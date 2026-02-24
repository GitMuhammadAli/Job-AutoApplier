"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2, Pause, Play, Trash2, RefreshCw, RotateCcw, ArrowUpDown } from "lucide-react";
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

type SortKey = "name" | "lastActive" | "sentToday" | "totalApplications" | "createdAt";
type SortDir = "asc" | "desc";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function isOnline(lastActive: string | null): boolean {
  if (!lastActive) return false;
  return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return dir * (a.name || "").localeCompare(b.name || "");
        case "lastActive": {
          const aT = a.lastActive ? new Date(a.lastActive).getTime() : 0;
          const bT = b.lastActive ? new Date(b.lastActive).getTime() : 0;
          return dir * (aT - bT);
        }
        case "sentToday":
          return dir * (a.sentToday - b.sentToday);
        case "totalApplications":
          return dir * (a.totalApplications - b.totalApplications);
        case "createdAt":
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        default:
          return 0;
      }
    });
  }, [users, sortKey, sortDir]);

  const onlineCount = users.filter((u) => isOnline(u.lastActive)).length;

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
        <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            {users.length} users · {onlineCount} online now
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchUsers} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl bg-white dark:bg-zinc-800 shadow-sm ring-1 ring-slate-100/80 dark:ring-zinc-700/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-zinc-700 text-slate-500 dark:text-zinc-400">
              <SortableHeader label="User" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th className="py-3 px-4 text-left font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Mode</th>
              <SortableHeader label="Sent Today" sortKey="sentToday" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <SortableHeader label="Total Apps" sortKey="totalApplications" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} align="right" />
              <SortableHeader label="Last Active" sortKey="lastActive" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHeader label="Joined" sortKey="createdAt" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th className="py-3 px-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const online = isOnline(user.lastActive);
              return (
                <tr key={user.id} className="border-b border-slate-50 dark:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-zinc-700/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="relative flex-shrink-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-700 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                          {(user.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-800 ${
                            online ? "bg-emerald-500" : "bg-slate-300 dark:bg-zinc-600"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 dark:text-zinc-100 truncate">{user.name || "Unnamed"}</div>
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        user.status === "active"
                          ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          : user.status === "paused"
                            ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            : "bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-zinc-300">
                      {user.mode}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-700 dark:text-zinc-200">{user.sentToday}</td>
                  <td className="py-3 px-4 text-right tabular-nums text-slate-700 dark:text-zinc-200">{user.totalApplications}</td>
                  <td className="py-3 px-4">
                    {online ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Online
                      </span>
                    ) : user.lastActive ? (
                      <span className="text-slate-500 dark:text-zinc-400" title={new Date(user.lastActive).toLocaleString()}>
                        {timeAgo(user.lastActive)}
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-zinc-600">Never</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 dark:text-zinc-500" title={new Date(user.createdAt).toLocaleString()}>
                    {timeAgo(user.createdAt)}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = currentKey === key;
  return (
    <th className={`py-3 px-4 font-semibold text-${align}`}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors ${
          active ? "text-slate-800 dark:text-zinc-200" : ""
        }`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-30"} ${active && currentDir === "asc" ? "rotate-180" : ""} transition-transform`} />
      </button>
    </th>
  );
}
