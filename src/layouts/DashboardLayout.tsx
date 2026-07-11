import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import toast from "react-hot-toast";
import {
  Zap, LayoutDashboard, Wallet, ListTodo, Gift, Newspaper, Briefcase,
  Store, MessageSquare, PenLine, User as UserIcon, Bell, LogOut,
  CreditCard, Menu, X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatCurrency } from "../lib/utils";
import Avatar from "../components/ui/Avatar";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
};

type NavSection = {
  heading: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    heading: "Main",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/wallet", label: "Wallet", icon: Wallet },
      { to: "/tasks", label: "Tasks", icon: ListTodo },
    ],
  },
  {
    heading: "Earn",
    items: [
      { to: "/daily-bonus", label: "Daily Bonus", icon: Gift },
      { to: "/news", label: "News", icon: Newspaper },
      { to: "/jobs", label: "Jobs", icon: Briefcase },
    ],
  },
  {
    heading: "Community",
    items: [
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/chat", label: "Chat", icon: MessageSquare },
      { to: "/blog", label: "Blog", icon: PenLine },
    ],
  },
  {
    heading: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: UserIcon },
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/cashout", label: "Cash Out", icon: CreditCard },
    ],
  },
];

// Bottom nav items for mobile
const bottomNav: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/marketplace", label: "Market", icon: Store },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/wallet": "Wallet",
  "/tasks": "Tasks",
  "/daily-bonus": "Daily Bonus",
  "/news": "News & Articles",
  "/jobs": "Job Listings",
  "/marketplace": "Marketplace",
  "/chat": "Messages",
  "/blog": "Blog",
  "/profile": "Profile",
  "/notifications": "Notifications",
  "/cashout": "Cash Out",
  "/referrals": "Referrals",
};

function getRouteTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];
  // Dynamic segments
  if (pathname.startsWith("/news/")) return "Article";
  if (pathname.startsWith("/jobs/")) return "Job Details";
  if (pathname.startsWith("/marketplace/create")) return "Create Listing";
  if (pathname.startsWith("/marketplace/") && pathname.endsWith("/edit"))
    return "Edit Listing";
  if (pathname.startsWith("/marketplace/")) return "Listing Details";
  if (pathname.startsWith("/chat/")) return "Conversation";
  if (pathname.startsWith("/blog/")) return "Blog Post";
  return "ClickEarn Pro";
}

export default function DashboardLayout() {
  const location = useLocation();
  const { user, wallet } = useCurrentUser();
  const unreadCount = useQuery(api.notifications.getUnreadCount as any) as
    | number
    | undefined;
  const { signOut } = useAuthActions();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="min-h-screen bg-dark-950">
      {/* ============ Desktop Sidebar ============ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-dark-800 bg-dark-900 lg:flex">
        <SidebarContent user={user} wallet={wallet} onLogout={handleLogout} />
      </aside>

      {/* ============ Mobile Drawer ============ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={closeDrawer}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-dark-800 bg-dark-900 animate-slide-in">
            <button
              onClick={closeDrawer}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              user={user}
              wallet={wallet}
              onLogout={handleLogout}
              onNavigate={closeDrawer}
            />
          </aside>
        </div>
      )}

      {/* ============ Main Content ============ */}
      <div className="lg:pl-[260px]">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-dark-800 bg-dark-950/80 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger - mobile */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-dark-300 hover:bg-dark-800 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-white">
              {getRouteTitle(location.pathname)}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <Link
              to="/notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-dark-300 transition-colors hover:bg-dark-800 hover:text-white"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error-600 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Avatar */}
            <Link to="/profile">
              <Avatar name={user?.name} src={user?.image} size="sm" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 pb-24 lg:px-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ============ Mobile Bottom Nav ============ */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-dark-800 bg-dark-900/95 backdrop-blur-xl lg:hidden">
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary-400" : "text-dark-500"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/* ---------- Sidebar inner content (shared by desktop + drawer) ---------- */
function SidebarContent({
  user,
  wallet,
  onLogout,
  onNavigate,
}: {
  user: ReturnType<typeof useCurrentUser>["user"];
  wallet: ReturnType<typeof useCurrentUser>["wallet"];
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-dark-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-900/40">
          <Zap className="h-5 w-5 text-white" fill="white" />
        </div>
        <span className="text-base font-bold text-white">ClickEarn Pro</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-thin px-3 py-5">
        {navSections.map((section) => (
          <div key={section.heading}>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-dark-500">
              {section.heading}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `sidebar-link ${isActive ? "active" : ""}`
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User card + logout */}
      <div className="border-t border-dark-800 p-3">
        <Link
          to="/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-dark-800"
        >
          <Avatar name={user?.name} src={user?.image} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.name ?? "User"}
            </p>
            <p className="truncate text-xs text-dark-500">
              {formatCurrency(wallet?.available)}
            </p>
          </div>
        </Link>
        <button
          onClick={onLogout}
          className="sidebar-link mt-1 w-full text-error-400 hover:bg-error-500/10 hover:text-error-300"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>
      </div>
    </>
  );
}
