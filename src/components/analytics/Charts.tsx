"use client";

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
} from "recharts";
import { BarChart3, GitBranch, Globe, Activity } from "lucide-react";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#ef4444", "#ec4899", "#6366f1"];

interface ChartsProps {
  applicationsOverTime: { week: string; count: number }[];
  stageFunnel: { stage: string; count: number }[];
  sourceBreakdown: { source: string; count: number }[];
  activityOverTime: { week: string; count: number }[];
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
    <div className={`relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100/80 ${className}`}>
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-4 w-4 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function NoData({ text = "No data yet" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-[200px]">
      <p className="text-xs text-slate-400">{text}</p>
    </div>
  );
}

export function Charts({
  applicationsOverTime,
  stageFunnel,
  sourceBreakdown,
  activityOverTime,
}: ChartsProps) {
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 10, fill: "#64748b", fontWeight: 600 }} width={70} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
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
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
            </PieChart>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#actGrad)" name="Activities" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
