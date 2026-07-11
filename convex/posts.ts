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
/* User mutations                                                       */
/* ------------------------------------------------------------------ */

/**
 * Submit a new blog post for review. Creates a post (status pending) and a
 * matching postSubmissions record. Notifies admins.
 */
export const submitPost = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    summary: v.string(),
    category: v.union(
      v.literal("news"), v.literal("job"), v.literal("article"),
      v.literal("review"), v.literal("tutorial")
    ),
    imageUrl: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const postId = await ctx.db.insert("posts", {
      authorId: userId,
      title: args.title,
      content: args.content,
      summary: args.summary,
      category: args.category,
      imageUrl: args.imageUrl,
      tags: args.tags,
      status: "pending",
      reward: 0,
      views: 0,
      createdAt: now,
    });

    await ctx.db.insert("postSubmissions", {
      postId,
      authorId: userId,
      submittedAt: now,
      reviewStatus: "pending",
    });

    // Notify all admins.
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    for (const admin of admins) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: admin._id,
        title: "New Post Submission",
        body: `A new post "${args.title}" has been submitted and is awaiting review.`,
        type: "info",
        referenceId: postId,
      });
    }

    return { postId };
  },
});

/**
 * Return paginated posts authored by the current user, newest first.
 */
export const getMyPosts = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const result = await ctx.db
      .query("posts")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
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

/**
 * Return paginated published posts (status published or approved).
 */
export const getPublishedPosts = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const numItems = args.paginationOpts.numItems;
    let cursor: string | null = args.paginationOpts.cursor;

    let collected: any[] = [];
    let done = false;

    while (!done && collected.length < numItems) {
      const p = await ctx.db
        .query("posts")
        .withIndex("by_created")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const post of p.page) {
        if (post.status !== "published" && post.status !== "approved") continue;
        collected.push(post);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    // Attach author info.
    const enriched = await Promise.all(
      page.map(async (post) => {
        const author = await ctx.db.get(post.authorId);
        return {
          ...post,
          author: author
            ? {
                name: author.name ?? null,
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

/**
 * Return a single post. If the post is not published/approved, only the
 * author or an admin may view it.
 */
export const getPostById = query({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) return null;

    const isPublic = post.status === "published" || post.status === "approved";
    if (isPublic) return post;

    // Non-public post: require author or admin.
    const userId = await getAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (post.authorId === userId || user?.role === "admin") {
      return post;
    }

    throw new Error("You do not have permission to view this post");
  },
});

/**
 * Author-only: update a post. Only allowed while the post is pending.
 */
export const updatePost = mutation({
  args: {
    postId: v.id("posts"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    summary: v.optional(v.string()),
    category: v.optional(
      v.union(
        v.literal("news"), v.literal("job"), v.literal("article"),
        v.literal("review"), v.literal("tutorial")
      )
    ),
    imageUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.authorId !== userId) {
      throw new Error("Forbidden: you can only edit your own posts");
    }
    if (post.status !== "pending") {
      throw new Error("You can only edit posts that are pending review");
    }

    const patch: Record<string, any> = {};
    for (const key of ["title", "content", "summary", "category", "imageUrl", "tags"] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.postId, patch);
    }

    return { success: true };
  },
});

/**
 * Author-only: delete a post. Only allowed if the post has not been
 * published.
 */
export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.authorId !== userId) {
      throw new Error("Forbidden: you can only delete your own posts");
    }
    if (post.status === "published") {
      throw new Error("Published posts cannot be deleted");
    }

    await ctx.db.delete(args.postId);

    // Also remove the associated submission record.
    const submission = await ctx.db
      .query("postSubmissions")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .first();
    if (submission) {
      await ctx.db.delete(submission._id);
    }

    return { success: true };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated posts with author info. Optional status filter.
 */
export const adminGetPosts = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    status: v.optional(
      v.union(
        v.literal("pending"), v.literal("approved"),
        v.literal("rejected"), v.literal("published")
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
        .query("posts")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const post of p.page) {
        if (args.status !== undefined && post.status !== args.status) continue;
        collected.push(post);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    const enriched = await Promise.all(
      page.map(async (post) => {
        const author = await ctx.db.get(post.authorId);
        return {
          ...post,
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
/* Admin mutation: review a post                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: approve or reject a post. On approve, reads blog_reward from
 * settings, sets the reward, publishes the post, updates the submission,
 * rewards the author, and notifies them. On reject, marks rejected and
 * notifies the author.
 */
export const adminReviewPost = mutation({
  args: {
    postId: v.id("posts"),
    action: v.union(v.literal("approve"), v.literal("reject")),
    adminNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const now = Date.now();

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const submission = await ctx.db
      .query("postSubmissions")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .first();

    if (args.action === "approve") {
      const reward = await getNumberSetting(ctx, "blog_reward", 100);

      await ctx.db.patch(args.postId, {
        status: "published",
        reward,
        reviewedBy: adminId,
        reviewedAt: now,
        publishedAt: now,
        adminNote: args.adminNote,
      });

      if (submission) {
        await ctx.db.patch(submission._id, {
          reviewStatus: "approved",
          reviewerId: adminId,
          reviewedAt: now,
          notes: args.adminNote,
        });
      }

      await ctx.runMutation(internal.transactions.createTransaction, {
        userId: post.authorId,
        type: "blog_reward",
        amount: reward,
        description: `Blog post reward: ${post.title}`,
        status: "completed",
        referenceId: args.postId,
      });

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: post.authorId,
        title: "Post Approved!",
        body: `Your post "${post.title}" has been approved and published. You earned ₦${reward.toFixed(2)}.`,
        type: "reward",
        referenceId: args.postId,
      });

      await logAudit(
        ctx,
        "admin_approve_post",
        "posts",
        args.postId,
        JSON.stringify({ adminId, reward })
      );
    } else {
      await ctx.db.patch(args.postId, {
        status: "rejected",
        reviewedBy: adminId,
        reviewedAt: now,
        adminNote: args.adminNote,
      });

      if (submission) {
        await ctx.db.patch(submission._id, {
          reviewStatus: "rejected",
          reviewerId: adminId,
          reviewedAt: now,
          notes: args.adminNote,
        });
      }

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: post.authorId,
        title: "Post Rejected",
        body: `Your post "${post.title}" was not approved.${args.adminNote ? ` Reason: ${args.adminNote}` : ""}`,
        type: "info",
        referenceId: args.postId,
      });

      await logAudit(
        ctx,
        "admin_reject_post",
        "posts",
        args.postId,
        JSON.stringify({ adminId, adminNote: args.adminNote })
      );
    }

    return { success: true };
  },
});
