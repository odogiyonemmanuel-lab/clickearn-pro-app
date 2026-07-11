import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import {
  Users, UserPlus, CreditCard, Wallet, UserCheck, FlagTriangleRight,
  ArrowRight, Activity, MousePointerClick, Eye, BookOpen, Share2,
  Megaphone, BarChart3, TrendingUp,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  cn, formatCurrency, formatRelativeTime, getInitials,
} from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type DashboardStats = {
  totalUsers: number;
  newUsersToday: number;
  totalPaidOut: number;
  pendingCashouts: { count: number; totalAmount: number };
  pendingReferrals: number;
  pendingReports: number;
  activeUsers: number;
  totalTasks: number;
  pendingPosts: number;
  totalListings: number;
};

type ChartPoint = { date: string; newUsers: number; earnings: number };

type ActivityItem = {
  _id: string;
  action: string;
  createdAt: number;
  actor: { name: string | null; image: string | null } | null;
};

const chartGridStroke = "#1e293b";
const chartTextFill = "#94a3b8";

const quickActions = [
  {
    to: "/admin/cashouts",
    label: "Manage Cashouts",
    description: "Review pending withdrawal requests",
    icon: CreditCard,
    color: "text-primary-400 bg-primary-500/15",
  },
  {
    to: "/admin/posts",
    label: "Review Posts",
    description: "Approve or reject blog submissions",
    icon: Eye,
    color: "text-secondary-400 bg-secondary-500/15",
  },
  {
    to: "/admin/reports",
    label: "Handle Reports",
    description: "Investigate user-submitted reports",
    icon: FlagTriangleRight,
    color: "text-error-400 bg-error-500/15",
  },
  {
    to: "/admin/referrals",
    label: "View Referrals",
    description: "Approve pending referral payouts",
    icon: UserPlus,
    color: "text-accent-400 bg-accent-500/15",
  },
];

const actionIconMap: Record<string, typeof Activity> = {
  admin_update_user: Users,
  admin_credit_wallet: Wallet,
  admin_create_task: MousePointerClick,
  admin_update_task: MousePointerClick,
  admin_toggle_task: MousePointerClick,
  admin_approve_referral: UserPlus,
  admin_reject_referral: UserPlus,
  admin_approve_cashout: CreditCard,
  admin_reject_cashout: CreditCard,
  admin_review_post: Eye,
  admin_create_news: BookOpen,
  admin_update_news: BookOpen,
  admin_toggle_publish_news: BookOpen,
  admin_create_job: BarChart3,
  admin_update_job: BarChart3,
  admin_review_report: FlagTriangleRight,
  admin_suspend_listing: Megaphone,
  admin_broadcast: Megaphone,
  settings_bulk_upsert: Activity,
};

function formatChartDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-dark-700 bg-dark-900 px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-medium text-dark-400">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs font-semibold text-white">
          {entry.name === "newUsers" ? "New Users" : "Earnings"}:{" "}
          {entry.name === "earnings"
            ? formatCurrency(entry.value)
            : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const stats = useQuery(api.admin.getDashboardStats) as
    | DashboardStats
    | undefined;
  const chartData = useQuery(api.admin.getChartData) as
    | ChartPoint[]
    | undefined;
  const activity = useQuery(api.admin.getRecentActivity) as
    | ActivityItem[]
    | undefined;

  const isLoading = stats === undefined;

  return (
    <div className="space-y-6">
      {/* ============ Stat Cards ============ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[120px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={stats!.totalUsers}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="New Today"
              value={stats!.newUsersToday}
              icon={UserPlus}
              color="green"
            />
            <StatCard
              title="Pending Cashouts"
              value={stats!.pendingCashouts.count}
              icon={CreditCard}
              color="orange"
            />
            <StatCard
              title="Total Paid Out"
              value={formatCurrency(stats!.totalPaidOut)}
              icon={Wallet}
              color="red"
            />
            <StatCard
              title="Pending Referrals"
              value={stats!.pendingReferrals}
              icon={UserCheck}
              color="orange"
            />
            <StatCard
              title="Open Reports"
              value={stats!.pendingReports}
              icon={FlagTriangleRight}
              color="red"
            />
          </>
        )}
      </div>

      {/* ============ Charts ============ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* User Growth */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-400" />
              <h2 className="text-sm font-semibold text-white">
                User Growth — 30 Days
              </h2>
            </div>
          </div>
          <div className="card-body">
            {chartData === undefined ? (
              <div className="skeleton h-[260px] rounded-lg" />
            ) : chartData.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No chart data yet"
                description="User registrations will appear here over time."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="userGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartGridStroke}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    stroke={chartTextFill}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={chartTextFill}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="newUsers"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#userGrowth)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Earnings */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent-400" />
              <h2 className="text-sm font-semibold text-white">
                Earnings Distribution — 30 Days
              </h2>
            </div>
          </div>
          <div className="card-body">
            {chartData === undefined ? (
              <div className="skeleton h-[260px] rounded-lg" />
            ) : chartData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No earnings data yet"
                description="Platform earnings will appear here over time."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartGridStroke}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatChartDate}
                    stroke={chartTextFill}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={chartTextFill}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b40" }} />
                  <Bar dataKey="earnings" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ============ Quick Actions ============ */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dark-400">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="card group flex flex-col gap-3 p-5 hover:border-dark-700"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  action.color
                )}
              >
                <action.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">
                  {action.label}
                </h3>
                <p className="mt-0.5 text-xs text-dark-400">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-dark-500 transition-transform group-hover:translate-x-1 group-hover:text-accent-400" />
            </Link>
          ))}
        </div>
      </div>

      {/* ============ Recent Activity ============ */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent-400" />
            <h2 className="text-sm font-semibold text-white">
              Recent Activity
            </h2>
          </div>
        </div>
        <div className="card-body">
          {activity === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-1/3 rounded" />
                    <div className="skeleton h-3 w-1/4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No recent activity"
              description="Admin actions will be logged here for audit purposes."
            />
          ) : (
            <ul className="space-y-1">
              {activity.map((item) => {
                const Icon = actionIconMap[item.action] ?? Activity;
                return (
                  <li
                    key={item._id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-dark-800/50"
                  >
                    <Avatar
                      name={item.actor?.name ?? undefined}
                      src={item.actor?.image ?? undefined}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-dark-100">
                        <span className="font-medium text-white">
                          {item.actor?.name ?? "System"}
                        </span>{" "}
                        <span className="text-dark-400">
                          {item.action.replace(/_/g, " ")}
                        </span>
                      </p>
                      <p className="text-xs text-dark-500">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dark-800">
                      <Icon className="h-4 w-4 text-dark-400" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
