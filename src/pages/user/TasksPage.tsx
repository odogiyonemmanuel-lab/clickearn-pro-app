import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  ListTodo, MousePointerClick, Eye, FileText, Share2, Coins, Clock,
  CheckCircle, Gift, Play, ExternalLink, Loader2, Zap, Lock,
  type LucideIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatCurrency, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TaskType = "click" | "watch" | "read" | "social" | "sponsor";

type CompletionStatus = {
  completedToday: number;
  lastCompletedAt: number | null;
  canComplete: boolean;
  nextAvailableAt: number | null;
};

type Task = {
  _id: string;
  title: string;
  description: string;
  type: TaskType;
  reward: number;
  url?: string;
  videoUrl?: string;
  imageUrl?: string;
  requiredWatchPercent?: number;
  requiredReadSeconds?: number;
  cooldownHours: number;
  dailyLimit: number;
  totalCompletions: number;
  maxCompletions?: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: number;
  expiresAt?: number;
  completionStatus: CompletionStatus;
};

type FilterTab = "all" | TaskType;

/* ------------------------------------------------------------------ */
/* Static config                                                       */
/* ------------------------------------------------------------------ */

const FILTER_TABS: { value: FilterTab; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "All", icon: ListTodo },
  { value: "click", label: "Click", icon: MousePointerClick },
  { value: "watch", label: "Watch", icon: Eye },
  { value: "read", label: "Read", icon: FileText },
  { value: "social", label: "Social", icon: Share2 },
];

const taskTypeIcon: Record<TaskType, LucideIcon> = {
  click: MousePointerClick,
  watch: Eye,
  read: FileText,
  social: Share2,
  sponsor: Gift,
};

const taskTypeIconColor: Record<TaskType, string> = {
  click: "bg-primary-500/15 text-primary-400",
  watch: "bg-accent-500/15 text-accent-400",
  read: "bg-secondary-500/15 text-secondary-400",
  social: "bg-primary-500/15 text-primary-400",
  sponsor: "bg-secondary-500/15 text-secondary-400",
};

/* ------------------------------------------------------------------ */
/* Cooldown countdown hook                                             */
/* ------------------------------------------------------------------ */

