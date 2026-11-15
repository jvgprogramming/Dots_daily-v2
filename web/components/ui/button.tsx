"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-medium tracking-[-0.005em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-900 text-white shadow-xs hover:bg-primary-800 focus-visible:ring-primary-900/30",
        destructive:
          "bg-danger text-white shadow-xs hover:bg-danger/90 focus-visible:ring-danger/30",
        outline:
          "border border-border-default bg-bg-card text-text-primary hover:border-border-strong hover:bg-bg-subtle focus-visible:ring-primary-500/30",
        secondary:
          "bg-bg-subtle text-text-primary border border-transparent hover:bg-primary-100/70 hover:text-primary-900",
        ghost:
          "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        link: "text-primary-700 underline-offset-4 hover:underline hover:text-primary-900",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 rounded-[8px] px-3 text-[12px]",
        lg: "h-11 rounded-[10px] px-6 text-[14px]",
        xl: "h-12 rounded-[12px] px-7 text-[14px]",
        icon: "h-9 w-9 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
