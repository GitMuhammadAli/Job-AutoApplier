import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getAuthSession();
  } catch {
    redirect("/login");
  }

  if (!session?.user) {
    redirect("/login");
  }

  const admin = isAdmin(session.user.email);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <DashboardShell
        sidebar={
          <Sidebar
            user={{ name: session.user.name, email: session.user.email, image: session.user.image }}
            isAdmin={admin}
          />
        }
        header={<Header />}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