/** Returns a human-readable countdown for a future timestamp, re-rendering every second. */
function useCountdown(target: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (target === null) return null;
  const remaining = target - now;
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

function TaskCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="skeleton h-11 w-11 rounded-lg" />
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-3 w-20" />
          </div>
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
      </div>
      <div className="skeleton mt-4 h-10 w-full rounded-lg" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Task card                                                           */
/* ------------------------------------------------------------------ */

function TaskCard({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (task: Task) => void;
}) {
  const [completing, setCompleting] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);

  const Icon = taskTypeIcon[task.type] ?? ListTodo;
  const iconColor = taskTypeIconColor[task.type] ?? "bg-primary-500/15 text-primary-400";
  const countdown = useCountdown(task.completionStatus.nextAvailableAt);

  const { canComplete, completedToday, nextAvailableAt } = task.completionStatus;
  const dailyLimitReached =
    task.dailyLimit > 0 && completedToday >= task.dailyLimit;
  const onCooldown = nextAvailableAt !== null && !canComplete;

  const handleStart = () => {
    if (task.type === "watch") {
      setShowWatchModal(true);
      return;
    }
    if (task.type === "click" && task.url) {
      window.open(task.url, "_blank", "noopener,noreferrer");
    }
    if (task.type === "social" && task.url) {
      window.open(task.url, "_blank", "noopener,noreferrer");
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    await onComplete(task);
    setCompleting(false);
  };

  // Status badge content
  let statusBadge: React.ReactNode;
  if (canComplete) {
    statusBadge = (
      <Badge variant="success">
        <CheckCircle className="h-3 w-3" />
        Available
      </Badge>
    );
  } else if (onCooldown && countdown) {
    statusBadge = (
      <Badge variant="warning">
        <Clock className="h-3 w-3" />
        Cooldown {countdown}
      </Badge>
    );
  } else if (dailyLimitReached) {
    statusBadge = (
      <Badge variant="neutral">
        <CheckCircle className="h-3 w-3" />
        Completed today
      </Badge>
    );
  } else {
    statusBadge = (
      <Badge variant="neutral">
        <Lock className="h-3 w-3" />
        Unavailable
      </Badge>
    );
  }

  return (
    <>
      <div className="card flex flex-col p-5 transition-all duration-200 hover:border-dark-700 hover:shadow-xl hover:shadow-black/30">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                iconColor
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight text-white">
                {task.title}
              </h3>
              <p className="mt-0.5 text-xs capitalize text-dark-500">
                {task.type} task
              </p>
            </div>
          </div>
          <Badge variant="success">
            <Coins className="h-3 w-3" />
            {formatCurrency(task.reward)}
          </Badge>
        </div>

        {/* Description */}
        <p className="mt-3 flex-1 text-sm text-dark-400">{task.description}</p>

        {/* Meta row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-dark-500">
          {statusBadge}
          {task.dailyLimit > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {completedToday}/{task.dailyLimit} today
            </span>
          )}
          {task.cooldownHours > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.cooldownHours}h cooldown
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          {canComplete ? (
            <>
              {(task.type === "click" || task.type === "social" || task.type === "watch") &&
                task.url || task.type === "watch" ? (
                <button
                  onClick={handleStart}
                  className="btn btn-secondary flex-1"
                  disabled={completing}
                >
                  <Play className="h-4 w-4" />
                  Start Task
                </button>
              ) : null}
              <button
                onClick={handleComplete}
                className="btn btn-success flex-1"
                disabled={completing}
              >
                {completing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Completing…
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Complete
                  </>
                )}
              </button>
            </>
          ) : (
            <button className="btn btn-secondary w-full" disabled>
              {onCooldown ? (
                <>
                  <Clock className="h-4 w-4" />
                  Available in {countdown ?? "—"}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Completed Today
                </>
              )}
            </button>
          )}
        </div>

        {/* External link hint for click/social */}
        {(task.type === "click" || task.type === "social") && task.url && canComplete && (
          <p className="mt-2 flex items-center gap-1 text-xs text-dark-500">
            <ExternalLink className="h-3 w-3" />
            Opens in a new tab — return here to complete.
          </p>
        )}
      </div>

      {/* Watch task modal */}
      <Modal
        isOpen={showWatchModal}
        onClose={() => setShowWatchModal(false)}
        title={task.title}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Video embed placeholder */}
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-dark-700 bg-dark-950">
            {task.videoUrl ? (
              <iframe
                src={task.videoUrl}
                title={task.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-dark-500">
                <Eye className="h-10 w-10" />
                <p className="text-sm">Video player placeholder</p>
                <p className="text-xs text-dark-600">
                  Watch the video, then mark this task complete.
                </p>
              </div>
            )}
          </div>

          <p className="text-sm text-dark-400">{task.description}</p>

          {task.requiredWatchPercent !== undefined && (
            <p className="text-xs text-dark-500">
              Watch at least {task.requiredWatchPercent}% of the video to earn the
              reward.
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-dark-800 pt-4">
            <div className="flex items-center gap-2 text-sm">
              <Coins className="h-4 w-4 text-secondary-400" />
              <span className="font-semibold text-secondary-400">
                {formatCurrency(task.reward)}
              </span>
              <span className="text-dark-500">reward</span>
            </div>
            <button
              onClick={async () => {
                setShowWatchModal(false);
                await onComplete(task);
              }}
              className="btn btn-success"
              disabled={completing}
            >
              <CheckCircle className="h-4 w-4" />
              Mark as Watched
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function TasksPage() {
  const tasks = useQuery(api.tasks.getActiveTasks as any) as Task[] | undefined;
  const completeTask = useMutation(api.tasks.completeTask as any);

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (activeFilter === "all") return tasks;
    return tasks.filter((t) => t.type === activeFilter);
  }, [tasks, activeFilter]);

  const handleComplete = useCallback(
    async (task: Task) => {
      try {
        const result = await completeTask({ taskId: task._id as any });
        const reward = (result as any)?.reward ?? task.reward;
        toast.success(
          `Task completed! You earned ${formatCurrency(reward)}.`
        );
      } catch (err: any) {
        const message = err?.message ?? "Failed to complete task";
        toast.error(message);
      }
    },
    [completeTask]
  );

  const isLoading = tasks === undefined;

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-xl font-bold text-white">Tasks</h1>
        <p className="mt-0.5 text-sm text-dark-400">
          Complete tasks to earn rewards. New tasks are added regularly.
        </p>
      </div>

      {/* ---------- Filter tabs ---------- */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "btn btn-sm gap-1.5",
                isActive ? "btn-primary" : "btn-secondary"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {isActive && tasks && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px] font-bold">
                  {tab.value === "all"
                    ? tasks.length
                    : tasks.filter((t) => t.type === tab.value).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ---------- Task grid ---------- */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Zap}
            title="No tasks available"
            description={
              activeFilter === "all"
                ? "There are no active tasks right now. Check back soon for new earning opportunities!"
                : `No ${activeFilter} tasks are available right now. Try a different category.`
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
