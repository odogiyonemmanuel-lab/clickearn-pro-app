import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* User queries                                                         */
/* ------------------------------------------------------------------ */

/**
 * Return the current user's post submissions, joined with the post info.
 */
export const getMySubmissions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const submissions = await ctx.db
      .query("postSubmissions")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      submissions.map(async (sub) => {
        const post = await ctx.db.get(sub.postId);
        return {
          ...sub,
          post: post ?? null,
        };
      })
    );

    return enriched;
  },
});

/**
 * Return the submission record for a given post.
 */
export const getSubmissionByPost = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const submission = await ctx.db
      .query("postSubmissions")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .first();

    return submission ?? null;
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated submissions with post and author info. Optional
 * reviewStatus filter.
 */
export const adminGetSubmissions = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    status: v.optional(
      v.union(
        v.literal("pending"), v.literal("in_review"),
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
        .query("postSubmissions")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const sub of p.page) {
        if (args.status !== undefined && sub.reviewStatus !== args.status) continue;
        collected.push(sub);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    const enriched = await Promise.all(
      page.map(async (sub) => {
        const [post, author] = await Promise.all([
          ctx.db.get(sub.postId),
          ctx.db.get(sub.authorId),
        ]);
        return {
          ...sub,
          post: post ?? null,
          author: author
            ? {
                name: author.name ?? null,
                email: author.email ?? null,
                image: author.image ?? null,
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
/* Admin mutation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Admin: update a submission's review status and optional notes.
 */
export const adminUpdateSubmissionStatus = mutation({
  args: {
    submissionId: v.id("postSubmissions"),
    reviewStatus: v.union(
      v.literal("pending"), v.literal("in_review"),
      v.literal("approved"), v.literal("rejected")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) throw new Error("Submission not found");

    const patch: Record<string, any> = {
      reviewStatus: args.reviewStatus,
      reviewerId: adminId,
      reviewedAt: Date.now(),
    };
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(args.submissionId, patch);

    await logAudit(
      ctx,
      "admin_update_submission",
      "postSubmissions",
      args.submissionId,
      JSON.stringify({ adminId, reviewStatus: args.reviewStatus, notes: args.notes })
    );

    return { success: true };
  },
});
