import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { internal } from "./_generated/api";
import { requireAdmin, logAudit } from "./helpers";

/* ------------------------------------------------------------------ */
/* Reads                                                                */
/* ------------------------------------------------------------------ */

/**
 * Return an array of all settings documents.
 */
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("settings").collect();
  },
});

/**
 * Return a single setting document by its key.
 */
export const getByKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

/**
 * Return all settings documents in a given group.
 */
export const getByGroup = query({
  args: { group: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_group", (q) => q.eq("group", args.group))
      .collect();
  },
});

/* ------------------------------------------------------------------ */
/* Writes                                                               */
/* ------------------------------------------------------------------ */

/**
 * Upsert a single setting by key. Admin only.
 */
export const upsert = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    label: v.string(),
    group: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        label: args.label,
        group: args.group,
        updatedAt: Date.now(),
        updatedBy: adminId,
      });
    } else {
      await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
        label: args.label,
        group: args.group,
        updatedAt: Date.now(),
        updatedBy: adminId,
      });
    }

    await logAudit(
      ctx,
      "settings_upsert",
      "settings",
      args.key,
      JSON.stringify({ key: args.key, value: args.value, label: args.label, group: args.group })
    );

    return { success: true };
  },
});

/**
 * Bulk upsert a list of settings. Admin only.
 */
export const bulkUpsert = mutation({
  args: {
    items: v.array(
      v.object({
        key: v.string(),
        value: v.string(),
        label: v.string(),
        group: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    for (const item of args.items) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", item.key))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          value: item.value,
          label: item.label,
          group: item.group,
          updatedAt: Date.now(),
          updatedBy: adminId,
        });
      } else {
        await ctx.db.insert("settings", {
          key: item.key,
          value: item.value,
          label: item.label,
          group: item.group,
          updatedAt: Date.now(),
          updatedBy: adminId,
        });
      }
    }

    await logAudit(
      ctx,
      "settings_bulk_upsert",
      "settings",
      undefined,
      JSON.stringify({ count: args.items.length })
    );

    return { success: true, count: args.items.length };
  },
});

/* ------------------------------------------------------------------ */
/* Default seeding                                                      */
/* ------------------------------------------------------------------ */

interface DefaultSetting {
  key: string;
  value: string;
  label: string;
  group: string;
}

const DEFAULT_SETTINGS: DefaultSetting[] = [
  { key: "platform_name", value: "ClickEarn Pro", label: "Platform Name", group: "general" },
  { key: "registration_fee", value: "500", label: "Registration Fee (₦)", group: "earning" },
  { key: "referral_reward", value: "300", label: "Referral Reward (₦)", group: "earning" },
  { key: "daily_bonus", value: "50", label: "Daily Bonus (₦)", group: "earning" },
  { key: "read_reward", value: "20", label: "Read Reward (₦)", group: "earning" },
  { key: "watch_reward", value: "30", label: "Watch Reward (₦)", group: "earning" },
  { key: "task_reward", value: "10", label: "Task Reward (₦)", group: "earning" },
  { key: "blog_reward", value: "100", label: "Blog Reward (₦)", group: "earning" },
  { key: "min_cashout", value: "1000", label: "Minimum Cashout (₦)", group: "cashout" },
  { key: "usd_to_ngn_rate", value: "1600", label: "USD → NGN Rate", group: "general" },
  { key: "payment_provider", value: "Bank Transfer", label: "Payment Provider", group: "payment" },
  { key: "payment_account_name", value: "ClickEarn Pro", label: "Payment Account Name", group: "payment" },
  { key: "payment_account_number", value: "0000000000", label: "Payment Account Number", group: "payment" },
  { key: "maintenance_mode", value: "false", label: "Maintenance Mode", group: "system" },
  { key: "support_email", value: "support@clickearnpro.com", label: "Support Email", group: "support" },
  { key: "support_whatsapp", value: "+2348000000000", label: "Support WhatsApp", group: "support" },
  { key: "telegram_link", value: "https://t.me/clickearnpro", label: "Telegram Link", group: "support" },
];

/**
 * Seed default settings if the settings table is empty. Admin only.
 */
export const initDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);

    const existing = await ctx.db.query("settings").first();
    if (existing) {
      return { success: true, seeded: false, message: "Settings already exist" };
    }

    const now = Date.now();
    for (const s of DEFAULT_SETTINGS) {
      await ctx.db.insert("settings", {
        key: s.key,
        value: s.value,
        label: s.label,
        group: s.group,
        updatedAt: now,
        updatedBy: adminId,
      });
    }

    await logAudit(
      ctx,
      "settings_init_defaults",
      "settings",
      undefined,
      JSON.stringify({ count: DEFAULT_SETTINGS.length })
    );

    return { success: true, seeded: true, count: DEFAULT_SETTINGS.length };
  },
});
