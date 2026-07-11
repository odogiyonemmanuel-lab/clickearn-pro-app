import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Read a numeric setting by key. Returns the provided default when the
 * setting is missing or cannot be parsed as a finite number.
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

/**
 * Compute the completion status for a given user + task:
 *  - completedToday: number of completions in the current UTC day window
 *  - lastCompletedAt: most recent completion timestamp (or null)
 *  - canComplete: whether the user may complete the task right now
 *  - nextAvailableAt: when the user may next complete (or null)
 */
async function getCompletionStatus(
  ctx: any,
  userId: string,
  task: any
): Promise<{
  completedToday: number;
  lastCompletedAt: number | null;
  canComplete: boolean;
  nextAvailableAt: number | null;
}> {
  const now = Date.now();

  // Collect this user's completed completions for the task, newest first.
  const completions = await ctx.db
    .query("taskCompletions")
    .withIndex("by_user_task", (q: any) =>
      q.eq("userId", userId).eq("taskId", task._id)
    )
    .order("desc")
    .filter((q: any) => q.eq(q.field("status"), "completed"))
    .collect();

  const lastCompletedAt =
    completions.length > 0 ? completions[0].completedAt : null;

  // "Today" is defined as the last 24h window for fairness across timezones.
  const dayStart = now - 24 * 60 * 60 * 1000;
  const completedToday = completions.filter(
    (c: any) => c.completedAt >= dayStart
  ).length;

  // Daily limit check.
  const dailyLimitReached =
    task.dailyLimit > 0 && completedToday >= task.dailyLimit;

  // Cooldown check: next available = lastCompletedAt + cooldownHours.
  let nextAvailableAt: number | null = null;
  let cooldownPassed = true;
  if (lastCompletedAt !== null && task.cooldownHours > 0) {
    nextAvailableAt = lastCompletedAt + task.cooldownHours * 60 * 60 * 1000;
    cooldownPassed = now >= nextAvailableAt;
    if (cooldownPassed) nextAvailableAt = null;
  }

  // Max completions (lifetime) check.
  const maxReached =
    task.maxCompletions !== undefined &&
    task.totalCompletions >= task.maxCompletions;

  const canComplete =
    !dailyLimitReached && cooldownPassed && !maxReached;

  return {
    completedToday,
    lastCompletedAt,
    canComplete,
    nextAvailableAt,
  };
}

/* ------------------------------------------------------------------ */
/* Public queries                                                       */
/* ------------------------------------------------------------------ */

/**
 * Return all active, non-expired tasks with per-user completion status.
 */
export const getActiveTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => {
        const notExpired = q.or(
          q.eq(q.field("expiresAt"), undefined),
          q.gte(q.field("expiresAt"), now)
        );
        return notExpired;
      })
      .collect();

    const enriched = await Promise.all(
      tasks.map(async (task) => {
        const completionStatus = await getCompletionStatus(ctx, userId, task);
        return { ...task, completionStatus };
      })
    );

    return enriched;
  },
});

/**
 * Return a single task by id with per-user completion status.
 */
export const getTaskById = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) return null;

    const completionStatus = await getCompletionStatus(ctx, userId, task);
    return { ...task, completionStatus };
  },
});

/* ------------------------------------------------------------------ */
/* User mutations                                                       */
/* ------------------------------------------------------------------ */

/**
 * Mark a task as started. Validates the task is completable but does NOT
 * award any reward — completion happens via `completeTask`.
 */
export const startTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (!task.isActive) throw new Error("Task is not active");
    if (task.expiresAt !== undefined && task.expiresAt < now) {
      throw new Error("Task has expired");
    }

    const status = await getCompletionStatus(ctx, userId, task);

    if (!status.canComplete) {
      if (status.nextAvailableAt !== null) {
        throw new Error("Task is on cooldown. Try again later.");
      }
      throw new Error("Daily limit reached for this task");
    }

    return { startedAt: now };
  },
});

/**
 * Complete a task: validate, record completion, bump counters, reward the
 * user via an internal transaction, and notify them.
 */
