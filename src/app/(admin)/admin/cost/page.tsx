/**
 * /admin/cost — super-admin AI dollar-spend dashboard.
 *
 * Polls /api/admin/cost every 60s (lower frequency than /admin/quotas since
 * cost rollups are heavier and don't need second-by-second freshness).
 *
 * Reads from LlmCallLog.costUsd which is populated on every recordUsage()
 * via the PROVIDER_PRICING table in src/lib/cost/pricing.ts.
 */

"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, DollarSign, Activity, Users, Zap } from "lucide-react";

type ProviderRow = {
  provider: string;
  model?: string;
  usd: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
};

type RouteRow = { route: string; usd: number; calls: number };
type UserRow = {
  userId: string;
  email: string | null;
  name: string | null;
  usd: number;
  inputTokens: number;
  outputTokens: number;
  calls: number;
};
type DailyRow = { provider: string; day: string; usd: number };
type ErrorRow = { provider: string; status: string; count: number };
type AlertRow = { provider: string; day: string; usd: number; threshold: number };

interface CostResponse {
  windows: {
    last24h: ProviderRow[];
    last7d: ProviderRow[];
    last30d: ProviderRow[];
  };
  byModel: ProviderRow[];
  byRoute: RouteRow[];
  topUsers: UserRow[];
  byDay: DailyRow[];
  errorCounts: ErrorRow[];
  alerts: AlertRow[];
  thresholds: Record<string, number>;
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.0001) return "<$0.0001";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default function AdminCostPage() {
  const [data, setData] = useState<CostResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch("/api/admin/cost", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `Cost endpoint returned ${res.status}`);
        }
        const json = (await res.json()) as CostResponse;
        if (alive) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/30 p-6 text-center shadow-soft-sm">
        <p className="text-[13px] font-medium text-rose-700 dark:text-rose-300">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const total24h = data.windows.last24h.reduce((s, r) => s + r.usd, 0);
  const total7d = data.windows.last7d.reduce((s, r) => s + r.usd, 0);
  const total30d = data.windows.last30d.reduce((s, r) => s + r.usd, 0);

  return (
    <div className="space-y-6 animate-page-enter">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500 mb-1">
          Spend
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-200/50 dark:ring-emerald-900/40">
            <DollarSign className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            AI cost
          </h1>
        </div>
        <p className="mt-1.5 text-[13px] sm:text-sm leading-relaxed text-stone-500 dark:text-stone-400 max-w-prose">
          Dollar spend by provider, model, route, and user. Polled every 60s.
        </p>
      </header>

      {data.alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200/70 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 shadow-soft-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-amber-900 dark:text-amber-100">
                {data.alerts.length} day{data.alerts.length === 1 ? "" : "s"} over threshold
              </p>
              <ul className="mt-2 space-y-1">
                {data.alerts.slice(0, 8).map((a) => (
                  <li
                    key={`${a.provider}:${a.day}`}
                    className="text-[12px] text-amber-800 dark:text-amber-200 tabular-nums"
                  >
                    {a.day} · <span className="font-medium">{a.provider}</span> · {fmtUsd(a.usd)}{" "}
                    <span className="text-amber-700/70 dark:text-amber-300/70">
                      (threshold {fmtUsd(a.threshold)})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <SummaryCard label="Last 24h" usd={total24h} icon={<Zap className="h-4 w-4" />} />
        <SummaryCard label="Last 7 days" usd={total7d} icon={<Activity className="h-4 w-4" />} />
        <SummaryCard label="Last 30 days" usd={total30d} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
          By provider · 7 days
        </h2>
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/95 dark:bg-stone-900/95 shadow-soft-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-stone-50/80 dark:bg-stone-800/40 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Provider</th>
                <th className="text-right px-4 py-2.5 font-medium">Calls</th>
                <th className="text-right px-4 py-2.5 font-medium">Input tokens</th>
                <th className="text-right px-4 py-2.5 font-medium">Output tokens</th>
                <th className="text-right px-4 py-2.5 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 dark:divide-stone-800/60">
              {data.windows.last7d.map((r) => (
                <tr key={r.provider} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors duration-200">
                  <td className="px-4 py-2.5 font-medium text-stone-900 dark:text-stone-100">{r.provider}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">{fmtNum(r.calls)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">{fmtNum(r.inputTokens)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">{fmtNum(r.outputTokens)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-900 dark:text-stone-100 tabular-nums">{fmtUsd(r.usd)}</td>
                </tr>
              ))}
              {data.windows.last7d.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">No calls in the last 7 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
          By model · 30 days
        </h2>
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/95 dark:bg-stone-900/95 shadow-soft-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-stone-50/80 dark:bg-stone-800/40 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Provider</th>
                <th className="text-left px-4 py-2.5 font-medium">Model</th>
                <th className="text-right px-4 py-2.5 font-medium">Calls</th>
                <th className="text-right px-4 py-2.5 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 dark:divide-stone-800/60">
              {data.byModel.map((r) => (
                <tr key={`${r.provider}:${r.model}`} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors duration-200">
                  <td className="px-4 py-2.5 text-stone-600 dark:text-stone-300">{r.provider}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-stone-700 dark:text-stone-200">{r.model}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">{fmtNum(r.calls)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-900 dark:text-stone-100 tabular-nums">{fmtUsd(r.usd)}</td>
                </tr>
              ))}
              {data.byModel.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No model rows yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
          By route · 7 days
        </h2>
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/95 dark:bg-stone-900/95 shadow-soft-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-stone-50/80 dark:bg-stone-800/40 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Route</th>
                <th className="text-right px-4 py-2.5 font-medium">Calls</th>
                <th className="text-right px-4 py-2.5 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 dark:divide-stone-800/60">
              {data.byRoute.map((r) => (
                <tr key={r.route} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors duration-200">
                  <td className="px-4 py-2.5 font-mono text-[12px] text-stone-700 dark:text-stone-200">{r.route}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">{fmtNum(r.calls)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-900 dark:text-stone-100 tabular-nums">{fmtUsd(r.usd)}</td>
                </tr>
              ))}
              {data.byRoute.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">No route rows yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
          Top users · 7 days
        </h2>
        <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/95 dark:bg-stone-900/95 shadow-soft-sm overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-stone-50/80 dark:bg-stone-800/40 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">User</th>
                <th className="text-right px-4 py-2.5 font-medium">Calls</th>
                <th className="text-right px-4 py-2.5 font-medium">Tokens</th>
                <th className="text-right px-4 py-2.5 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200/60 dark:divide-stone-800/60">
              {data.topUsers.map((u) => (
                <tr key={u.userId} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/30 transition-colors duration-200">
                  <td className="px-4 py-2.5">
                    <div className="text-stone-900 dark:text-stone-100">{u.name ?? "—"}</div>
                    <div className="text-[11px] text-stone-400 dark:text-stone-500 font-mono">
                      {u.email ?? u.userId.slice(0, 12) + "…"}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">{fmtNum(u.calls)}</td>
                  <td className="px-4 py-2.5 text-right text-stone-600 dark:text-stone-300 tabular-nums">
                    {fmtNum(u.inputTokens + u.outputTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-stone-900 dark:text-stone-100 tabular-nums">{fmtUsd(u.usd)}</td>
                </tr>
              ))}
              {data.topUsers.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400"><Users className="h-4 w-4 inline mr-1 text-stone-300" />No user spend yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, usd, icon }: { label: string; usd: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-stone-200/80 dark:border-stone-800/60 bg-white/95 dark:bg-stone-900/95 p-5 shadow-soft-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
          {label}
        </span>
        <span className="text-stone-400 dark:text-stone-500">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-stone-900 dark:text-stone-100 tabular-nums">{fmtUsd(usd)}</p>
    </div>
  );
}
