import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Eye, Check, X, FileText, ExternalLink } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate } from "../../lib/utils";
import { useSettings } from "../../hooks/useSettings";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type PostStatus = "pending" | "approved" | "rejected" | "published";

type PostRow = {
  _id: string;
  title: string;
  content: string;
  summary: string;
  category: "news" | "job" | "article" | "review" | "tutorial";
  status: PostStatus;
  tags: string[];
  reward: number;
  views: number;
  imageUrl?: string;
  adminNote?: string;
  createdAt: number;
  author: { name: string | null; email: string | null; image: string | null } | null;
};

const PAGE_SIZE = 20;

const statusTabs: { key: "all" | PostStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "published", label: "Published" },
  { key: "all", label: "All" },
];

const statusBadge: Record<PostStatus, { variant: "warning" | "primary" | "error" | "success"; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "primary", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
  published: { variant: "success", label: "Published" },
};

const categoryLabel: Record<PostRow["category"], string> = {
  news: "News",
  job: "Job",
  article: "Article",
  review: "Review",
  tutorial: "Tutorial",
};

export default function AdminPostsPage() {
  const settings = useSettings();
  const [activeTab, setActiveTab] = useState<"all" | PostStatus>("pending");
  const [cursor, setCursor] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<PostRow | null>(null);
  const [rejectModal, setRejectModal] = useState<PostRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveModal, setApproveModal] = useState<PostRow | null>(null);

  const result = useQuery(api.posts.adminGetPosts, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
    status: activeTab === "all" ? undefined : activeTab,
  }) as { page: PostRow[]; isDone: boolean; continueCursor: string } | undefined;

  const reviewPost = useMutation(api.posts.adminReviewPost);
  const blogReward = settings.blogReward;

  const handleApprove = async () => {
    if (!approveModal) return;
    try {
      await reviewPost({ postId: approveModal._id as any, action: "approve" });
      toast.success(`Post approved & author rewarded ${formatCurrency(blogReward)}`);
      setApproveModal(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve post");
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    try {
      await reviewPost({
        postId: rejectModal._id as any,
        action: "reject",
        adminNote: rejectReason.trim(),
      });
      toast.success("Post rejected");
      setRejectModal(null);
      setRejectReason("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reject post");
    }
  };

  const canReview = (s: PostStatus) => s === "pending" || s === "approved";

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
            icon={FileText}
            title="No posts found"
            description="There are no blog posts matching this filter."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Author</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Submitted</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((post) => (
                  <tr key={post._id} className="hover:bg-dark-800/30">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar name={post.author?.name ?? undefined} src={post.author?.image ?? undefined} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{post.author?.name ?? "Unknown"}</p>
                          <p className="truncate text-xs text-dark-500">{post.author?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="max-w-[200px] truncate font-medium text-white">{post.title}</p>
                      {post.tags.length > 0 && (
                        <p className="text-xs text-dark-500">{post.tags.slice(0, 3).join(", ")}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      <Badge variant="neutral">{categoryLabel[post.category]}</Badge>
                    </td>
                    <td className="table-cell">
                      <Badge variant={statusBadge[post.status].variant}>
                        {statusBadge[post.status].label}
                      </Badge>
                    </td>
                    <td className="table-cell text-dark-400">{formatDate(post.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewPost(post)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canReview(post.status) && (
                          <>
                            <button
                              onClick={() => setApproveModal(post)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-500/10"
                              title={`Approve (reward ${formatCurrency(blogReward)})`}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setRejectModal(post); setRejectReason(""); }}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-error-400 hover:bg-error-500/10"
                              title="Reject"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
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

      {/* ============ Preview Modal ============ */}
      <Modal
        isOpen={!!previewPost}
        onClose={() => setPreviewPost(null)}
        title="Post Preview"
        maxWidth="2xl"
      >
        {previewPost && (
          <div className="space-y-4">
            {previewPost.imageUrl && (
              <img
                src={previewPost.imageUrl}
                alt={previewPost.title}
                className="h-48 w-full rounded-lg object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div>
              <Badge variant="neutral" className="mb-2">{categoryLabel[previewPost.category]}</Badge>
              <h2 className="text-xl font-bold text-white">{previewPost.title}</h2>
            </div>
            <p className="text-sm text-dark-300 italic">{previewPost.summary}</p>
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin rounded-lg border border-dark-800 bg-dark-800/30 p-4">
              <p className="whitespace-pre-wrap text-sm text-dark-200">{previewPost.content}</p>
            </div>
            <div className="flex items-center justify-between border-t border-dark-800 pt-3 text-xs text-dark-500">
              <span>By {previewPost.author?.name ?? "Unknown"}</span>
              <span>{formatDate(previewPost.createdAt)} · {previewPost.views} views</span>
            </div>
          </div>
        )}
      </Modal>

      {/* ============ Approve Modal ============ */}
      <Modal
        isOpen={!!approveModal}
        onClose={() => setApproveModal(null)}
        title="Approve Post"
      >
        <div className="space-y-4">
          <p className="text-sm text-dark-300">
            Approving will publish this post and reward the author{" "}
            <span className="font-semibold text-secondary-400">{formatCurrency(blogReward)}</span>.
          </p>
          {approveModal && (
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3">
              <p className="text-sm font-medium text-white">{approveModal.title}</p>
              <p className="text-xs text-dark-500">By {approveModal.author?.name ?? "Unknown"}</p>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button onClick={() => setApproveModal(null)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleApprove} className="btn btn-success">
              <Check className="h-4 w-4" /> Approve & Publish
            </button>
          </div>
        </div>
      </Modal>

      {/* ============ Reject Modal ============ */}
      <Modal
        isOpen={!!rejectModal}
        onClose={() => setRejectModal(null)}
        title="Reject Post"
      >
        <div className="space-y-4">
          {rejectModal && (
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3">
              <p className="text-sm font-medium text-white">{rejectModal.title}</p>
              <p className="text-xs text-dark-500">By {rejectModal.author?.name ?? "Unknown"}</p>
            </div>
          )}
          <div>
            <label className="label">Reason for rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="This reason will be sent to the author…"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setRejectModal(null)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleReject} className="btn btn-danger">
              <X className="h-4 w-4" /> Reject Post
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
