import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./helpers";

/* ------------------------------------------------------------------ */
/* Public queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return all conversations the current user participates in. For each,
 * attach the other participant's info, the last message text/time, and the
 * current user's unread count.
 */
export const getMyConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // Find this user's participant records.
    const myParticipations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const enriched = await Promise.all(
      myParticipations.map(async (participation) => {
        const conversation = await ctx.db.get(participation.conversationId);
        if (!conversation) return null;

        // The other participant is whoever isn't the current user.
        const otherUserId = conversation.participants.find(
          (id: string) => id !== userId
        );

        let otherParticipant: { name: string | null; image: string | null } | null = null;
        if (otherUserId) {
          const other = await ctx.db.get(otherUserId);
          otherParticipant = other
            ? { name: other.name ?? null, image: other.image ?? null }
            : null;
        }

        return {
          ...conversation,
          otherParticipant,
          unreadCount: participation.unreadCount,
          isBlocked: participation.isBlocked,
        };
      })
    );

    // Drop any nulls from deleted conversations, sort by lastMessageAt desc.
    return enriched
      .filter((c) => c !== null)
      .sort((a, b) => b!.lastMessageAt - a!.lastMessageAt);
  },
});

/**
 * Return a single conversation with participant info. Must be a participant.
 */
export const getConversationById = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    if (!conversation.participants.includes(userId)) {
      throw new Error("Forbidden: you are not a participant in this conversation");
    }

    const participantsInfo = await Promise.all(
      conversation.participants.map(async (pid: string) => {
        const user = await ctx.db.get(pid);
        return {
          userId: pid,
          name: user?.name ?? null,
          image: user?.image ?? null,
        };
      })
    );

    return {
      ...conversation,
      participantsInfo,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Mutations                                                            */
/* ------------------------------------------------------------------ */

/**
 * Get an existing 1:1 conversation between the current user and another
 * user, or create one if none exists.
 */
export const getOrCreateConversation = mutation({
  args: {
    otherUserId: v.id("users"),
    listingId: v.optional(v.id("listings")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (args.otherUserId === userId) {
      throw new Error("Cannot create a conversation with yourself");
    }

    const otherUser = await ctx.db.get(args.otherUserId);
    if (!otherUser) throw new Error("User not found");

    const now = Date.now();

    // Look for an existing conversation that includes both users.
    const myParticipations = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const participation of myParticipations) {
      const conversation = await ctx.db.get(participation.conversationId);
      if (!conversation) continue;
      if (conversation.participants.includes(args.otherUserId)) {
        return { conversationId: conversation._id };
      }
    }

    // None exists — create one.
    const conversationId = await ctx.db.insert("conversations", {
      participants: [userId, args.otherUserId],
      listingId: args.listingId,
      lastMessageAt: now,
      isArchived: false,
    });

    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId,
      unreadCount: 0,
      isBlocked: false,
      joinedAt: now,
    });

    await ctx.db.insert("conversationParticipants", {
      conversationId,
      userId: args.otherUserId,
      unreadCount: 0,
      isBlocked: false,
      joinedAt: now,
    });

    return { conversationId };
  },
});

/**
 * Reset the current user's unread count to 0 for a conversation and mark
 * all messages from the other user as read.
 */
export const markConversationRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.participants.includes(userId)) {
      throw new Error("Forbidden: you are not a participant in this conversation");
    }

    // Reset the current user's unread count.
    const myParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", args.conversationId)
      )
      .first();

    if (myParticipation && myParticipation.unreadCount > 0) {
      await ctx.db.patch(myParticipation._id, { unreadCount: 0 });
    }

    // Mark all unread messages not sent by the current user as read.
    const now = Date.now();
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("isRead"), false),
          q.neq(q.field("senderId"), userId)
        )
      )
      .collect();

    for (const message of messages) {
      await ctx.db.patch(message._id, { isRead: true, readAt: now });
    }

    return { success: true };
  },
});

/**
 * Block another participant in a conversation. Sets isBlocked for the
 * current user and records an entry in the blocks table.
 */
export const blockParticipant = mutation({
  args: {
    conversationId: v.id("conversations"),
    blockedUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.participants.includes(userId)) {
      throw new Error("Forbidden: you are not a participant in this conversation");
    }
    if (!conversation.participants.includes(args.blockedUserId)) {
      throw new Error("The user to block is not a participant in this conversation");
    }

    const myParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", args.conversationId)
      )
      .first();

    if (myParticipation) {
      await ctx.db.patch(myParticipation._id, { isBlocked: true });
    }

    // Record the block (idempotent — avoid duplicate block entries).
    const existingBlock = await ctx.db
      .query("blocks")
      .withIndex("by_blocker_blocked", (q) =>
        q.eq("blockerId", userId).eq("blockedId", args.blockedUserId)
      )
      .first();

    if (!existingBlock) {
      await ctx.db.insert("blocks", {
        blockerId: userId,
        blockedId: args.blockedUserId,
        createdAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Toggle the archived state of a conversation for the current user.
 */
export const archiveConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.participants.includes(userId)) {
      throw new Error("Forbidden: you are not a participant in this conversation");
    }

    await ctx.db.patch(args.conversationId, {
      isArchived: !conversation.isArchived,
    });

    return { success: true, isArchived: !conversation.isArchived };
  },
});
