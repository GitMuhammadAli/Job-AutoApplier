/**
 * /admin/quotas — super-admin AI token usage dashboard.
 *
 * Wraps /api/admin/quotas/usage. Polls every 30s while open so the picture
 * stays live without hammering the server (matches the API's 30s cache TTL).
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, Activity, AlertCircle, TrendingUp, Users } from "lucide-react";

type Provider = {
  provider: string;
  enabled: boolean;
  dailyBudget: number;
  globalUsed: number;
  pctUsed: number;
  activeUsers: number;
  totalCalls: number;
  rejectedCalls: number;
};

type UserRow = {
  userId: string;
  email: string | null;
  name: string | null;
  provider: string;
  used: number;
  inputTokens: number;
  outputTokens: number;
  totalCalls: number;
  rejectedCalls: number;
  fairShare: number;
  softCap: number;
  remaining: number;
  lastUpdated: string;
};

type Route = { route: string; totalTokens: number; calls: number };

type ApiBody = {
  asOf: string;
  providers: Provider[];
  users: UserRow[];
  routes: Route[];
  hourly: Array<{ bucket: string; provider: string; tokens: number }>;
  rejectionsLastHour: number;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function QuotasDashboardPage() {
  const [data, setData] = useState<ApiBody | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/admin/quotas/usage", { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setError(`Failed: HTTP ${r.status}`);
          return;
        }
        const body = (await r.json()) as ApiBody;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="inline h-4 w-4 mr-1.5" />
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading quota dashboard…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Token quota dashboard
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            As of {new Date(data.asOf).toLocaleTimeString()} · refreshes every 30s
          </p>
        </div>
        {data.rejectionsLastHour > 0 && (
          <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 px-3 py-1.5 text-xs text-amber-300 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            {data.rejectionsLastHour} rejection{data.rejectionsLastHour !== 1 ? "s" : ""} in last hour
          </div>
        )}
      </header>

      {/* Per-provider cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.providers.length === 0 && (
          <div className="col-span-full rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 text-sm text-zinc-400">
            No AI usage recorded yet today.
          </div>
        )}
        {data.providers.map((p) => (
          <div
            key={p.provider}
            className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wide">{p.provider}</h3>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  p.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-700 text-zinc-400"
                }`}
              >
                {p.enabled ? "ENFORCING" : "DISABLED"}
              </span>
            </div>
            <div className="text-xs text-zinc-400">
              {formatTokens(p.globalUsed)} / {formatTokens(p.dailyBudget)} · {p.pctUsed}%
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  p.pctUsed >= 90 ? "bg-red-500" : p.pctUsed >= 70 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(p.pctUsed, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-500 pt-1">
              <div>
                <Users className="h-3 w-3 inline mr-0.5" />
                {p.activeUsers} active
              </div>
              <div>{p.totalCalls} calls</div>
              <div className={p.rejectedCalls > 0 ? "text-amber-400" : ""}>{p.rejectedCalls} rejected</div>
            </div>
          </div>
        ))}
      </section>

      {/* Per-user table */}
      <section>
        <h2 className="text-sm font-bold text-zinc-200 mb-2 flex items-center gap-1.5">
          <Users className="h-4 w-4 text-emerald-400" />
          Per-user usage today
        </h2>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left p-2.5">Email</th>
                <th className="text-left p-2.5">Provider</th>
                <th className="text-right p-2.5">Used</th>
                <th className="text-right p-2.5">Fair share</th>
                <th className="text-right p-2.5">Remaining</th>
                <th className="text-right p-2.5">Calls</th>
                <th className="text-right p-2.5">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {data.users.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-zinc-500">
                    No users have triggered LLM calls today.
                  </td>
                </tr>
              )}
              {data.users.map((u) => (
                <tr key={`${u.userId}-${u.provider}`} className="border-t border-zinc-800">
                  <td className="p-2.5 text-zinc-300 font-mono">{u.email ?? u.userId.slice(0, 8)}</td>
                  <td className="p-2.5 text-zinc-400 uppercase text-[10px]">{u.provider}</td>
                  <td className="p-2.5 text-right text-zinc-200">{formatTokens(u.used)}</td>
                  <td className="p-2.5 text-right text-zinc-500">{formatTokens(u.fairShare)}</td>
                  <td className="p-2.5 text-right text-emerald-400">{formatTokens(u.remaining)}</td>
                  <td className="p-2.5 text-right text-zinc-400">{u.totalCalls}</td>
                  <td className={`p-2.5 text-right ${u.rejectedCalls > 0 ? "text-amber-400" : "text-zinc-500"}`}>
                    {u.rejectedCalls}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top routes */}
      <section>
        <h2 className="text-sm font-bold text-zinc-200 mb-2 flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          Top routes (last 24h)
        </h2>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="text-left p-2.5">Route</th>
                <th className="text-right p-2.5">Total tokens</th>
                <th className="text-right p-2.5">Calls</th>
              </tr>
            </thead>
            <tbody>
              {data.routes.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-4 text-center text-zinc-500">
                    No route activity in the last 24h.
                  </td>
                </tr>
              )}
              {data.routes.map((r) => (
                <tr key={r.route} className="border-t border-zinc-800">
                  <td className="p-2.5 text-zinc-300 font-mono">{r.route}</td>
                  <td className="p-2.5 text-right text-zinc-200">{formatTokens(r.totalTokens)}</td>
                  <td className="p-2.5 text-right text-zinc-400">{r.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
