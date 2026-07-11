import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./helpers";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Return true if `a` contains `b` (array membership).
 */
function includes<T>(arr: T[], value: T): boolean {
  return arr.indexOf(value) !== -1;
}

/* ------------------------------------------------------------------ */
/* Public query                                                         */
/* ------------------------------------------------------------------ */

/**
 * Return paginated messages for a conversation, newest last. Must be a
 * participant. Deleted messages are redacted (text/imageUrl shown as null).
 */
export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!includes(conversation.participants, userId)) {
      throw new Error("Forbidden: you are not a participant in this conversation");
    }

    const numItems = args.limit ?? 50;

    const result = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .paginate({ numItems, cursor: args.cursor ?? null });

    // Redact deleted messages.
    const page = result.page.map((message: any) => {
      if (message.deletedAt !== undefined) {
        return {
          ...message,
          text: null,
          imageUrl: null,
          deletedAt: message.deletedAt,
        };
      }
      return message;
    });

    return {
      page,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Mutation: send a message                                             */
/* ------------------------------------------------------------------ */

/**
 * Send a message in a conversation. Validates that the sender is a
 * participant and not blocked by the other participant. Increments the
 * other participant's unread count and notifies them.
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!args.text && !args.imageUrl) {
      throw new Error("A message must contain text or an image");
    }

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!includes(conversation.participants, userId)) {
      throw new Error("Forbidden: you are not a participant in this conversation");
    }

    const otherUserId = conversation.participants.find(
      (id: string) => id !== userId
    );
    if (!otherUserId) {
      throw new Error("Conversation has no other participant");
    }

    // Check whether the other user has blocked the current user.
    const otherParticipation = await ctx.db
      .query("conversationParticipants")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", otherUserId).eq("conversationId", args.conversationId)
      )
      .first();

    if (otherParticipation?.isBlocked) {
      throw new Error("You have been blocked by this user");
    }

    const now = Date.now();
    const messageType = args.imageUrl ? "image" : "text";

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: userId,
      text: args.text,
      imageUrl: args.imageUrl,
      type: messageType,
      isRead: false,
      createdAt: now,
    });

    // Update the conversation's last message info.
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessageText: args.text ?? (args.imageUrl ? "[Image]" : ""),
    });

    // Increment the other participant's unread count.
    if (otherParticipation) {
      await ctx.db.patch(otherParticipation._id, {
        unreadCount: otherParticipation.unreadCount + 1,
      });
    }

    // Notify the other participant.
    const sender = await ctx.db.get(userId);
    const senderName = sender?.name ?? "Someone";
    await ctx.runMutation(internal.notifications.createNotification, {
      userId: otherUserId,
      title: `New message from ${senderName}`,
      body: args.text ?? (args.imageUrl ? "Sent you an image" : ""),
      type: "message",
      referenceId: args.conversationId,
    });

    return { messageId };
  },
});

/* ------------------------------------------------------------------ */
/* Mutation: delete a message                                           */
/* ------------------------------------------------------------------ */

/**
 * Sender-only: soft-delete a message by setting deletedAt.
 */
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== userId) {
      throw new Error("Forbidden: you can only delete your own messages");
    }

    await ctx.db.patch(args.messageId, { deletedAt: Date.now() });

    return { success: true };
  },
});
