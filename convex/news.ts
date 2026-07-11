import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Public queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return paginated published news. Optional category filter and limit.
 */
export const getPublishedNews = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const numItems = args.limit ?? 20;
    let cursor: string | null = args.cursor ?? null;

    let collected: any[] = [];
    let done = false;

    while (!done && collected.length < numItems) {
      const p = await ctx.db
        .query("news")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const n of p.page) {
        if (args.category !== undefined && n.category !== args.category) continue;
        collected.push(n);
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
 * Return a single news article by id. Does NOT increment views here —
 * the client calls `incrementNewsViews` separately.
 */
export const getNewsById = query({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const news = await ctx.db.get(args.newsId);
    return news ?? null;
  },
});

/* ------------------------------------------------------------------ */
/* Public mutation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Increment a news article's view count by 1.
 */
export const incrementNewsViews = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const news = await ctx.db.get(args.newsId);
    if (!news) throw new Error("News article not found");

    await ctx.db.patch(args.newsId, {
      views: news.views + 1,
    });

    return { success: true, views: news.views + 1 };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated list of all news articles (any published state).
 */
export const adminGetNews = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const result = await ctx.db
      .query("news")
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
 * Admin: create a news article. Always starts unpublished with zero
 * views and totalReaders.
 */
export const adminCreateNews = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    summary: v.string(),
    imageUrl: v.optional(v.string()),
    category: v.string(),
    tags: v.array(v.string()),
    readReward: v.number(),
    requiredReadSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const newsId = await ctx.db.insert("news", {
      title: args.title,
      slug: args.slug,
      content: args.content,
      summary: args.summary,
      imageUrl: args.imageUrl,
      category: args.category,
      tags: args.tags,
      readReward: args.readReward,
      requiredReadSeconds: args.requiredReadSeconds,
      isPublished: false,
      publishedBy: adminId,
      views: 0,
      totalReaders: 0,
      createdAt: Date.now(),
    });

    await logAudit(
      ctx,
      "admin_create_news",
      "news",
      newsId,
      JSON.stringify({ adminId, title: args.title, slug: args.slug })
    );

    return { newsId };
  },
});

/**
 * Admin: update any subset of a news article's fields.
 */
export const adminUpdateNews = mutation({
  args: {
    newsId: v.id("news"),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    content: v.optional(v.string()),
    summary: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    readReward: v.optional(v.number()),
    requiredReadSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const news = await ctx.db.get(args.newsId);
    if (!news) throw new Error("News article not found");

    const patch: Record<string, any> = {};
    for (const key of [
      "title", "slug", "content", "summary", "imageUrl", "category",
      "tags", "readReward", "requiredReadSeconds",
    ] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.newsId, patch);
    }

    await logAudit(
      ctx,
      "admin_update_news",
      "news",
      args.newsId,
      JSON.stringify({ adminId, patch })
    );

    return { success: true };
  },
});

/**
 * Admin: toggle a news article's published state. Sets publishedAt when
 * publishing.
 */
export const adminTogglePublish = mutation({
  args: { newsId: v.id("news") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const news = await ctx.db.get(args.newsId);
    if (!news) throw new Error("News article not found");

    const willPublish = !news.isPublished;
    const patch: Record<string, any> = { isPublished: willPublish };
    if (willPublish) patch.publishedAt = Date.now();

    await ctx.db.patch(args.newsId, patch);

    await logAudit(
      ctx,
      "admin_toggle_publish_news",
      "news",
      args.newsId,
      JSON.stringify({ adminId, isPublished: willPublish })
    );

    return { success: true, isPublished: willPublish };
  },
});
