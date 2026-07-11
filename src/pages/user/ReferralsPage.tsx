import { useState } from "react";
import { useQuery } from "convex/react";
import toast from "react-hot-toast";
import {
  Users, CheckCircle, Clock, Coins, Gift, Copy, Share2, UserPlus,
  DollarSign, TrendingUp, Wallet,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useSettings } from "../../hooks/useSettings";
import {
  formatCurrency, formatDate, copyToClipboard, cn,
} from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ReferralStatus = "pending" | "fee_paid" | "approved" | "rejected";

type Referral = {
  _id: string;
  referrerId: string;
  referredId: string;
  status: ReferralStatus;
  registrationFeeAmount: number;
  rewardAmount: number;
  createdAt: number;
  approvedAt?: number;
  referredUser: {
    name: string | null;
    email: string | null;
    image: string | null;
    createdAt: number;
  } | null;
};

type ReferralStats = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalEarned: number;
  pendingRewards: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const statusConfig: Record<
  ReferralStatus,
  { label: string; variant: "success" | "warning" | "error" | "neutral" }
> = {
  pending: { label: "Pending", variant: "warning" },
  fee_paid: { label: "Fee Paid", variant: "primary" as any },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "error" },
};

function referralStatusBadge(status: ReferralStatus) {
  const cfg = statusConfig[status] ?? { label: status, variant: "neutral" as const };
  // Map "primary" to a supported Badge variant.
  const variant =
    cfg.variant === ("primary" as any) ? "primary" : cfg.variant;
  return (
    <Badge variant={variant as any}>
      {cfg.label}
    </Badge>
  );
}

