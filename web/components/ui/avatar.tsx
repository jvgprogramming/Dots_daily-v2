"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { HTMLAttributes, forwardRef } from "react";

const avatarVariants = cva(
  "inline-flex items-center justify-center overflow-hidden rounded-full font-medium text-white shrink-0",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        default: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-xl",
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
    const gradientColors = [
      "bg-gradient-to-br from-primary-400 to-primary-600",
      "bg-gradient-to-br from-violet-400 to-violet-600",
      "bg-gradient-to-br from-amber-400 to-amber-600",
      "bg-gradient-to-br from-rose-400 to-rose-600",
      "bg-gradient-to-br from-cyan-400 to-cyan-600",
    ];

    const gradientIndex =
      fallback ? fallback.charCodeAt(0) % gradientColors.length : 0;

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
            gradientColors[gradientIndex],
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
