"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ProgressProps {
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "default";
}

export function Progress({
  value,
  variant = "default",
  className,
  showLabel,
  size = "default",
}: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const variantStyles = {
    default: "bg-primary-500",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex-1 overflow-hidden rounded-full bg-bg-subtle",
          size === "sm" ? "h-1.5" : "h-2.5"
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn(
            "h-full rounded-full",
            variantStyles[variant]
          )}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-text-secondary min-w-[2.5rem] text-right">
          {Math.round(clampedValue)}%
        </span>
      )}
    </div>
  );
}
