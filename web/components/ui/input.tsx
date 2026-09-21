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
          "flex h-11 w-full rounded-[10px] border bg-bg-card px-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-primary-400/25 focus:border-primary-500",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-subtle",
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
Input.displayName = "Input";

export { Input };
