import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin } from "./helpers";

/* ------------------------------------------------------------------ */
/* Wallet update helper                                                 */
/* ------------------------------------------------------------------ */

// Credit types that increase available balance + totalEarned.
const CREDIT_TYPES = new Set([
  "referral_reward",
  "task_reward",
  "daily_bonus",
  "read_reward",
  "watch_reward",
  "blog_reward",
  "admin_credit",
]);

/**
 * Apply the wallet balance change corresponding to a transaction type.
 * Returns the updated wallet document.
 *
 * Rules:
 *  - credit types (referral_reward, task_reward, daily_bonus, read_reward,
 *    watch_reward, blog_reward, admin_credit): add to available and totalEarned.
 *  - cashout (pending): move from available to pending.
 *  - cashout approved (completed): subtract from pending, add to totalWithdrawn.
 *  - cashout_rejected: move from pending back to available.
 *  - admin_debit: subtract from available.
 *  - registration_fee: no wallet change (fee is external).
 */
async function applyWalletChange(
  ctx: any,
  userId: string,
  type: string,
  amount: number,
  status: string
): Promise<any> {
  const wallet = await ctx.db
    .query("wallets")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!wallet) {
    throw new Error("Wallet not found for user");
  }

  // No wallet change for registration fees.
  if (type === "registration_fee") {
    return wallet;
  }

  const patch: Record<string, number> = {};

  if (CREDIT_TYPES.has(type) && status === "completed") {
    patch.available = wallet.available + amount;
    patch.totalEarned = wallet.totalEarned + amount;
  } else if (type === "cashout" && status === "pending") {
    // Move from available into pending.
    if (wallet.available < amount) {
      throw new Error("Insufficient available balance for cashout");
    }
    patch.available = wallet.available - amount;
    patch.pending = wallet.pending + amount;
  } else if (type === "cashout" && status === "completed") {
    // Cashout approved: subtract from pending, add to totalWithdrawn.
    if (wallet.pending < amount) {
      throw new Error("Insufficient pending balance for cashout approval");
    }
    patch.pending = wallet.pending - amount;
    patch.totalWithdrawn = wallet.totalWithdrawn + amount;
  } else if (type === "cashout_rejected") {
    // Move from pending back to available.
    patch.pending = Math.max(0, wallet.pending - amount);
    patch.available = wallet.available + amount;
  } else if (type === "cashout" && status === "failed") {
    // Failed cashout: return pending back to available.
    patch.pending = Math.max(0, wallet.pending - amount);
    patch.available = wallet.available + amount;
  } else if (type === "admin_debit" && status === "completed") {
    if (wallet.available < amount) {
      throw new Error("Insufficient available balance for debit");
    }
    patch.available = wallet.available - amount;
  }
  // Other type/status combinations: no wallet change.

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(wallet._id, patch);
  }

  return { ...wallet, ...patch };
}

/* ------------------------------------------------------------------ */
/* Reads                                                                */
/* ------------------------------------------------------------------ */

/**
 * Return paginated transactions for the current user, newest first.
 */
