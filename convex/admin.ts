import { query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { requireAdmin } from "./helpers";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Count all rows in a table by paginating through it in chunks.
 */
async function countTable(ctx: any, table: string): Promise<number> {
  let total = 0;
  let cursor: string | null = null;
  do {
    const p = await ctx.db
      .query(table as any)
      .paginate({ numItems: 100, cursor });
    total += p.page.length;
    cursor = p.continueCursor;
    if (p.isDone) break;
  } while (cursor);
  return total;
}

/**
 * Sum a numeric field across all rows of a table matching an optional
 * index-based predicate.
 */
async function sumField(
  ctx: any,
  table: string,
  field: string,
  predicate?: (row: any) => boolean
): Promise<number> {
  let total = 0;
  let cursor: string | null = null;
  do {
    const p = await ctx.db
      .query(table as any)
      .paginate({ numItems: 100, cursor });
    for (const row of p.page) {
      if (predicate && !predicate(row)) continue;
      total += Number(row[field] ?? 0);
    }
    cursor = p.continueCursor;
    if (p.isDone) break;
  } while (cursor);
  return total;
}

/* ------------------------------------------------------------------ */
/* getDashboardStats                                                    */
/* ------------------------------------------------------------------ */

/**
 * Admin: return aggregate platform statistics for the dashboard.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const todayStart = now - oneDayMs;

    // Users
    let totalUsers = 0;
    let newUsersToday = 0;
    let activeUsers = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("users")
          .paginate({ numItems: 100, cursor });
        for (const u of p.page) {
          totalUsers += 1;
          if (u.createdAt > todayStart) newUsersToday += 1;
          if (u.lastSeen !== undefined && now - u.lastSeen < sevenDaysMs) {
            activeUsers += 1;
          }
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Transactions
    const totalTransactions = await countTable(ctx, "transactions");

    // Total paid out: sum of approved cashouts.
    let totalPaidOut = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("cashouts")
          .withIndex("by_status", (q) => q.eq("status", "approved"))
          .paginate({ numItems: 100, cursor });
        for (const c of p.page) totalPaidOut += c.amount;
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Pending cashouts: count + total amount.
    let pendingCashoutsCount = 0;
    let pendingCashoutsTotal = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("cashouts")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .paginate({ numItems: 100, cursor });
        for (const c of p.page) {
          pendingCashoutsCount += 1;
          pendingCashoutsTotal += c.amount;
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Tasks
    const totalTasks = await countTable(ctx, "tasks");

    // Completed tasks today (scan all completions, filter in-memory).
    let completedTasksToday = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("taskCompletions")
          .paginate({ numItems: 100, cursor });
        for (const tc of p.page) {
          if (tc.status === "completed" && tc.completedAt > todayStart) {
            completedTasksToday += 1;
          }
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Pending referrals (pending + fee_paid).
    let pendingReferrals = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("referrals")
          .paginate({ numItems: 100, cursor });
        for (const r of p.page) {
          if (r.status === "pending" || r.status === "fee_paid") {
            pendingReferrals += 1;
          }
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Pending posts.
    let pendingPosts = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("posts")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .paginate({ numItems: 100, cursor });
        pendingPosts += p.page.length;
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Pending reports (open).
    let pendingReports = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("reports")
          .withIndex("by_status", (q) => q.eq("status", "open"))
          .paginate({ numItems: 100, cursor });
        pendingReports += p.page.length;
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Listings
    const totalListings = await countTable(ctx, "listings");
    let activeListings = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("listings")
          .withIndex("by_status", (q) => q.eq("status", "active"))
          .paginate({ numItems: 100, cursor });
        activeListings += p.page.length;
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Wallet stats: sum across all wallets.
    let walletTotalAvailable = 0;
    let walletTotalPending = 0;
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("wallets")
          .paginate({ numItems: 100, cursor });
        for (const w of p.page) {
          walletTotalAvailable += w.available;
          walletTotalPending += w.pending;
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    return {
      totalUsers,
      newUsersToday,
      activeUsers,
      totalTransactions,
      totalPaidOut,
      pendingCashouts: {
        count: pendingCashoutsCount,
        totalAmount: pendingCashoutsTotal,
      },
      totalTasks,
      completedTasksToday,
      pendingReferrals,
      pendingPosts,
      pendingReports,
      totalListings,
      activeListings,
      walletStats: {
        totalAvailable: walletTotalAvailable,
        totalPending: walletTotalPending,
      },
    };
  },
});

/* ------------------------------------------------------------------ */
/* getRecentActivity                                                    */
/* ------------------------------------------------------------------ */

/**
 * Admin: return the last 20 audit logs with actor info.
 */
export const getRecentActivity = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const recent = await ctx.db
      .query("auditLogs")
      .withIndex("by_created")
      .order("desc")
      .take(20);

    const enriched = await Promise.all(
      recent.map(async (log) => {
        const actor = await ctx.db.get(log.actorId);
        return {
          ...log,
          actor: actor
            ? {
                name: actor.name ?? null,
                image: actor.image ?? null,
              }
            : null,
        };
      })
    );

    return enriched;
  },
});

/* ------------------------------------------------------------------ */
/* getChartData                                                         */
/* ------------------------------------------------------------------ */

/**
 * Admin: return daily aggregates for the last 30 days:
 *   { date, newUsers, earnings }
 * `date` is an ISO date string (YYYY-MM-DD). `newUsers` is the number of
 * users created on that day. `earnings` is the sum of completed credit-type
 * transactions on that day.
 */
export const getChartData = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * oneDayMs;

    // Initialize the 30-day buckets.
    const buckets: Record<string, { date: string; newUsers: number; earnings: number }> = {};
    for (let i = 0; i < 30; i++) {
      const dayStart = thirtyDaysAgo + i * oneDayMs;
      const dateStr = new Date(dayStart).toISOString().slice(0, 10);
      buckets[dateStr] = { date: dateStr, newUsers: 0, earnings: 0 };
    }

    // Users created in the last 30 days.
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("users")
          .paginate({ numItems: 100, cursor });
        for (const u of p.page) {
          if (u.createdAt < thirtyDaysAgo) continue;
          const dateStr = new Date(u.createdAt).toISOString().slice(0, 10);
          if (buckets[dateStr]) buckets[dateStr].newUsers += 1;
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Completed credit-type transactions in the last 30 days.
    const creditTypes = new Set([
      "referral_reward", "task_reward", "daily_bonus", "read_reward",
      "watch_reward", "blog_reward", "admin_credit",
    ]);
    {
      let cursor: string | null = null;
      do {
        const p = await ctx.db
          .query("transactions")
          .withIndex("by_created")
          .paginate({ numItems: 100, cursor });
        for (const t of p.page) {
          if (t.createdAt < thirtyDaysAgo) continue;
          if (t.status !== "completed") continue;
          if (!creditTypes.has(t.type)) continue;
          const dateStr = new Date(t.createdAt).toISOString().slice(0, 10);
          if (buckets[dateStr]) buckets[dateStr].earnings += t.amount;
        }
        cursor = p.continueCursor;
        if (p.isDone) break;
      } while (cursor);
    }

    // Return as an array sorted by date ascending.
    return Object.values(buckets).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
  },
});
