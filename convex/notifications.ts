import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Reads                                                                */
/* ------------------------------------------------------------------ */

/**
 * Return paginated notifications for the current user, newest first.
 */
export const getMyNotifications = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const numItems = args.limit ?? 20;
    const cursor = args.cursor ?? null;

    const result = await ctx.db
      .query("notifications")
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
 * Return the count of unread notifications for the current user.
 */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

/* ------------------------------------------------------------------ */
/* Mutations                                                            */
/* ------------------------------------------------------------------ */

/**
 * Mark a single notification as read. Ownership is verified.
 */
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== userId) {
      throw new Error("Forbidden: not your notification");
    }

    if (!notification.isRead) {
      await ctx.db.patch(args.notificationId, { isRead: true });
    }

    return { success: true };
  },
});

/**
 * Mark all of the current user's notifications as read.
 */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_unread", (q) =>
        q.eq("userId", userId).eq("isRead", false)
      )
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true });
    }

    return { success: true, count: unread.length };
  },
});

/* ------------------------------------------------------------------ */
/* Internal mutation: create notification                              */
/* ------------------------------------------------------------------ */

export const createNotification = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"), v.literal("success"), v.literal("warning"),
      v.literal("error"), v.literal("reward"), v.literal("cashout"),
      v.literal("referral"), v.literal("task"), v.literal("message"),
      v.literal("announcement")
    ),
    link: v.optional(v.string()),
    referenceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      body: args.body,
      type: args.type,
      isRead: false,
      link: args.link,
      referenceId: args.referenceId,
      createdAt: Date.now(),
    });
    return id;
  },
});

/* ------------------------------------------------------------------ */
/* Admin: broadcast                                                     */
/* ------------------------------------------------------------------ */

export const adminBroadcast = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"), v.literal("success"), v.literal("warning"),
      v.literal("error"), v.literal("reward"), v.literal("cashout"),
      v.literal("referral"), v.literal("task"), v.literal("message"),
      v.literal("announcement")
    ),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    // Gather all active, non-banned users.
    const users = await ctx.db.query("users").collect();
    const recipients = users.filter((u) => u.isActive && !u.isBanned);

    const now = Date.now();
    let count = 0;
    for (const u of recipients) {
      await ctx.db.insert("notifications", {
        userId: u._id,
        title: args.title,
        body: args.body,
        type: args.type,
        isRead: false,
        createdAt: now,
      });
      count += 1;
    }

    await logAudit(
      ctx,
      "admin_broadcast",
      "notifications",
      undefined,
      JSON.stringify({ adminId, title: args.title, count })
    );

    return { success: true, count };
  },
});
