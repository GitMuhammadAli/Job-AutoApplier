"use client";

import { useEffect, useState } from "react";
import { Loader2, Pause, Play, Trash2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  mode: string;
  sentToday: number;
  totalJobs: number;
  totalApplications: number;
  resumeCount: number;
  isOnboarded: boolean;
  lastActive: string | null;
  status: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast.error("Failed to load users");
    }
    setLoading(false);
  }

  async function handleAction(userId: string, action: "pause" | "activate" | "reset_sending" | "delete") {
    if (action === "delete") {
      if (!window.confirm("Permanently delete this user and all their data?")) return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      const msgs: Record<string, string> = {
        pause: "User paused",
        activate: "User activated",
        reset_sending: "Sending reset",
        delete: "User deleted",
      };
      toast.success(msgs[action]);
      fetchUsers();
    } catch {
      toast.error("Action failed");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} users</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchUsers} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-100/80 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-slate-500">
              <th className="py-3 px-4 text-left font-semibold">User</th>
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Mode</th>
              <th className="py-3 px-4 text-right font-semibold">Sent Today</th>
              <th className="py-3 px-4 text-right font-semibold">Total Apps</th>
              <th className="py-3 px-4 text-left font-semibold">Last Active</th>
              <th className="py-3 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-800">{user.name || "Unnamed"}</div>
                  <div className="text-slate-400">{user.email}</div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      user.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : user.status === "paused"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-600">{user.mode}</td>
                <td className="py-3 px-4 text-right tabular-nums text-slate-700">{user.sentToday}</td>
                <td className="py-3 px-4 text-right tabular-nums text-slate-700">{user.totalApplications}</td>
                <td className="py-3 px-4 text-slate-500">
                  {user.lastActive
                    ? new Date(user.lastActive).toLocaleString()
                    : "Never"}
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {user.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleAction(user.id, "pause")}
                        title="Pause user"
                      >
                        <Pause className="h-3.5 w-3.5 text-amber-500" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleAction(user.id, "activate")}
                        title="Activate user"
                      >
                        <Play className="h-3.5 w-3.5 text-emerald-500" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleAction(user.id, "reset_sending")}
                      title="Reset sending pause"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-blue-400" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => handleAction(user.id, "delete")}
                      title="Delete user"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
