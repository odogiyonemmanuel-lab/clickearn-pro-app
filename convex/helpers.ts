import { v } from "convex/values";
import { auth } from "./auth";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Get the authenticated user's ID, throwing if not authenticated.
 */
export async function getAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await auth.getUserId(ctx);
  if (userId === null) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

/**
 * Ensure the current user is an admin, returning the admin user document.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Forbidden: Admin only");
  }
  return userId;
}

/**
 * Format a Naira amount as "₦X,XXX.XX".
 */
export function formatAmount(amount: number): string {
  return "₦" + amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Characters excluded to avoid confusion: O, 0, I, 1
const REFERRAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate an 8-character alphanumeric referral code,
 * excluding visually-ambiguous characters (O, 0, I, 1).
 */
export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    const idx = Math.floor(Math.random() * REFERRAL_CHARS.length);
    code += REFERRAL_CHARS[idx];
  }
  return code;
}

/**
 * Append an entry to the auditLogs table.
 */
export async function logAudit(
  ctx: MutationCtx,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: string
): Promise<void> {
  const actorId = await getAuthUserId(ctx);
  await ctx.db.insert("auditLogs", {
    actorId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: Date.now(),
  });
}
