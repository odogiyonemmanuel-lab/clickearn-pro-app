import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, Search, MapPin, DollarSign, Gift, Building2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatCurrency, getInitials, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
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
  readReward: number;
  requiredReadSeconds: number;
  views: number;
  createdAt: number;
};

type JobsPageResult = {
  page: JobDoc[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const JOB_TYPES: { value: JobType | "all"; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "remote", label: "Remote" },
  { value: "internship", label: "Internship" },
];

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

function JobsGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-20" />
            </div>
          </div>
          <div className="skeleton h-5 w-3/4" />
          <div className="flex gap-2">
            <div className="skeleton h-5 w-16 rounded-full" />
            <div className="skeleton h-5 w-20 rounded-full" />
          </div>
          <div className="flex justify-between pt-2">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function JobsPage() {
  const navigate = useNavigate();
  const [activeType, setActiveType] = useState<JobType | "all">("all");
  const [search, setSearch] = useState("");

  const result = useQuery(api.jobs.getPublishedJobs as any, {
    type: activeType === "all" ? undefined : activeType,
    limit: 50,
  }) as JobsPageResult | undefined;

  const allJobs = result?.page ?? [];
  const isLoading = result === undefined;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allJobs;
    return allJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
    );
  }, [allJobs, search]);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-2xl font-bold text-white">Jobs</h1>
        <p className="mt-1 text-sm text-dark-400">
          Browse job postings and earn rewards for reading them.
        </p>
      </div>

      {/* ---------- Search + type filter ---------- */}
      <div className="card p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs, companies, locations…"
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setActiveType(t.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                activeType === t.value
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Grid ---------- */}
      {isLoading ? (
        <JobsGridSkeleton />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Briefcase}
            title={search ? "No matching jobs" : "No jobs available"}
            description={
              search
                ? "Try a different search or job type."
                : "Check back soon for new job postings."
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((job) => (
            <button
              key={job._id}
              onClick={() => navigate(`/jobs/${job._id}`)}
              className="card group flex flex-col p-5 text-left transition-all hover:border-dark-700 hover:shadow-xl hover:shadow-black/30"
            >
              {/* Company */}
              <div className="flex items-center gap-3">
                <Avatar name={job.company} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white group-hover:text-primary-300">
                    {job.company}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-dark-500">
                    <Building2 className="h-3 w-3" />
                    Company
                  </p>
                </div>
                <Badge variant={typeVariant[job.type]}>
                  {typeLabel[job.type]}
                </Badge>
              </div>

              {/* Title */}
              <h3 className="mt-4 line-clamp-2 font-semibold text-white group-hover:text-primary-300">
                {job.title}
              </h3>

              {/* Location + salary */}
              <div className="mt-3 space-y-1.5 text-sm text-dark-400">
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{job.location}</span>
                </p>
                {job.salary && (
                  <p className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{job.salary}</span>
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-dark-800 pt-3">
                <span className="flex items-center gap-1 text-xs font-semibold text-secondary-400">
                  <Gift className="h-3.5 w-3.5" />
                  {formatCurrency(job.readReward)}
                </span>
                <span className="text-xs text-dark-500">
                  {getInitials(job.company)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
