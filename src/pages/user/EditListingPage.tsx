import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import toast from "react-hot-toast";
import { ArrowLeft, Save, Trash2, Plus, X } from "lucide-react";
import { useCurrentUser } from "../../hooks/useCurrentUser";

const CATEGORIES = [
  { value: "electronics", label: "Electronics" },
  { value: "phones", label: "Phones" },
  { value: "fashion", label: "Fashion" },
  { value: "vehicles", label: "Vehicles" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "jobs", label: "Jobs" },
  { value: "digital", label: "Digital Products" },
  { value: "others", label: "Others" },
] as const;

export default function EditListingPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const listing = useQuery(api.marketplace.getListingById, id ? { listingId: id as any } : "skip");
  const updateListing = useMutation(api.marketplace.updateListing);
  const deleteListing = useMutation(api.marketplace.deleteListing);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    negotiable: false,
    category: "electronics",
    location: "",
  });
  const [images, setImages] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (listing && !loaded) {
      if (user && listing.sellerId !== user._id) {
        toast.error("You can only edit your own listings");
        navigate("/marketplace");
        return;
      }
      setForm({
        title: listing.title || "",
        description: listing.description || "",
        price: String(listing.price || ""),
        negotiable: listing.negotiable ?? false,
        category: listing.category || "electronics",
        location: listing.location || "",
      });
      setImages(listing.images?.length ? [...listing.images, ""] : [""]);
      setLoaded(true);
    }
  }, [listing, user, loaded, navigate]);

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.price || Number(form.price) <= 0) return toast.error("Valid price is required");
    if (!form.location.trim()) return toast.error("Location is required");

    setSaving(true);
    try {
      const cleanImages = images.filter((img) => img.trim() !== "");
      await updateListing({
        listingId: id as any,
        title: form.title,
        description: form.description,
        price: Number(form.price),
        negotiable: form.negotiable,
        category: form.category,
        location: form.location,
        images: cleanImages,
      });
      toast.success("Listing updated successfully");
      navigate(`/marketplace/${id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update listing");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setDeleting(true);
    try {
      await deleteListing({ listingId: id as any });
      toast.success("Listing deleted");
      navigate("/marketplace");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete listing");
    } finally {
      setDeleting(false);
    }
  };

  if (listing === undefined) {
    return (
      <div className="p-6">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-96 w-full" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="p-6 text-center">
        <p className="text-dark-400">Listing not found.</p>
        <button onClick={() => navigate("/marketplace")} className="btn-secondary mt-4">
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(`/marketplace/${id}`)} className="btn-ghost mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Listing
      </button>

      <h1 className="text-2xl font-bold text-white mb-6">Edit Listing</h1>

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What are you selling?"
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[100px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Describe your item..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Price (₦)</label>
            <input
              className="input"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="0"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Location</label>
          <input
            className="input"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="City, State"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.negotiable}
              onChange={(e) => setForm({ ...form, negotiable: e.target.checked })}
              className="w-4 h-4 rounded accent-primary-600"
            />
            <span className="text-sm text-dark-200">Price is negotiable</span>
          </label>
        </div>

        <div>
          <label className="label">Images (URLs)</label>
          <div className="space-y-2">
            {images.map((img, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  value={img}
                  onChange={(e) => {
                    const next = [...images];
                    next[i] = e.target.value;
                    setImages(next);
                  }}
                  placeholder="https://example.com/image.jpg"
                />
                {images.length > 1 && (
                  <button
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="btn-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {images.length < 5 && (
              <button
                onClick={() => setImages([...images, ""])}
                className="btn-ghost text-sm"
              >
                <Plus className="w-4 h-4" /> Add Image
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger">
            <Trash2 className="w-4 h-4" /> {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
