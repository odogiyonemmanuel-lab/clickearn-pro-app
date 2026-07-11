import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../../lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  color?: "blue" | "green" | "orange" | "red";
  prefix?: string;
};

const colorStyles: Record<
  NonNullable<StatCardProps["color"]>,
  { iconBg: string; iconText: string; glow: string; ring: string }
> = {
  blue: {
    iconBg: "bg-primary-500/15",
    iconText: "text-primary-400",
    glow: "from-primary-500/10",
    ring: "group-hover:border-primary-500/30",
  },
  green: {
    iconBg: "bg-secondary-500/15",
    iconText: "text-secondary-400",
    glow: "from-secondary-500/10",
    ring: "group-hover:border-secondary-500/30",
  },
  orange: {
    iconBg: "bg-accent-500/15",
    iconText: "text-accent-400",
    glow: "from-accent-500/10",
    ring: "group-hover:border-accent-500/30",
  },
  red: {
    iconBg: "bg-error-500/15",
    iconText: "text-red-400",
    glow: "from-error-500/10",
    ring: "group-hover:border-error-500/30",
  },
};

/**
 * Beautiful gradient stat card for dashboards.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = "blue",
  prefix,
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-dark-800 bg-dark-900 p-5 shadow-lg shadow-black/20 transition-all duration-200 hover:shadow-xl hover:shadow-black/30",
        styles.ring
      )}
    >
      {/* Ambient glow */}
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br to-transparent blur-2xl opacity-60 transition-opacity duration-300 group-hover:opacity-100",
          styles.glow
        )}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-dark-400">{title}</p>
          <p className="text-2xl font-bold text-white">
            {prefix && <span className="mr-0.5 text-dark-400">{prefix}</span>}
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>

        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            styles.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", styles.iconText)} />
        </div>
      </div>

      {trend && (
        <div className="relative mt-3 flex items-center gap-1.5 text-xs">
          {trend.value >= 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-secondary-400" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
          )}
          <span
            className={cn(
              "font-semibold",
              trend.value >= 0 ? "text-secondary-400" : "text-red-400"
            )}
          >
            {trend.value >= 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-dark-500">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
