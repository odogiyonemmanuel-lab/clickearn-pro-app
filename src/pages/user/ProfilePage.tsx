import { useState, useEffect, type FormEvent } from "react";
import { useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  User as UserIcon, Mail, Phone, Image as ImageIcon, Copy, Check,
  Gift, Calendar, TrendingUp, Users, AlertCircle,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { useQuery } from "convex/react";
import {
  formatCurrency, formatDate, copyToClipboard, cn, getInitials,
} from "../../lib/utils";
import Avatar from "../../components/ui/Avatar";
import Badge from "../../components/ui/Badge";

type UserStats = {
  taskCompletions: number;
  referralCount: number;
  referralEarnings: number;
  totalEarned: number;
  completedTasks: number;
};

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-4 w-56" />
          </div>
        </div>
      </div>
      <div className="card p-6">
        <div className="skeleton mb-6 h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton mb-2 h-4 w-20" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, wallet, isLoading } = useCurrentUser();
  const stats = useQuery(api.users.getUserStats as any) as UserStats | undefined;

  const updateProfile = useMutation(api.users.updateProfile as any);

  // Editable form state — synced once the user loads.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Populate form fields when user data arrives.
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setImageUrl(user.image ?? "");
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <ProfileSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl card p-10 text-center">
        <p className="text-sm text-dark-400">
          Unable to load your profile. Please refresh the page.
        </p>
      </div>
    );
  }

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(user.referralCode);
    if (ok) {
      setCopiedCode(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(referralLink);
    if (ok) {
      setCopiedLink(true);
      toast.success("Referral link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        image: imageUrl.trim() || undefined,
      });
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ---------- Profile header ---------- */}
      <div className="card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <Avatar
            name={user.name}
            src={imageUrl || user.image}
            size="xl"
          />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
              <h1 className="text-xl font-bold text-white">
                {user.name ?? "Unnamed User"}
              </h1>
              <Badge variant={user.role === "admin" ? "primary" : "neutral"}>
                {user.role === "admin" ? "Admin" : "Member"}
              </Badge>
            </div>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-dark-400 sm:justify-start">
              <Mail className="h-4 w-4" />
              {user.email ?? "—"}
            </p>
            <p className="mt-1 text-xs text-dark-500">
              Member since {formatDate(user.createdAt)}
            </p>
          </div>
        </div>

        {/* Initials fallback display when no image */}
        {!user.image && !imageUrl && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-dark-800 px-3 py-2 text-xs text-dark-500">
            <span className="font-semibold text-dark-300">{getInitials(user.name)}</span>
            are your initials (set an image URL below to personalize your avatar)
          </div>
        )}
      </div>

      {/* ---------- Editable profile form ---------- */}
      <form onSubmit={handleSave} className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Edit Profile</h2>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
        <div className="card-body space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Name */}
            <div>
              <label htmlFor="profile-name" className="label">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" />
                  Full Name
                </span>
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="input"
                disabled={isSaving}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="profile-phone" className="label">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Phone Number
                </span>
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 800 000 0000"
                className="input"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="profile-image" className="label">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Profile Image URL
              </span>
            </label>
            <input
              id="profile-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="input"
              disabled={isSaving}
            />
            <p className="mt-1.5 text-xs text-dark-500">
              Paste a direct link to an image. Your initials are used until you do.
            </p>
          </div>

          {/* Read-only email */}
          <div>
            <label className="label">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email Address
              </span>
            </label>
            <input
              type="email"
              value={user.email ?? ""}
              disabled
              className="input opacity-60"
            />
            <p className="mt-1.5 text-xs text-dark-500">
              Email cannot be changed here. Contact support if it needs updating.
            </p>
          </div>
        </div>
      </form>

      {/* ---------- Referral section ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Your Referral</h2>
          <Gift className="h-4 w-4 text-primary-400" />
        </div>
        <div className="card-body space-y-4">
          {/* Referral code */}
          <div>
            <label className="label">Referral Code</label>
            <div className="flex items-stretch gap-2">
              <div className="flex flex-1 items-center rounded-lg border border-dark-700 bg-dark-800 px-4">
                <span className="font-mono text-lg font-bold tracking-wider text-primary-300">
                  {user.referralCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="btn btn-secondary"
                aria-label="Copy referral code"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-4 w-4 text-secondary-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referral link */}
          <div>
            <label className="label">Your Referral Link</label>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="input font-mono text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="btn btn-secondary shrink-0"
                aria-label="Copy referral link"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-4 w-4 text-secondary-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-dark-500">
              Share this link — when friends register with it, you earn rewards after
              their registration fee is approved.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Stats row ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-500/15">
              <Calendar className="h-5 w-5 text-primary-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-dark-400">Member Since</p>
              <p className="text-sm font-bold text-white">{formatDate(user.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary-500/15">
              <TrendingUp className="h-5 w-5 text-secondary-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-dark-400">Total Earned</p>
              <p className="text-sm font-bold text-white">
                {formatCurrency(wallet?.totalEarned ?? stats?.totalEarned)}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/15">
              <Users className="h-5 w-5 text-accent-400" />
            </div>
            <div>
              <p className="text-xs font-medium text-dark-400">Referral Count</p>
              <p className="text-sm font-bold text-white">
                {stats?.referralCount ?? 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
