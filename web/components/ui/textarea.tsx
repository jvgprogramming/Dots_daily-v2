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
          "flex min-h-[100px] w-full rounded-[8px] border bg-bg-card px-3 py-2.5 text-[13px] leading-relaxed text-text-primary placeholder:text-text-muted transition-colors duration-150",
          "focus:outline-none focus:ring-[3px] focus:ring-primary-500/[0.12] focus:border-primary-600",
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
