import { type LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
};

/**
 * Friendly empty-state placeholder for lists, tables, and sections.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800 border border-dark-700">
        <Icon className="h-7 w-7 text-dark-500" />
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-dark-400">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn btn-primary mt-5">
          {action.label}
        </button>
      )}
    </div>
  );
}
