import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  ArrowLeft, Clock, Gift, MapPin, DollarSign, Building2,
  CheckCircle2, Loader2, ExternalLink, Eye, ListChecks,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatCurrency, formatDate, cn } from "../../lib/utils";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type JobType =
  | "full_time"
  | "part_time"
  | "contract"
  | "remote"
  | "internship";

type JobDoc = {
  _id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  salary?: string;
  description: string;
  requirements: string;
  applyUrl?: string;
  readReward: number;
  requiredReadSeconds: number;
  views: number;
  totalReaders: number;
  createdAt: number;
};

const typeLabel: Record<JobType, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  remote: "Remote",
  internship: "Internship",
};

const typeVariant: Record<JobType, "primary" | "success" | "warning" | "neutral"> = {
  full_time: "primary",
  part_time: "success",
  contract: "warning",
  remote: "neutral",
  internship: "neutral",
};

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="skeleton h-9 w-32 rounded-lg" />
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-6 w-2/3" />
            <div className="skeleton h-4 w-1/3" />
          </div>
        </div>
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const job = useQuery(
    api.jobs.getJobById as any,
    id ? { jobId: id } : "skip"
  ) as JobDoc | null | undefined;

  const incrementViews = useMutation(api.jobs.incrementJobViews as any);
  const trackJobRead = useMutation(api.rewards.trackJobRead as any);
  const claimJobReward = useMutation(api.rewards.claimJobReward as any);

  const [elapsed, setElapsed] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const trackedRef = useRef(false);
  const viewedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  /* ---------- Track read + views on mount ---------- */
  useEffect(() => {
    if (!id || !job || trackedRef.current) return;
    trackedRef.current = true;
    startTimeRef.current = Date.now();

    (async () => {
      try {
        await trackJobRead({ jobId: id });
      } catch {
        /* non-fatal */
      }
    })();

    if (!viewedRef.current) {
      viewedRef.current = true;
      (async () => {
        try {
          await incrementViews({ jobId: id });
        } catch {
          /* non-fatal */
        }
      })();
    }
  }, [id, job, trackJobRead, incrementViews]);

  /* ---------- Reading timer ---------- */
  useEffect(() => {
    if (!job) return;
    const required = job.requiredReadSeconds;
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(secs);
      if (secs >= required) {
        setCanClaim(true);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [job]);

  const requiredSeconds = job?.requiredReadSeconds ?? 0;
  const progress = requiredSeconds > 0
    ? Math.min(100, (elapsed / requiredSeconds) * 100)
    : 100;

  /* ---------- Claim ---------- */
  const handleClaim = useCallback(async () => {
    if (!id) return;
    setIsClaiming(true);
    try {
      const res = await claimJobReward({ jobId: id });
      setClaimed(true);
      toast.success(`You earned ${formatCurrency(res.reward)}!`);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to claim reward";
      if (msg.includes("already")) {
        setClaimed(true);
        toast.success("Reward already claimed for this job.");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsClaiming(false);
    }
  }, [id, claimJobReward]);

  if (job === undefined) {
    return (
      <div className="mx-auto max-w-3xl">
        <DetailSkeleton />
      </div>
    );
  }

  if (job === null) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card p-10 text-center">
          <p className="text-sm text-dark-400">
            This job posting could not be found or is no longer available.
          </p>
          <button
            onClick={() => navigate("/jobs")}
            className="btn btn-secondary mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ---------- Back ---------- */}
      <button
        onClick={() => navigate("/jobs")}
        className="btn btn-ghost btn-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </button>

      {/* ---------- Job header ---------- */}
      <div className="card">
        <div className="card-body space-y-5">
          <div className="flex items-start gap-4">
            <Avatar name={job.company} size="xl" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white">{job.title}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-dark-300">
                <Building2 className="h-4 w-4" />
                {job.company}
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={typeVariant[job.type]}>{typeLabel[job.type]}</Badge>
            <span className="flex items-center gap-1 text-xs text-dark-500">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </span>
            <span className="flex items-center gap-1 text-xs text-dark-500">
              <Eye className="h-3.5 w-3.5" />
              {job.views} views
            </span>
            <span className="flex items-center gap-1 text-xs text-dark-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {job.totalReaders} readers
            </span>
            <span className="text-xs text-dark-500">
              {formatDate(job.createdAt)}
            </span>
          </div>

          {/* Salary */}
          {job.salary && (
            <div className="flex items-center gap-2 rounded-lg bg-secondary-500/10 px-4 py-3">
              <DollarSign className="h-5 w-5 text-secondary-400" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-dark-500">
                  Salary
                </p>
                <p className="text-sm font-semibold text-white">{job.salary}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Description ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">
            Job Description
          </h2>
        </div>
        <div className="card-body">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-dark-200">
            {job.description}
          </p>
        </div>
      </div>

      {/* ---------- Requirements ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Requirements</h2>
          <ListChecks className="h-4 w-4 text-dark-400" />
        </div>
        <div className="card-body">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-dark-200">
            {job.requirements}
          </p>
        </div>
      </div>

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

          <div className="h-2 w-full overflow-hidden rounded-full bg-dark-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000",
                claimed || canClaim ? "bg-secondary-500" : "bg-primary-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-dark-400">
              <Gift className="h-4 w-4 text-secondary-400" />
              Reward:{" "}
              <span className="font-semibold text-secondary-400">
                {formatCurrency(job.readReward)}
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

      {/* ---------- Apply ---------- */}
      {job.applyUrl && (
        <div className="card">
          <div className="card-body">
            <a
              href={job.applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary w-full"
            >
              <ExternalLink className="h-4 w-4" />
              Apply Now
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
