import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  ArrowLeft,
  Radio,
} from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/scrapers", label: "Scrapers", icon: Radio },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();
  if (!session?.user?.email || !isAdmin(session.user.email)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="mb-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to App
          </Link>
          <h1 className="mt-3 text-base font-bold text-slate-900 dark:text-zinc-100">Admin Panel</h1>
        </div>
        <nav className="space-y-1">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2.5">
        <Link href="/" className="text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">Admin</span>
        <div className="flex gap-2 ml-auto">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg p-2 text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors"
              aria-label={item.label}
            >
              <item.icon className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8 pt-16 md:pt-8">
        {children}
      </main>
    </div>
  );
}
