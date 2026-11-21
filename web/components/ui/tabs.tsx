"use client";

import { cn } from "@/lib/utils";
import { useState, useId, createContext, useContext, ReactNode } from "react";
import { motion } from "framer-motion";

// ── Context ──
interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
  /** Unique per Tabs group so each group's sliding pill animates on its own. */
  pillId: string;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error("Tabs sub-components must be used within Tabs");
  return context;
}

// ── Root ──
interface TabsProps {
  defaultValue: string;
  /** Optional controlled value — pass with onValueChange to drive tabs from outside. */
  value?: string;
  children: ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({ defaultValue, value, children, className, onValueChange }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultValue);
  const activeTab = value ?? internalTab;
  const pillId = useId();

  const handleSetActiveTab = (next: string) => {
    setInternalTab(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleSetActiveTab, pillId }}>
      <div className={cn("space-y-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

// ── List ──
function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[12px] border border-border-light bg-bg-card p-1 shadow-xs",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Trigger ──
interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab, pillId } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
        isActive
          ? "text-white"
          : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary",
        className
      )}
    >
      {isActive && (
        <motion.span
          layoutId={pillId}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute inset-0 rounded-[9px] bg-brand-action shadow-xs"
        />
      )}
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </button>
  );
}

// ── Content ──
interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabs();
  if (activeTab !== value) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn("pt-2", className)}
    >
      {children}
    </motion.div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
