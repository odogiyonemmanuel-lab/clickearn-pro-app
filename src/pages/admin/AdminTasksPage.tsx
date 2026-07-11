import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  ListTodo, Plus, MousePointerClick, Eye, BookOpen, Share2, Megaphone,
  Pencil, Power, Star, Clock, X,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatCurrency, formatDate } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type TaskType = "click" | "watch" | "read" | "social" | "sponsor";

type TaskRow = {
  _id: string;
  title: string;
  description: string;
  type: TaskType;
  reward: number;
  url?: string;
  videoUrl?: string;
  totalCompletions: number;
  dailyLimit: number;
  cooldownHours: number;
  isActive: boolean;
  isFeatured: boolean;
  requiredWatchPercent?: number;
  requiredReadSeconds?: number;
  expiresAt?: number;
  createdAt: number;
};

const PAGE_SIZE = 20;

const typeIconMap: Record<TaskType, typeof MousePointerClick> = {
  click: MousePointerClick,
  watch: Eye,
  read: BookOpen,
  social: Share2,
  sponsor: Megaphone,
};

const typeLabelMap: Record<TaskType, string> = {
  click: "Click",
  watch: "Watch",
  read: "Read",
  social: "Social",
  sponsor: "Sponsor",
};

type FormState = {
  title: string;
  description: string;
  type: TaskType;
  reward: string;
  url: string;
  videoUrl: string;
  cooldownHours: string;
  dailyLimit: string;
  requiredWatchPercent: string;
  requiredReadSeconds: string;
  isFeatured: boolean;
  expiresAt: string;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  type: "click",
  reward: "",
  url: "",
  videoUrl: "",
  cooldownHours: "24",
  dailyLimit: "1",
  requiredWatchPercent: "80",
  requiredReadSeconds: "30",
  isFeatured: false,
  expiresAt: "",
};

function formFromTask(task: TaskRow): FormState {
  return {
    title: task.title,
    description: task.description,
    type: task.type,
    reward: String(task.reward),
    url: task.url ?? "",
    videoUrl: task.videoUrl ?? "",
    cooldownHours: String(task.cooldownHours),
    dailyLimit: String(task.dailyLimit),
    requiredWatchPercent: String(task.requiredWatchPercent ?? 80),
    requiredReadSeconds: String(task.requiredReadSeconds ?? 30),
    isFeatured: task.isFeatured,
    expiresAt: task.expiresAt ? new Date(task.expiresAt).toISOString().slice(0, 10) : "",
  };
}

