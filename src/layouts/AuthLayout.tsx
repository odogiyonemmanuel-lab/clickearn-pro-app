import { Outlet } from "react-router-dom";
import { Zap, Coins, Gift, Users } from "lucide-react";

const features = [
  {
    icon: Coins,
    title: "Earn on Every Task",
    description: "Complete clicks, reads, and watches to earn rewards instantly.",
  },
  {
    icon: Gift,
    title: "Daily Bonuses & Rewards",
    description: "Claim daily bonuses and unlock streak rewards every day.",
  },
  {
    icon: Users,
    title: "Refer & Earn Together",
    description: "Invite friends and earn commissions on their activity.",
  },
];

/**
 * Split-screen auth layout.
 * Desktop: left gradient brand panel, right form card.
 * Mobile: only the form side.
 */
export default function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-dark-950">
      {/* ---------- Left: Brand panel (desktop only) ---------- */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-dark-950 p-12 lg:flex">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-60 w-60 rounded-full bg-secondary-500/10 blur-3xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
            <Zap className="h-6 w-6 text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ClickEarn Pro</h1>
            <p className="text-sm text-primary-200">Earn. Refer. Withdraw.</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight text-white">
            Turn your time into{" "}
            <span className="bg-gradient-to-r from-primary-200 to-accent-300 bg-clip-text text-transparent">
              real earnings
            </span>
          </h2>
          <p className="mt-4 text-lg text-primary-100/80">
            Complete simple tasks, read the news, watch videos, and refer friends
            to build a steady income stream.
          </p>

          {/* Feature highlights */}
          <div className="mt-10 space-y-5">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white">{f.title}</p>
                  <p className="text-sm text-primary-100/70">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative text-sm text-primary-200/60">
          &copy; {new Date().getFullYear()} ClickEarn Pro. All rights reserved.
        </div>
      </div>

      {/* ---------- Right: Form side ---------- */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-900/40">
              <Zap className="h-6 w-6 text-white" fill="white" />
            </div>
            <h1 className="text-xl font-bold text-white">ClickEarn Pro</h1>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