export const completeTask = mutation({
  args: {
    taskId: v.id("tasks"),
    proofUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    if (!task.isActive) throw new Error("Task is not active");
    if (task.expiresAt !== undefined && task.expiresAt < now) {
      throw new Error("Task has expired");
    }

    const status = await getCompletionStatus(ctx, userId, task);

    if (status.lastCompletedAt !== null && task.cooldownHours > 0) {
      const nextAvailableAt =
        status.lastCompletedAt + task.cooldownHours * 60 * 60 * 1000;
      if (now < nextAvailableAt) {
        throw new Error("Task is on cooldown. Try again later.");
      }
    }

    if (task.dailyLimit > 0 && status.completedToday >= task.dailyLimit) {
      throw new Error("Daily limit reached for this task");
    }

    if (
      task.maxCompletions !== undefined &&
      task.totalCompletions >= task.maxCompletions
    ) {
      throw new Error("Task has reached its maximum completions");
    }

    // Record the completion.
    const completionId = await ctx.db.insert("taskCompletions", {
      userId,
      taskId: task._id,
      status: "completed",
      reward: task.reward,
      completedAt: now,
      proofUrl: args.proofUrl,
    });

    // Increment the task's total completions counter.
    await ctx.db.patch(task._id, {
      totalCompletions: task.totalCompletions + 1,
    });

    // Reward the user via the internal transaction mutation (also updates wallet).
    await ctx.runMutation(internal.transactions.createTransaction, {
      userId,
      type: "task_reward",
      amount: task.reward,
      description: `Task reward: ${task.title}`,
      status: "completed",
      referenceId: completionId,
    });

    // Notify the user.
    await ctx.runMutation(internal.notifications.createNotification, {
      userId,
      title: "Task Completed!",
      body: `You earned ₦${task.reward.toFixed(2)} for completing "${task.title}".`,
      type: "task",
      referenceId: task._id,
    });

    return { reward: task.reward, completedAt: now };
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated list of all tasks (any active state).
 */
export const adminGetTasks = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const result = await ctx.db
      .query("tasks")
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
 * Admin: create a new task with all fields.
 */
export const adminCreateTask = mutation({
  args: {
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
    maxCompletions: v.optional(v.number()),
    isActive: v.boolean(),
    isFeatured: v.boolean(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      type: args.type,
      reward: args.reward,
      url: args.url,
      videoUrl: args.videoUrl,
      imageUrl: args.imageUrl,
      requiredWatchPercent: args.requiredWatchPercent,
      requiredReadSeconds: args.requiredReadSeconds,
      cooldownHours: args.cooldownHours,
      dailyLimit: args.dailyLimit,
      totalCompletions: 0,
      maxCompletions: args.maxCompletions,
      isActive: args.isActive,
      isFeatured: args.isFeatured,
      createdBy: adminId,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
    });

    await logAudit(
      ctx,
      "admin_create_task",
      "tasks",
      taskId,
      JSON.stringify({ adminId, title: args.title, type: args.type })
    );

    return { taskId };
  },
});

/**
 * Admin: update any subset of a task's fields.
 */
export const adminUpdateTask = mutation({
  args: {
    taskId: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("click"), v.literal("watch"),
        v.literal("read"), v.literal("social"), v.literal("sponsor")
      )
    ),
    reward: v.optional(v.number()),
    url: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    requiredWatchPercent: v.optional(v.number()),
    requiredReadSeconds: v.optional(v.number()),
    cooldownHours: v.optional(v.number()),
    dailyLimit: v.optional(v.number()),
    maxCompletions: v.optional(v.number()),
    isFeatured: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const patch: Record<string, any> = {};
    for (const key of [
      "title", "description", "type", "reward", "url", "videoUrl",
      "imageUrl", "requiredWatchPercent", "requiredReadSeconds",
      "cooldownHours", "dailyLimit", "maxCompletions", "isFeatured",
      "expiresAt",
    ] as const) {
      if (args[key] !== undefined) patch[key] = args[key];
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.taskId, patch);
    }

    await logAudit(
      ctx,
      "admin_update_task",
      "tasks",
      args.taskId,
      JSON.stringify({ adminId, patch })
    );

    return { success: true };
  },
});

/**
 * Admin: toggle a task's active flag.
 */
export const adminToggleTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.taskId, { isActive: !task.isActive });

    await logAudit(
      ctx,
      "admin_toggle_task",
      "tasks",
      args.taskId,
      JSON.stringify({ adminId, isActive: !task.isActive })
    );

    return { success: true, isActive: !task.isActive };
  },
});
