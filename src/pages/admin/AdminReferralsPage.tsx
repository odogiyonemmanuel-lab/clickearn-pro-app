import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { UserPlus, Check, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type ReferralStatus = "pending" | "fee_paid" | "approved" | "rejected";

type ReferralRow = {
  _id: string;
  status: ReferralStatus;
  registrationFeeAmount: number;
  rewardAmount: number;
  adminNote?: string;
  createdAt: number;
  approvedAt?: number;
  referrer: { name: string | null; email: string | null; image: string | null } | null;
  referredUser: { name: string | null; email: string | null; image: string | null } | null;
};

const PAGE_SIZE = 20;

const statusTabs: { key: "all" | ReferralStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "fee_paid", label: "Fee Paid" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const statusBadge: Record<ReferralStatus, { variant: "warning" | "primary" | "success" | "error"; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  fee_paid: { variant: "primary", label: "Fee Paid" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
};

export default function AdminReferralsPage() {
  const [activeTab, setActiveTab] = useState<"all" | ReferralStatus>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<ReferralRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const result = useQuery(api.referrals.adminGetReferrals, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
    status: activeTab === "all" ? undefined : activeTab,
  }) as { page: ReferralRow[]; isDone: boolean; continueCursor: string } | undefined;

  const approveReferral = useMutation(api.referrals.adminApproveReferral);
  const rejectReferral = useMutation(api.referrals.adminRejectReferral);

  const handleApprove = async (referral: ReferralRow) => {
    try {
      await approveReferral({ referralId: referral._id as any });
      toast.success("Referral approved & reward paid");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve referral");
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await rejectReferral({ referralId: rejectModal._id as any, adminNote: rejectReason.trim() });
      toast.success("Referral rejected");
      setRejectModal(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reject referral");
    }
  };

  const canAct = (s: ReferralStatus) => s === "pending" || s === "fee_paid";

  return (
    <div className="space-y-5">
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
            icon={UserPlus}
            title="No referrals found"
            description="There are no referrals matching this filter."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Referrer</th>
                  <th className="table-header">Referred User</th>
                  <th className="table-header">Fee Amount</th>
                  <th className="table-header">Reward</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((ref) => (
                  <tr key={ref._id} className="hover:bg-dark-800/30">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar name={ref.referrer?.name ?? undefined} src={ref.referrer?.image ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{ref.referrer?.name ?? "Unknown"}</p>
                          <p className="truncate text-xs text-dark-500">{ref.referrer?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar name={ref.referredUser?.name ?? undefined} src={ref.referredUser?.image ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{ref.referredUser?.name ?? "Unknown"}</p>
                          <p className="truncate text-xs text-dark-500">{ref.referredUser?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell text-dark-300">{formatCurrency(ref.registrationFeeAmount)}</td>
                    <td className="table-cell font-medium text-primary-400">{formatCurrency(ref.rewardAmount)}</td>
                    <td className="table-cell">
                      <Badge variant={statusBadge[ref.status].variant}>
                        {statusBadge[ref.status].label}
                      </Badge>
                    </td>
                    <td className="table-cell text-dark-400">{formatDate(ref.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {canAct(ref.status) ? (
                          <>
                            <button
                              onClick={() => handleApprove(ref)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-500/10"
                              title="Approve"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setRejectModal(ref); setRejectReason(""); }}
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

      {/* ============ Reject Modal ============ */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Reject Referral"
      >
        <div className="space-y-4">
          {rejectModal && (
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3 text-sm">
              <p className="text-dark-200">
                <span className="text-dark-500">Referrer:</span>{" "}
                {rejectModal.referrer?.name ?? "Unknown"}
              </p>
              <p className="text-dark-200">
                <span className="text-dark-500">Referred:</span>{" "}
                {rejectModal.referredUser?.name ?? "Unknown"}
              </p>
              <p className="text-dark-200">
                <span className="text-dark-500">Reward:</span>{" "}
                {formatCurrency(rejectModal.rewardAmount)}
              </p>
            </div>
          )}
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
            <button onClick={handleReject} className="btn btn-danger">Reject Referral</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
