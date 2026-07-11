import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  Wallet, TrendingUp, Users, CheckCircle, Gift, ListTodo, ArrowRight,
  Bell, Clock, Coins, type LucideIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  formatCurrency, formatRelativeTime, cn,
} from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type TransactionType =
  | "referral_reward" | "task_reward" | "daily_bonus" | "read_reward"
  | "watch_reward" | "blog_reward" | "cashout" | "cashout_rejected"
  | "admin_credit" | "admin_debit" | "registration_fee";

type Transaction = {
  _id: string;
  type: TransactionType;
  amount: number;
  description: string;
  status: "completed" | "pending" | "failed";
  createdAt: number;
};

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
};

type UserStats = {
  taskCompletions: number;
  referralCount: number;
  referralEarnings: number;
  totalEarned: number;
  completedTasks: number;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Credit-type transactions display as positive (green), debits as negative (red). */
const CREDIT_TYPES = new Set<TransactionType>([
  "referral_reward", "task_reward", "daily_bonus", "read_reward",
  "watch_reward", "blog_reward", "admin_credit",
]);

function isCredit(type: TransactionType): boolean {
  return CREDIT_TYPES.has(type);
}

const transactionTypeLabels: Record<TransactionType, string> = {
  referral_reward: "Referral",
  task_reward: "Task",
  daily_bonus: "Bonus",
  read_reward: "Read",
  watch_reward: "Watch",
  blog_reward: "Blog",
  cashout: "Cash Out",
  cashout_rejected: "Cash Out",
  admin_credit: "Credit",
  admin_debit: "Debit",
  registration_fee: "Fee",
};

function transactionBadgeVariant(
  type: TransactionType
): "primary" | "success" | "warning" | "error" | "neutral" {
  if (CREDIT_TYPES.has(type)) return "success";
  if (type === "cashout") return "warning";
  if (type === "cashout_rejected" || type === "admin_debit") return "error";
  return "neutral";
}

const notificationIconMap: Record<NotificationType, LucideIcon> = {
  info: Bell,
  success: CheckCircle,
  warning: Bell,
  error: Bell,
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

/** Return "Good morning/afternoon/evening" based on the local hour. */
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------------ */
/* Quick actions                                                       */
/* ------------------------------------------------------------------ */

const quickActions: {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  iconBg: string;
  iconText: string;
  ring: string;
}[] = [
  {
    to: "/daily-bonus",
    title: "Daily Bonus",
    description: "Claim your daily reward",
    icon: Gift,
    iconBg: "bg-secondary-500/15",
    iconText: "text-secondary-400",
    ring: "group-hover:border-secondary-500/30",
  },
  {
    to: "/tasks",
    title: "Complete Tasks",
    description: "Earn from available tasks",
    icon: ListTodo,
    iconBg: "bg-primary-500/15",
    iconText: "text-primary-400",
    ring: "group-hover:border-primary-500/30",
  },
  {
    to: "/referrals",
    title: "Refer Friends",
    description: "Invite & earn commissions",
    icon: Users,
    iconBg: "bg-primary-500/15",
    iconText: "text-primary-400",
    ring: "group-hover:border-primary-500/30",
  },
  {
    to: "/cashout",
    title: "Cash Out",
    description: "Withdraw your earnings",
    icon: Wallet,
    iconBg: "bg-accent-500/15",
    iconText: "text-accent-400",
    ring: "group-hover:border-accent-500/30",
  },
];

/* ------------------------------------------------------------------ */
/* Loading skeletons                                                   */
/* ------------------------------------------------------------------ */

function StatCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-7 w-32" />
        </div>
        <div className="skeleton h-11 w-11 rounded-lg" />
      </div>
    </div>
  );
}

