"use client";

import { Card } from "@/components/ui/card";
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
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#ef4444", "#ec4899", "#6366f1"];

interface ChartsProps {
  applicationsOverTime: { week: string; count: number }[];
  stageFunnel: { stage: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
  resumePerformance: { name: string; total: number; responseRate: number }[];
  activityOverTime: { week: string; count: number }[];
}

export function Charts({
  applicationsOverTime,
  stageFunnel,
  platformBreakdown,
  resumePerformance,
  activityOverTime,
}: ChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Applications Over Time */}
      <Card className="p-4 rounded-xl border-0 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Applications Over Time
        </h3>
        {applicationsOverTime.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={applicationsOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Applications" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Stage Funnel */}
      <Card className="p-4 rounded-xl border-0 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Stage Funnel
        </h3>
        {stageFunnel.every((s) => s.count === 0) ? (
          <p className="text-sm text-slate-400 py-8 text-center">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stageFunnel} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Platform Breakdown */}
      <Card className="p-4 rounded-xl border-0 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Platform Breakdown
        </h3>
        {platformBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={platformBreakdown}
                dataKey="count"
                nameKey="platform"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ platform, count }) => `${platform} (${count})`}
                labelLine
              >
                {platformBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Resume Performance */}
      <Card className="p-4 rounded-xl border-0 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Resume Performance
        </h3>
        {resumePerformance.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Apply with different resumes to see data</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={resumePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Applied" />
              <Bar dataKey="responseRate" fill="#10b981" radius={[4, 4, 0, 0]} name="Response %" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Weekly Activity */}
      <Card className="p-4 rounded-xl border-0 shadow-sm lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Weekly Activity
        </h3>
        {activityOverTime.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">No activity yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={activityOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => v.split("-W")[1] ? `W${v.split("-W")[1]}` : v}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} name="Activities" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
