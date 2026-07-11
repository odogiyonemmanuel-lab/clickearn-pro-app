import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

type BadgeProps = {
  children: ReactNode;
  variant?: "default" | "primary" | "success" | "warning" | "error" | "neutral";
  className?: string;
};

const variantMap: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-dark-700 text-dark-200 border border-dark-600",
  primary: "bg-primary-500/15 text-primary-300 border border-primary-500/20",
  success: "bg-secondary-500/15 text-secondary-300 border border-secondary-500/20",
  warning: "bg-warning-500/15 text-amber-400 border border-warning-500/20",
  error: "bg-error-500/15 text-red-400 border border-error-500/20",
  neutral: "bg-dark-700 text-dark-300 border border-dark-600",
};

/**
 * Small status/label badge.
 */
export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantMap[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
