import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDateTime } from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";

type TxnType =
  | "referral_reward" | "task_reward" | "daily_bonus" | "read_reward"
  | "watch_reward" | "blog_reward" | "cashout" | "cashout_rejected"
  | "admin_credit" | "admin_debit" | "registration_fee";

type TxnStatus = "completed" | "pending" | "failed";

type TransactionRow = {
  _id: string;
  type: TxnType;
  amount: number;
  description: string;
  status: TxnStatus;
  createdAt: number;
  user: { name: string | null; email: string | null; image: string | null } | null;
};

const PAGE_SIZE = 25;

const typeLabels: Record<TxnType, string> = {
  referral_reward: "Referral",
  task_reward: "Task",
  daily_bonus: "Daily Bonus",
  read_reward: "Read",
  watch_reward: "Watch",
  blog_reward: "Blog",
  cashout: "Cashout",
  cashout_rejected: "Cashout Reversal",
  admin_credit: "Admin Credit",
  admin_debit: "Admin Debit",
  registration_fee: "Reg. Fee",
};

const statusBadge: Record<TxnStatus, { variant: "success" | "warning" | "error"; label: string }> = {
  completed: { variant: "success", label: "Completed" },
  pending: { variant: "warning", label: "Pending" },
  failed: { variant: "error", label: "Failed" },
};

// Types that represent credits (positive earnings) vs debits.
const creditTypes = new Set<TxnType>([
  "referral_reward", "task_reward", "daily_bonus", "read_reward",
  "watch_reward", "blog_reward", "admin_credit",
]);

const debitTypes = new Set<TxnType>([
  "cashout", "admin_debit", "registration_fee",
]);

export default function AdminTransactionsPage() {
  const [typeFilter, setTypeFilter] = useState<"all" | TxnType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TxnStatus>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  // Stack of cursors to enable "previous page" navigation.
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([]);

  const result = useQuery(api.transactions.adminGetAllTransactions, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
    type: typeFilter === "all" ? undefined : typeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
  }) as { page: TransactionRow[]; isDone: boolean; continueCursor: string; total: number } | undefined;

  // Stats derived from the full filtered set (we use the returned `total`
  // and scan the current page for amount sums as an approximation).
  const stats = useMemo(() => {
    const page = result?.page ?? [];
    const totalCredits = page
      .filter((t) => creditTypes.has(t.type) && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDebits = page
      .filter((t) => debitTypes.has(t.type) && t.status === "completed")
      .reduce((sum, t) => sum + t.amount, 0);
    const pendingCount = page.filter((t) => t.status === "pending").length;
    return {
      total: result?.total ?? 0,
      totalCredits,
      totalDebits,
      pendingCount,
    };
  }, [result]);

  const hasNext = result && !result.isDone && result.page.length > 0;
  const hasPrev = cursorStack.length > 0;

  const goNext = () => {
    if (!result) return;
    setCursorStack((prev) => [...prev, cursor]);
    setCursor(result.continueCursor || null);
  };

  const goPrev = () => {
    setCursorStack((prev) => {
      const stack = [...prev];
      const prevCursor = stack.pop() ?? null;
      setCursor(prevCursor);
      return stack;
    });
  };

  const resetFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setCursor(null);
    setCursorStack([]);
  };

  return (
    <div className="space-y-5">
      {/* ============ Stats ============ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Transactions" value={stats.total} icon={ArrowLeftRight} color="blue" />
        <StatCard title="Total Credits (page)" value={formatCurrency(stats.totalCredits)} icon={TrendingUp} color="green" />
        <StatCard title="Total Debits (page)" value={formatCurrency(stats.totalDebits)} icon={TrendingDown} color="red" />
        <StatCard title="Pending (page)" value={stats.pendingCount} icon={Clock} color="orange" />
      </div>

      {/* ============ Filters ============ */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-dark-500">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value as any); setCursor(null); setCursorStack([]); }}
                className="input w-auto"
              >
                <option value="all">All Types</option>
                {(Object.keys(typeLabels) as TxnType[]).map((t) => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-dark-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setCursor(null); setCursorStack([]); }}
                className="input w-auto"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {(typeFilter !== "all" || statusFilter !== "all") && (
              <button onClick={resetFilters} className="btn btn-ghost btn-sm">
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ Table ============ */}
      <div className="card overflow-hidden">
        {result === undefined ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : result.page.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions found"
            description="There are no transactions matching your filters."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">User</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((txn) => {
                  const isCredit = creditTypes.has(txn.type);
                  const isDebit = debitTypes.has(txn.type);
                  const isReversal = txn.type === "cashout_rejected";
                  return (
                    <tr key={txn._id} className="hover:bg-dark-800/30">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Avatar name={txn.user?.name ?? undefined} src={txn.user?.image ?? undefined} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{txn.user?.name ?? "Unknown"}</p>
                            <p className="truncate text-xs text-dark-500">{txn.user?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge variant="neutral">{typeLabels[txn.type]}</Badge>
                      </td>
                      <td className="table-cell">
                        <p className="max-w-[260px] truncate text-sm text-dark-200">{txn.description}</p>
                      </td>
                      <td className="table-cell">
                        <span
                          className={cn(
                            "font-semibold",
                            isReversal
                              ? "text-amber-400"
                              : isCredit
                                ? "text-secondary-400"
                                : isDebit
                                  ? "text-error-400"
                                  : "text-white"
                          )}
                        >
                          {isCredit || isReversal ? "+" : isDebit ? "−" : ""}
                          {formatCurrency(txn.amount)}
                        </span>
                      </td>
                      <td className="table-cell">
                        <Badge variant={statusBadge[txn.status].variant}>
                          {statusBadge[txn.status].label}
                        </Badge>
                      </td>
                      <td className="table-cell text-dark-400">{formatDateTime(txn.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ============ Pagination ============ */}
        {result && result.page.length > 0 && (hasNext || hasPrev) && (
          <div className="flex items-center justify-between border-t border-dark-800 px-4 py-3">
            <button
              onClick={goPrev}
              disabled={!hasPrev}
              className="btn btn-secondary btn-sm"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <span className="text-xs text-dark-500">
              {cursorStack.length + 1} / {Math.max(1, cursorStack.length + (hasNext ? 2 : 1))}
            </span>
            <button
              onClick={goNext}
              disabled={!hasNext}
              className="btn btn-secondary btn-sm"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
