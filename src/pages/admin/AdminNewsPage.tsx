import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Newspaper, Plus, Pencil, Power, Eye, Image as ImageIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate, truncate } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type NewsRow = {
  _id: string;
  title: string;
  slug: string;
  content: string;
  summary: string;
  imageUrl?: string;
  category: string;
  tags: string[];
  readReward: number;
  requiredReadSeconds: number;
  isPublished: boolean;
  views: number;
  createdAt: number;
  publishedAt?: number;
};

const PAGE_SIZE = 20;

type FormState = {
  title: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  tags: string;
  readReward: string;
  requiredReadSeconds: string;
};

const emptyForm: FormState = {
  title: "",
  summary: "",
  content: "",
  imageUrl: "",
  category: "general",
  tags: "",
  readReward: "20",
  requiredReadSeconds: "30",
};

function formFromNews(news: NewsRow): FormState {
  return {
    title: news.title,
    summary: news.summary,
    content: news.content,
    imageUrl: news.imageUrl ?? "",
    category: news.category,
    tags: news.tags.join(", "),
    readReward: String(news.readReward),
    requiredReadSeconds: String(news.requiredReadSeconds),
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminNewsPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewNews, setPreviewNews] = useState<NewsRow | null>(null);

  const result = useQuery(api.news.adminGetNews, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  }) as { page: NewsRow[]; isDone: boolean; continueCursor: string } | undefined;

  const createNews = useMutation(api.news.adminCreateNews);
  const updateNews = useMutation(api.news.adminUpdateNews);
  const togglePublish = useMutation(api.news.adminTogglePublish);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (news: NewsRow) => {
    setEditing(news);
    setForm(formFromNews(news));
    setModalOpen(true);
  };

  const handleToggle = async (news: NewsRow) => {
    try {
      await togglePublish({ newsId: news._id as any });
      toast.success(`News article ${news.isPublished ? "unpublished" : "published"}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to toggle publish");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const reward = Number(form.readReward);
    const seconds = Number(form.requiredReadSeconds);
    setSaving(true);
    try {
      if (editing) {
        await updateNews({
          newsId: editing._id as any,
          title: form.title.trim(),
          slug: slugify(form.title),
          content: form.content.trim(),
          summary: form.summary.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          category: form.category.trim(),
          tags,
          readReward: reward,
          requiredReadSeconds: seconds,
        } as any);
        toast.success("News article updated");
      } else {
        await createNews({
          title: form.title.trim(),
          slug: slugify(form.title),
          content: form.content.trim(),
          summary: form.summary.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          category: form.category.trim(),
          tags,
          readReward: reward,
          requiredReadSeconds: seconds,
        } as any);
        toast.success("News article created");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save news article");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* ============ Header ============ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">News Articles</h2>
          <p className="text-sm text-dark-400">Manage news content that users can read for rewards.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus className="h-4 w-4" /> Add Article
        </button>
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
            icon={Newspaper}
            title="No news articles"
            description="Create your first news article to reward users for reading."
            action={{ label: "Add Article", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Image</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Category</th>
                  <th className="table-header">Views</th>
                  <th className="table-header">Published</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((news) => (
                  <tr key={news._id} className="hover:bg-dark-800/30">
                    <td className="table-cell">
                      <div className="h-10 w-14 overflow-hidden rounded-lg bg-dark-800">
                        {news.imageUrl ? (
                          <img src={news.imageUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-dark-600" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="max-w-[220px] truncate font-medium text-white">{news.title}</p>
                      <p className="text-xs text-dark-500">{formatCurrency(news.readReward)} reward</p>
                    </td>
                    <td className="table-cell">
                      <Badge variant="neutral">{news.category}</Badge>
                    </td>
                    <td className="table-cell text-dark-300">{news.views}</td>
                    <td className="table-cell">
                      {news.isPublished ? (
                        <Badge variant="success">Published</Badge>
                      ) : (
                        <Badge variant="neutral">Draft</Badge>
                      )}
                    </td>
                    <td className="table-cell text-dark-400">{formatDate(news.createdAt)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewNews(news)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                          title="Preview"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(news)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(news)}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-800",
                            news.isPublished ? "text-error-400 hover:text-error-300" : "text-secondary-400 hover:text-secondary-300"
                          )}
                          title={news.isPublished ? "Unpublish" : "Publish"}
                        >
                          <Power className="h-4 w-4" />
                        </button>
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

      {/* ============ Preview Modal ============ */}
      <Modal
        isOpen={!!previewNews}
        onClose={() => setPreviewNews(null)}
        title="Article Preview"
        maxWidth="2xl"
      >
        {previewNews && (
          <div className="space-y-4">
            {previewNews.imageUrl && (
              <img src={previewNews.imageUrl} alt="" className="h-48 w-full rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div>
              <Badge variant="neutral" className="mb-2">{previewNews.category}</Badge>
              <h2 className="text-xl font-bold text-white">{previewNews.title}</h2>
            </div>
            <p className="text-sm text-dark-300 italic">{truncate(previewNews.summary, 200)}</p>
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin rounded-lg border border-dark-800 bg-dark-800/30 p-4">
              <p className="whitespace-pre-wrap text-sm text-dark-200">{previewNews.content}</p>
            </div>
            <p className="text-xs text-dark-500">{previewNews.views} views · {previewNews.requiredReadSeconds}s required</p>
          </div>
        )}
      </Modal>

      {/* ============ Create / Edit Modal ============ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Article" : "Add Article"}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
              placeholder="Article title…"
            />
          </div>
          <div>
            <label className="label">Summary</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="input resize-none"
              rows={2}
              placeholder="Short summary shown in listings…"
            />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="input resize-none"
              rows={6}
              placeholder="Full article content…"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Image URL</label>
              <input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="input"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="label">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input"
                placeholder="e.g. crypto, finance, tech"
              />
            </div>
            <div>
              <label className="label">Tags (comma-separated)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="input"
                placeholder="bitcoin, finance, news"
              />
            </div>
            <div>
              <label className="label">Read Reward (₦)</label>
              <input
                type="number"
                step="0.01"
                value={form.readReward}
                onChange={(e) => setForm({ ...form, readReward: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Required Read Seconds</label>
              <input
                type="number"
                value={form.requiredReadSeconds}
                onChange={(e) => setForm({ ...form, requiredReadSeconds: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-dark-800 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : editing ? "Update Article" : "Create Article"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
