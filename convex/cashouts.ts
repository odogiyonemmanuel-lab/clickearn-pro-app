import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Read a numeric setting by key, returning the default when missing.
 */
async function getNumberSetting(
  ctx: any,
  key: string,
  defaultValue: number
): Promise<number> {
  const doc = await ctx.db
    .query("settings")
    .withIndex("by_key", (q: any) => q.eq("key", key))
    .first();
  if (!doc) return defaultValue;
  const parsed = Number(doc.value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/* ------------------------------------------------------------------ */
/* User mutation: request a cashout                                     */
/* ------------------------------------------------------------------ */

/**
 * Request a cashout. Validates auth, minimum amount, and available balance.
 * Creates the cashout record, a pending transaction, and moves funds from
 * available to pending in the wallet.
 */
export const requestCashout = mutation({
  args: {
    amount: v.number(),
    accountName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    if (args.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    const minCashout = await getNumberSetting(ctx, "min_cashout", 1000);
    if (args.amount < minCashout) {
      throw new Error(`Minimum cashout amount is ₦${minCashout.toFixed(2)}`);
    }

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!wallet) throw new Error("Wallet not found");
    if (wallet.available < args.amount) {
      throw new Error("Insufficient available balance");
    }

    // Create the cashout record.
    const cashoutId = await ctx.db.insert("cashouts", {
      userId,
      amount: args.amount,
      accountName: args.accountName,
      accountNumber: args.accountNumber,
      bankName: args.bankName,
      status: "pending",
      createdAt: now,
    });

    // Create a pending cashout transaction (moves available -> pending).
    await ctx.runMutation(internal.transactions.createTransaction, {
      userId,
      type: "cashout",
      amount: args.amount,
      description: `Cashout request to ${args.bankName} (${args.accountNumber})`,
      status: "pending",
      referenceId: cashoutId,
    });

    // Notify the user.
    await ctx.runMutation(internal.notifications.createNotification, {
      userId,
      title: "Cashout Requested",
      body: `Your cashout request of ₦${args.amount.toFixed(2)} has been submitted and is pending review.`,
      type: "cashout",
      referenceId: cashoutId,
    });

    return { cashoutId };
  },
});

/* ------------------------------------------------------------------ */
/* User query: my cashouts                                              */
/* ------------------------------------------------------------------ */

/**
 * Return paginated cashouts for the current user, newest first.
 */
export const getMyCashouts = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const result = await ctx.db
      .query("cashouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({
        numItems: args.paginationOpts.numItems,
        cursor: args.paginationOpts.cursor,
      });

    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated cashouts with user info. Optional status filter.
 */
export const adminGetCashouts = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    status: v.optional(
      v.union(
        v.literal("pending"), v.literal("approved"), v.literal("rejected")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const numItems = args.paginationOpts.numItems;
    let cursor: string | null = args.paginationOpts.cursor;

    let collected: any[] = [];
    let done = false;

    while (!done && collected.length < numItems) {
      const p = await ctx.db
        .query("cashouts")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const c of p.page) {
        if (args.status !== undefined && c.status !== args.status) continue;
        collected.push(c);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    const enriched = await Promise.all(
      page.map(async (c) => {
        const user = await ctx.db.get(c.userId);
        return {
          ...c,
          user: user
            ? {
                name: user.name ?? null,
                email: user.email ?? null,
                image: user.image ?? null,
              }
            : null,
        };
      })
    );

    return {
      page: enriched,
      isDone: done && collected.length <= numItems,
      continueCursor: cursor ?? "",
    };
  },
});

/* ------------------------------------------------------------------ */
/* Admin mutation: process a cashout                                    */
/* ------------------------------------------------------------------ */

/**
 * Admin: approve or reject a cashout. Updates the cashout record, creates
 * the appropriate transaction, updates the wallet, and notifies the user.
 */
export const adminProcessCashout = mutation({
  args: {
    cashoutId: v.id("cashouts"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const now = Date.now();

    const cashout = await ctx.db.get(args.cashoutId);
    if (!cashout) throw new Error("Cashout not found");
    if (cashout.status !== "pending") {
      throw new Error(`Cashout already ${cashout.status}`);
    }

    if (args.action === "approve") {
      await ctx.db.patch(args.cashoutId, {
        status: "approved",
        processedBy: adminId,
        processedAt: now,
        adminNote: args.adminNote,
      });

      // Completed cashout transaction: pending -> totalWithdrawn.
      await ctx.runMutation(internal.transactions.createTransaction, {
        userId: cashout.userId,
        type: "cashout",
        amount: cashout.amount,
        description: `Cashout approved: ${cashout.bankName} (${cashout.accountNumber})`,
        status: "completed",
        referenceId: args.cashoutId,
      });

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: cashout.userId,
        title: "Cashout Approved!",
        body: `Your cashout of ₦${cashout.amount.toFixed(2)} has been approved and paid out.`,
        type: "cashout",
        referenceId: args.cashoutId,
      });

      await logAudit(
        ctx,
        "admin_approve_cashout",
        "cashouts",
        args.cashoutId,
        JSON.stringify({ adminId, amount: cashout.amount })
      );
    } else {
      // Reject: return funds from pending back to available.
      await ctx.db.patch(args.cashoutId, {
        status: "rejected",
        processedBy: adminId,
        processedAt: now,
        adminNote: args.adminNote,
      });

      await ctx.runMutation(internal.transactions.createTransaction, {
        userId: cashout.userId,
        type: "cashout_rejected",
        amount: cashout.amount,
        description: `Cashout rejected${args.adminNote ? `: ${args.adminNote}` : ""}`,
        status: "completed",
        referenceId: args.cashoutId,
      });

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: cashout.userId,
        title: "Cashout Rejected",
        body: `Your cashout request of ₦${cashout.amount.toFixed(2)} was rejected.${args.adminNote ? ` Reason: ${args.adminNote}` : ""}`,
        type: "cashout",
        referenceId: args.cashoutId,
      });

      await logAudit(
        ctx,
        "admin_reject_cashout",
        "cashouts",
        args.cashoutId,
        JSON.stringify({ adminId, amount: cashout.amount, adminNote: args.adminNote })
      );
    }

    return { success: true };
  },
});
