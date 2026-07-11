import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  Wallet, Clock, TrendingUp, ArrowUpRight, ArrowDownLeft, CreditCard,
  Coins, Gift, Users, FileText, Eye, CheckCircle, AlertCircle, ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  formatCurrency, formatDateTime, cn,
} from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TransactionType =
  | "referral_reward" | "task_reward" | "daily_bonus" | "read_reward"
  | "watch_reward" | "blog_reward" | "cashout" | "cashout_rejected"
  | "admin_credit" | "admin_debit" | "registration_fee";

type Transaction = {
  _id: string;
  type: TransactionType;
  amount: number;
  description: string;
  status: "completed" | "pending" | "failed";
  createdAt: number;
};

type WalletDoc = {
  _id: string;
  userId: string;
  available: number;
  pending: number;
  totalEarned: number;
  totalWithdrawn: number;
};

type PaginatedResult = {
  page: Transaction[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const CREDIT_TYPES = new Set<TransactionType>([
  "referral_reward", "task_reward", "daily_bonus", "read_reward",
  "watch_reward", "blog_reward", "admin_credit",
]);

function isCredit(type: TransactionType): boolean {
  return CREDIT_TYPES.has(type);
}

const transactionTypeIcon: Record<TransactionType, LucideIcon> = {
  referral_reward: Users,
  task_reward: CheckCircle,
  daily_bonus: Gift,
  read_reward: FileText,
  watch_reward: Eye,
  blog_reward: FileText,
  cashout: CreditCard,
  cashout_rejected: CreditCard,
  admin_credit: Coins,
  admin_debit: ArrowDownLeft,
  registration_fee: FileText,
};

const transactionTypeLabels: Record<TransactionType, string> = {
  referral_reward: "Referral Reward",
  task_reward: "Task Reward",
  daily_bonus: "Daily Bonus",
  read_reward: "Read Reward",
  watch_reward: "Watch Reward",
  blog_reward: "Blog Reward",
  cashout: "Cash Out",
  cashout_rejected: "Cash Out Rejected",
  admin_credit: "Admin Credit",
  admin_debit: "Admin Debit",
  registration_fee: "Registration Fee",
};

function statusBadgeVariant(
  status: "completed" | "pending" | "failed"
): "success" | "warning" | "error" {
  if (status === "completed") return "success";
  if (status === "pending") return "warning";
  return "error";
}

const FILTER_OPTIONS: { value: TransactionType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "task_reward", label: "Task Rewards" },
  { value: "referral_reward", label: "Referral Rewards" },
  { value: "daily_bonus", label: "Daily Bonuses" },
  { value: "read_reward", label: "Read Rewards" },
  { value: "watch_reward", label: "Watch Rewards" },
  { value: "cashout", label: "Cash Outs" },
  { value: "admin_credit", label: "Admin Credits" },
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
          <div className="skeleton h-7 w-32" />
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
          <div className="skeleton h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-24" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4"><div className="skeleton h-3.5 w-40" /></td>
      <td className="px-4 py-4"><div className="skeleton h-4 w-20" /></td>
      <td className="px-4 py-4"><div className="skeleton h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-4"><div className="skeleton h-3.5 w-28" /></td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function WalletPage() {
  const { wallet, isLoading: userLoading } = useCurrentUser();
  const walletDirect = useQuery(api.users.getMyWallet as any) as
    | WalletDoc
    | null
    | undefined;
  const transactionsResult = useQuery(api.transactions.getMyTransactions as any, {
    limit: 50,
  }) as PaginatedResult | undefined;

  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");

  // Prefer the directly-fetched wallet; fall back to the hook's wallet.
  const activeWallet =
    walletDirect !== undefined ? walletDirect : wallet;
  const walletLoading = userLoading && walletDirect === undefined;

  const allTransactions = transactionsResult?.page ?? [];
  const txLoading = transactionsResult === undefined;

  // Apply the type filter client-side.
  const filteredTransactions = useMemo(() => {
    if (typeFilter === "all") return allTransactions;
    return allTransactions.filter((t) => t.type === typeFilter);
  }, [allTransactions, typeFilter]);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">My Wallet</h1>
          <p className="mt-0.5 text-sm text-dark-400">
            Track your balance and transaction history.
          </p>
        </div>
        <Link to="/cashout" className="btn btn-primary">
          <CreditCard className="h-4 w-4" />
          Request Cash Out
        </Link>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {walletLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Available Balance"
              value={formatCurrency(activeWallet?.available)}
              icon={Wallet}
              color="blue"
            />
            <StatCard
              title="Pending Balance"
              value={formatCurrency(activeWallet?.pending)}
              icon={Clock}
              color="orange"
            />
            <StatCard
              title="Total Earned"
              value={formatCurrency(activeWallet?.totalEarned)}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Total Withdrawn"
              value={formatCurrency(activeWallet?.totalWithdrawn)}
              icon={ArrowUpRight}
              color="red"
            />
          </>
        )}
      </div>

      {/* ---------- Transaction history ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Transaction History</h2>

          {/* Type filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TransactionType | "all")}
              className="input appearance-none pr-9 text-sm"
              disabled={txLoading}
              aria-label="Filter by type"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
          </div>
        </div>

        {txLoading ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="table-header">Type</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No transactions found"
            description={
              typeFilter === "all"
                ? "Your transaction history will appear here once you start earning."
                : "No transactions match this filter. Try selecting a different type."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="table-header">Type</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const credit = isCredit(tx.type);
                  const Icon = transactionTypeIcon[tx.type] ?? Coins;
                  return (
                    <tr
                      key={tx._id}
                      className="border-b border-dark-800 transition-colors last:border-0 hover:bg-dark-800/40"
                    >
                      {/* Type */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              credit
                                ? "bg-secondary-500/15 text-secondary-400"
                                : "bg-error-500/15 text-red-400"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-dark-200">
                            {transactionTypeLabels[tx.type]}
                          </span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="table-cell max-w-xs">
                        <p className="truncate text-dark-300">{tx.description}</p>
                      </td>

                      {/* Amount */}
                      <td className="table-cell">
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            credit ? "text-secondary-400" : "text-red-400"
                          )}
                        >
                          {credit ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <Badge variant={statusBadgeVariant(tx.status)}>
                          {tx.status === "completed" && (
                            <Coins className="h-3 w-3" />
                          )}
                          {tx.status === "pending" && (
                            <Clock className="h-3 w-3" />
                          )}
                          {tx.status === "failed" && (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          <span className="capitalize">{tx.status}</span>
                        </Badge>
                      </td>

                      {/* Date */}
                      <td className="table-cell whitespace-nowrap text-dark-400">
                        {formatDateTime(tx.createdAt)}
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
