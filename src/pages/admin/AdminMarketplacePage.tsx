import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  Store, Image as ImageIcon, Power, Eye, Ban, ShoppingCart, Package, AlertCircle,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate } from "../../lib/utils";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type ListingStatus = "active" | "sold" | "suspended" | "deleted";

type ListingRow = {
  _id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  location: string;
  images: string[];
  status: ListingStatus;
  views: number;
  isFeatured: boolean;
  createdAt: number;
  seller: { name: string | null; email: string | null; image: string | null } | null;
};

const PAGE_SIZE = 20;

const statusTabs: { key: "all" | ListingStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "sold", label: "Sold" },
];

const statusBadge: Record<ListingStatus, { variant: "success" | "error" | "warning" | "neutral"; label: string }> = {
  active: { variant: "success", label: "Active" },
  sold: { variant: "warning", label: "Sold" },
  suspended: { variant: "error", label: "Suspended" },
  deleted: { variant: "neutral", label: "Deleted" },
};

export default function AdminMarketplacePage() {
  const [activeTab, setActiveTab] = useState<"all" | ListingStatus>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [suspendModal, setSuspendModal] = useState<ListingRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch all listings for stats (first page is a good approximation).
  const allResult = useQuery(api.marketplace.adminGetListings, {
    paginationOpts: { numItems: 100, cursor: null },
  }) as { page: ListingRow[]; isDone: boolean; continueCursor: string } | undefined;

  const result = useQuery(
    api.marketplace.adminGetListings,
    activeTab === "all"
      ? { paginationOpts: { numItems: PAGE_SIZE, cursor } }
      : { paginationOpts: { numItems: PAGE_SIZE, cursor }, status: activeTab }
  ) as { page: ListingRow[]; isDone: boolean; continueCursor: string } | undefined;

  const suspendListing = useMutation(api.marketplace.adminSuspendListing);

  const stats = useMemo(() => {
    const listings = allResult?.page ?? [];
    return {
      total: listings.length,
      active: listings.filter((l) => l.status === "active").length,
      suspended: listings.filter((l) => l.status === "suspended").length,
      sold: listings.filter((l) => l.status === "sold").length,
    };
  }, [allResult]);

  const handleSuspend = async () => {
    if (!suspendModal) return;
    if (!suspendReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setSaving(true);
    try {
      await suspendListing({ listingId: suspendModal._id as any, reason: suspendReason.trim() });
      toast.success("Listing suspended");
      setSuspendModal(null);
      setSuspendReason("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to suspend listing");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* ============ Stats ============ */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Listings" value={stats.total} icon={Package} color="blue" />
        <StatCard title="Active" value={stats.active} icon={Store} color="green" />
        <StatCard title="Suspended" value={stats.suspended} icon={Ban} color="red" />
        <StatCard title="Sold" value={stats.sold} icon={ShoppingCart} color="orange" />
      </div>

      {/* ============ Tabs ============ */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCursor(null); }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  activeTab === tab.key
                    ? "bg-accent-500/15 text-accent-300 border border-accent-500/30"
                    : "text-dark-400 hover:bg-dark-800 hover:text-white border border-transparent"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
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
        ) : result.page.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No listings found"
            description="There are no marketplace listings matching this filter."
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Image</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Seller</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Views</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((listing) => (
                  <tr key={listing._id} className="hover:bg-dark-800/30">
                    <td className="table-cell">
                      <div className="h-10 w-14 overflow-hidden rounded-lg bg-dark-800">
                        {listing.images[0] ? (
                          <img src={listing.images[0]} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-dark-600" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="max-w-[180px] truncate font-medium text-white">{listing.title}</p>
                      <p className="text-xs text-dark-500">{listing.location}</p>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar name={listing.seller?.name ?? undefined} src={listing.seller?.image ?? undefined} size="sm" />
                        <span className="truncate text-sm text-dark-200">{listing.seller?.name ?? "Unknown"}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <Badge variant="neutral" className="capitalize">{listing.category}</Badge>
                    </td>
                    <td className="table-cell font-medium text-primary-400">{formatCurrency(listing.price)}</td>
                    <td className="table-cell text-dark-300">{listing.views}</td>
                    <td className="table-cell">
                      <Badge variant={statusBadge[listing.status].variant}>
                        {statusBadge[listing.status].label}
                      </Badge>
                    </td>
                    <td className="table-cell text-dark-400">{formatDate(listing.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        {listing.status === "active" ? (
                          <button
                            onClick={() => { setSuspendModal(listing); setSuspendReason(""); }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-error-400 hover:bg-error-500/10"
                            title="Suspend"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        ) : listing.status === "suspended" ? (
                          <span className="text-xs text-dark-600">—</span>
                        ) : (
                          <span className="text-xs text-dark-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && !result.isDone && result.page.length > 0 && (
          <div className="border-t border-dark-800 p-4 text-center">
            <button onClick={() => setCursor(result.continueCursor || null)} className="btn btn-secondary btn-sm">
              Load More
            </button>
          </div>
        )}
      </div>

      {/* ============ Suspend Modal ============ */}
      <Modal
        isOpen={!!suspendModal}
        onClose={() => setSuspendModal(null)}
        title="Suspend Listing"
      >
        <div className="space-y-4">
          {suspendModal && (
            <div className="flex items-center gap-3 rounded-lg border border-dark-800 bg-dark-800/50 p-3">
              {suspendModal.images[0] ? (
                <img src={suspendModal.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-dark-700">
                  <ImageIcon className="h-5 w-5 text-dark-500" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-white">{suspendModal.title}</p>
                <p className="text-xs text-dark-500">{formatCurrency(suspendModal.price)} · {suspendModal.seller?.name ?? "Unknown"}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg border border-warning-500/20 bg-warning-500/10 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs text-amber-400/80">The seller will be notified with the reason provided.</p>
          </div>
          <div>
            <label className="label">Reason for suspension</label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="input resize-none"
              rows={3}
              placeholder="e.g. Prohibited item, policy violation…"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setSuspendModal(null)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSuspend} disabled={saving} className="btn btn-danger">
              <Ban className="h-4 w-4" /> {saving ? "Suspending…" : "Suspend Listing"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
