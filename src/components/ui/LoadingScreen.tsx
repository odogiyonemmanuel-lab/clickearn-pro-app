import { Zap } from "lucide-react";

/**
 * Full-screen dark loading state with the ClickEarn Pro logo and an animated spinner.
 */
export default function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark-950">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-6">
        {/* Logo + spinner combo */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          {/* Spinning ring */}
          <div className="absolute inset-0 rounded-full border-2 border-dark-800 border-t-primary-500 animate-spin" />
          {/* Logo */}
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-900/40">
            <Zap className="h-5 w-5 text-white" fill="white" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <h2 className="text-lg font-semibold text-white">ClickEarn Pro</h2>
          <p className="text-sm text-dark-400">{label}</p>
        </div>
      </div>
    </div>
  );
}
