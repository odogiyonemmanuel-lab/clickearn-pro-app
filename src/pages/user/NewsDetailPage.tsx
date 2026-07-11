import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  ArrowLeft, Clock, Gift, Tag, Calendar, Eye, Share2,
  CheckCircle2, Loader2, Link2, MessageCircle, Twitter,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  formatCurrency, formatDate, copyToClipboard, cn,
} from "../../lib/utils";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type NewsDoc = {
  _id: string;
  title: string;
  content: string;
  summary: string;
  imageUrl?: string;
  category: string;
  tags: string[];
  readReward: number;
  requiredReadSeconds: number;
  views: number;
  totalReaders: number;
  createdAt: number;
  publishedAt?: number;
};

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="skeleton h-9 w-32 rounded-lg" />
      <div className="card overflow-hidden">
        <div className="skeleton h-64 w-full" />
        <div className="card-body space-y-4">
          <div className="skeleton h-7 w-3/4" />
          <div className="flex gap-2">
            <div className="skeleton h-5 w-20 rounded-full" />
            <div className="skeleton h-5 w-24 rounded-full" />
          </div>
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const news = useQuery(
    api.news.getNewsById as any,
    id ? { newsId: id } : "skip"
  ) as NewsDoc | null | undefined;

  const incrementViews = useMutation(api.news.incrementNewsViews as any);
  const trackNewsRead = useMutation(api.rewards.trackNewsRead as any);
  const claimNewsReward = useMutation(api.rewards.claimNewsReward as any);

  const [elapsed, setElapsed] = useState(0); // seconds spent on page
  const [canClaim, setCanClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [shared, setShared] = useState(false);

  const trackedRef = useRef(false);
  const viewedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  /* ---------- Track read + increment views on mount ---------- */
  useEffect(() => {
    if (!id || !news || trackedRef.current) return;
    trackedRef.current = true;
    startTimeRef.current = Date.now();

    (async () => {
      try {
        await trackNewsRead({ newsId: id });
      } catch {
        /* non-fatal */
      }
    })();

    if (!viewedRef.current) {
      viewedRef.current = true;
      (async () => {
        try {
          await incrementViews({ newsId: id });
        } catch {
          /* non-fatal */
        }
      })();
    }
  }, [id, news, trackNewsRead, incrementViews]);

  /* ---------- Reading timer ---------- */
  useEffect(() => {
    if (!news) return;
    const required = news.requiredReadSeconds;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= required) {
        setCanClaim(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [news]);

  const requiredSeconds = news?.requiredReadSeconds ?? 0;
  const progress = requiredSeconds > 0
    ? Math.min(100, (elapsed / requiredSeconds) * 100)
    : 100;

  /* ---------- Claim reward ---------- */
  const handleClaim = useCallback(async () => {
    if (!id) return;
    setIsClaiming(true);
    try {
      const res = await claimNewsReward({ newsId: id });
      setClaimed(true);
      toast.success(`You earned ${formatCurrency(res.reward)}!`);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to claim reward";
      if (msg.includes("already")) {
        setClaimed(true);
        toast.success("Reward already claimed for this article.");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsClaiming(false);
    }
  }, [id, claimNewsReward]);

  /* ---------- Share ---------- */
  const shareUrl =
    typeof window !== "undefined" ? window.location.href : "";
  const shareText = news ? `${news.title} — via ClickEarn Pro` : "";

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      toast.success("Link copied!");
    } else {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: news?.title, text: shareText, url: shareUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopyLink();
    }
  };

  const handleTwitterShare = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      shareText
    )}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShared(true);
  };

  if (news === undefined) {
    return (
      <div className="mx-auto max-w-3xl">
        <DetailSkeleton />
      </div>
    );
  }

  if (news === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card p-10 text-center">
          <p className="text-sm text-dark-400">
            This article could not be found or is no longer available.
          </p>
          <button
            onClick={() => navigate("/news")}
            className="btn btn-secondary mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to News
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ---------- Back ---------- */}
      <button
        onClick={() => navigate("/news")}
        className="btn btn-ghost btn-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to News
      </button>

      {/* ---------- Article ---------- */}
      <article className="card overflow-hidden">
        {news.imageUrl && (
          <div className="relative h-64 w-full overflow-hidden sm:h-80">
            <img
              src={news.imageUrl}
              alt={news.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="card-body space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              <Tag className="h-3 w-3" />
              {news.category}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-dark-500">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(news.publishedAt ?? news.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-xs text-dark-500">
              <Eye className="h-3.5 w-3.5" />
              {news.views} views
            </span>
            <span className="flex items-center gap-1 text-xs text-dark-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {news.totalReaders} readers
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {news.title}
          </h1>
          {news.summary && (
            <p className="text-base text-dark-300">{news.summary}</p>
          )}

          {/* Content */}
          <div className="prose prose-invert max-w-none">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-dark-200">
              {news.content}
            </p>
          </div>

          {/* Tags */}
          {news.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {news.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-dark-800 px-2.5 py-0.5 text-xs text-dark-400"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>

      {/* ---------- Reading timer + reward ---------- */}
      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-400" />
              <span className="text-sm font-semibold text-white">
                Reading Timer
              </span>
            </div>
            <span className="font-mono text-sm text-dark-400 tabular-nums">
              {Math.floor(elapsed / 60)}:
              {(elapsed % 60).toString().padStart(2, "0")} /{" "}
              {Math.floor(requiredSeconds / 60)}:
              {(requiredSeconds % 60).toString().padStart(2, "0")}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-dark-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                claimed
                  ? "bg-secondary-500"
                  : canClaim
                  ? "bg-secondary-500"
                  : "bg-primary-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-dark-400">
              <Gift className="h-4 w-4 text-secondary-400" />
              Reward:{" "}
              <span className="font-semibold text-secondary-400">
                {formatCurrency(news.readReward)}
              </span>
            </span>

            {claimed ? (
              <Badge variant="success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Reward Claimed
              </Badge>
            ) : (
              <button
                onClick={handleClaim}
                disabled={!canClaim || isClaiming}
                className="btn btn-success btn-sm"
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming…
                  </>
                ) : canClaim ? (
                  <>
                    <Gift className="h-4 w-4" />
                    Claim Reward
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4" />
                    Keep reading…
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Share ---------- */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-dark-400" />
            <span className="text-sm font-semibold text-white">
              Share this article
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleCopyLink}
              className="btn btn-secondary btn-sm"
            >
              <Link2 className="h-4 w-4" />
              Copy Link
            </button>
            <button
              onClick={handleTwitterShare}
              className="btn btn-secondary btn-sm"
            >
              <Twitter className="h-4 w-4" />
              Tweet
            </button>
            <button
              onClick={handleNativeShare}
              className="btn btn-secondary btn-sm"
            >
              <MessageCircle className="h-4 w-4" />
              Share
            </button>
            {shared && (
              <span className="text-xs text-secondary-400">Thanks for sharing!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
