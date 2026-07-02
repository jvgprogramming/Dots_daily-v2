"use client";

import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-[10px] border bg-bg-card px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-subtle",
          "resize-y",
          error
            ? "border-danger/50 focus:border-danger focus:ring-danger/20"
            : "border-border-default hover:border-border-strong",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
