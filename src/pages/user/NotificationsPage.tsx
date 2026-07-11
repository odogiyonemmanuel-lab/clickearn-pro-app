import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  Bell, CheckCircle, Clock, Check, Coins, Wallet, Users,
  AlertCircle, type LucideIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { formatRelativeTime, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type NotificationType =
  | "info" | "success" | "warning" | "error" | "reward" | "cashout"
  | "referral" | "task" | "message" | "announcement";

type Notification = {
  _id: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: number;
  link?: string;
};

type PaginatedResult = {
  page: Notification[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const notificationIconMap: Record<NotificationType, LucideIcon> = {
  info: Bell,
  success: CheckCircle,
  warning: AlertCircle,
  error: AlertCircle,
  reward: Coins,
  cashout: Wallet,
  referral: Users,
  task: CheckCircle,
  message: Bell,
  announcement: Bell,
};

const notificationIconColor: Record<NotificationType, string> = {
  info: "bg-primary-500/15 text-primary-400",
  success: "bg-secondary-500/15 text-secondary-400",
  warning: "bg-warning-500/15 text-amber-400",
  error: "bg-error-500/15 text-red-400",
  reward: "bg-secondary-500/15 text-secondary-400",
  cashout: "bg-accent-500/15 text-accent-400",
  referral: "bg-primary-500/15 text-primary-400",
  task: "bg-secondary-500/15 text-secondary-400",
  message: "bg-primary-500/15 text-primary-400",
  announcement: "bg-accent-500/15 text-accent-400",
};

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="skeleton h-10 w-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-20" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single notification row                                             */
/* ------------------------------------------------------------------ */

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const Icon = notificationIconMap[notification.type] ?? Bell;
  const iconColor =
    notificationIconColor[notification.type] ??
    "bg-primary-500/15 text-primary-400";

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkRead(notification._id);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 border-b border-dark-800 px-5 py-4 text-left transition-colors last:border-0",
        !notification.isRead
          ? "bg-primary-500/[0.05] hover:bg-primary-500/[0.08]"
          : "hover:bg-dark-800/50"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          iconColor
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "truncate text-sm",
              notification.isRead
                ? "font-medium text-dark-200"
                : "font-semibold text-white"
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500 ring-2 ring-primary-500/20" />
          )}
        </div>
        <p className="mt-1 text-sm text-dark-400">{notification.body}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-dark-500">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function NotificationsPage() {
  const markAsRead = useMutation(api.notifications.markAsRead as any);
  const markAllRead = useMutation(api.notifications.markAllRead as any);

  // Pagination state — track the cursor across "load more" clicks.
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulated, setAccumulated] = useState<Notification[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  const result = useQuery(
    api.notifications.getMyNotifications as any,
    { limit: 20, cursor }
  ) as PaginatedResult | undefined;

  // The first page (cursor null) is the "base" view.
  const isFirstPage = cursor === null;
  const baseResult = isFirstPage ? result : undefined;
  const isLoading = baseResult === undefined;

  const baseNotifications = baseResult?.page ?? [];
  const hasMoreBase = baseResult ? !baseResult.isDone : false;

  // Combine base + loaded-more pages for display.
  const allNotifications =
    cursor === null ? baseNotifications : [...accumulated, ...(result?.page ?? [])];
  const isFullyLoaded = cursor === null
    ? !hasMoreBase
    : result
      ? result.isDone
      : false;

  const unreadCount = allNotifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead({ notificationId: id as any });
      // Optimistic local update so the UI feels instant.
      setAccumulated((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to mark notification");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await markAllRead({});
      const count = (res as any)?.count ?? 0;
      if (count > 0) {
        toast.success(`Marked ${count} notification${count === 1 ? "" : "s"} as read`);
      } else {
        toast("No unread notifications", { icon: "✓" });
      }
      // Optimistically clear unread state for currently visible items.
      setAccumulated((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to mark all as read");
    }
  };

  const handleLoadMore = () => {
    if (!baseResult || baseResult.isDone || loadingMore) return;
    setLoadingMore(true);
    setAccumulated(baseNotifications);
    setCursor(baseResult.continueCursor || null);
    // Reset loading flag once the next page query starts resolving.
    setTimeout(() => setLoadingMore(false), 100);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="mt-0.5 text-sm text-dark-400">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
              : "You're all caught up."}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn btn-secondary btn-sm"
            disabled={isLoading}
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      {/* ---------- List ---------- */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-dark-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <NotificationSkeleton key={i} />
            ))}
          </div>
        ) : allNotifications.length === 0 ? (
          <EmptyState
            icon={CheckCircle}
            title="All caught up!"
            description="You have no notifications right now. New activity will appear here."
          />
        ) : (
          <>
            <div className="divide-y divide-dark-800">
              {allNotifications.map((n) => (
                <NotificationRow
                  key={n._id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>

            {/* Load more */}
            {!isFullyLoaded && (
              <div className="p-4 text-center">
                <button
                  onClick={handleLoadMore}
                  className="btn btn-secondary"
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-dark-500 border-t-dark-300" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Load more
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
