import { type ReactNode } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

import AuthLayout from "./layouts/AuthLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";
import LoadingScreen from "./components/ui/LoadingScreen";

// Auth pages
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";

// User pages
import DashboardPage from "./pages/user/DashboardPage";
import WalletPage from "./pages/user/WalletPage";
import TasksPage from "./pages/user/TasksPage";
import ReferralsPage from "./pages/user/ReferralsPage";
import CashoutPage from "./pages/user/CashoutPage";
import DailyBonusPage from "./pages/user/DailyBonusPage";
import NewsPage from "./pages/user/NewsPage";
import NewsDetailPage from "./pages/user/NewsDetailPage";
import JobsPage from "./pages/user/JobsPage";
import JobDetailPage from "./pages/user/JobDetailPage";
import MarketplacePage from "./pages/user/MarketplacePage";
import ListingDetailPage from "./pages/user/ListingDetailPage";
import CreateListingPage from "./pages/user/CreateListingPage";
import EditListingPage from "./pages/user/EditListingPage";
import ChatPage from "./pages/user/ChatPage";
import BlogPage from "./pages/user/BlogPage";
import CreatePostPage from "./pages/user/CreatePostPage";
import ProfilePage from "./pages/user/ProfilePage";
import NotificationsPage from "./pages/user/NotificationsPage";

// Admin pages
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminTasksPage from "./pages/admin/AdminTasksPage";
import AdminReferralsPage from "./pages/admin/AdminReferralsPage";
import AdminCashoutsPage from "./pages/admin/AdminCashoutsPage";
import AdminMarketplacePage from "./pages/admin/AdminMarketplacePage";
import AdminPostsPage from "./pages/admin/AdminPostsPage";
import AdminNewsPage from "./pages/admin/AdminNewsPage";
import AdminJobsPage from "./pages/admin/AdminJobsPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminTransactionsPage from "./pages/admin/AdminTransactionsPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";

/* ============================================================
   Route Guards
   ============================================================ */

/** Blocks rendering until Convex auth finishes loading; redirects unauthenticated users to /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen label="Authenticating…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/** Blocks non-admin users; checks role via the current user query. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const location = useLocation();

  // Cast to any to avoid type recursion from the generated api stub.
  const result = useQuery(api.users.getCurrentUser as any) as any;
  const userLoading = result === undefined;

  if (authLoading || (isAuthenticated && userLoading)) {
    return <LoadingScreen label="Verifying admin access…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const user = result?.user ?? result;
  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** Redirects authenticated users away from auth pages (e.g. /login → /dashboard). */
function PublicOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) return <LoadingScreen label="Loading…" />;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/* ============================================================
   App Router
   ============================================================ */
export default function App() {
  return (
    <Routes>
      {/* ---------- Public / Auth routes ---------- */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnly>
              <ForgotPasswordPage />
            </PublicOnly>
          }
        />
      </Route>

      {/* ---------- User routes (require auth) ---------- */}
      <Route
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/referrals" element={<ReferralsPage />} />
        <Route path="/cashout" element={<CashoutPage />} />
        <Route path="/daily-bonus" element={<DailyBonusPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:id" element={<NewsDetailPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/create" element={<CreateListingPage />} />
        <Route path="/marketplace/:id" element={<ListingDetailPage />} />
        <Route path="/marketplace/:id/edit" element={<EditListingPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/create" element={<CreatePostPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>

      {/* ---------- Admin routes (require admin) ---------- */}
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/tasks" element={<AdminTasksPage />} />
        <Route path="/admin/referrals" element={<AdminReferralsPage />} />
        <Route path="/admin/cashouts" element={<AdminCashoutsPage />} />
        <Route path="/admin/marketplace" element={<AdminMarketplacePage />} />
        <Route path="/admin/posts" element={<AdminPostsPage />} />
        <Route path="/admin/news" element={<AdminNewsPage />} />
        <Route path="/admin/jobs" element={<AdminJobsPage />} />
        <Route path="/admin/reports" element={<AdminReportsPage />} />
        <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Route>

      {/* ---------- Catch-all ---------- */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
