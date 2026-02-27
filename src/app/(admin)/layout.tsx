import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { hasValidAdminSession } from "@/lib/admin-auth";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ScrollText,
  ArrowLeft,
  Radio,
  MessageSquare,
  Activity,
  Shield,
} from "lucide-react";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, desc: "Overview & metrics" },
  { href: "/admin/scrapers", label: "Monitoring", icon: Activity, desc: "Crons & scrapers" },
  { href: "/admin/users", label: "Users", icon: Users, desc: "User management" },
  { href: "/admin/logs", label: "Logs", icon: ScrollText, desc: "System logs" },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare, desc: "User feedback" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let oauthSession: Awaited<ReturnType<typeof getAuthSession>> = null;
  let isOAuthAdmin = false;
  let isCredentialAdmin = false;

  try {
    oauthSession = await getAuthSession();
    isOAuthAdmin = !!(oauthSession?.user?.email && isAdmin(oauthSession.user.email));
  } catch {
    // DB or auth unavailable — continue to credential check
  }

  try {
    isCredentialAdmin = hasValidAdminSession();
  } catch {
    // cookies() unavailable
  }

  if (!isOAuthAdmin && !isCredentialAdmin) {
    redirect("/admin/login");
  }

  const authMethod = isOAuthAdmin ? "oauth" : "credentials";
  const displayName = isOAuthAdmin
    ? oauthSession?.user?.name || oauthSession?.user?.email || "Admin"
    : "Admin";
  const displayEmail = isOAuthAdmin ? oauthSession?.user?.email : "Credential login";

  return (
    <div className="flex min-h-screen bg-[#0b0e14] text-slate-200">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-white/[0.06] bg-[#0f1219]">
        {/* Brand */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">JobPilot</h1>
              <p className="text-[10px] text-slate-500 font-medium">CONTROL PANEL</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all duration-150"
            >
              <item.icon className="h-4 w-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
              <div>
                <div className="text-[13px] leading-tight">{item.label}</div>
                <div className="text-[10px] text-slate-600 group-hover:text-slate-500 leading-tight">{item.desc}</div>
              </div>
            </Link>
          ))}
        </nav>

        {/* User / Footer */}
        <div className="p-4 border-t border-white/[0.06]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-[11px] text-slate-500 hover:text-blue-400 transition-colors mb-3"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to App
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-600 text-[10px] font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-300 truncate">{displayName}</div>
              <div className="text-[10px] text-slate-600 truncate">{displayEmail}</div>
            </div>
          </div>
          {authMethod === "credentials" && (
            <div className="mt-3">
              <AdminLogoutButton />
            </div>
          )}
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 flex items-center gap-2 border-b border-white/[0.06] bg-[#0f1219]/95 backdrop-blur-md px-3 py-2">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-300 mr-1">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-violet-600">
          <Shield className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-bold text-white tracking-tight">Control Panel</span>
        <div className="flex gap-1 ml-auto">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg p-2 text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label={item.label}
            >
              <item.icon className="h-3.5 w-3.5" />
            </Link>
          ))}
          {authMethod === "credentials" && (
            <AdminLogoutButton mobile />
          )}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
