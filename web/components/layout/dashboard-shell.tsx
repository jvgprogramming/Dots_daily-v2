import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="pl-16 md:pl-64">
        <Header />
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
