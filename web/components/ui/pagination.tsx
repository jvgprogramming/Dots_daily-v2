"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const showPages = 5;

    if (totalPages <= showPages + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {getPageNumbers().map((page, i) =>
        page === "..." ? (
          <span
            key={`ellipsis-${i}`}
            className="flex h-8 w-8 items-center justify-center text-[13px] text-text-muted"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[6px] text-[13px] font-medium transition-colors duration-150",
              page === currentPage
                ? "bg-brand-action text-white"
                : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary"
            )}
          >
            {page}
          </button>
        )
      )}

      <Button
        variant="ghost"
        size="icon"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