export const getMyTransactions = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const numItems = args.limit ?? 20;
    const cursor = args.cursor ?? null;

    const result = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ numItems, cursor });

    return {
      page: result.page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Return transactions for the current user filtered by type.
 */
export const getMyTransactionsByType = query({
  args: {
    type: v.union(
      v.literal("referral_reward"), v.literal("task_reward"),
      v.literal("daily_bonus"), v.literal("read_reward"),
      v.literal("watch_reward"), v.literal("blog_reward"),
      v.literal("cashout"), v.literal("cashout_rejected"),
      v.literal("admin_credit"), v.literal("admin_debit"),
      v.literal("registration_fee")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const result = await ctx.db
      .query("transactions")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", args.type)
      )
      .order("desc")
      .take(args.limit ?? 50);

    return result;
  },
});

/* ------------------------------------------------------------------ */
/* Admin reads                                                          */
/* ------------------------------------------------------------------ */

export const adminGetAllTransactions = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    userId: v.optional(v.id("users")),
    type: v.optional(
      v.union(
        v.literal("referral_reward"), v.literal("task_reward"),
        v.literal("daily_bonus"), v.literal("read_reward"),
        v.literal("watch_reward"), v.literal("blog_reward"),
        v.literal("cashout"), v.literal("cashout_rejected"),
        v.literal("admin_credit"), v.literal("admin_debit"),
        v.literal("registration_fee")
      )
    ),
    status: v.optional(
      v.union(v.literal("completed"), v.literal("pending"), v.literal("failed"))
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Build the base query using the best available index.
    let q: any;
    if (args.userId) {
      q = ctx.db
        .query("transactions")
        .withIndex("by_user", (q2) => q2.eq("userId", args.userId as any));
    } else {
      q = ctx.db.query("transactions").withIndex("by_created");
    }

    const numItems = args.paginationOpts.numItems;
    const cursor = args.paginationOpts.cursor;

    // Paginate in creation order, newest first when not filtering by user.
    const ordered = args.userId ? q : q.order("desc");

    let page: any[] = [];
    let isDone = false;
    let continueCursor: string = "";
    let total = 0;

    // Count total matching in a single pass.
    {
      let countCursor: string | null = null;
      do {
        const p = await (args.userId ? q : q.order("desc")).paginate({
          numItems: 100,
          cursor: countCursor,
        });
        for (const t of p.page) {
          if (args.type !== undefined && t.type !== args.type) continue;
          if (args.status !== undefined && t.status !== args.status) continue;
          total += 1;
        }
        countCursor = p.continueCursor;
        if (p.isDone) break;
      } while (countCursor);
    }

    // Fetch the requested page, applying in-memory filters.
    let collected: any[] = [];
    let done = false;
    let pageCursor: string | null = cursor;
    while (!done && collected.length < numItems) {
      const p = await (args.userId ? q : q.order("desc")).paginate({
        numItems: 100,
        cursor: pageCursor,
      });
      for (const t of p.page) {
        if (args.type !== undefined && t.type !== args.type) continue;
        if (args.status !== undefined && t.status !== args.status) continue;
        collected.push(t);
        if (collected.length >= numItems) break;
      }
      pageCursor = p.continueCursor;
      if (p.isDone) {
        done = true;
      }
    }

    page = collected.slice(0, numItems);
    isDone = done && collected.length <= numItems;
    continueCursor = pageCursor ?? "";

    // Join user info for each transaction.
    const enriched = await Promise.all(
      page.map(async (t) => {
        const user = await ctx.db.get(t.userId);
        return {
          ...t,
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

    return { page: enriched, isDone, continueCursor, total };
  },
});

/* ------------------------------------------------------------------ */
/* Internal mutation: create transaction + update wallet atomically    */
/* ------------------------------------------------------------------ */

export const createTransaction = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("referral_reward"), v.literal("task_reward"),
      v.literal("daily_bonus"), v.literal("read_reward"),
      v.literal("watch_reward"), v.literal("blog_reward"),
      v.literal("cashout"), v.literal("cashout_rejected"),
      v.literal("admin_credit"), v.literal("admin_debit"),
      v.literal("registration_fee")
    ),
    amount: v.number(),
    description: v.string(),
    status: v.union(
      v.literal("completed"), v.literal("pending"), v.literal("failed")
    ),
    referenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Insert the transaction first.
    const transactionId = await ctx.db.insert("transactions", {
      userId: args.userId,
      type: args.type,
      amount: args.amount,
      description: args.description,
      status: args.status,
      referenceId: args.referenceId,
      createdAt: now,
    });

    // Update the wallet balance based on the transaction type/status.
    const wallet = await applyWalletChange(
      ctx,
      args.userId,
      args.type,
      args.amount,
      args.status
    );

    return { transactionId, wallet };
  },
});
