import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import {
  Settings as SettingsIcon, Save, Sparkles, Database, DollarSign,
  CreditCard, LifeBuoy, AlertTriangle, Loader2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import toast from "react-hot-toast";

type SettingDoc = {
  _id: string;
  key: string;
  value: string;
  label: string;
  group: string;
};

type GroupKey = "general" | "earning" | "payment" | "support" | "system" | "cashout";

const groupConfig: {
  key: GroupKey;
  label: string;
  icon: typeof SettingsIcon;
  description: string;
}[] = [
  { key: "general", label: "General", icon: SettingsIcon, description: "Platform-wide configuration" },
  { key: "earning", label: "Rewards", icon: DollarSign, description: "Earning rates for user activities" },
  { key: "payment", label: "Payments", icon: CreditCard, description: "Cashout and payment provider settings" },
  { key: "cashout", label: "Cashout", icon: DollarSign, description: "Minimum cashout threshold" },
  { key: "support", label: "Support", icon: LifeBuoy, description: "Support contact channels" },
  { key: "system", label: "System", icon: Database, description: "Maintenance and system flags" },
];

// Expected keys per group, used to seed empty fields for new settings.
const expectedKeys: Record<GroupKey, { key: string; label: string }[]> = {
  general: [
    { key: "platform_name", label: "Platform Name" },
    { key: "usd_to_ngn_rate", label: "USD → NGN Rate" },
  ],
  earning: [
    { key: "registration_fee", label: "Registration Fee (₦)" },
    { key: "referral_reward", label: "Referral Reward (₦)" },
    { key: "daily_bonus", label: "Daily Bonus (₦)" },
    { key: "read_reward", label: "Read Reward (₦)" },
    { key: "watch_reward", label: "Watch Reward (₦)" },
    { key: "task_reward", label: "Task Reward (₦)" },
    { key: "blog_reward", label: "Blog Reward (₦)" },
  ],
  payment: [
    { key: "payment_provider", label: "Payment Provider" },
    { key: "payment_account_name", label: "Payment Account Name" },
    { key: "payment_account_number", label: "Payment Account Number" },
  ],
  cashout: [
    { key: "min_cashout", label: "Minimum Cashout (₦)" },
  ],
  support: [
    { key: "support_email", label: "Support Email" },
    { key: "support_whatsapp", label: "Support WhatsApp" },
    { key: "telegram_link", label: "Telegram Link" },
  ],
  system: [
    { key: "maintenance_mode", label: "Maintenance Mode" },
  ],
};

const booleanKeys = new Set(["maintenance_mode"]);
const numberKeys = new Set([
  "registration_fee", "referral_reward", "daily_bonus", "read_reward",
  "watch_reward", "task_reward", "blog_reward", "min_cashout", "usd_to_ngn_rate",
]);

export default function AdminSettingsPage() {
  const settings = useQuery(api.settings.getAll) as SettingDoc[] | undefined;
  const bulkUpsert = useMutation(api.settings.bulkUpsert);
  const initDefaults = useMutation(api.settings.initDefaults);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  // Build a map of key → setting doc.
  const settingsByKey = useMemo(() => {
    const map: Record<string, SettingDoc> = {};
    if (settings) for (const s of settings) map[s.key] = s;
    return map;
  }, [settings]);

  const getValue = (key: string): string => {
    if (key in drafts) return drafts[key];
    return settingsByKey[key]?.value ?? "";
  };

  const handleChange = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const handleInitDefaults = async () => {
    setInitializing(true);
    try {
      await initDefaults({});
      toast.success("Default settings initialized");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to initialize defaults");
    }
    setInitializing(false);
  };

  const handleSaveGroup = async (groupKey: GroupKey) => {
    const expected = expectedKeys[groupKey];
    const items = expected
      .map((entry) => {
        const value = getValue(entry.key);
        if (!value && !booleanKeys.has(entry.key)) return null;
        return {
          key: entry.key,
          value: booleanKeys.has(entry.key) ? (value === "true" ? "true" : "false") : value,
          label: entry.label,
          group: groupKey,
        };
      })
      .filter(Boolean) as { key: string; value: string; label: string; group: string }[];

    if (items.length === 0) {
      toast.error("No values to save");
      return;
    }
    setSavingGroup(groupKey);
    try {
      await bulkUpsert({ items });
      // Clear drafts for this group.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const entry of expected) delete next[entry.key];
        return next;
      });
      toast.success(`${groupConfig.find((g) => g.key === groupKey)?.label} settings saved`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save settings");
    }
    setSavingGroup(null);
  };

  const isLoading = settings === undefined;
  const hasSettings = (settings?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!hasSettings) {
    return (
      <div className="card">
        <div className="card-body">
          <EmptyState
            icon={Database}
            title="No settings configured"
            description="Initialize the platform with default settings to get started, then customize them as needed."
            action={{
              label: initializing ? "Initializing…" : "Initialize Defaults",
              onClick: handleInitDefaults,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-xl border border-warning-500/20 bg-warning-500/10 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="text-sm font-medium text-amber-300">Changes affect the entire platform</p>
          <p className="text-xs text-amber-400/80">
            Reward and payment settings take effect immediately for all users. Save each group after editing.
          </p>
        </div>
      </div>

      {/* Setting groups */}
      {groupConfig.map((group) => {
        const entries = expectedKeys[group.key];
        const hasDraft = entries.some((e) => e.key in drafts);
        const isSaving = savingGroup === group.key;
        return (
          <div key={group.key} className="card">
            <div className="card-header">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15">
                  <group.icon className="h-4 w-4 text-accent-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">{group.label}</h2>
                  <p className="text-xs text-dark-500">{group.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleSaveGroup(group.key)}
                disabled={!hasDraft || isSaving}
                className="btn btn-primary btn-sm"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
            <div className="card-body space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {entries.map((entry) => {
                  const isBoolean = booleanKeys.has(entry.key);
                  const value = getValue(entry.key);
                  const isDirty = entry.key in drafts;
                  return (
                    <div key={entry.key}>
                      <label className="label">{entry.label}</label>
                      {isBoolean ? (
                        <select
                          value={value || "false"}
                          onChange={(e) => handleChange(entry.key, e.target.value)}
                          className={cn("input", isDirty && "border-accent-500/50")}
                        >
                          <option value="false">Disabled</option>
                          <option value="true">Enabled</option>
                        </select>
                      ) : (
                        <input
                          type={numberKeys.has(entry.key) ? "number" : "text"}
                          value={value}
                          onChange={(e) => handleChange(entry.key, e.target.value)}
                          className={cn("input", isDirty && "border-accent-500/50")}
                          placeholder={entry.label}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
