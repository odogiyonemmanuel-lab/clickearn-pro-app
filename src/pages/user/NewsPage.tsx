import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
  Newspaper, Search, Clock, Gift, Calendar, Tag,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatCurrency, formatDate, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type NewsDoc = {
  _id: string;
  title: string;
  summary: string;
  content: string;
  imageUrl?: string;
  category: string;
  tags: string[];
  readReward: number;
  requiredReadSeconds: number;
  views: number;
  createdAt: number;
  publishedAt?: number;
};

type NewsPageResult = {
  page: NewsDoc[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Gradient placeholders for cards without images.
const gradients = [
  "from-primary-500/30 to-accent-500/30",
  "from-secondary-500/30 to-primary-500/30",
  "from-accent-500/30 to-secondary-500/30",
  "from-primary-600/30 to-primary-400/30",
  "from-secondary-600/30 to-accent-400/30",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

function readTimeText(seconds: number): string {
  if (seconds < 60) return `${seconds}s read`;
  return `${Math.ceil(seconds / 60)} min read`;
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function NewsGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton h-44 w-full" />
          <div className="card-body space-y-3">
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-5 w-full" />
            <div className="skeleton h-4 w-2/3" />
            <div className="flex gap-2 pt-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function NewsPage() {
  const navigate = useNavigate();
  const result = useQuery(api.news.getPublishedNews as any, {
    limit: 50,
  }) as NewsPageResult | undefined;

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const allNews = result?.page ?? [];
  const isLoading = result === undefined;

  // Derive category list from the fetched news.
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const n of allNews) set.add(n.category);
    return ["All", ...Array.from(set).sort()];
  }, [allNews]);

  // Client-side filter on search + active category.
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allNews.filter((n) => {
      if (activeCategory !== "All" && n.category !== activeCategory) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [allNews, search, activeCategory]);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">News</h1>
          <p className="mt-1 text-sm text-dark-400">
            Read articles and earn rewards for your time.
          </p>
        </div>
      </div>

      {/* ---------- Search + filters ---------- */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search news, tags, summaries…"
            className="input pl-10"
          />
        </div>
        {categories.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  activeCategory === cat
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

      {/* ---------- Grid ---------- */}
      {isLoading ? (
        <NewsGridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Newspaper}
            title={search ? "No matching articles" : "No news yet"}
            description={
              search
                ? "Try a different search term or category."
                : "Check back soon for fresh news and articles."
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => {
            const grad = gradientFor(n._id);
            return (
              <button
                key={n._id}
                onClick={() => navigate(`/news/${n._id}`)}
                className="card group flex flex-col overflow-hidden text-left transition-all hover:border-dark-700 hover:shadow-xl hover:shadow-black/30"
              >
                {/* Image / placeholder */}
                <div className="relative h-44 w-full overflow-hidden">
                  {n.imageUrl ? (
                    <img
                      src={n.imageUrl}
                      alt={n.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex h-full w-full items-center justify-center bg-gradient-to-br",
                        grad
                      )}
                    >
                      <Newspaper className="h-10 w-10 text-white/40" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge variant="primary">
                      <Tag className="h-3 w-3" />
                      {n.category}
                    </Badge>
                  </div>
                </div>

                {/* Body */}
                <div className="card-body flex flex-1 flex-col">
                  <h3 className="line-clamp-2 font-semibold text-white group-hover:text-primary-300">
                    {n.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-dark-400">
                    {n.summary}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-dark-800 pt-3 text-xs text-dark-500">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {readTimeText(n.requiredReadSeconds)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(n.publishedAt ?? n.createdAt)}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 font-semibold text-secondary-400">
                      <Gift className="h-3.5 w-3.5" />
                      {formatCurrency(n.readReward)}
                    </span>
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
