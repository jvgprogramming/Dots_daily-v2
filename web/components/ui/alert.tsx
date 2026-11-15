"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const alertConfig = {
  success: {
    icon: CheckCircle2,
    bg: "bg-success-bg/70 border-primary-200/70",
    text: "text-success-text",
    iconColor: "text-success",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning-bg/70 border-warning/20",
    text: "text-warning-text",
    iconColor: "text-warning",
  },
  danger: {
    icon: AlertCircle,
    bg: "bg-danger-bg/70 border-danger/20",
    text: "text-danger-text",
    iconColor: "text-danger",
  },
  info: {
    icon: Info,
    bg: "bg-info-bg/70 border-primary-200/60",
    text: "text-info-text",
    iconColor: "text-info",
  },
};

interface AlertProps {
  variant?: "success" | "warning" | "danger" | "info";
  title?: string;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
}

export function Alert({
  variant = "info",
  title,
  children,
  className,
  onClose,
}: AlertProps) {
  const config = alertConfig[variant];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex gap-3 rounded-[10px] border px-4 py-3",
        config.bg,
        className
      )}
    >
      <Icon className={cn("mt-px h-4 w-4 shrink-0", config.iconColor)} />
      <div className="flex-1">
        {title && (
          <p className={cn("text-[13px] font-semibold", config.text)}>{title}</p>
        )}
        <div className={cn("text-[13px] leading-relaxed", config.text, title && "mt-0.5")}>
          {children}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 text-current opacity-40 transition-opacity hover:opacity-80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}
