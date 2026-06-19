"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINRCompact } from "@/lib/utils";

export type SpendDatum = { name: string; committed: number; budget: number };

export function SpendByProjectChart({ data }: { data: SpendDatum[] }) {
  if (!data.length) return null;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: string) => (v.length > 14 ? v.slice(0, 13) + "…" : v)}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => formatINRCompact(v)}
            width={56}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value, name) => [
              formatINRCompact(Number(value)),
              name === "committed" ? "Committed" : "Budget",
            ]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              fontSize: 12,
            }}
          />
          <Bar dataKey="budget" radius={[4, 4, 0, 0]} fill="hsl(var(--muted))" />
          <Bar dataKey="committed" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.committed > d.budget ? "hsl(var(--destructive))" : "hsl(var(--primary))"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
