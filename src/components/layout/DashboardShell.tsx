"use client";

import { useSidebarStore } from "@/store/useSidebarStore";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({ sidebar, header, children }: DashboardShellProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <>
      {sidebar}
      <div
        className={cn(
          "transition-[padding-left] duration-300 ease-out",
          collapsed ? "pl-0" : "md:pl-64"
        )}
      >
        {header}
        <main id="main-content" className="px-4 py-5 md:px-6 md:py-6">
          {children}
        </main>
      </div>
    </>
  );
}
