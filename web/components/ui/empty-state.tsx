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
        "flex flex-col items-center justify-center rounded-[16px] border border-dashed border-border-light bg-bg-card p-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[12px] bg-bg-subtle text-text-tertiary">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-[16px] font-semibold text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[14px] text-text-secondary">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-5">
          {action.label}
        </Button>
      )}
    </div>
  );
}
