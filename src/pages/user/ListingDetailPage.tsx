import { useState, useEffect, useRef, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  ArrowLeft, MapPin, Tag, MessageCircle, Edit, Trash2,
  CheckCircle2, Flag, X, Loader2, Eye, ChevronLeft, ChevronRight,
  Image as ImageIcon, ShieldAlert,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import {
  formatCurrency, formatDate, formatRelativeTime, cn,
} from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import Modal from "../../components/ui/Modal";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ListingCategory =
  | "electronics" | "phones" | "fashion" | "vehicles"
  | "property" | "services" | "jobs" | "digital" | "others";

type ListingDetail = {
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
  isFeatured: boolean;
  createdAt: number;
  updatedAt: number;
  seller: { name: string | null; image: string | null } | null;
};

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

const gradients = [
  "from-primary-500/30 to-accent-500/30",
  "from-secondary-500/30 to-primary-500/30",
  "from-accent-500/30 to-secondary-500/30",
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

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="skeleton h-9 w-32 rounded-lg" />
      <div className="card overflow-hidden">
        <div className="skeleton h-80 w-full" />
        <div className="card-body space-y-4">
          <div className="skeleton h-7 w-2/3" />
          <div className="skeleton h-6 w-32" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const listing = useQuery(
    api.marketplace.getListingById as any,
    id ? { listingId: id } : "skip"
  ) as ListingDetail | null | undefined;

  const incrementViews = useMutation(api.marketplace.incrementListingViews as any);
  const deleteListing = useMutation(api.marketplace.deleteListing as any);
  const markAsSold = useMutation(api.marketplace.markAsSold as any);
  const getOrCreateConversation = useMutation(
    api.chat.getOrCreateConversation as any
  );
  const createReport = useMutation(api.reports.createReport as any);

  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  const viewedRef = useRef(false);

  /* ---------- Increment views on mount ---------- */
  useEffect(() => {
    if (!id || !listing || viewedRef.current) return;
    viewedRef.current = true;
    (async () => {
      try {
        await incrementViews({ listingId: id });
      } catch {
        /* non-fatal */
      }
    })();
  }, [id, listing, incrementViews]);

  // Reset active image when listing changes.
  useEffect(() => {
    setActiveImage(0);
  }, [id]);

  const isOwnListing = !!user && !!listing && listing.sellerId === user._id;

  /* ---------- Message seller ---------- */
  const handleMessageSeller = async () => {
    if (!listing || !user || isOwnListing) return;
    setIsMessaging(true);
    try {
      const res = await getOrCreateConversation({
        otherUserId: listing.sellerId,
        listingId: listing._id,
      });
      navigate(`/chat/${res.conversationId}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to start conversation");
    } finally {
      setIsMessaging(false);
    }
  };

  /* ---------- Delete listing ---------- */
  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteListing({ listingId: id });
      toast.success("Listing deleted");
      navigate("/marketplace");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete listing");
    } finally {
      setIsDeleting(false);
    }
  };

  /* ---------- Mark as sold ---------- */
  const handleMarkSold = async () => {
    if (!id) return;
    setIsSelling(true);
    try {
      await markAsSold({ listingId: id });
      toast.success("Listing marked as sold");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update listing");
    } finally {
      setIsSelling(false);
    }
  };

  /* ---------- Report ---------- */
  const handleReportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!listing || !reportReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }
    setIsReporting(true);
    try {
      await createReport({
        reportedUserId: listing.sellerId,
        reportedListingId: listing._id,
        reason: reportReason.trim(),
        description: reportDescription.trim() || reportReason.trim(),
      });
      toast.success("Report submitted. Thank you!");
      setReportOpen(false);
      setReportReason("");
      setReportDescription("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit report");
    } finally {
      setIsReporting(false);
    }
  };

  if (listing === undefined) {
    return (
      <div className="mx-auto max-w-4xl">
        <DetailSkeleton />
      </div>
    );
  }

  if (listing === null) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-10 text-center">
          <p className="text-sm text-dark-400">
            This listing could not be found or is no longer available.
          </p>
          <button
            onClick={() => navigate("/marketplace")}
            className="btn btn-secondary mt-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </button>
        </div>
      </div>
    );
  }

  const images = listing.images;
  const hasImages = images.length > 0;
  const currentImage = hasImages ? images[activeImage] : null;
  const grad = gradientFor(listing._id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ---------- Back ---------- */}
      <button
        onClick={() => navigate("/marketplace")}
        className="btn btn-ghost btn-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- Image gallery ---------- */}
        <div className="card overflow-hidden">
          <div
            className="relative h-80 w-full cursor-pointer bg-dark-800"
            onClick={() => hasImages && setLightboxOpen(true)}
          >
            {currentImage ? (
              <img
                src={currentImage}
                alt={listing.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center bg-gradient-to-br",
                  grad
                )}
              >
                <ImageIcon className="h-12 w-12 text-white/40" />
              </div>
            )}

            {listing.status === "sold" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="rounded-lg bg-dark-900/90 px-4 py-1.5 text-lg font-bold text-white">
                  SOLD
                </span>
              </div>
            )}

            {/* Navigation arrows */}
            {hasImages && images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((i) =>
                      i === 0 ? images.length - 1 : i - 1
                    );
                  }}
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveImage((i) =>
                      i === images.length - 1 ? 0 : i + 1
                    );
                  }}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white">
                  {activeImage + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {hasImages && images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3 scrollbar-thin">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2",
                    i === activeImage
                      ? "border-primary-500"
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Details ---------- */}
        <div className="space-y-4">
          <div className="card">
            <div className="card-body space-y-4">
              {/* Category + status */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={categoryVariant[listing.category]}>
                  <Tag className="h-3 w-3" />
                  {listing.category}
                </Badge>
                {listing.negotiable && (
                  <Badge variant="neutral">Negotiable</Badge>
                )}
                <span className="flex items-center gap-1 text-xs text-dark-500">
                  <Eye className="h-3.5 w-3.5" />
                  {listing.views} views
                </span>
              </div>

              {/* Title + price */}
              <h1 className="text-2xl font-bold text-white">{listing.title}</h1>
              <p className="text-3xl font-bold text-primary-400">
                {formatCurrency(listing.price)}
              </p>

              {/* Location + date */}
              <div className="flex items-center gap-4 text-sm text-dark-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {listing.location}
                </span>
                <span>•</span>
                <span>{formatRelativeTime(listing.createdAt)}</span>
              </div>

              {/* Description */}
              <div className="border-t border-dark-800 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-white">
                  Description
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-dark-200">
                  {listing.description}
                </p>
              </div>
            </div>
          </div>

          {/* ---------- Seller card ---------- */}
          <div className="card">
            <div className="card-body">
              <h3 className="mb-3 text-sm font-semibold text-white">Seller</h3>
              <div className="flex items-center gap-3">
                <Avatar
                  name={listing.seller?.name ?? "Seller"}
                  src={listing.seller?.image ?? undefined}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {listing.seller?.name ?? "Unknown seller"}
                  </p>
                  <p className="text-xs text-dark-500">
                    Listed {formatDate(listing.createdAt)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 space-y-2">
                {isOwnListing ? (
                  <>
                    <button
                      onClick={() => navigate(`/marketplace/${listing._id}/edit`)}
                      className="btn btn-secondary w-full"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Listing
                    </button>
                    <button
                      onClick={handleMarkSold}
                      disabled={isSelling || listing.status === "sold"}
                      className="btn btn-success w-full"
                    >
                      {isSelling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Updating…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          Mark as Sold
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="btn btn-danger w-full"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Deleting…
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          Delete Listing
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleMessageSeller}
                      disabled={isMessaging}
                      className="btn btn-primary w-full"
                    >
                      {isMessaging ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Starting chat…
                        </>
                      ) : (
                        <>
                          <MessageCircle className="h-4 w-4" />
                          Message Seller
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setReportOpen(true)}
                      className="btn btn-ghost w-full"
                    >
                      <Flag className="h-4 w-4" />
                      Report Listing
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Lightbox ---------- */}
      {lightboxOpen && currentImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-dark-800 text-white hover:bg-dark-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {hasImages && images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage((i) =>
                    i === 0 ? images.length - 1 : i - 1
                  );
                }}
                className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-dark-800 text-white hover:bg-dark-700"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImage((i) =>
                    i === images.length - 1 ? 0 : i + 1
                  );
                }}
                className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-dark-800 text-white hover:bg-dark-700"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          <img
            src={currentImage}
            alt={listing.title}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ---------- Report modal ---------- */}
      <Modal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report Listing"
      >
        <form onSubmit={handleReportSubmit} className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg bg-warning-500/10 px-3 py-2 text-xs text-amber-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Report this listing if it violates our policies. Our team will
              review it promptly.
            </span>
          </div>
          <div>
            <label htmlFor="report-reason" className="label">
              Reason <span className="text-error-400">*</span>
            </label>
            <input
              id="report-reason"
              type="text"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="e.g. Scam, prohibited item, misleading"
              className="input"
              disabled={isReporting}
              required
            />
          </div>
          <div>
            <label htmlFor="report-desc" className="label">
              Description
            </label>
            <textarea
              id="report-desc"
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              placeholder="Provide additional details…"
              rows={4}
              className="input resize-y"
              disabled={isReporting}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="btn btn-secondary"
              disabled={isReporting}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={isReporting || !reportReason.trim()}
            >
              {isReporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
