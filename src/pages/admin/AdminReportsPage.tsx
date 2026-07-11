import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { FlagTriangleRight, CheckCircle, Ban, Eye, MessageSquare, Package, User } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatDate } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type ReportStatus = "open" | "reviewed" | "resolved" | "dismissed";

type ReportRow = {
  _id: string;
  reason: string;
  description: string;
  status: ReportStatus;
  reportedUserId?: string;
  reportedListingId?: string;
  reportedMessageId?: string;
  adminNote?: string;
  createdAt: number;
  reporter: { name: string | null; email: string | null; image: string | null } | null;
  reportedUser: { name: string | null; email: string | null; image: string | null } | null;
};

const PAGE_SIZE = 20;

const statusTabs: { key: "all" | ReportStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "reviewed", label: "Reviewed" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

const statusBadge: Record<ReportStatus, { variant: "warning" | "primary" | "success" | "error" | "neutral"; label: string }> = {
  open: { variant: "warning", label: "Open" },
  reviewed: { variant: "primary", label: "Reviewed" },
  resolved: { variant: "success", label: "Resolved" },
  dismissed: { variant: "neutral", label: "Dismissed" },
};

function getReportTarget(report: ReportRow): { type: string; icon: typeof User } {
  if (report.reportedMessageId) return { type: "Message", icon: MessageSquare };
  if (report.reportedListingId) return { type: "Listing", icon: Package };
  if (report.reportedUserId) return { type: "User", icon: User };
  return { type: "Other", icon: FlagTriangleRight };
}

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<"all" | ReportStatus>("open");
  const [cursor, setCursor] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<ReportRow | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [action, setAction] = useState<"resolved" | "dismissed">("resolved");
  const [banUser, setBanUser] = useState(false);
  const [saving, setSaving] = useState(false);

  const result = useQuery(api.reports.adminGetReports, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
    status: activeTab === "all" ? undefined : activeTab,
  }) as { page: ReportRow[]; isDone: boolean; continueCursor: string } | undefined;

  const reviewReport = useMutation(api.reports.adminReviewReport);

  const openReview = (report: ReportRow, defaultAction: "resolved" | "dismissed") => {
    setReviewModal(report);
    setAdminNote("");
    setAction(defaultAction);
    setBanUser(false);
  };

  const handleReview = async () => {
    if (!reviewModal) return;
    setSaving(true);
    try {
      await reviewReport({
        reportId: reviewModal._id as any,
        status: action,
        adminNote: adminNote.trim() || undefined,
        banUser: banUser || undefined,
      });
      toast.success(
        action === "resolved"
          ? `Report resolved${banUser ? " & user banned" : ""}`
          : "Report dismissed"
      );
      setReviewModal(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to review report");
    }
    setSaving(false);
  };

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
            icon={FlagTriangleRight}
            title="No reports found"
            description="There are no reports matching this filter."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Reporter</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Target</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((report) => {
                  const target = getReportTarget(report);
                  return (
                    <tr key={report._id} className="hover:bg-dark-800/30">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Avatar name={report.reporter?.name ?? undefined} src={report.reporter?.image ?? undefined} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-white">{report.reporter?.name ?? "Unknown"}</p>
                            <p className="truncate text-xs text-dark-500">{report.reporter?.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <target.icon className="h-4 w-4 text-dark-400" />
                          <span className="text-dark-200">{target.type}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        {report.reportedUser ? (
                          <span className="text-sm text-dark-200">{report.reportedUser.name ?? "Unknown"}</span>
                        ) : (
                          <span className="text-xs text-dark-500">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="max-w-[200px] truncate text-sm text-dark-200">{report.reason}</p>
                      </td>
                      <td className="table-cell">
                        <Badge variant={statusBadge[report.status].variant}>
                          {statusBadge[report.status].label}
                        </Badge>
                      </td>
                      <td className="table-cell text-dark-400">{formatDate(report.createdAt)}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          {report.status === "open" ? (
                            <>
                              <button
                                onClick={() => openReview(report, "resolved")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-500/10"
                                title="Resolve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openReview(report, "dismissed")}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                                title="Dismiss"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openReview(report, "resolved")}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* ============ Review Modal ============ */}
      <Modal
        isOpen={!!reviewModal}
        onClose={() => setReviewModal(null)}
        title="Review Report"
        maxWidth="2xl"
      >
        {reviewModal && (
          <div className="space-y-4">
            {/* Reporter + Reported */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-500">Reporter</p>
                <div className="flex items-center gap-2">
                  <Avatar name={reviewModal.reporter?.name ?? undefined} src={reviewModal.reporter?.image ?? undefined} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{reviewModal.reporter?.name ?? "Unknown"}</p>
                    <p className="truncate text-xs text-dark-500">{reviewModal.reporter?.email}</p>
                  </div>
                </div>
              </div>
              {reviewModal.reportedUser && (
                <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-500">Reported User</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={reviewModal.reportedUser?.name ?? undefined} src={reviewModal.reportedUser?.image ?? undefined} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{reviewModal.reportedUser?.name ?? "Unknown"}</p>
                      <p className="truncate text-xs text-dark-500">{reviewModal.reportedUser?.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="rounded-lg border border-dark-800 bg-dark-800/30 p-4 space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-dark-500">Reason</p>
                <p className="text-sm text-white">{reviewModal.reason}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-dark-500">Description</p>
                <p className="whitespace-pre-wrap text-sm text-dark-200">{reviewModal.description}</p>
              </div>
              {reviewModal.adminNote && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-dark-500">Previous Admin Note</p>
                  <p className="text-sm text-dark-300">{reviewModal.adminNote}</p>
                </div>
              )}
            </div>

            {/* Actions (only for open reports) */}
            {reviewModal.status === "open" && (
              <>
                <div>
                  <label className="label">Admin Note (optional)</label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    className="input resize-none"
                    rows={2}
                    placeholder="Add a note about this resolution…"
                  />
                </div>
                {reviewModal.reportedUserId && (
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-error-500/20 bg-error-500/10 p-3 text-sm text-error-300">
                    <input
                      type="checkbox"
                      checked={banUser}
                      onChange={(e) => setBanUser(e.target.checked)}
                      className="h-4 w-4 rounded border-dark-600 bg-dark-800 text-error-500 focus:ring-error-500"
                    />
                    <Ban className="h-4 w-4" />
                    Ban the reported user
                  </label>
                )}
                <div className="flex justify-end gap-3 border-t border-dark-800 pt-4">
                  <button
                    onClick={() => { setAction("dismissed"); }}
                    className={cn("btn", action === "dismissed" ? "btn-secondary" : "btn-ghost")}
                  >
                    Mark as Dismiss
                  </button>
                  <button
                    onClick={handleReview}
                    disabled={saving}
                    className="btn btn-success"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {saving ? "Processing…" : action === "resolved" ? "Resolve Report" : "Dismiss Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
