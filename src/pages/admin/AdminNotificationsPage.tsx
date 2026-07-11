import { useState } from "react";
import { useMutation } from "convex/react";
import { Bell, Megaphone, Send, Info, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn, formatRelativeTime } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import toast from "react-hot-toast";

type BroadcastType = "announcement" | "info" | "warning";

const typeConfig: Record<BroadcastType, { icon: typeof Info; color: string; label: string }> = {
  announcement: { icon: Megaphone, color: "text-accent-400 bg-accent-500/15", label: "Announcement" },
  info: { icon: Info, color: "text-primary-400 bg-primary-500/15", label: "Info" },
  warning: { icon: AlertTriangle, color: "text-amber-400 bg-warning-500/15", label: "Warning" },
};

// In-memory history of broadcasts sent during this session (the API returns
// a count; we keep a local log for display since there's no list endpoint).
type BroadcastLog = {
  id: number;
  title: string;
  body: string;
  type: BroadcastType;
  count: number;
  sentAt: number;
};

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<BroadcastType>("announcement");
  const [sending, setSending] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [history, setHistory] = useState<BroadcastLog[]>([]);

  const broadcast = useMutation(api.notifications.adminBroadcast);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0;

  const handleSend = async () => {
    if (!canSubmit) {
      toast.error("Title and body are required");
      return;
    }
    setSending(true);
    try {
      const result = await broadcast({
        title: title.trim(),
        body: body.trim(),
        type,
      }) as { success: boolean; count: number };
      toast.success(`Notification sent to ${result.count} users`);
      setHistory((prev) => [
        {
          id: Date.now(),
          title: title.trim(),
          body: body.trim(),
          type,
          count: result.count,
          sentAt: Date.now(),
        },
        ...prev,
      ]);
      setTitle("");
      setBody("");
      setType("announcement");
      setConfirmModal(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send broadcast");
    }
    setSending(false);
  };

  return (
    <div className="space-y-5">
      {/* ============ Broadcast Form ============ */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-accent-400" />
            <h2 className="text-sm font-semibold text-white">Broadcast Notification</h2>
          </div>
        </div>
        <div className="card-body space-y-4">
          {/* Type selector */}
          <div>
            <label className="label">Notification Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(typeConfig) as BroadcastType[]).map((key) => {
                const cfg = typeConfig[key];
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setType(key)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      type === key
                        ? "border-accent-500/40 bg-accent-500/10 text-white"
                        : "border-dark-700 text-dark-400 hover:bg-dark-800 hover:text-white"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", type === key ? "text-accent-400" : "text-dark-500")} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="e.g. Platform Maintenance Scheduled"
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input resize-none"
              rows={4}
              placeholder="Write the notification message that all users will receive…"
              maxLength={500}
            />
            <p className="mt-1 text-right text-xs text-dark-500">{body.length}/500</p>
          </div>

          <div className="flex items-center justify-between border-t border-dark-800 pt-4">
            <div className="flex items-center gap-2 text-xs text-dark-500">
              <Info className="h-3.5 w-3.5" />
              This will be sent to all active, non-banned users.
            </div>
            <button
              onClick={() => setConfirmModal(true)}
              disabled={!canSubmit}
              className="btn btn-primary"
            >
              <Send className="h-4 w-4" /> Send to All Users
            </button>
          </div>
        </div>
      </div>

      {/* ============ Recent Broadcasts ============ */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary-400" />
            <h2 className="text-sm font-semibold text-white">Recent Broadcasts</h2>
          </div>
          <span className="text-xs text-dark-500">{history.length} sent this session</span>
        </div>
        <div className="card-body">
          {history.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No broadcasts sent yet"
              description="Notifications you send during this session will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {history.map((item) => {
                const cfg = typeConfig[item.type];
                const Icon = cfg.icon;
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-dark-800 bg-dark-800/30 p-3"
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", cfg.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">{item.title}</p>
                        <span className="shrink-0 text-xs text-dark-500">{formatRelativeTime(item.sentAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-dark-400">{item.body}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <Badge variant="neutral">{cfg.label}</Badge>
                        <span className="flex items-center gap-1 text-secondary-400">
                          <CheckCircle className="h-3 w-3" />
                          Delivered to {item.count} users
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ============ Confirm Modal ============ */}
      <Modal
        isOpen={confirmModal}
        onClose={() => setConfirmModal(false)}
        title="Confirm Broadcast"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-warning-500/20 bg-warning-500/10 p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-300">
              This will immediately send a notification to <span className="font-semibold">all active, non-banned users</span>. This action cannot be undone.
            </p>
          </div>
          <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-3 space-y-1">
            <p className="text-xs text-dark-500">Type: <span className="text-dark-200">{typeConfig[type].label}</span></p>
            <p className="text-sm font-medium text-white">{title || "(no title)"}</p>
            <p className="text-sm text-dark-300">{body || "(no body)"}</p>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmModal(false)} className="btn btn-secondary">Cancel</button>
            <button onClick={handleSend} disabled={sending} className="btn btn-primary">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Sending…" : "Confirm & Send"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

