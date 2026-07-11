import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import {
  getAuthUserId,
  requireAdmin,
  generateReferralCode,
  logAudit,
} from "./helpers";

/* ------------------------------------------------------------------ */
/* Current user                                                        */
/* ------------------------------------------------------------------ */

/**
 * Returns the current user document joined with their wallet document.
 * Returns null when not authenticated.
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return { user, wallet: wallet ?? null };
  },
});

/* ------------------------------------------------------------------ */
/* Public profile                                                      */
/* ------------------------------------------------------------------ */

/**
 * Return a public profile for a given user id.
 */
export const getUserProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      referralCode: user.referralCode,
      createdAt: user.createdAt,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Profile updates                                                     */
/* ------------------------------------------------------------------ */

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const patch: Record<string, string> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.phone !== undefined) patch.phone = args.phone;
    if (args.image !== undefined) patch.image = args.image;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(userId, patch);
    }

    return { success: true };
  },
});

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

export const getMyWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return wallet ?? null;
  },
});

/* ------------------------------------------------------------------ */
/* New user initialization                                             */
/* ------------------------------------------------------------------ */

export const initializeNewUser = mutation({
  args: {
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // 1. Create wallet with zero balances if it doesn't exist.
    const existingWallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existingWallet) {
      await ctx.db.insert("wallets", {
        userId,
        available: 0,
        pending: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
      });
    }

    // 2. Generate a unique referral code with a retry loop.
    let referralCode = user.referralCode;
    if (!referralCode) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = generateReferralCode();
        const clash = await ctx.db
          .query("users")
          .withIndex("by_referral_code", (q) => q.eq("referralCode", candidate))
          .first();
        if (!clash) {
          referralCode = candidate;
          break;
        }
      }
      if (!referralCode) {
        throw new Error("Failed to generate unique referral code");
      }
      await ctx.db.patch(userId, { referralCode });
    }

    // 3. Create welcome notification.
    await ctx.db.insert("notifications", {
      userId,
      title: "Welcome to ClickEarn Pro!",
      body: "Your account has been created. Complete your registration to start earning.",
      type: "info",
      isRead: false,
      createdAt: Date.now(),
    });

    // 4. If a referral code was provided, locate the referrer and create
    //    a pending referral record.
    if (args.referralCode) {
      const referrer = await ctx.db
        .query("users")
        .withIndex("by_referral_code", (q) =>
          q.eq("referralCode", args.referralCode as string)
        )
        .first();

      if (referrer && referrer._id !== userId) {
        // Make sure a referral record does not already exist for this pair.
        const existingReferral = await ctx.db
          .query("referrals")
          .withIndex("by_referred", (q) => q.eq("referredId", userId))
          .first();

        if (!existingReferral) {
          await ctx.db.insert("referrals", {
            referrerId: referrer._id,
            referredId: userId,
            status: "pending",
            registrationFeeAmount: 0,
            rewardAmount: 0,
            createdAt: Date.now(),
          });

          await ctx.db.patch(userId, { referredBy: referrer._id });
        }
      }
    }
  },
});

/* ------------------------------------------------------------------ */
/* User stats                                                          */
/* ------------------------------------------------------------------ */

