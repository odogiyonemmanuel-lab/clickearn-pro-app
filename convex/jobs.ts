import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Public queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return paginated published, non-expired jobs. Optional type filter and limit.
 */
export const getPublishedJobs = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("full_time"), v.literal("part_time"),
        v.literal("contract"), v.literal("remote"), v.literal("internship")
      )
    ),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const numItems = args.limit ?? 20;
    let cursor: string | null = args.cursor ?? null;

    let collected: any[] = [];
    let done = false;

    while (!done && collected.length < numItems) {
      const p = await ctx.db
        .query("jobs")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const job of p.page) {
        // Skip expired jobs.
        if (job.expiresAt !== undefined && job.expiresAt < now) continue;
        if (args.type !== undefined && job.type !== args.type) continue;
        collected.push(job);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    return {
      page,
      isDone: done && collected.length <= numItems,
      continueCursor: cursor ?? "",
    };
  },
});

/**
 * Return a single job by id.
 */
export const getJobById = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    return job ?? null;
  },
});

/* ------------------------------------------------------------------ */
/* Public mutation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Increment a job's view count by 1.
 */
export const incrementJobViews = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await ctx.db.patch(args.jobId, {
      views: job.views + 1,
    });

    return { success: true, views: job.views + 1 };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated list of all jobs (any published state).
 */
export const adminGetJobs = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const result = await ctx.db
      .query("jobs")
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
/* Admin mutations                                                      */
/* ------------------------------------------------------------------ */

/**
 * Admin: create a job posting.
 */
export const adminCreateJob = mutation({
  args: {
    title: v.string(),
    company: v.string(),
    location: v.string(),
    type: v.union(
      v.literal("full_time"), v.literal("part_time"),
      v.literal("contract"), v.literal("remote"), v.literal("internship")
    ),
    salary: v.optional(v.string()),
    description: v.string(),
    requirements: v.string(),
    applyUrl: v.optional(v.string()),
    readReward: v.number(),
    requiredReadSeconds: v.number(),
    isPublished: v.boolean(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const jobId = await ctx.db.insert("jobs", {
      title: args.title,
      company: args.company,
      location: args.location,
      type: args.type,
      salary: args.salary,
      description: args.description,
      requirements: args.requirements,
      applyUrl: args.applyUrl,
      readReward: args.readReward,
      requiredReadSeconds: args.requiredReadSeconds,
      isPublished: args.isPublished,
      publishedBy: adminId,
      views: 0,
      totalReaders: 0,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
    });

    await logAudit(
      ctx,
      "admin_create_job",
      "jobs",
      jobId,
      JSON.stringify({ adminId, title: args.title, company: args.company })
    );

    return { jobId };
  },
});

/**
 * Admin: update any subset of a job's fields.
 */
export const adminUpdateJob = mutation({
  args: {
    jobId: v.id("jobs"),
    title: v.optional(v.string()),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("full_time"), v.literal("part_time"),
        v.literal("contract"), v.literal("remote"), v.literal("internship")
      )
    ),
    salary: v.optional(v.string()),
    description: v.optional(v.string()),
    requirements: v.optional(v.string()),
    applyUrl: v.optional(v.string()),
    readReward: v.optional(v.number()),
    requiredReadSeconds: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    const patch: Record<string, any> = {};
    for (const key of [
      "title", "company", "location", "type", "salary", "description",
      "requirements", "applyUrl", "readReward", "requiredReadSeconds",
      "expiresAt",
    ] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.jobId, patch);
    }

    await logAudit(
      ctx,
      "admin_update_job",
      "jobs",
      args.jobId,
      JSON.stringify({ adminId, patch })
    );

    return { success: true };
  },
});

/**
 * Admin: toggle a job's published state.
 */
export const adminTogglePublish = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    await ctx.db.patch(args.jobId, { isPublished: !job.isPublished });

    await logAudit(
      ctx,
      "admin_toggle_publish_job",
      "jobs",
      args.jobId,
      JSON.stringify({ adminId, isPublished: !job.isPublished })
    );

    return { success: true, isPublished: !job.isPublished };
  },
});
