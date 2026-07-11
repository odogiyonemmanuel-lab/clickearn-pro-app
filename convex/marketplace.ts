import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Public queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return paginated active listings, post-filtered by category, location,
 * and a search term (title/description match).
 */
export const getListings = query({
  args: {
    category: v.optional(
      v.union(
        v.literal("electronics"), v.literal("phones"), v.literal("fashion"),
        v.literal("vehicles"), v.literal("property"), v.literal("services"),
        v.literal("jobs"), v.literal("digital"), v.literal("others")
      )
    ),
    search: v.optional(v.string()),
    location: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const numItems = args.limit ?? 20;
    let cursor: string | null = args.cursor ?? null;

    const searchLower = args.search?.toLowerCase().trim() ?? "";
    const locationFilter = args.location?.trim() ?? "";

    let collected: any[] = [];
    let done = false;

    while (!done && collected.length < numItems) {
      const p = await ctx.db
        .query("listings")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const listing of p.page) {
        if (args.category !== undefined && listing.category !== args.category) continue;
        if (locationFilter && listing.location !== locationFilter) continue;
        if (searchLower) {
          const titleMatch = listing.title.toLowerCase().includes(searchLower);
          const descMatch = listing.description.toLowerCase().includes(searchLower);
          if (!titleMatch && !descMatch) continue;
        }
        collected.push(listing);
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
 * Return a single listing with the seller's public info.
 */
export const getListingById = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) return null;

    const seller = await ctx.db.get(listing.sellerId);

    return {
      ...listing,
      seller: seller
        ? {
            name: seller.name ?? null,
            image: seller.image ?? null,
          }
        : null,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Public mutation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Increment a listing's view count by 1.
 */
export const incrementListingViews = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");

    await ctx.db.patch(args.listingId, {
      views: listing.views + 1,
    });

    return { success: true, views: listing.views + 1 };
  },
});

/**
 * Return the current user's non-deleted listings.
 */
export const getMyListings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_seller", (q) => q.eq("sellerId", userId))
      .order("desc")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .collect();

    return listings;
  },
});

/* ------------------------------------------------------------------ */
/* Seller mutations                                                     */
/* ------------------------------------------------------------------ */

/**
 * Create a new listing. Starts as active with zero views, not featured.
 */
export const createListing = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    negotiable: v.boolean(),
    category: v.union(
      v.literal("electronics"), v.literal("phones"), v.literal("fashion"),
      v.literal("vehicles"), v.literal("property"), v.literal("services"),
      v.literal("jobs"), v.literal("digital"), v.literal("others")
    ),
    location: v.string(),
    images: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const listingId = await ctx.db.insert("listings", {
      sellerId: userId,
      title: args.title,
      description: args.description,
      price: args.price,
      negotiable: args.negotiable,
      category: args.category,
      location: args.location,
      images: args.images,
      status: "active",
      views: 0,
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
    });

    return { listingId };
  },
});

/**
 * Seller-only: update a listing's fields. Bumps updatedAt.
 */
export const updateListing = mutation({
  args: {
    listingId: v.id("listings"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    negotiable: v.optional(v.boolean()),
    category: v.optional(
      v.union(
        v.literal("electronics"), v.literal("phones"), v.literal("fashion"),
        v.literal("vehicles"), v.literal("property"), v.literal("services"),
        v.literal("jobs"), v.literal("digital"), v.literal("others")
      )
    ),
    location: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.sellerId !== userId) {
      throw new Error("Forbidden: you can only edit your own listings");
    }

    const patch: Record<string, any> = { updatedAt: Date.now() };
    for (const key of [
      "title", "description", "price", "negotiable", "category",
      "location", "images",
    ] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }

    await ctx.db.patch(args.listingId, patch);

    return { success: true };
  },
});

/**
 * Seller-only: soft-delete a listing by setting status to "deleted".
 */
export const deleteListing = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.sellerId !== userId) {
      throw new Error("Forbidden: you can only delete your own listings");
    }

    await ctx.db.patch(args.listingId, {
      status: "deleted",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Seller-only: mark a listing as sold.
 */
export const markAsSold = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.sellerId !== userId) {
      throw new Error("Forbidden: you can only update your own listings");
    }

    await ctx.db.patch(args.listingId, {
      status: "sold",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated listings with seller info. Optional status filter.
 */
export const adminGetListings = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    status: v.optional(
      v.union(
        v.literal("active"), v.literal("sold"),
        v.literal("suspended"), v.literal("deleted")
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
        .query("listings")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const listing of p.page) {
        if (args.status !== undefined && listing.status !== args.status) continue;
        collected.push(listing);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    const enriched = await Promise.all(
      page.map(async (listing) => {
        const seller = await ctx.db.get(listing.sellerId);
        return {
          ...listing,
          seller: seller
            ? {
                name: seller.name ?? null,
                email: seller.email ?? null,
                image: seller.image ?? null,
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
 * Admin: suspend a listing with a reason. Notifies the seller.
 */
export const adminSuspendListing = mutation({
  args: {
    listingId: v.id("listings"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");

    await ctx.db.patch(args.listingId, {
      status: "suspended",
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      userId: listing.sellerId,
      title: "Listing Suspended",
      body: `Your listing "${listing.title}" has been suspended by an administrator. Reason: ${args.reason}`,
      type: "warning",
      referenceId: args.listingId,
    });

    await logAudit(
      ctx,
      "admin_suspend_listing",
      "listings",
      args.listingId,
      JSON.stringify({ adminId, reason: args.reason })
    );

    return { success: true };
  },
});
