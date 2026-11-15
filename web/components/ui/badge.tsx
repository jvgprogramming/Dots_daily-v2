import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border text-[11.5px] font-semibold leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-border-light bg-bg-subtle text-text-body",
        primary: "border-primary-200/80 bg-primary-100/70 text-primary-900",
        success: "border-primary-200/80 bg-success-bg text-success-text",
        warning: "border-warning/20 bg-warning-bg text-warning-text",
        danger: "border-danger/20 bg-danger-bg text-danger-text",
        info: "border-primary-200/60 bg-info-bg text-info-text",
        outline: "border-border-default bg-bg-card text-text-secondary",
      },
      size: {
        default: "px-2.5 py-1",
        sm: "px-2 py-[3px] text-[10.5px]",
        lg: "px-3 py-1.5 text-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
