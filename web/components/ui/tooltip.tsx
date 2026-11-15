"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
  content,
  children,
  className,
  side = "top",
}: TooltipProps) {
  const [show, setShow] = useState(false);

  const sideStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const animationVariants = {
    top: { initial: { opacity: 0, y: 3 }, animate: { opacity: 1, y: 0 } },
    bottom: { initial: { opacity: 0, y: -3 }, animate: { opacity: 1, y: 0 } },
    left: { initial: { opacity: 0, x: 3 }, animate: { opacity: 1, x: 0 } },
    right: { initial: { opacity: 0, x: -3 }, animate: { opacity: 1, x: 0 } },
  };

  return (
    <div
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={animationVariants[side].initial}
            animate={animationVariants[side].animate}
            exit={animationVariants[side].initial}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute z-50 pointer-events-none",
              sideStyles[side]
            )}
          >
            <div className="whitespace-nowrap rounded-[6px] bg-text-primary px-2.5 py-1 text-[11px] font-medium text-white shadow-dropdown">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
