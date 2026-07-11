import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    referralCode: v.string(),
    referredBy: v.optional(v.id("users")),
    isActive: v.boolean(),
    isBanned: v.boolean(),
    banReason: v.optional(v.string()),
    lastSeen: v.optional(v.number()),
    registrationFeePaid: v.boolean(),
    registrationFeeVerified: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_referral_code", ["referralCode"])
    .index("by_role", ["role"])
    .index("by_referred_by", ["referredBy"]),

  wallets: defineTable({
    userId: v.id("users"),
    available: v.number(),
    pending: v.number(),
    totalEarned: v.number(),
    totalWithdrawn: v.number(),
  }).index("by_user", ["userId"]),

  transactions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("referral_reward"), v.literal("task_reward"),
      v.literal("daily_bonus"), v.literal("read_reward"),
      v.literal("watch_reward"), v.literal("blog_reward"),
      v.literal("cashout"), v.literal("cashout_rejected"),
      v.literal("admin_credit"), v.literal("admin_debit"),
      v.literal("registration_fee")
    ),
    amount: v.number(),
    description: v.string(),
    status: v.union(v.literal("completed"), v.literal("pending"), v.literal("failed")),
    referenceId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"])
    .index("by_created", ["createdAt"]),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
    label: v.string(),
    group: v.string(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]).index("by_group", ["group"]),

  tasks: defineTable({
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("click"), v.literal("watch"),
      v.literal("read"), v.literal("social"), v.literal("sponsor")
    ),
    reward: v.number(),
    url: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    requiredWatchPercent: v.optional(v.number()),
    requiredReadSeconds: v.optional(v.number()),
    cooldownHours: v.number(),
    dailyLimit: v.number(),
    totalCompletions: v.number(),
    maxCompletions: v.optional(v.number()),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_type", ["type"])
    .index("by_active", ["isActive"]),

  taskCompletions: defineTable({
    userId: v.id("users"),
    taskId: v.id("tasks"),
    status: v.union(v.literal("completed"), v.literal("pending"), v.literal("rejected")),
    reward: v.number(),
    completedAt: v.number(),
    proofUrl: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_task", ["taskId"])
    .index("by_user_task", ["userId", "taskId"])
    .index("by_user_completed", ["userId", "completedAt"]),

  dailyBonusClaims: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    claimedAt: v.number(),
  }).index("by_user", ["userId"]).index("by_user_claimed", ["userId", "claimedAt"]),

  referrals: defineTable({
    referrerId: v.id("users"),
    referredId: v.id("users"),
    status: v.union(
      v.literal("pending"), v.literal("fee_paid"),
      v.literal("approved"), v.literal("rejected")
    ),
    registrationFeeAmount: v.number(),
    rewardAmount: v.number(),
    paymentProof: v.optional(v.string()),
    adminNote: v.optional(v.string()),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_referrer", ["referrerId"])
    .index("by_referred", ["referredId"])
    .index("by_status", ["status"]),

  cashouts: defineTable({
    userId: v.id("users"),
    amount: v.number(),
    accountName: v.string(),
    accountNumber: v.string(),
    bankName: v.string(),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    adminNote: v.optional(v.string()),
    processedBy: v.optional(v.id("users")),
    processedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  news: defineTable({
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    summary: v.string(),
    imageUrl: v.optional(v.string()),
    category: v.string(),
    tags: v.array(v.string()),
    readReward: v.number(),
    requiredReadSeconds: v.number(),
    isPublished: v.boolean(),
    publishedBy: v.id("users"),
    views: v.number(),
    totalReaders: v.number(),
    createdAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_published", ["isPublished"])
    .index("by_created", ["createdAt"]),

  newsReads: defineTable({
    userId: v.id("users"),
    newsId: v.id("news"),
    rewarded: v.boolean(),
    readAt: v.number(),
    sharedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_news", ["newsId"])
    .index("by_user_news", ["userId", "newsId"]),

  jobs: defineTable({
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
    publishedBy: v.id("users"),
    views: v.number(),
    totalReaders: v.number(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
  })
    .index("by_published", ["isPublished"])
    .index("by_created", ["createdAt"]),

  jobReads: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    rewarded: v.boolean(),
    readAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"])
    .index("by_user_job", ["userId", "jobId"]),

  posts: defineTable({
    authorId: v.id("users"),
    title: v.string(),
    content: v.string(),
    summary: v.string(),
    category: v.union(
      v.literal("news"), v.literal("job"), v.literal("article"),
      v.literal("review"), v.literal("tutorial")
    ),
    imageUrl: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.union(
      v.literal("pending"), v.literal("approved"),
      v.literal("rejected"), v.literal("published")
    ),
    reward: v.number(),
    adminNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    views: v.number(),
    createdAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  postSubmissions: defineTable({
    postId: v.id("posts"),
    authorId: v.id("users"),
    submittedAt: v.number(),
    reviewStatus: v.union(
      v.literal("pending"), v.literal("in_review"),
      v.literal("approved"), v.literal("rejected")
    ),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_post", ["postId"])
    .index("by_author", ["authorId"])
    .index("by_status", ["reviewStatus"]),

  listings: defineTable({
    sellerId: v.id("users"),
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
    status: v.union(
      v.literal("active"), v.literal("sold"),
      v.literal("suspended"), v.literal("deleted")
    ),
    views: v.number(),
    isFeatured: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_seller", ["sellerId"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_featured", ["isFeatured"])
    .index("by_created", ["createdAt"]),

  conversations: defineTable({
    participants: v.array(v.id("users")),
    listingId: v.optional(v.id("listings")),
    lastMessageAt: v.number(),
    lastMessageText: v.optional(v.string()),
    isArchived: v.boolean(),
  })
    .index("by_listing", ["listingId"])
    .index("by_last_message", ["lastMessageAt"]),

  conversationParticipants: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    unreadCount: v.number(),
    isBlocked: v.boolean(),
    joinedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user", ["userId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("system")),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_created", ["conversationId", "createdAt"])
    .index("by_sender", ["senderId"]),

  notifications: defineTable({
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    type: v.union(
      v.literal("info"), v.literal("success"), v.literal("warning"),
      v.literal("error"), v.literal("reward"), v.literal("cashout"),
      v.literal("referral"), v.literal("task"), v.literal("message"),
      v.literal("announcement")
    ),
    isRead: v.boolean(),
    link: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_created", ["createdAt"]),

  reports: defineTable({
    reporterId: v.id("users"),
    reportedUserId: v.optional(v.id("users")),
    reportedListingId: v.optional(v.id("listings")),
    reportedMessageId: v.optional(v.id("messages")),
    reason: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("open"), v.literal("reviewed"),
      v.literal("resolved"), v.literal("dismissed")
    ),
    adminNote: v.optional(v.string()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_reporter", ["reporterId"])
    .index("by_reported_user", ["reportedUserId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  blocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_blocker", ["blockerId"])
    .index("by_blocker_blocked", ["blockerId", "blockedId"]),

  auditLogs: defineTable({
    actorId: v.id("users"),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_actor", ["actorId"])
    .index("by_created", ["createdAt"]),
});