export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // taskCompletions: count of completed task completions.
    let taskCompletions = 0;
    let completedTasksEarned = 0;
    {
      let cursor: string | null = null;
      do {
        const page = await ctx.db
          .query("taskCompletions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .paginate({ numItems: 100, cursor: cursor ?? null });
        for (const tc of page.page) {
          if (tc.status === "completed") {
            taskCompletions += 1;
            completedTasksEarned += tc.reward;
          }
        }
        cursor = page.continueCursor;
        if (page.isDone) break;
      } while (cursor);
    }

    // referralCount: number of referrals created by this user (any status).
    let referralCount = 0;
    {
      let cursor: string | null = null;
      do {
        const page = await ctx.db
          .query("referrals")
          .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
          .paginate({ numItems: 100, cursor: cursor ?? null });
        referralCount += page.page.length;
        cursor = page.continueCursor;
        if (page.isDone) break;
      } while (cursor);
    }

    // referralEarnings + totalEarned from transactions.
    let referralEarnings = 0;
    let totalEarned = 0;
    {
      let cursor: string | null = null;
      do {
        const page = await ctx.db
          .query("transactions")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .paginate({ numItems: 100, cursor: cursor ?? null });
        for (const t of page.page) {
          if (t.status === "completed") {
            if (t.type === "referral_reward") {
              referralEarnings += t.amount;
            }
            if (
              t.type === "referral_reward" ||
              t.type === "task_reward" ||
              t.type === "daily_bonus" ||
              t.type === "read_reward" ||
              t.type === "watch_reward" ||
              t.type === "blog_reward" ||
              t.type === "admin_credit"
            ) {
              totalEarned += t.amount;
            }
          }
        }
        cursor = page.continueCursor;
        if (page.isDone) break;
      } while (cursor);
    }

    // Prefer the wallet's totalEarned if available (authoritative).
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (wallet) {
      totalEarned = wallet.totalEarned;
    }

    return {
      taskCompletions,
      referralCount,
      referralEarnings,
      totalEarned,
      completedTasks: taskCompletions,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Admin: list users (paginated with optional filters)                 */
/* ------------------------------------------------------------------ */

export const adminGetUsers = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
    isActive: v.optional(v.boolean()),
    isBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let page: any[] = [];
    let isDone = false;
    let continueCursor: string = "";
    let total = 0;

    // Convex's paginate only works on a single index. We paginate the
    // whole table (creation order) and apply filters in-memory.
    let cursor: string | null = args.paginationOpts.cursor;

    // First, compute total matching count (single pass over the table).
    {
      let countCursor: string | null = null;
      do {
        const p = await ctx.db
          .query("users")
          .paginate({ numItems: 100, cursor: countCursor });
        for (const u of p.page) {
          if (args.role !== undefined && u.role !== args.role) continue;
          if (args.isActive !== undefined && u.isActive !== args.isActive) continue;
          if (args.isBanned !== undefined && u.isBanned !== args.isBanned) continue;
          total += 1;
        }
        countCursor = p.continueCursor;
        if (p.isDone) break;
      } while (countCursor);
    }

    // Now fetch the requested page, filtering in-memory.
    const numItems = args.paginationOpts.numItems;
    let collected: any[] = [];
    let done = false;

    while (!done && collected.length < numItems) {
      const p = await ctx.db
        .query("users")
        .paginate({ numItems: 100, cursor });
      for (const u of p.page) {
        if (args.role !== undefined && u.role !== args.role) continue;
        if (args.isActive !== undefined && u.isActive !== args.isActive) continue;
        if (args.isBanned !== undefined && u.isBanned !== args.isBanned) continue;
        collected.push(u);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) {
        done = true;
      }
    }

    page = collected.slice(0, numItems);
    isDone = done && collected.length <= numItems;
    continueCursor = cursor ?? "";

    return { page, isDone, continueCursor, total };
  },
});

/* ------------------------------------------------------------------ */
/* Admin: update user                                                  */
/* ------------------------------------------------------------------ */

export const adminUpdateUser = mutation({
  args: {
    userId: v.id("users"),
    isBanned: v.optional(v.boolean()),
    banReason: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    role: v.optional(v.union(v.literal("user"), v.literal("admin"))),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const patch: Record<string, any> = {};
    if (args.isBanned !== undefined) patch.isBanned = args.isBanned;
    if (args.banReason !== undefined) patch.banReason = args.banReason;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.role !== undefined) patch.role = args.role;

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.userId, patch);
    }

    await logAudit(
      ctx,
      "admin_update_user",
      "users",
      args.userId,
      JSON.stringify({ adminId, patch })
    );

    return { success: true };
  },
});

/* ------------------------------------------------------------------ */
/* Admin: credit wallet                                                */
/* ------------------------------------------------------------------ */

export const adminCreditWallet = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    await ctx.scheduler.runAfter(0, internal.transactions.createTransaction, {
      userId: args.userId,
      type: args.amount >= 0 ? "admin_credit" : "admin_debit",
      amount: Math.abs(args.amount),
      description: args.description,
      status: "completed",
    });

    await logAudit(
      ctx,
      "admin_credit_wallet",
      "users",
      args.userId,
      JSON.stringify({
        adminId,
        amount: args.amount,
        description: args.description,
      })
    );

    return { success: true };
  },
});
