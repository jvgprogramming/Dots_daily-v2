import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "matte-surface flex flex-col items-center justify-center rounded-[16px] border px-8 py-14 text-center",
        className
      )}
    >
      {/* Icon tile sitting in two soft rings */}
      <div className="mb-5 rounded-full bg-primary-50/70 p-2.5 ring-1 ring-primary-100/70">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-primary-200/70 text-primary-800 shadow-xs">
          {icon || <Inbox className="h-5 w-5" />}
        </div>
      </div>
      <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-text-primary">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  );
}
