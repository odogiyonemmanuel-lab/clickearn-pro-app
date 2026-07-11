import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { getAuthUserId, requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* User mutation: create a report                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a report. At least one target (user, listing, or message) must be
 * provided. Notifies all admins.
 */
export const createReport = mutation({
  args: {
    reportedUserId: v.optional(v.id("users")),
    reportedListingId: v.optional(v.id("listings")),
    reportedMessageId: v.optional(v.id("messages")),
    reason: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (
      !args.reportedUserId &&
      !args.reportedListingId &&
      !args.reportedMessageId
    ) {
      throw new Error("You must report a user, listing, or message");
    }

    const reportId = await ctx.db.insert("reports", {
      reporterId: userId,
      reportedUserId: args.reportedUserId,
      reportedListingId: args.reportedListingId,
      reportedMessageId: args.reportedMessageId,
      reason: args.reason,
      description: args.description,
      status: "open",
      createdAt: Date.now(),
    });

    // Notify all admins.
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();

    for (const admin of admins) {
      await ctx.runMutation(internal.notifications.createNotification, {
        userId: admin._id,
        title: "New Report Submitted",
        body: `A new report has been filed: ${args.reason}`,
        type: "warning",
        referenceId: reportId,
      });
    }

    return { reportId };
  },
});

/* ------------------------------------------------------------------ */
/* User query: my reports                                               */
/* ------------------------------------------------------------------ */

/**
 * Return all reports filed by the current user, newest first.
 */
export const getMyReports = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const reports = await ctx.db
      .query("reports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", userId))
      .order("desc")
      .collect();

    return reports;
  },
});

/* ------------------------------------------------------------------ */
/* Admin queries                                                        */
/* ------------------------------------------------------------------ */

/**
 * Admin: paginated reports with reporter and reported user info. Optional
 * status filter.
 */
export const adminGetReports = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
    status: v.optional(
      v.union(
        v.literal("open"), v.literal("reviewed"),
        v.literal("resolved"), v.literal("dismissed")
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
        .query("reports")
        .order("desc")
        .paginate({ numItems: 100, cursor });
      for (const r of p.page) {
        if (args.status !== undefined && r.status !== args.status) continue;
        collected.push(r);
        if (collected.length >= numItems) break;
      }
      cursor = p.continueCursor;
      if (p.isDone) done = true;
    }

    const page = collected.slice(0, numItems);

    const enriched = await Promise.all(
      page.map(async (r) => {
        const [reporter, reportedUser] = await Promise.all([
          ctx.db.get(r.reporterId),
          r.reportedUserId ? ctx.db.get(r.reportedUserId) : Promise.resolve(null),
        ]);
        return {
          ...r,
          reporter: reporter
            ? {
                name: reporter.name ?? null,
                email: reporter.email ?? null,
                image: reporter.image ?? null,
              }
            : null,
          reportedUser: reportedUser
            ? {
                name: reportedUser.name ?? null,
                email: reportedUser.email ?? null,
                image: reportedUser.image ?? null,
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
/* Admin mutation: review a report                                      */
/* ------------------------------------------------------------------ */

/**
 * Admin: review a report. Updates its status and optionally bans the
 * reported user.
 */
export const adminReviewReport = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(
      v.literal("reviewed"), v.literal("resolved"), v.literal("dismissed")
    ),
    adminNote: v.optional(v.string()),
    banUser: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const now = Date.now();

    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Report not found");

    await ctx.db.patch(args.reportId, {
      status: args.status,
      adminNote: args.adminNote,
      reviewedBy: adminId,
      reviewedAt: now,
    });

    // Optionally ban the reported user.
    if (args.banUser && report.reportedUserId) {
      const banReason = args.adminNote ?? `Banned via report ${report._id}`;
      await ctx.db.patch(report.reportedUserId, {
        isBanned: true,
        banReason,
      });

      await ctx.runMutation(internal.notifications.createNotification, {
        userId: report.reportedUserId,
        title: "Account Banned",
        body: `Your account has been banned. Reason: ${banReason}`,
        type: "error",
        referenceId: report._id,
      });
    }

    await logAudit(
      ctx,
      "admin_review_report",
      "reports",
      args.reportId,
      JSON.stringify({
        adminId,
        status: args.status,
        adminNote: args.adminNote,
        banUser: args.banUser ?? false,
      })
    );

    return { success: true };
  },
});
