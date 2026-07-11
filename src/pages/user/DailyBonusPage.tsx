import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  Gift, Clock, CheckCircle2, Sparkles, Loader2, History,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSettings } from "../../hooks/useSettings";
import { formatCurrency, formatRelativeTime, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type BonusStatus = {
  canClaim: boolean;
  nextClaimAt: number | null;
  lastClaim: { amount: number; claimedAt: number } | null;
};

type ClaimDoc = {
  _id: string;
  amount: number;
  claimedAt: number;
};

/* ------------------------------------------------------------------ */
/* Countdown hook                                                      */
/* ------------------------------------------------------------------ */

function useCountdown(target: number | null): {
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
} {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (target === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (target === null || now >= target) {
    return { hours: 0, minutes: 0, seconds: 0, done: true };
  }

  const diff = target - now;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function BonusSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-8">
        <div className="mx-auto mb-6 skeleton h-20 w-20 rounded-full" />
        <div className="mx-auto skeleton h-8 w-48" />
        <div className="mx-auto mt-4 skeleton h-16 w-40" />
        <div className="mx-auto mt-6 skeleton h-12 w-48 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DailyBonusPage() {
  const status = useQuery(api.rewards.getMyDailyBonusStatus as any) as
    | BonusStatus
    | undefined;
  const claimBonus = useMutation(api.rewards.claimDailyBonus as any);
  const { dailyBonus } = useSettings();

  const [isClaiming, setIsClaiming] = useState(false);
  // Local override so the UI flips to countdown immediately after claiming.
  const [localNextClaimAt, setLocalNextClaimAt] = useState<number | null>(null);
  const [claimHistory, setClaimHistory] = useState<ClaimDoc[]>([]);

  // Server-driven next claim time, unless we've overridden locally.
  const effectiveNextClaimAt =
    localNextClaimAt ?? status?.nextClaimAt ?? null;
  const effectiveCanClaim =
    (localNextClaimAt === null ? status?.canClaim : false) ?? false;

  const countdown = useCountdown(effectiveNextClaimAt);

  // When the countdown elapses, clear the local override so the server value
  // can take over (the query will refresh and report canClaim: true).
  useEffect(() => {
    if (localNextClaimAt !== null && countdown.done) {
      setLocalNextClaimAt(null);
    }
  }, [localNextClaimAt, countdown.done]);

  // Track the last claim in local history for instant UI feedback.
  useEffect(() => {
    if (status?.lastClaim) {
      setClaimHistory((prev) => {
        const exists = prev.some(
          (c) => c.claimedAt === status.lastClaim!.claimedAt
        );
        if (exists) return prev;
        return [
          {
            _id: `local-${status.lastClaim!.claimedAt}`,
            amount: status.lastClaim!.amount,
            claimedAt: status.lastClaim!.claimedAt,
          },
          ...prev,
        ];
      });
    }
  }, [status?.lastClaim]);

  const handleClaim = useCallback(async () => {
    setIsClaiming(true);
    const now = Date.now();
    const next = now + 24 * 60 * 60 * 1000;
    try {
      const res = await claimBonus({});
      toast.success(`You earned ${formatCurrency(res.amount)}!`);
      // Optimistic UI: show countdown immediately.
      setLocalNextClaimAt(next);
      setClaimHistory((prev) => [
        {
          _id: `local-${now}`,
          amount: res.amount,
          claimedAt: now,
        },
        ...prev,
      ]);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to claim daily bonus");
      // Revert optimistic state.
      setLocalNextClaimAt(null);
    } finally {
      setIsClaiming(false);
    }
  }, [claimBonus]);

  if (status === undefined) {
    return (
      <div className="mx-auto max-w-2xl">
        <BonusSkeleton />
      </div>
    );
  }

  const claimable = effectiveCanClaim || countdown.done;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Daily Bonus</h1>
        <p className="mt-1 text-sm text-dark-400">
          Claim your daily reward and keep your streak going.
        </p>
      </div>

      {/* ---------- Claim card ---------- */}
      <div
        className={cn(
          "card relative overflow-hidden p-8 text-center",
          claimable && !isClaiming && "ring-1 ring-primary-500/40"
        )}
      >
        {/* Glow background when claimable */}
        {claimable && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-accent-500/10" />
        )}

        <div className="relative">
          <div
            className={cn(
              "mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-900/40",
              claimable && !isClaiming && "animate-pulse"
            )}
          >
            <Gift className="h-9 w-9 text-white" />
          </div>

          <h2 className="mt-5 text-lg font-semibold text-white">
            Your Daily Bonus
          </h2>
          <p className="mt-1 text-4xl font-bold text-gradient">
            {formatCurrency(dailyBonus)}
          </p>

          {/* Countdown or claim button */}
          {claimable ? (
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="btn btn-primary btn-lg mt-6"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Claiming…
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Claim Daily Bonus
                </>
              )}
            </button>
          ) : (
            <div className="mt-6">
              <p className="flex items-center justify-center gap-1.5 text-sm text-dark-400">
                <Clock className="h-4 w-4" />
                Next bonus in
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {[
                  { label: "Hours", value: countdown.hours },
                  { label: "Min", value: countdown.minutes },
                  { label: "Sec", value: countdown.seconds },
                ].map((unit, i) => (
                  <div key={unit.label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className="flex h-14 w-16 items-center justify-center rounded-lg border border-dark-700 bg-dark-800 font-mono text-2xl font-bold text-white tabular-nums">
                        {pad(unit.value)}
                      </div>
                      <span className="mt-1 text-[10px] uppercase tracking-wider text-dark-500">
                        {unit.label}
                      </span>
                    </div>
                    {i < 2 && (
                      <span className="text-xl font-bold text-dark-600">:</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {status.lastClaim && !claimable && (
            <p className="mt-4 text-xs text-dark-500">
              Last claimed {formatRelativeTime(status.lastClaim.claimedAt)} for{" "}
              {formatCurrency(status.lastClaim.amount)}
            </p>
          )}
        </div>
      </div>

      {/* ---------- History ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">Claim History</h2>
          <History className="h-4 w-4 text-dark-400" />
        </div>
        {claimHistory.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No claims yet"
            description="Claim your first daily bonus to start your streak!"
          />
        ) : (
          <ul className="divide-y divide-dark-800">
            {claimHistory.map((c) => (
              <li
                key={c._id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-500/15">
                    <CheckCircle2 className="h-4 w-4 text-secondary-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {formatCurrency(c.amount)}
                    </p>
                    <p className="text-xs text-dark-500">
                      {formatRelativeTime(c.claimedAt)}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Claimed</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
