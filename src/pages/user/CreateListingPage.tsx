import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  ArrowLeft, Plus, X, Loader2, Image as ImageIcon, Tag,
  MapPin, DollarSign, Check,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { value: "electronics", label: "Electronics" },
  { value: "phones", label: "Phones" },
  { value: "fashion", label: "Fashion" },
  { value: "vehicles", label: "Vehicles" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "jobs", label: "Jobs" },
  { value: "digital", label: "Digital" },
  { value: "others", label: "Others" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

const MAX_IMAGES = 5;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CreateListingPage() {
  const navigate = useNavigate();
  const createListing = useMutation(api.marketplace.createListing as any);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [category, setCategory] = useState<CategoryValue>("electronics");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------- Validation ---------- */
  const numericPrice = parseFloat(price) || 0;
  const titleError = !title.trim();
  const priceError = numericPrice <= 0;
  const locationError = !location.trim();
  const formInvalid = titleError || priceError || locationError;

  /* ---------- Image management ---------- */
  const handleAddImage = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (images.length >= MAX_IMAGES) {
      toast.error(`Maximum of ${MAX_IMAGES} images`);
      return;
    }
    if (images.includes(url)) {
      toast.error("Image already added");
      return;
    }
    setImages((prev) => [...prev, url]);
    setImageUrlInput("");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ---------- Submit ---------- */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (numericPrice <= 0) {
      toast.error("Price must be greater than zero");
      return;
    }
    if (!location.trim()) {
      toast.error("Location is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createListing({
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        negotiable,
        category,
        location: location.trim(),
        images,
      });
      toast.success("Listing created!");
      navigate(`/marketplace/${res.listingId}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/marketplace");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ---------- Back ---------- */}
      <Link to="/marketplace" className="btn btn-ghost btn-sm">
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-2xl font-bold text-white">Create Listing</h1>
        <p className="mt-1 text-sm text-dark-400">
          List an item for sale. You can add up to {MAX_IMAGES} images.
        </p>
      </div>

      {/* ---------- Form ---------- */}
      <form onSubmit={handleSubmit} className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Listing Details</h2>
          <Tag className="h-4 w-4 text-primary-400" />
        </div>
        <div className="card-body space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="listing-title" className="label">
              Title <span className="text-error-400">*</span>
            </label>
            <input
              id="listing-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. iPhone 13 Pro Max 256GB"
              className={cn(
                "input",
                titleError && title.length > 0 && "input-error"
              )}
              disabled={isSubmitting}
              maxLength={120}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="listing-desc" className="label">
              Description
            </label>
            <textarea
              id="listing-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the item, condition, and any other details…"
              rows={5}
              className="input resize-y"
              disabled={isSubmitting}
              maxLength={2000}
            />
          </div>

          {/* Price + Negotiable */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="listing-price" className="label">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Price <span className="text-error-400">*</span>
                </span>
              </label>
              <input
                id="listing-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className={cn(
                  "input",
                  priceError && price.length > 0 && "input-error"
                )}
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label className="label">Negotiable</label>
              <button
                type="button"
                onClick={() => setNegotiable((n) => !n)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                  negotiable
                    ? "border-primary-500/40 bg-primary-500/10 text-primary-300"
                    : "border-dark-700 bg-dark-800 text-dark-300"
                )}
                disabled={isSubmitting}
              >
                <span>Price is negotiable</span>
                <span
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors",
                    negotiable ? "bg-primary-600" : "bg-dark-600"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                      negotiable ? "left-4" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          {/* Category + Location */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="listing-category" className="label">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Category <span className="text-error-400">*</span>
                </span>
              </label>
              <select
                id="listing-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryValue)}
                className="input"
                disabled={isSubmitting}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="listing-location" className="label">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Location <span className="text-error-400">*</span>
                </span>
              </label>
              <input
                id="listing-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos, Nigeria"
                className={cn(
                  "input",
                  locationError && location.length > 0 && "input-error"
                )}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Images */}
          <div>
            <label className="label">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Images ({images.length}/{MAX_IMAGES})
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddImage();
                  }
                }}
                placeholder="https://example.com/image.jpg"
                className="input"
                disabled={isSubmitting || images.length >= MAX_IMAGES}
              />
              <button
                type="button"
                onClick={handleAddImage}
                disabled={
                  isSubmitting ||
                  !imageUrlInput.trim() ||
                  images.length >= MAX_IMAGES
                }
                className="btn btn-secondary shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            {/* Image previews */}
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-dark-700"
                  >
                    <img
                      src={img}
                      alt={`Listing image ${i + 1}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.opacity = "0.3";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-error-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-dark-500">
              Add up to {MAX_IMAGES} images. Paste a direct image URL and click Add.
            </p>
          </div>
        </div>

        {/* ---------- Actions ---------- */}
        <div className="flex items-center justify-end gap-3 border-t border-dark-800 px-5 py-4">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || formInvalid}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Create Listing
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
