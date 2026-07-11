import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  Users, Search, Shield, ShieldOff, Ban, CheckCircle, Wallet,
  MoreVertical, Eye, UserCog, X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  cn, formatCurrency, formatDate, getInitials,
} from "../../lib/utils";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type UserRow = {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
  role: "user" | "admin";
  isBanned: boolean;
  isActive: boolean;
  banReason?: string;
  createdAt: number;
};

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const { user: currentUser } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    user: UserRow;
    type: "ban" | "unban" | "makeAdmin" | "makeUser";
  } | null>(null);
  const [creditModal, setCreditModal] = useState<UserRow | null>(null);

  const result = useQuery(api.users.adminGetUsers, {
    paginationOpts: { numItems: PAGE_SIZE, cursor: cursor },
    role: roleFilter === "all" ? undefined : roleFilter,
    isBanned: statusFilter === "banned" ? true : statusFilter === "active" ? false : undefined,
  }) as { page: UserRow[]; isDone: boolean; continueCursor: string; total: number } | undefined;

  const updateUser = useMutation(api.users.adminUpdateUser);
  const creditWallet = useMutation(api.users.adminCreditWallet);

  // Client-side search filtering on the loaded page.
  const filteredPage = useMemo(() => {
    if (!result?.page) return [];
    if (!search.trim()) return result.page;
    const q = search.toLowerCase();
    return result.page.filter(
      (u) =>
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
    );
  }, [result, search]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { user, type } = confirmAction;
    const isSelf = currentUser?._id === user._id;
    if (isSelf) {
      toast.error("You cannot modify your own account.");
      setConfirmAction(null);
      return;
    }
    try {
      if (type === "ban") {
        await updateUser({ userId: user._id as any, isBanned: true, banReason: "Banned by admin" });
        toast.success(`${user.name ?? "User"} banned`);
      } else if (type === "unban") {
        await updateUser({ userId: user._id as any, isBanned: false, banReason: undefined });
        toast.success(`${user.name ?? "User"} unbanned`);
      } else if (type === "makeAdmin") {
        await updateUser({ userId: user._id as any, role: "admin" });
        toast.success(`${user.name ?? "User"} promoted to admin`);
      } else if (type === "makeUser") {
        await updateUser({ userId: user._id as any, role: "user" });
        toast.success(`${user.name ?? "User"} demoted to user`);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Action failed");
    }
    setConfirmAction(null);
  };

  const confirmConfig = confirmAction
    ? {
        ban: { label: "Ban User", desc: "This user will be prevented from accessing the platform.", btn: "btn-danger" },
        unban: { label: "Unban User", desc: "This user will regain access to the platform.", btn: "btn-success" },
        makeAdmin: { label: "Make Admin", desc: "This user will gain administrator privileges.", btn: "btn-primary" },
        makeUser: { label: "Remove Admin", desc: "This user will lose administrator privileges.", btn: "btn-secondary" },
      }[confirmAction.type]
    : null;

  return (
    <div className="space-y-5">
      {/* ============ Header / Filters ============ */}
      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="input pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value as any); setCursor(null); }}
                className="input w-auto"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as any); setCursor(null); }}
                className="input w-auto"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </select>
            </div>
          </div>
          {result && (
            <p className="text-xs text-dark-500">
              Showing {filteredPage.length} of {result.total} users
            </p>
          )}
        </div>
      </div>

      {/* ============ Table ============ */}
      <div className="card overflow-hidden">
        {result === undefined ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        ) : filteredPage.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="No users match your current filters."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">User</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Joined</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {filteredPage.map((u) => {
                  const isSelf = currentUser?._id === u._id;
                  return (
                    <tr key={u._id} className="hover:bg-dark-800/30">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.image} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {u.name ?? "Unnamed"}
                              {isSelf && (
                                <span className="ml-2 text-xs text-accent-400">(You)</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-dark-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        {u.role === "admin" ? (
                          <Badge variant="primary">Admin</Badge>
                        ) : (
                          <Badge variant="neutral">User</Badge>
                        )}
                      </td>
                      <td className="table-cell">
                        {u.isBanned ? (
                          <Badge variant="error">Banned</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="table-cell text-dark-400">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="table-cell">
                        <div className="relative flex justify-end">
                          <button
                            onClick={() => setActionMenu(actionMenu === u._id ? null : u._id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {actionMenu === u._id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActionMenu(null)} />
                              <div className="absolute right-0 top-9 z-20 w-44 rounded-lg border border-dark-700 bg-dark-900 py-1 shadow-xl">
                                <button
                                  onClick={() => { setActionMenu(null); setConfirmAction({ user: u, type: u.isBanned ? "unban" : "ban" }); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-800"
                                >
                                  {u.isBanned ? <CheckCircle className="h-4 w-4 text-secondary-400" /> : <Ban className="h-4 w-4 text-error-400" />}
                                  {u.isBanned ? "Unban User" : "Ban User"}
                                </button>
                                <button
                                  onClick={() => { setActionMenu(null); setConfirmAction({ user: u, type: u.role === "admin" ? "makeUser" : "makeAdmin" }); }}
                                  disabled={isSelf}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-800 disabled:opacity-40"
                                >
                                  {u.role === "admin" ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                  {u.role === "admin" ? "Remove Admin" : "Make Admin"}
                                </button>
                                <button
                                  onClick={() => { setActionMenu(null); setCreditModal(u); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-800"
                                >
                                  <Wallet className="h-4 w-4 text-primary-400" />
                                  Credit Wallet
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {result && !result.isDone && result.page.length > 0 && (
          <div className="border-t border-dark-800 p-4 text-center">
            <button
              onClick={() => setCursor(result.continueCursor || null)}
              className="btn btn-secondary btn-sm"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* ============ Confirm Modal ============ */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmConfig?.label}
      >
        <p className="text-sm text-dark-300">{confirmConfig?.desc}</p>
        {confirmAction?.user && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-dark-800 bg-dark-800/50 p-3">
            <Avatar name={confirmAction.user.name} src={confirmAction.user.image} size="sm" />
            <div>
              <p className="text-sm font-medium text-white">{confirmAction.user.name ?? "Unnamed"}</p>
              <p className="text-xs text-dark-500">{confirmAction.user.email}</p>
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={() => setConfirmAction(null)} className="btn btn-secondary">Cancel</button>
          <button onClick={handleConfirmAction} className={cn(confirmConfig?.btn)}>
            {confirmConfig?.label}
          </button>
        </div>
      </Modal>

      {/* ============ Credit Wallet Modal ============ */}
      <CreditWalletModal
        user={creditModal}
        onClose={() => setCreditModal(null)}
        onSubmit={async (amount, description) => {
          if (!creditModal) return;
          try {
            await creditWallet({
              userId: creditModal._id as any,
              amount,
              description,
            });
            toast.success(
              `${amount >= 0 ? "Credited" : "Debited"} ${formatCurrency(Math.abs(amount))} to ${creditModal.name ?? "user"}`
            );
            setCreditModal(null);
          } catch (err: any) {
            toast.error(err.message ?? "Failed to credit wallet");
          }
        }}
      />
    </div>
  );
}

/* ---------- Credit Wallet Modal ---------- */
function CreditWalletModal({
  user,
  onClose,
  onSubmit,
}: {
  user: UserRow | null;
  onClose: () => void;
  onSubmit: (amount: number, description: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt === 0) {
      toast.error("Enter a valid amount (use negative to debit)");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    setSaving(true);
    await onSubmit(amt, description.trim());
    setSaving(false);
    setAmount("");
    setDescription("");
  };

  return (
    <Modal isOpen={!!user} onClose={onClose} title="Credit / Debit Wallet">
      <form onSubmit={handleSubmit} className="space-y-4">
        {user && (
          <div className="flex items-center gap-3 rounded-lg border border-dark-800 bg-dark-800/50 p-3">
            <Avatar name={user.name} src={user.image} size="sm" />
            <div>
              <p className="text-sm font-medium text-white">{user.name ?? "Unnamed"}</p>
              <p className="text-xs text-dark-500">{user.email}</p>
            </div>
          </div>
        )}
        <div>
          <label className="label">Amount (₦) — use negative to debit</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 500 or -200"
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Reason for credit/debit…"
            rows={3}
            className="input resize-none"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Processing…" : "Apply"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
