import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import toast from "react-hot-toast";
import {
  Shield, LayoutDashboard, ArrowLeftRight, Users, ListTodo, UserPlus,
  CreditCard, Store, PenLine, Newspaper, Briefcase, FlagTriangleRight,
  Bell, Settings, LogOut, Menu, X, ArrowLeft,
} from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
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

const adminNavSections: NavSection[] = [
  {
    heading: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
    ],
  },
  {
    heading: "Management",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/tasks", label: "Tasks", icon: ListTodo },
      { to: "/admin/referrals", label: "Referrals", icon: UserPlus },
      { to: "/admin/cashouts", label: "Cashouts", icon: CreditCard },
      { to: "/admin/marketplace", label: "Marketplace", icon: Store },
      { to: "/admin/posts", label: "Blog Posts", icon: PenLine },
      { to: "/admin/news", label: "News", icon: Newspaper },
      { to: "/admin/jobs", label: "Jobs", icon: Briefcase },
    ],
  },
  {
    heading: "Community",
    items: [
      { to: "/admin/reports", label: "Reports", icon: FlagTriangleRight },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    heading: "Config",
    items: [
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

const routeTitles: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/transactions": "Transactions",
  "/admin/users": "User Management",
  "/admin/tasks": "Task Management",
  "/admin/referrals": "Referral Management",
  "/admin/cashouts": "Cashout Requests",
  "/admin/marketplace": "Marketplace Moderation",
  "/admin/posts": "Blog Post Reviews",
  "/admin/news": "News Management",
  "/admin/jobs": "Job Management",
  "/admin/reports": "Reports",
  "/admin/notifications": "Notifications",
  "/admin/settings": "Platform Settings",
};

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useCurrentUser();
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
        <AdminSidebarContent
          user={user}
          onLogout={handleLogout}
        />
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
            <AdminSidebarContent
              user={user}
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
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent-500" />
              <h1 className="text-lg font-semibold text-white">
                {routeTitles[location.pathname] ?? "Admin"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-dark-700 px-3 py-1.5 text-sm font-medium text-dark-300 transition-colors hover:bg-dark-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to App</span>
            </Link>
            <Avatar name={user?.name} src={user?.image} size="sm" />
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] px-4 py-6 pb-20 lg:px-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ---------- Admin Sidebar inner content ---------- */
function AdminSidebarContent({
  user,
  onLogout,
  onNavigate,
}: {
  user: ReturnType<typeof useCurrentUser>["user"];
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Admin logo */}
      <div className="flex h-16 items-center gap-3 border-b border-dark-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-500 to-error-600 shadow-lg shadow-accent-900/40">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <span className="block text-sm font-bold text-white">Admin Panel</span>
          <span className="text-xs text-accent-400">ClickEarn Pro</span>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-6 overflow-y-auto scrollbar-thin px-3 py-5">
        {adminNavSections.map((section) => (
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
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar name={user?.name} src={user?.image} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user?.name ?? "Admin"}
            </p>
            <p className="truncate text-xs text-accent-400">Administrator</p>
          </div>
        </div>
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
