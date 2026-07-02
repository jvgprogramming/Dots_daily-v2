"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

const alertConfig = {
  success: {
    icon: CheckCircle2,
    bg: "bg-success-bg border-success/20",
    text: "text-success-text",
    iconColor: "text-success",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning-bg border-warning/20",
    text: "text-warning-text",
    iconColor: "text-warning",
  },
  danger: {
    icon: AlertCircle,
    bg: "bg-danger-bg border-danger/20",
    text: "text-danger-text",
    iconColor: "text-danger",
  },
  info: {
    icon: Info,
    bg: "bg-info-bg border-info/20",
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
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative flex gap-3 rounded-[12px] border p-4",
        config.bg,
        className
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", config.iconColor)} />
      <div className="flex-1">
        {title && (
          <p className={cn("text-sm font-semibold", config.text)}>{title}</p>
        )}
        <div className={cn("text-sm", config.text, title && "mt-1")}>
          {children}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  );
}