function QuickActionSkeleton() {
  return (
    <div className="card p-5">
      <div className="skeleton mb-3 h-11 w-11 rounded-lg" />
      <div className="skeleton mb-2 h-4 w-28" />
      <div className="skeleton h-3 w-36" />
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="skeleton h-9 w-9 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
      </div>
      <div className="skeleton h-4 w-16" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { user, wallet, isLoading: userLoading } = useCurrentUser();
  const stats = useQuery(api.users.getUserStats as any) as UserStats | undefined;
  const transactionsResult = useQuery(api.transactions.getMyTransactions as any, {
    limit: 5,
  }) as { page: Transaction[]; isDone: boolean } | undefined;
  const notificationsResult = useQuery(api.notifications.getMyNotifications as any, {
    limit: 5,
  }) as { page: Notification[]; isDone: boolean } | undefined;

  const statsLoading = stats === undefined;
  const txLoading = transactionsResult === undefined;
  const notifLoading = notificationsResult === undefined;

  const transactions = transactionsResult?.page ?? [];
  const notifications = notificationsResult?.page ?? [];

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* ---------- Greeting ---------- */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {getGreeting()}, {firstName}! 👋
        </h1>
        <p className="mt-1 text-sm text-dark-400">
          Here's a summary of your earnings and activity.
        </p>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {userLoading || statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Wallet Balance"
              value={formatCurrency(wallet?.available)}
              icon={Wallet}
              color="blue"
            />
            <StatCard
              title="Total Earned"
              value={formatCurrency(wallet?.totalEarned ?? stats?.totalEarned)}
              icon={TrendingUp}
              color="green"
            />
            <StatCard
              title="Referral Earnings"
              value={formatCurrency(stats?.referralEarnings)}
              icon={Users}
              color="orange"
            />
            <StatCard
              title="Completed Tasks"
              value={stats?.completedTasks ?? 0}
              icon={CheckCircle}
              color="red"
            />
          </>
        )}
      </div>

      {/* ---------- Quick actions ---------- */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {userLoading
            ? Array.from({ length: 4 }).map((_, i) => <QuickActionSkeleton key={i} />)
            : quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={cn(
                    "group card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30",
                    action.ring
                  )}
                >
                  <div
                    className={cn(
                      "mb-3 flex h-11 w-11 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110",
                      action.iconBg
                    )}
                  >
                    <action.icon className={cn("h-5 w-5", action.iconText)} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{action.title}</h3>
                  <p className="mt-0.5 text-xs text-dark-400">{action.description}</p>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-dark-500 transition-colors group-hover:text-primary-400">
                    Open
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
        </div>
      </div>

      {/* ---------- Recent activity (two columns) ---------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent transactions */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-white">Recent Transactions</h2>
            <Link
              to="/wallet"
              className="text-xs font-medium text-primary-400 transition-colors hover:text-primary-300"
            >
              View all
            </Link>
          </div>
          <div>
            {txLoading ? (
              <div className="divide-y divide-dark-800">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ListItemSkeleton key={i} />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No transactions yet"
                description="Your earnings will appear here once you complete tasks or claim bonuses."
              />
            ) : (
              <div className="divide-y divide-dark-800">
                {transactions.map((tx) => {
                  const credit = isCredit(tx.type);
                  return (
                    <div
                      key={tx._id}
                      className="flex items-center justify-between gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={transactionBadgeVariant(tx.type)}>
                            {transactionTypeLabels[tx.type]}
                          </Badge>
                          <span className="truncate text-sm text-dark-300">
                            {tx.description}
                          </span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-dark-500">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(tx.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          credit ? "text-secondary-400" : "text-red-400"
                        )}
                      >
                        {credit ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Latest notifications */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-base font-semibold text-white">Latest Notifications</h2>
            <Link
              to="/notifications"
              className="text-xs font-medium text-primary-400 transition-colors hover:text-primary-300"
            >
              View all
            </Link>
          </div>
          <div>
            {notifLoading ? (
              <div className="divide-y divide-dark-800">
                {Array.from({ length: 4 }).map((_, i) => (
                  <ListItemSkeleton key={i} />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No notifications"
                description="You're all caught up! New notifications will show up here."
              />
            ) : (
              <div className="divide-y divide-dark-800">
                {notifications.map((n) => {
                  const Icon = notificationIconMap[n.type] ?? Bell;
                  return (
                    <div
                      key={n._id}
                      className={cn(
                        "flex items-start gap-3 px-5 py-3.5",
                        !n.isRead && "bg-primary-500/[0.04]"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          notificationIconColor[n.type] ??
                            "bg-primary-500/15 text-primary-400"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-dark-400">
                          {n.body}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-dark-500">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