export default function AdminTasksPage() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const result = useQuery(api.tasks.adminGetTasks, {
    paginationOpts: { numItems: PAGE_SIZE, cursor },
  }) as { page: TaskRow[]; isDone: boolean; continueCursor: string } | undefined;

  const createTask = useMutation(api.tasks.adminCreateTask);
  const updateTask = useMutation(api.tasks.adminUpdateTask);
  const toggleTask = useMutation(api.tasks.adminToggleTask);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (task: TaskRow) => {
    setEditing(task);
    setForm(formFromTask(task));
    setModalOpen(true);
  };

  const handleToggle = async (task: TaskRow) => {
    try {
      await toggleTask({ taskId: task._id as any });
      toast.success(`Task ${task.isActive ? "deactivated" : "activated"}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to toggle task");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    const reward = parseFloat(form.reward);
    if (isNaN(reward) || reward < 0) {
      toast.error("Enter a valid reward amount");
      return;
    }
    setSaving(true);
    try {
      const base = {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        reward,
        url: form.url.trim() || undefined,
        videoUrl: form.videoUrl.trim() || undefined,
        requiredWatchPercent: form.type === "watch" ? Number(form.requiredWatchPercent) : undefined,
        requiredReadSeconds: form.type === "read" ? Number(form.requiredReadSeconds) : undefined,
        isFeatured: form.isFeatured,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).getTime() : undefined,
      };
      if (editing) {
        await updateTask({
          taskId: editing._id as any,
          ...base,
          cooldownHours: Number(form.cooldownHours),
          dailyLimit: Number(form.dailyLimit),
        });
        toast.success("Task updated");
      } else {
        await createTask({
          ...base,
          cooldownHours: Number(form.cooldownHours),
          dailyLimit: Number(form.dailyLimit),
          isActive: true,
        } as any);
        toast.success("Task created");
      }
      setModalOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save task");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* ============ Header ============ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Tasks</h2>
          <p className="text-sm text-dark-400">Manage earning tasks available to users.</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus className="h-4 w-4" /> Add Task
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
            icon={ListTodo}
            title="No tasks yet"
            description="Create your first earning task to get started."
            action={{ label: "Add Task", onClick: openCreate }}
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800 bg-dark-900/50">
                  <th className="table-header">Type</th>
                  <th className="table-header">Title</th>
                  <th className="table-header">Reward</th>
                  <th className="table-header">Completions</th>
                  <th className="table-header">Daily Limit</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {result.page.map((task) => {
                  const Icon = typeIconMap[task.type];
                  return (
                    <tr key={task._id} className="hover:bg-dark-800/30">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dark-800">
                            <Icon className="h-4 w-4 text-accent-400" />
                          </div>
                          <span className="text-dark-300">{typeLabelMap[task.type]}</span>
                          {task.isFeatured && (
                            <Star className="h-3.5 w-3.5 fill-accent-400 text-accent-400" />
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-white">{task.title}</p>
                        {task.expiresAt && (
                          <p className="text-xs text-dark-500">Expires {formatDate(task.expiresAt)}</p>
                        )}
                      </td>
                      <td className="table-cell font-medium text-primary-400">
                        {formatCurrency(task.reward)}
                      </td>
                      <td className="table-cell text-dark-300">{task.totalCompletions}</td>
                      <td className="table-cell text-dark-300">{task.dailyLimit}/day</td>
                      <td className="table-cell">
                        {task.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="neutral">Inactive</Badge>
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(task)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-400 hover:bg-dark-800 hover:text-white"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(task)}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-800",
                              task.isActive ? "text-error-400 hover:text-error-300" : "text-secondary-400 hover:text-secondary-300"
                            )}
                            title={task.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      {/* ============ Create / Edit Modal ============ */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Task" : "Create Task"}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="e.g. Visit our sponsor"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input resize-none"
                rows={2}
                placeholder="Instructions for the user…"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}
                className="input"
              >
                <option value="click">Click</option>
                <option value="watch">Watch</option>
                <option value="read">Read</option>
                <option value="social">Social</option>
                <option value="sponsor">Sponsor</option>
              </select>
            </div>
            <div>
              <label className="label">Reward (₦)</label>
              <input
                type="number"
                step="0.01"
                value={form.reward}
                onChange={(e) => setForm({ ...form, reward: e.target.value })}
                className="input"
                placeholder="e.g. 20"
              />
            </div>
            <div>
              <label className="label">URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="input"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="label">Video URL (for watch tasks)</label>
              <input
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                className="input"
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="label">Cooldown (hours)</label>
              <input
                type="number"
                value={form.cooldownHours}
                onChange={(e) => setForm({ ...form, cooldownHours: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Daily Limit</label>
              <input
                type="number"
                value={form.dailyLimit}
                onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })}
                className="input"
              />
            </div>
            {form.type === "watch" && (
              <div>
                <label className="label">Required Watch %</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.requiredWatchPercent}
                  onChange={(e) => setForm({ ...form, requiredWatchPercent: e.target.value })}
                  className="input"
                />
              </div>
            )}
            {form.type === "read" && (
              <div>
                <label className="label">Required Read Seconds</label>
                <input
                  type="number"
                  value={form.requiredReadSeconds}
                  onChange={(e) => setForm({ ...form, requiredReadSeconds: e.target.value })}
                  className="input"
                />
              </div>
            )}
            <div>
              <label className="label">Expiry Date</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                className="input"
              />
            </div>
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-dark-200">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                  className="h-4 w-4 rounded border-dark-600 bg-dark-800 text-accent-500 focus:ring-accent-500"
                />
                <Star className="h-4 w-4 text-accent-400" />
                Featured task
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-dark-800 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : editing ? "Update Task" : "Create Task"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
