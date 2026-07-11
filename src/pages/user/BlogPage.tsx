import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate, Link } from "react-router-dom";
import {
  PenLine, Search, Plus, Tag, Calendar, FileText,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatDate, getInitials, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type PostStatus = "pending" | "approved" | "rejected" | "published";

type PostDoc = {
  _id: string;
  authorId: string;
  title: string;
  content: string;
  summary: string;
  category: "news" | "job" | "article" | "review" | "tutorial";
  imageUrl?: string;
  tags: string[];
  status: PostStatus;
  reward: number;
  views: number;
  createdAt: number;
  publishedAt?: number;
  adminNote?: string;
};

type PublishedPost = PostDoc & {
  author: { name: string | null; image: string | null } | null;
};

type PaginatedResult = {
  page: PostDoc[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Status helpers                                                      */
/* ------------------------------------------------------------------ */

const statusVariant: Record<PostStatus, "warning" | "primary" | "error" | "success"> = {
  pending: "warning",
  approved: "primary",
  rejected: "error",
  published: "success",
};

const statusLabel: Record<PostStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function BlogListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-20" />
            </div>
          </div>
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function BlogPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");

  const publishedResult = useQuery(api.posts.getPublishedPosts as any, {
    paginationOpts: { numItems: 50, cursor: null },
  }) as PaginatedResult | undefined;

  const myResult = useQuery(api.posts.getMyPosts as any, {
    paginationOpts: { numItems: 50, cursor: null },
  }) as PaginatedResult | undefined;

  const publishedPosts = (publishedResult?.page ?? []) as PublishedPost[];
  const myPosts = myResult?.page ?? [];
  const isLoading =
    tab === "all" ? publishedResult === undefined : myResult === undefined;

  // Derive categories from whichever tab is active.
  const categories = useMemo(() => {
    const set = new Set<string>();
    const source = tab === "all" ? publishedPosts : myPosts;
    for (const p of source) set.add(p.category);
    return ["All", ...Array.from(set).sort()];
  }, [publishedPosts, myPosts, tab]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const source = tab === "all" ? publishedPosts : myPosts;
    return source.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [tab, publishedPosts, myPosts, search, category]);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Blog</h1>
          <p className="mt-1 text-sm text-dark-400">
            Read community posts or submit your own to earn rewards.
          </p>
        </div>
        <Link to="/blog/create" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          Submit Post
        </Link>
      </div>

      {/* ---------- Tabs ---------- */}
      <div className="card p-4 space-y-4">
        <div className="flex gap-2">
          {[
            { value: "all", label: "All Posts" },
            { value: "mine", label: "My Posts" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value as "all" | "mine")}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                tab === t.value
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + category */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts…"
              className="input pl-10"
            />
          </div>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    category === cat
                      ? "bg-primary-600 text-white"
                      : "bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---------- List ---------- */}
      {isLoading ? (
        <BlogListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={PenLine}
            title={
              tab === "mine"
                ? "You haven't submitted any posts"
                : search
                ? "No matching posts"
                : "No posts yet"
            }
            description={
              tab === "mine"
                ? "Share your knowledge and earn rewards by submitting a post."
                : search
                ? "Try a different search or category."
                : "Be the first to publish a post!"
            }
            action={
              tab === "mine"
                ? { label: "Submit Post", onClick: () => navigate("/blog/create") }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const author = (post as PublishedPost).author ?? null;
            const isMyPost = tab === "mine";
            return (
              <button
                key={post._id}
                onClick={() => navigate(`/blog/${post._id}`)}
                className="card group block w-full p-5 text-left transition-all hover:border-dark-700 hover:shadow-xl hover:shadow-black/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {/* Author row */}
                    <div className="mb-3 flex items-center gap-2">
                      <Avatar
                        name={author?.name ?? "You"}
                        src={author?.image ?? undefined}
                        size="sm"
                      />
                      <span className="text-xs text-dark-400">
                        {author?.name ?? "Unknown author"}
                      </span>
                      <span className="text-xs text-dark-600">•</span>
                      <span className="flex items-center gap-1 text-xs text-dark-500">
                        <Calendar className="h-3 w-3" />
                        {formatDate(post.publishedAt ?? post.createdAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-white group-hover:text-primary-300">
                      {post.title}
                    </h3>

                    {/* Summary */}
                    {post.summary && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-dark-400">
                        {post.summary}
                      </p>
                    )}

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {post.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-dark-800 px-2 py-0.5 text-xs text-dark-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right column: category + status */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant="primary">
                      <Tag className="h-3 w-3" />
                      {post.category}
                    </Badge>
                    {isMyPost && (
                      <Badge variant={statusVariant[post.status]}>
                        {statusLabel[post.status]}
                      </Badge>
                    )}
                    {post.status === "rejected" && post.adminNote && (
                      <p className="mt-1 max-w-[160px] text-right text-xs text-error-400">
                        {post.adminNote}
                      </p>
                    )}
                    {post.status === "published" && post.reward > 0 && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-secondary-400">
                        <FileText className="h-3 w-3" />
                        {post.reward > 0 ? `+${post.reward}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
