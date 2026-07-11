import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate, Link } from "react-router-dom";
import {
  ShoppingBag, Search, MapPin, Plus, Tag, Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  formatCurrency, formatRelativeTime, cn,
} from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ListingCategory =
  | "electronics" | "phones" | "fashion" | "vehicles"
  | "property" | "services" | "jobs" | "digital" | "others";

type ListingDoc = {
  _id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  negotiable: boolean;
  category: ListingCategory;
  location: string;
  images: string[];
  status: "active" | "sold" | "suspended" | "deleted";
  views: number;
  createdAt: number;
};

type ListingsPageResult = {
  page: ListingDoc[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES: { value: ListingCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "electronics", label: "Electronics" },
  { value: "phones", label: "Phones" },
  { value: "fashion", label: "Fashion" },
  { value: "vehicles", label: "Vehicles" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "jobs", label: "Jobs" },
  { value: "digital", label: "Digital" },
  { value: "others", label: "Others" },
];

const categoryVariant: Record<ListingCategory, "primary" | "success" | "warning" | "neutral"> = {
  electronics: "primary",
  phones: "primary",
  fashion: "success",
  vehicles: "warning",
  property: "warning",
  services: "neutral",
  jobs: "neutral",
  digital: "primary",
  others: "neutral",
};

// Gradient placeholders for listings without images.
const gradients = [
  "from-primary-500/30 to-accent-500/30",
  "from-secondary-500/30 to-primary-500/30",
  "from-accent-500/30 to-secondary-500/30",
  "from-primary-600/30 to-primary-400/30",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function ListingsGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton h-40 w-full" />
          <div className="card-body space-y-2">
            <div className="skeleton h-5 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="flex justify-between pt-2">
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MarketplacePage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<ListingCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [limit, setLimit] = useState(20);

  const result = useQuery(api.marketplace.getListings as any, {
    category: activeCategory === "all" ? undefined : activeCategory,
    search: search.trim() || undefined,
    location: locationFilter.trim() || undefined,
    limit,
  }) as ListingsPageResult | undefined;

  const listings = result?.page ?? [];
  const isLoading = result === undefined;
  const hasMore = !result?.isDone && listings.length >= limit;

  const handleLoadMore = () => {
    setLimit((prev) => prev + 20);
  };

  // Derive unique locations from the fetched listings for the filter dropdown.
  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const l of listings) set.add(l.location);
    return Array.from(set).sort();
  }, [listings]);

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          <p className="mt-1 text-sm text-dark-400">
            Buy and sell items within the community.
          </p>
        </div>
        <Link to="/marketplace/create" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          Create Listing
        </Link>
      </div>

      {/* ---------- Search + filters ---------- */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="input pl-10"
            />
          </div>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="input sm:w-48"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setActiveCategory(c.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                activeCategory === c.value
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 hover:bg-dark-700 hover:text-white"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- Grid ---------- */}
      {isLoading ? (
        <ListingsGridSkeleton />
      ) : listings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShoppingBag}
            title={search ? "No matching listings" : "No listings yet"}
            description={
              search
                ? "Try a different search or category."
                : "Be the first to list an item for sale!"
            }
            action={{
              label: "Create Listing",
              onClick: () => navigate("/marketplace/create"),
            }}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => {
              const firstImage = listing.images[0];
              const grad = gradientFor(listing._id);
              return (
                <button
                  key={listing._id}
                  onClick={() => navigate(`/marketplace/${listing._id}`)}
                  className="card group flex flex-col overflow-hidden text-left transition-all hover:border-dark-700 hover:shadow-xl hover:shadow-black/30"
                >
                  {/* Image / placeholder */}
                  <div className="relative h-40 w-full overflow-hidden">
                    {firstImage ? (
                      <img
                        src={firstImage}
                        alt={listing.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex h-full w-full items-center justify-center bg-gradient-to-br",
                          grad
                        )}
                      >
                        <ImageIcon className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                    {listing.status === "sold" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <span className="rounded-lg bg-dark-900/90 px-3 py-1 text-sm font-bold text-white">
                          SOLD
                        </span>
                      </div>
                    )}
                    <div className="absolute left-2 top-2">
                      <Badge variant={categoryVariant[listing.category]}>
                        <Tag className="h-3 w-3" />
                        {listing.category}
                      </Badge>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="card-body flex flex-1 flex-col">
                    <h3 className="line-clamp-1 font-semibold text-white group-hover:text-primary-300">
                      {listing.title}
                    </h3>
                    <p className="text-lg font-bold text-primary-400">
                      {formatCurrency(listing.price)}
                      {listing.negotiable && (
                        <span className="ml-1.5 text-xs font-normal text-dark-500">
                          negotiable
                        </span>
                      )}
                    </p>

                    <div className="mt-2 flex items-center justify-between border-t border-dark-800 pt-2 text-xs text-dark-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{listing.location}</span>
                      </span>
                      <span>{formatRelativeTime(listing.createdAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ---------- Load more ---------- */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                className="btn btn-secondary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
