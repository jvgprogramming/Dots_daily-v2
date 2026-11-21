"use client";

import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { ButtonHTMLAttributes, forwardRef } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-semibold tracking-[-0.005em] transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-action text-white shadow-[0_6px_14px_-8px_rgb(11_90_60/0.65)] hover:bg-brand-action-hover hover:shadow-[0_10px_20px_-10px_rgb(11_90_60/0.75)] focus-visible:ring-brand-action/30",
        destructive:
          "bg-danger text-white shadow-xs hover:bg-danger/90 focus-visible:ring-danger/30",
        outline:
          "border border-border-default bg-bg-card text-text-primary shadow-xs hover:border-border-strong hover:bg-bg-subtle focus-visible:ring-primary-500/30",
        secondary:
          "bg-bg-subtle text-text-primary border border-transparent hover:bg-primary-100/70 hover:text-primary-900",
        ghost:
          "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        link: "text-primary-700 underline-offset-4 hover:underline hover:text-primary-900",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 rounded-[9px] px-3.5 text-[12.5px]",
        lg: "h-11 rounded-[10px] px-6 text-[14px]",
        xl: "h-12 rounded-[12px] px-7 text-[14px]",
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
