import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  ArrowLeft, Plus, X, Loader2, FileText, Tag, Image as ImageIcon,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { value: "news", label: "News" },
  { value: "job", label: "Job" },
  { value: "article", label: "Article" },
  { value: "review", label: "Review" },
  { value: "tutorial", label: "Tutorial" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

const MAX_TAGS = 8;
const MAX_IMAGES = 5;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CreatePostPage() {
  const navigate = useNavigate();
  const submitPost = useMutation(api.posts.submitPost as any);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<CategoryValue>("article");
  const [tagsInput, setTagsInput] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------- Derived tags ---------- */
  const tags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  /* ---------- Validation ---------- */
  const titleError = title.trim().length === 0;
  const contentError = content.trim().length === 0;
  const formInvalid = titleError || contentError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!content.trim()) {
      toast.error("Content is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitPost({
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim(),
        category,
        imageUrl: imageUrl.trim() || undefined,
        tags,
      });
      toast.success("Post submitted for review!");
      navigate("/blog");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/blog");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ---------- Back ---------- */}
      <div className="flex items-center justify-between">
        <Link to="/blog" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to Blog
        </Link>
      </div>

      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-2xl font-bold text-white">Submit a Post</h1>
        <p className="mt-1 text-sm text-dark-400">
          Share your thoughts with the community. Posts are reviewed before
          publishing and earn a reward when approved.
        </p>
      </div>

      {/* ---------- Form ---------- */}
      <form onSubmit={handleSubmit} className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Post Details</h2>
          <FileText className="h-4 w-4 text-primary-400" />
        </div>
        <div className="card-body space-y-5">
          {/* Title */}
          <div>
            <label htmlFor="post-title" className="label">
              Title <span className="text-error-400">*</span>
            </label>
            <input
              id="post-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="An engaging title for your post"
              className={cn("input", titleError && title.length > 0 && "input-error")}
              disabled={isSubmitting}
              maxLength={120}
              required
            />
            <p className="mt-1.5 text-xs text-dark-500">{title.length}/120</p>
          </div>

          {/* Summary */}
          <div>
            <label htmlFor="post-summary" className="label">
              Summary
            </label>
            <input
              id="post-summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A short one-line summary"
              className="input"
              disabled={isSubmitting}
              maxLength={200}
            />
            <p className="mt-1.5 text-xs text-dark-500">
              {summary.length}/200 — shown in the post list
            </p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="post-category" className="label">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Category <span className="text-error-400">*</span>
              </span>
            </label>
            <select
              id="post-category"
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

          {/* Content */}
          <div>
            <label htmlFor="post-content" className="label">
              Content <span className="text-error-400">*</span>
            </label>
            <textarea
              id="post-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post here…"
              rows={10}
              className={cn(
                "input resize-y",
                contentError && content.length > 0 && "input-error"
              )}
              disabled={isSubmitting}
              required
            />
            <p className="mt-1.5 text-xs text-dark-500">
              {content.length} characters
            </p>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="post-tags" className="label">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Tags
              </span>
            </label>
            <input
              id="post-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="news, tech, tutorial (comma-separated)"
              className="input"
              disabled={isSubmitting}
            />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-primary-500/15 px-2.5 py-0.5 text-xs text-primary-300"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() =>
                        setTagsInput(
                          tagsInput
                            .split(",")
                            .map((t) => t.trim())
                            .filter((t) => t !== tag)
                            .join(", ")
                        )
                      }
                      className="text-primary-400 hover:text-primary-200"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-xs text-dark-500">
              Separate tags with commas. Up to {MAX_TAGS} tags.
            </p>
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="post-image" className="label">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Image URL
              </span>
            </label>
            <input
              id="post-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="input"
              disabled={isSubmitting}
            />
            {imageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border border-dark-800">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="max-h-40 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
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
                Submitting…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Submit Post
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
