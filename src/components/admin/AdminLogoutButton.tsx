"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AdminLogoutButton({ mobile }: { mobile?: boolean }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  };

  if (mobile) {
    return (
      <button
        onClick={handleLogout}
        className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors w-full"
    >
      <LogOut className="h-3.5 w-3.5" />
      Sign Out
    </button>
  );
}
