import { cn, getInitials } from "../../lib/utils";

type AvatarProps = {
  name?: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { box: "h-8 w-8", text: "text-xs", dot: "h-2 w-2", ring: "ring-dark-900" },
  md: { box: "h-10 w-10", text: "text-sm", dot: "h-2.5 w-2.5", ring: "ring-dark-900" },
  lg: { box: "h-12 w-12", text: "text-base", dot: "h-3 w-3", ring: "ring-dark-900" },
  xl: { box: "h-16 w-16", text: "text-lg", dot: "h-3.5 w-3.5", ring: "ring-dark-950" },
};

/**
 * Avatar with image or initials fallback and optional online indicator.
 */
export default function Avatar({
  name,
  src,
  size = "md",
  online,
  className,
}: AvatarProps) {
  const s = sizeMap[size];

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500 to-primary-700 font-semibold text-white ring-2",
          s.box,
          s.text,
          s.ring
        )}
      >
        {src ? (
          <img
            src={src}
            alt={name ?? "avatar"}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-2",
            s.dot,
            s.ring,
            online ? "bg-secondary-500" : "bg-dark-600"
          )}
        />
      )}
    </div>
  );
}
