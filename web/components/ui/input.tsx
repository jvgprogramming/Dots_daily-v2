"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, value, ...props }, ref) => {
    return (
      <input
        type={type}
        value={value === null ? "" : value}
        className={cn(
          "flex h-10 w-full rounded-[10px] border bg-bg-card px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-muted transition-colors duration-150",
          "focus:outline-none focus-visible:outline-none focus:ring-[3px] focus:ring-primary-500/[0.12] focus:border-primary-600",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-subtle",
          error
            ? "border-danger/50 focus:border-danger focus:ring-danger/15"
            : "border-border-default hover:border-border-strong",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
