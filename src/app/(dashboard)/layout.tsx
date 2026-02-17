import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <Sidebar />
      <div className="md:pl-64">
        <Header />
        <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
