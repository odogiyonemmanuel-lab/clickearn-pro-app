import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./helpers";

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
/* Daily bonus                                                          */
/* ------------------------------------------------------------------ */

/**
 * Claim the daily bonus. Enforces a cooldown read from settings
 * (daily_bonus_cooldown_hours, default 24).
 */
export const claimDailyBonus = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const cooldownHours = await getNumberSetting(
      ctx,
      "daily_bonus_cooldown_hours",
      24
    );
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    const lastClaim = await ctx.db
      .query("dailyBonusClaims")
      .withIndex("by_user_claimed", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (lastClaim && now - lastClaim.claimedAt < cooldownMs) {
      const nextAvailableAt = lastClaim.claimedAt + cooldownMs;
      throw new Error(
        `Daily bonus already claimed. Next available at ${new Date(nextAvailableAt).toISOString()}`
      );
    }

    const amount = await getNumberSetting(ctx, "daily_bonus", 50);

    const claimId = await ctx.db.insert("dailyBonusClaims", {
      userId,
      amount,
      claimedAt: now,
    });

    await ctx.runMutation(internal.transactions.createTransaction, {
      userId,
      type: "daily_bonus",
      amount,
      description: "Daily bonus claim",
      status: "completed",
      referenceId: claimId,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId,
      title: "Daily Bonus Claimed!",
      body: `You earned ₦${amount.toFixed(2)} from your daily bonus.`,
      type: "reward",
      referenceId: claimId,
    });

    return { amount };
  },
});

/**
 * Return the current user's daily bonus claim status.
 */
export const getMyDailyBonusStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const cooldownHours = await getNumberSetting(
      ctx,
      "daily_bonus_cooldown_hours",
      24
    );
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    const lastClaim = await ctx.db
      .query("dailyBonusClaims")
      .withIndex("by_user_claimed", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!lastClaim) {
      return {
        canClaim: true,
        nextClaimAt: null,
        lastClaim: null,
      };
    }

    const nextClaimAt = lastClaim.claimedAt + cooldownMs;
    const canClaim = now >= nextClaimAt;

    return {
      canClaim,
      nextClaimAt: canClaim ? null : nextClaimAt,
      lastClaim: {
        amount: lastClaim.amount,
        claimedAt: lastClaim.claimedAt,
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* News read tracking & reward                                          */
/* ------------------------------------------------------------------ */

/**
 * Record that the current user has opened a news article. Creates a
 * newsReads doc with rewarded=false if one does not already exist.
 */
export const trackNewsRead = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const existing = await ctx.db
      .query("newsReads")
      .withIndex("by_user_news", (q) =>
        q.eq("userId", userId).eq("newsId", args.newsId)
      )
      .first();

    if (existing) return { success: true, alreadyTracked: true };

    await ctx.db.insert("newsReads", {
      userId,
      newsId: args.newsId,
      rewarded: false,
      readAt: Date.now(),
    });

    return { success: true, alreadyTracked: false };
  },
});

/**
 * Claim the reward for reading a news article. Requires that enough time
 * has elapsed since the read started (readAt + requiredReadSeconds <= now).
 */
export const claimNewsReward = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const news = await ctx.db.get(args.newsId);
    if (!news) throw new Error("News article not found");

    const read = await ctx.db
      .query("newsReads")
      .withIndex("by_user_news", (q) =>
        q.eq("userId", userId).eq("newsId", args.newsId)
      )
      .first();

    if (!read) {
      throw new Error("You must read this article first");
    }
    if (read.rewarded) {
      throw new Error("Reward already claimed for this article");
    }

    const eligibleAt = read.readAt + news.requiredReadSeconds * 1000;
    if (now < eligibleAt) {
      throw new Error("You have not read this article long enough to earn the reward");
    }

    await ctx.db.patch(read._id, { rewarded: true });

    await ctx.db.patch(args.newsId, {
      totalReaders: news.totalReaders + 1,
    });

    await ctx.runMutation(internal.transactions.createTransaction, {
      userId,
      type: "read_reward",
      amount: news.readReward,
      description: `Read reward: ${news.title}`,
      status: "completed",
      referenceId: args.newsId,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId,
      title: "Read Reward Earned!",
      body: `You earned ₦${news.readReward.toFixed(2)} for reading "${news.title}".`,
      type: "reward",
      referenceId: args.newsId,
    });

    return { reward: news.readReward };
  },
});

/* ------------------------------------------------------------------ */
/* Job read tracking & reward                                           */
/* ------------------------------------------------------------------ */

/**
 * Record that the current user has opened a job posting. Creates a
 * jobReads doc with rewarded=false if one does not already exist.
 */
export const trackJobRead = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const existing = await ctx.db
      .query("jobReads")
      .withIndex("by_user_job", (q) =>
        q.eq("userId", userId).eq("jobId", args.jobId)
      )
      .first();

    if (existing) return { success: true, alreadyTracked: true };

    await ctx.db.insert("jobReads", {
      userId,
      jobId: args.jobId,
      rewarded: false,
      readAt: Date.now(),
    });

    return { success: true, alreadyTracked: false };
  },
});

/**
 * Claim the reward for reading a job posting. Requires that enough time
 * has elapsed since the read started (readAt + requiredReadSeconds <= now).
 */
export const claimJobReward = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    const read = await ctx.db
      .query("jobReads")
      .withIndex("by_user_job", (q) =>
        q.eq("userId", userId).eq("jobId", args.jobId)
      )
      .first();

    if (!read) {
      throw new Error("You must read this job posting first");
    }
    if (read.rewarded) {
      throw new Error("Reward already claimed for this job");
    }

    const eligibleAt = read.readAt + job.requiredReadSeconds * 1000;
    if (now < eligibleAt) {
      throw new Error("You have not read this job long enough to earn the reward");
    }

    await ctx.db.patch(read._id, { rewarded: true });

    await ctx.db.patch(args.jobId, {
      totalReaders: job.totalReaders + 1,
    });

    await ctx.runMutation(internal.transactions.createTransaction, {
      userId,
      type: "read_reward",
      amount: job.readReward,
      description: `Read reward: ${job.title}`,
      status: "completed",
      referenceId: args.jobId,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId,
      title: "Read Reward Earned!",
      body: `You earned ₦${job.readReward.toFixed(2)} for reading the job "${job.title}".`,
      type: "reward",
      referenceId: args.jobId,
    });

    return { reward: job.readReward };
  },
});

/* ------------------------------------------------------------------ */
/* Read status query                                                    */
/* ------------------------------------------------------------------ */

/**
 * Return the current user's read status for a news article or job posting.
 */
export const getReadStatus = query({
  args: {
    newsId: v.optional(v.id("news")),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (args.newsId) {
      const read = await ctx.db
        .query("newsReads")
        .withIndex("by_user_news", (q) =>
          q.eq("userId", userId).eq("newsId", args.newsId as any)
        )
        .first();
      return {
        rewarded: read ? read.rewarded : false,
        readAt: read ? read.readAt : null,
      };
    }

    if (args.jobId) {
      const read = await ctx.db
        .query("jobReads")
        .withIndex("by_user_job", (q) =>
          q.eq("userId", userId).eq("jobId", args.jobId as any)
        )
        .first();
      return {
        rewarded: read ? read.rewarded : false,
        readAt: read ? read.readAt : null,
      };
    }

    return { rewarded: false, readAt: null };
  },
});
