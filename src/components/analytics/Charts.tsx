"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Area,
  AreaChart,
  LineChart,
  Line,
} from "recharts";
import { BarChart3, GitBranch, Globe, Activity, Zap, Timer, Star, PieChartIcon, Building2 } from "lucide-react";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#ef4444", "#ec4899", "#6366f1"];
const RESPONSE_COLORS = ["#10b981", "#ef4444", "#94a3b8", "#f59e0b"];

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const check = () => el.classList.contains("dark");
    setIsDark(check());
    const obs = new MutationObserver(() => setIsDark(check()));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
}

interface ChartsProps {
  applicationsOverTime: { week: string; count: number }[];
  stageFunnel: { stage: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
  activityOverTime: { week: string; count: number }[];
  applyMethodBreakdown: { method: string; count: number }[];
  speedOverTime: { date: string; avgMinutes: number }[];
  matchScoreDistribution?: { range: string; count: number }[];
  responseRateBreakdown?: { name: string; value: number }[];
  topCompanies?: { company: string; count: number }[];
}

function ChartCard({
  title,
  icon: Icon,
  gradient,
  children,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  gradient: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white dark:bg-zinc-800 p-4 shadow-sm dark:shadow-zinc-900/50 ring-1 ring-slate-100/80 dark:ring-zinc-700/50 ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
        <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function NoData({ text = "No data yet" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <p className="text-xs text-slate-400 dark:text-zinc-500">{text}</p>
    </div>
  );
}

const GRID_LIGHT = "#f1f5f9";
const GRID_DARK = "#3f3f46";
const TICK_LIGHT = "#94a3b8";
const TICK_DARK = "#a1a1aa";
const TOOLTIP_BORDER_LIGHT = "#e2e8f0";
const TOOLTIP_BORDER_DARK = "#52525b";

export function Charts({
  applicationsOverTime,
  stageFunnel,
  sourceBreakdown,
  activityOverTime,
  applyMethodBreakdown,
  speedOverTime,
  matchScoreDistribution,
  responseRateBreakdown,
  topCompanies,
}: ChartsProps) {
  const isDark = useIsDark();
  const gridStroke = isDark ? GRID_DARK : GRID_LIGHT;
  const tickFill = isDark ? TICK_DARK : TICK_LIGHT;
  const tooltipBorder = isDark ? TOOLTIP_BORDER_DARK : TOOLTIP_BORDER_LIGHT;
  const tooltipBg = isDark ? "#27272a" : "#ffffff";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Applications Over Time" icon={BarChart3} gradient="from-blue-500 to-cyan-500">
        {applicationsOverTime.length === 0 ? (
          <NoData />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={applicationsOverTime}>
              <defs>
                <linearGradient id="appGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: tickFill }}
                tickFormatter={(v) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: tickFill }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#appGrad)" name="Applications" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Stage Funnel" icon={GitBranch} gradient="from-violet-500 to-purple-500">
        {stageFunnel.every((s) => s.count === 0) ? (
          <NoData />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageFunnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 10, fill: tickFill }} allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: isDark ? "#a1a1aa" : "#64748b", fontWeight: 600 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Jobs">
                {stageFunnel.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Source Breakdown" icon={Globe} gradient="from-emerald-500 to-teal-500">
        {sourceBreakdown.length === 0 ? (
          <NoData />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sourceBreakdown}
                dataKey="count"
                nameKey="source"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                label={({ source, count }: { source: string; count: number }) => `${source} (${count})`}
                labelLine
              >
                {sourceBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Apply Method Breakdown" icon={Zap} gradient="from-amber-400 to-orange-500">
        {applyMethodBreakdown.length === 0 ? (
          <NoData text="No applications yet" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={applyMethodBreakdown}
                dataKey="count"
                nameKey="method"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                label={({ method, count }: { method: string; count: number }) => `${method} (${count})`}
                labelLine
              >
                {applyMethodBreakdown.map((_, i) => (
                  <Cell key={i} fill={["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#94a3b8"][i % 5]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Application Speed (min)" icon={Timer} gradient="from-rose-500 to-pink-500">
        {speedOverTime.length === 0 ? (
          <NoData text="No speed data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={speedOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: tickFill }}
                tickFormatter={(v) => v.split("-").slice(1).join("/")}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} label={{ value: "min", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: tickFill } }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} formatter={(value: number) => [`${value} min`, "Avg Time"]} />
              <Line type="monotone" dataKey="avgMinutes" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, fill: "#ec4899" }} name="Avg Minutes" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Weekly Activity" icon={Activity} gradient="from-amber-400 to-orange-500">
        {activityOverTime.length === 0 ? (
          <NoData text="No activity yet" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={activityOverTime}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: tickFill }}
                tickFormatter={(v) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: tickFill }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#actGrad)" name="Activities" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {responseRateBreakdown && responseRateBreakdown.some((d) => d.value > 0) && (
        <ChartCard title="Response Rate" icon={PieChartIcon} gradient="from-teal-500 to-cyan-500">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={responseRateBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                label={({ name, value }: { name: string; value: number }) =>
                  value > 0 ? `${name} (${value})` : ""
                }
                labelLine
              >
                {responseRateBreakdown.map((_, i) => (
                  <Cell key={i} fill={RESPONSE_COLORS[i % RESPONSE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {topCompanies && topCompanies.length > 0 && (
        <ChartCard title="Top Companies" icon={Building2} gradient="from-indigo-500 to-blue-500">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topCompanies} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis type="number" tick={{ fontSize: 10, fill: tickFill }} allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="company"
                type="category"
                tick={{ fontSize: 10, fill: isDark ? "#a1a1aa" : "#64748b", fontWeight: 600 }}
                width={100}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Applications" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {matchScoreDistribution && (
        <ChartCard title="Match Score Distribution" icon={Star} gradient="from-emerald-500 to-cyan-500" className="lg:col-span-2">
          {matchScoreDistribution.every((d) => d.count === 0) ? (
            <NoData text="No match data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={matchScoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="range" tick={{ fontSize: 10, fill: tickFill }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: tickFill }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, fontSize: 12 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Jobs">
                  {matchScoreDistribution.map((_, i) => (
                    <Cell key={i} fill={["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#10b981"][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}
    </div>
  );
}
