import { cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight, Slash } from "lucide-react";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  separator?: "chevron" | "slash";
}

export function Breadcrumb({
  items,
  className,
  separator = "chevron",
}: BreadcrumbProps) {
  const SeparatorIcon = separator === "chevron" ? ChevronRight : Slash;

  return (
    <nav className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <SeparatorIcon className="h-3.5 w-3.5 text-text-tertiary" />
            )}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  isLast
                    ? "font-medium text-text-primary"
                    : "text-text-secondary"
                )}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
