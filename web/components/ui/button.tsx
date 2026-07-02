"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-500 text-white shadow-sm hover:bg-primary-600 hover:shadow-md active:scale-[0.98] focus-visible:ring-primary-500",
        destructive:
          "bg-danger text-white shadow-sm hover:bg-danger/90 hover:shadow-md active:scale-[0.98] focus-visible:ring-danger",
        outline:
          "border border-border-default bg-bg-card text-text-primary hover:bg-bg-subtle hover:border-border-strong active:scale-[0.98] focus-visible:ring-primary-500",
        secondary:
          "bg-bg-subtle text-text-primary hover:bg-border-light active:scale-[0.98] focus-visible:ring-primary-500",
        ghost:
          "text-text-secondary hover:bg-bg-subtle hover:text-text-primary active:scale-[0.98] focus-visible:ring-primary-500",
        link: "text-primary-600 underline-offset-4 hover:underline hover:text-primary-700 focus-visible:ring-primary-500",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-[8px] px-4 text-xs",
        lg: "h-12 rounded-[10px] px-8 text-base",
        xl: "h-14 rounded-[12px] px-10 text-base",
        icon: "h-10 w-10 rounded-[10px]",
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