/* How it works steps */
const HOW_IT_WORKS = [
  {
    icon: Share2,
    title: "Share Your Code",
    description: "Send your referral code or link to friends and family.",
  },
  {
    icon: UserPlus,
    title: "Friend Registers & Pays",
    description: "They sign up using your code and pay the registration fee.",
  },
  {
    icon: CheckCircle,
    title: "Admin Approves",
    description: "Our team verifies their payment and approves the referral.",
  },
  {
    icon: Coins,
    title: "You Get Rewarded",
    description: "Your referral reward is credited straight to your wallet.",
  },
];

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-7 w-20" />
        </div>
        <div className="skeleton h-11 w-11 rounded-lg" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-dark-800">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="skeleton h-3.5 w-28" />
        </div>
      </td>
      <td className="px-4 py-4"><div className="skeleton h-5 w-20 rounded-full" /></td>
      <td className="px-4 py-4"><div className="skeleton h-3.5 w-16" /></td>
      <td className="px-4 py-4"><div className="skeleton h-3.5 w-24" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function ReferralsPage() {
  const { user, isLoading: userLoading } = useCurrentUser();
  const settings = useSettings();
  const referrals = useQuery(api.referrals.getMyReferrals as any) as
    | Referral[]
    | undefined;
  const stats = useQuery(api.referrals.getReferralStats as any) as
    | ReferralStats
    | undefined;

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralCode = user?.referralCode ?? "";
  const referralLink = user
    ? `${window.location.origin}/register?ref=${referralCode}`
    : "";

  const handleCopyCode = async () => {
    if (!referralCode) return;
    const ok = await copyToClipboard(referralCode);
    if (ok) {
      setCopiedCode(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    const ok = await copyToClipboard(referralLink);
    if (ok) {
      setCopiedLink(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  const referralsLoading = referrals === undefined;
  const statsLoading = stats === undefined;
  const settingsLoading = settings.isLoading;

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-xl font-bold text-white">Referrals</h1>
        <p className="mt-0.5 text-sm text-dark-400">
          Invite friends and earn rewards when they join and pay the registration fee.
        </p>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Referrals"
              value={stats?.total ?? 0}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Approved"
              value={stats?.approved ?? 0}
              icon={CheckCircle}
              color="green"
            />
            <StatCard
              title="Pending"
              value={stats?.pending ?? 0}
              icon={Clock}
              color="orange"
            />
            <StatCard
              title="Total Earned"
              value={formatCurrency(stats?.totalEarned)}
              icon={TrendingUp}
              color="red"
            />
          </>
        )}
      </div>

      {/* ---------- Referral code + share link ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Your Referral Code</h2>
          <Gift className="h-4 w-4 text-primary-400" />
        </div>
        <div className="card-body space-y-5">
          {/* Big code display */}
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dark-800 bg-gradient-to-br from-dark-950 to-dark-900 p-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-xs font-medium uppercase tracking-wider text-dark-500">
                Your unique code
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-wider text-gradient">
                {userLoading ? "······" : referralCode}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="btn btn-primary"
              disabled={userLoading || !referralCode}
            >
              {copiedCode ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Code
                </>
              )}
            </button>
          </div>

          {/* Share link */}
          <div>
            <label className="label">Share this link</label>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                placeholder={userLoading ? "Loading…" : "Your referral link"}
                className="input font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopyLink}
                className="btn btn-secondary shrink-0"
                disabled={userLoading || !referralLink}
              >
                {copiedLink ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-secondary-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- How it works ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">How It Works</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, idx) => (
              <div key={step.title} className="relative">
                {/* Step number */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-500/15">
                    <step.icon className="h-5 w-5 text-primary-400" />
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-dark-800 text-xs font-bold text-dark-400">
                    {idx + 1}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-xs text-dark-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Settings card (fees & rewards) ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Referral Program Details</h2>
          <DollarSign className="h-4 w-4 text-secondary-400" />
        </div>
        <div className="card-body">
          {settingsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="skeleton h-16 w-full rounded-lg" />
              <div className="skeleton h-16 w-full rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-4 rounded-lg border border-dark-800 bg-dark-950 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-error-500/15">
                  <Wallet className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-dark-400">
                    Registration Fee
                  </p>
                  <p className="text-lg font-bold text-white">
                    {formatCurrency(settings.registrationFee)}
                  </p>
                  <p className="text-xs text-dark-500">
                    Paid by each referred user
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-lg border border-dark-800 bg-dark-950 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary-500/15">
                  <Gift className="h-5 w-5 text-secondary-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-dark-400">
                    Your Reward Per Referral
                  </p>
                  <p className="text-lg font-bold text-secondary-400">
                    {formatCurrency(settings.referralReward)}
                  </p>
                  <p className="text-xs text-dark-500">
                    Credited after admin approval
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Referrals table ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Your Referrals</h2>
          {stats && (
            <span className="text-xs text-dark-500">
              {stats.total} total
            </span>
          )}
        </div>

        {referralsLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="table-header">Referred User</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Reward</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : !referrals || referrals.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No referrals yet"
            description="Share your referral code with friends to start earning rewards for each successful referral."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="table-header">Referred User</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Reward</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((ref) => {
                  const name = ref.referredUser?.name ?? "Unknown User";
                  const approved = ref.status === "approved";
                  return (
                    <tr
                      key={ref._id}
                      className="border-b border-dark-800 transition-colors last:border-0 hover:bg-dark-800/40"
                    >
                      {/* User */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-semibold text-white">
                            {(name?.[0] ?? "?").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-dark-200">
                              {name}
                            </p>
                            {ref.referredUser?.email && (
                              <p className="truncate text-xs text-dark-500">
                                {ref.referredUser.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        {referralStatusBadge(ref.status)}
                      </td>

                      {/* Reward */}
                      <td className="table-cell">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            approved ? "text-secondary-400" : "text-dark-400"
                          )}
                        >
                          {approved
                            ? formatCurrency(ref.rewardAmount)
                            : ref.status === "pending" || ref.status === "fee_paid"
                              ? "Pending"
                              : "—"}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="table-cell whitespace-nowrap text-dark-400">
                        {formatDate(ref.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
