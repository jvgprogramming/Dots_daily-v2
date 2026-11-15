"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { HTMLAttributes, forwardRef } from "react";

const avatarVariants = cva(
  "inline-flex items-center justify-center overflow-hidden rounded-full font-medium shrink-0 bg-primary-100 text-primary-900",
  {
    variants: {
      size: {
        sm: "h-7 w-7 text-[11px]",
        default: "h-9 w-9 text-[12px]",
        lg: "h-11 w-11 text-[13px]",
        xl: "h-14 w-14 text-[16px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

interface AvatarProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string | null;
  alt?: string;
  fallback?: string;
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, src, alt, fallback, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(avatarVariants({ size }), className)}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || "Avatar"}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <span
          className={cn(
            "flex h-full w-full items-center justify-center",
            src ? "hidden" : ""
          )}
        >
          {fallback ? fallback.charAt(0).toUpperCase() : "?"}
        </span>
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar, avatarVariants };
