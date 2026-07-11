import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { CreditCard, Check, X, Wallet, TrendingUp, TrendingDown, XCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate } from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type CashoutStatus = "pending" | "approved" | "rejected";

type CashoutRow = {
  _id: string;
  amount: number;
  accountName: string;
  accountNumber: string;
  bankName: string;
  status: CashoutStatus;
  adminNote?: string;
  createdAt: number;
  processedAt?: number;
  user: { name: string | null; email: string | null; image: string | null } | null;
};

const PAGE_SIZE = 20;

const statusTabs: { key: "all" | CashoutStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const statusBadge: Record<CashoutStatus, { variant: "warning" | "success" | "error"; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
};

export default function AdminCashoutsPage() {
  const [activeTab, setActiveTab] = useState<"all" | CashoutStatus>("pending");
  const [cursor, setCursor] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<CashoutRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveModal, setApproveModal] = useState<CashoutRow | null>(null);

  const result = useQuery(api.cashouts.adminGetCashouts, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
    status: activeTab === "all" ? undefined : activeTab,
  }) as { page: CashoutRow[]; isDone: boolean; continueCursor: string } | undefined;

  const processCashout = useMutation(api.cashouts.adminProcessCashout);

  // Summary computed from the current page + a separate all-pending fetch.
  const pendingResult = useQuery(api.cashouts.adminGetCashouts, {
    paginationOpts: { numItems: 100, cursor: null },
    status: "pending",
  }) as { page: CashoutRow[]; isDone: boolean; continueCursor: string } | undefined;

  const summary = useMemo(() => {
    const pending = pendingResult?.page ?? [];
    const pendingTotal = pending.reduce((sum, c) => sum + c.amount, 0);
    const rejectedCount = (result?.page ?? []).filter((c) => c.status === "rejected").length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const approvedThisMonth = (result?.page ?? [])
      .filter((c) => c.status === "approved" && (c.processedAt ?? c.createdAt) >= monthStart.getTime())
      .reduce((sum, c) => sum + c.amount, 0);
    return {
      pendingCount: pending.length,
      pendingTotal,
      approvedThisMonth,
      rejectedCount,
    };
  }, [pendingResult, result]);

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      await processCashout({ cashoutId: approveModal._id as any, action: "approve" });
      toast.success("Cashout approved & paid out");
      setApproveModal(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve cashout");
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await processCashout({
        cashoutId: rejectModal._id as any,
        action: "reject",
        adminNote: rejectReason.trim(),
      });
      toast.success("Cashout rejected & funds returned");
      setRejectModal(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reject cashout");
    }
  };

  return (
    <div className="space-y-5">
      {/* ============ Summary ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Pending Cashouts"
          value={summary.pendingCount}
          icon={Wallet}
          color="orange"
          prefix={`₦${summary.pendingTotal.toLocaleString()} · `}
        />
        <StatCard
          title="Approved This Month"
          value={formatCurrency(summary.approvedThisMonth)}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Rejected (visible)"
          value={summary.rejectedCount}
          icon={TrendingDown}
          color="red"
        />
      </div>

      {/* ============ Tabs ============ */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCursor(null); }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "bg-accent-500/15 text-accent-300 border border-accent-500/30"
                    : "text-dark-400 hover:bg-dark-800 hover:text-white border border-transparent"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============ Table ============ */}
      <div className="card overflow-hidden">
        {result === undefined ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : result.page.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No cashout requests"
            description="There are no cashouts matching this filter."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">User</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Bank</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((c) => (
                  <tr key={c._id} className="hover:bg-dark-800/30">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar name={c.user?.name ?? undefined} src={c.user?.image ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{c.user?.name ?? "Unknown"}</p>
                          <p className="truncate text-xs text-dark-500">{c.user?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-semibold text-white">{formatCurrency(c.amount)}</td>
                    <td className="table-cell text-dark-300">{c.bankName}</td>
                    <td className="table-cell">
                      <p className="text-sm text-dark-200">{c.accountName}</p>
                      <p className="text-xs text-dark-500">{c.accountNumber}</p>
                    </td>
                    <td className="table-cell">
                      <Badge variant={statusBadge[c.status].variant}>
                        {statusBadge[c.status].label}
                      </Badge>
                    </td>
                    <td className="table-cell text-dark-400">{formatDate(c.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === "pending" ? (
                          <>
                            <button
                              onClick={() => setApproveModal(c)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-500/10"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setRejectModal(c); setRejectReason(""); }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-error-400 hover:bg-error-500/10"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-dark-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && !result.isDone && result.page.length > 0 && (
          <div className="border-t border-dark-800 p-4 text-center">
            <button onClick={() => setCursor(result.continueCursor || null)} className="btn btn-secondary btn-sm">
              Load More
            </button>
          </div>
        )}
      </div>

      {/* ============ Approve Confirm Modal ============ */}
      <Modal
        isOpen={!!approveModal}
        onClose={() => setApproveModal(null)}
        title="Approve Cashout"
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-300">
            Confirm payout of <span className="font-semibold text-white">{approveModal && formatCurrency(approveModal.amount)}</span> to this user's bank account.
          </p>
          {approveModal && (
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3 text-sm">
              <p className="text-dark-200"><span className="text-dark-500">User:</span> {approveModal.user?.name ?? "Unknown"}</p>
              <p className="text-dark-200"><span className="text-dark-500">Bank:</span> {approveModal.bankName}</p>
              <p className="text-dark-200"><span className="text-dark-500">Account:</span> {approveModal.accountName} — {approveModal.accountNumber}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setApproveModal(null)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleApprove} className="btn btn-success">
              <Check className="h-4 w-4" /> Approve & Pay
            </button>
          </div>
        </div>
      </Modal>

      {/* ============ Reject Modal ============ */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Reject Cashout"
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-300">
            Rejecting will return <span className="font-semibold text-white">{rejectModal && formatCurrency(rejectModal.amount)}</span> to the user's available balance.
          </p>
          <div>
            <label className="label">Reason for rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="This reason will be sent to the user…"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRejectModal(null)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleReject} className="btn btn-danger">
              <XCircle className="h-4 w-4" /> Reject Cashout
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
