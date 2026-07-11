import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type CurrentUser = {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
  phone?: string;
  role: "user" | "admin";
  referralCode: string;
  referredBy?: string;
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  lastSeen?: number;
  registrationFeePaid: boolean;
  registrationFeeVerified: boolean;
  createdAt: number;
};

export type Wallet = {
  _id: string;
  userId: string;
  available: number;
  pending: number;
  totalEarned: number;
  totalWithdrawn: number;
};

/**
 * useCurrentUser — loads the currently authenticated user and their wallet.
 *
 * The Convex query `api.users.getCurrentUser` may return either:
 *   - `{ user, wallet }` (nested shape)
 *   - a flat object with user + wallet fields merged
 *
 * This hook normalizes both into a consistent `{ user, wallet, isLoading, isAdmin }` shape.
 */
export function useCurrentUser() {
  // Cast to any to avoid type recursion from the generated api stub.
  const result = useQuery(api.users.getCurrentUser as any) as any;

  const isLoading = result === undefined;

  let user: CurrentUser | null = null;
  let wallet: Wallet | null = null;

  if (result && !isLoading) {
    if (result.user) {
      // Nested shape: { user, wallet }
      user = result.user as CurrentUser;
      wallet = (result.wallet ?? null) as Wallet | null;
    } else if (result._id || result.referralCode) {
      // Flat shape — the user fields are directly on the result
      user = result as CurrentUser;
      wallet = (result.wallet ?? null) as Wallet | null;
    }
  }

  const isAdmin = user?.role === "admin";

  return { user, wallet, isLoading, isAdmin };
}

export default useCurrentUser;
