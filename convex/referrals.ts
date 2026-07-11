import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Public queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return all referrals where the current user is the referrer, joined with
 * the referred user's public info.
 */
export const getMyReferrals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      referrals.map(async (ref) => {
        const referred = await ctx.db.get(ref.referredId);
        return {
          ...ref,
          referredUser: referred
            ? {
                name: referred.name ?? null,
                email: referred.email ?? null,
                image: referred.image ?? null,
                createdAt: referred.createdAt,
              }
            : null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Return aggregate referral statistics for the current user.
 */
export const getReferralStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .collect();

    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let totalEarned = 0;
    let pendingRewards = 0;

    for (const ref of referrals) {
      if (ref.status === "approved") {
        approved += 1;
        totalEarned += ref.rewardAmount;
      } else if (ref.status === "pending" || ref.status === "fee_paid") {
        pending += 1;
        pendingRewards += ref.rewardAmount;
      } else if (ref.status === "rejected") {
        rejected += 1;
      }
    }

    return {
      total: referrals.length,
      approved,
      pending,
      rejected,
      totalEarned,
      pendingRewards,
    };
  },
});

/* ------------------------------------------------------------------ */
/* User mutation: submit payment proof                                  */
/* ------------------------------------------------------------------ */

/**
 * Update the current user's referral record (where they are the referred
 * user) to status "fee_paid" and store the payment proof. Notifies admins.
 */
export const submitPaymentProof = mutation({
  args: { paymentProof: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", userId))
      .first();

    if (!referral) throw new Error("No referral record found for your account");
    if (referral.status === "approved") {
      throw new Error("Your referral has already been approved");
    }
    if (referral.status === "rejected") {
      throw new Error("Your referral has been rejected");
    }

    await ctx.db.patch(referral._id, {
      status: "fee_paid",
      paymentProof: args.paymentProof,
    });

    // Notify all admins.
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    for (const admin of admins) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: admin._id,
        title: "Payment Proof Submitted",
        body: `A user has submitted their registration fee payment proof for verification.`,
        type: "referral",
        referenceId: referral._id,
      });
    }

    return { success: true };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated list of all referrals with both referrer and referred
 * user info. Optional status filter.
 */
export const adminGetReferrals = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    status: v.optional(
      v.union(
        v.literal("pending"), v.literal("fee_paid"),
        v.literal("approved"), v.literal("rejected")
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
        .query("referrals")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const r of p.page) {
        if (args.status !== undefined && r.status !== args.status) continue;
        collected.push(r);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    const enriched = await Promise.all(
      page.map(async (r) => {
        const [referrer, referred] = await Promise.all([
          ctx.db.get(r.referrerId),
          ctx.db.get(r.referredId),
        ]);
        return {
          ...r,
          referrer: referrer
            ? {
                name: referrer.name ?? null,
                email: referrer.email ?? null,
                image: referrer.image ?? null,
              }
            : null,
          referredUser: referred
            ? {
                name: referred.name ?? null,
                email: referred.email ?? null,
                image: referred.image ?? null,
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
/* Admin mutations                                                      */
/* ------------------------------------------------------------------ */

/**
 * Admin: approve a referral. Rewards the referrer and notifies them.
 */
export const adminApproveReferral = mutation({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const now = Date.now();

    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.status === "approved") {
      throw new Error("Referral is already approved");
    }

    await ctx.db.patch(args.referralId, {
      status: "approved",
      approvedBy: adminId,
      approvedAt: now,
    });

    // Reward the referrer.
    await ctx.runMutation(internal.transactions.createTransaction, {
      userId: referral.referrerId,
      type: "referral_reward",
      amount: referral.rewardAmount,
      description: "Referral reward: approved referral",
      status: "completed",
      referenceId: args.referralId,
    });

    // Notify the referrer.
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: referral.referrerId,
      title: "Referral Approved!",
      body: `Your referral has been approved. You earned ₦${referral.rewardAmount.toFixed(2)}.`,
      type: "referral",
      referenceId: args.referralId,
    });

    await logAudit(
      ctx,
      "admin_approve_referral",
      "referrals",
      args.referralId,
      JSON.stringify({ adminId, referrerId: referral.referrerId, rewardAmount: referral.rewardAmount })
    );

    return { success: true };
  },
});

/**
 * Admin: reject a referral with an optional admin note. Notifies the
 * referred user.
 */
export const adminRejectReferral = mutation({
  args: {
    referralId: v.id("referrals"),
    adminNote: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.status === "rejected") {
      throw new Error("Referral is already rejected");
    }

    await ctx.db.patch(args.referralId, {
      status: "rejected",
      adminNote: args.adminNote,
    });

    // Notify the referred user.
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: referral.referredId,
      title: "Referral Update",
      body: `Your referral was not approved. Reason: ${args.adminNote}`,
      type: "referral",
      referenceId: args.referralId,
    });

    await logAudit(
      ctx,
      "admin_reject_referral",
      "referrals",
      args.referralId,
      JSON.stringify({ adminId, adminNote: args.adminNote })
    );

    return { success: true };
  },
});
