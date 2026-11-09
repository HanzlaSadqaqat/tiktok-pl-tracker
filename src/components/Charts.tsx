"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money, pct } from "@/lib/format";

const C = {
  navy: "#1f2a44",
  accent: "#1f5fbf",
  accentSoft: "#7baaf7",
  pos: "#1e8e3e",
  neg: "#c5221f",
  slate: "#5b6b82",
  amber: "#e8a33d",
  grid: "#e6e9ee",
};
const PIE = ["#1f5fbf", "#1e8e3e", "#e8a33d", "#5b6b82", "#7baaf7", "#c5221f", "#8e6bd1", "#2bb3a3", "#d97a9c", "#9aa0a6"];
const STATUS_COLORS: Record<string, string> = {
  Pending: "#9aa0a6",
  Processing: "#7baaf7",
  Shipped: "#1f5fbf",
  Delivered: "#1e8e3e",
  Cancelled: "#bdc1c6",
  Returned: "#e8a33d",
  Refunded: "#c5221f",
};

const axis = { fontSize: 11, fill: "#5b6b82" };
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));

function Frame({ title, children, empty }: { title: string; children: React.ReactElement; empty?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-navy">{title}</h3>
      <div className="h-64">
        {empty ? (
          <div className="grid h-full place-items-center text-sm text-muted">No data for this period</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export interface TrendPoint {
  label: string;
  revenue: number;
  netProfit: number;
  orderExpenses: number;
  businessExpenses: number;
  netMargin: number;
}

export function DashboardCharts({
  trend,
  products,
  categories,
  statuses,
}: {
  trend: TrendPoint[];
  products: { name: string; revenue: number }[];
  categories: { name: string; value: number }[];
  statuses: { name: string; value: number }[];
}) {
  const noTrend = trend.every((t) => !t.revenue && !t.orderExpenses && !t.businessExpenses);
  const cats = categories.filter((c) => c.value > 0);
  const sts = statuses.filter((s) => s.value > 0);
  const moneyTip = (v: unknown) => money(Number(v));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Frame title="Monthly Revenue vs Net Profit" empty={noTrend}>
        <BarChart data={trend} margin={{ left: -10, right: 8 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickFormatter={compact} tickLine={false} axisLine={false} />
          <Tooltip formatter={moneyTip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Revenue" fill={C.accent} radius={[3, 3, 0, 0]} />
          <Bar dataKey="netProfit" name="Net profit" radius={[3, 3, 0, 0]}>
            {trend.map((t, i) => (
              <Cell key={i} fill={t.netProfit < 0 ? C.neg : C.pos} />
            ))}
          </Bar>
        </BarChart>
      </Frame>

      <Frame title="Monthly Expenses (order-level and business)" empty={noTrend}>
        <BarChart data={trend} margin={{ left: -10, right: 8 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickFormatter={compact} tickLine={false} axisLine={false} />
          <Tooltip formatter={moneyTip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="orderExpenses" name="Order-level costs" stackId="e" fill={C.slate} />
          <Bar dataKey="businessExpenses" name="Business expenses" stackId="e" fill={C.amber} radius={[3, 3, 0, 0]} />
        </BarChart>
      </Frame>

      <Frame title="Net Profit Margin Trend" empty={noTrend}>
        <LineChart data={trend} margin={{ left: -10, right: 8 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v: unknown) => pct(Number(v))} />
          <Line type="monotone" dataKey="netMargin" name="Net margin" stroke={C.accent} strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </Frame>

      <Frame title="Revenue by Product (top 8)" empty={!products.length}>
        <BarChart data={products} layout="vertical" margin={{ left: 10, right: 16 }}>
          <CartesianGrid stroke={C.grid} horizontal={false} />
          <XAxis type="number" tick={axis} tickFormatter={compact} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={130} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip formatter={moneyTip} />
          <Bar dataKey="revenue" name="Revenue" fill={C.accent} radius={[0, 3, 3, 0]} />
        </BarChart>
      </Frame>

      <Frame title="Business Expenses by Category" empty={!cats.length}>
        <PieChart>
          <Pie data={cats} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={2}>
            {cats.map((c, i) => (
              <Cell key={c.name} fill={PIE[i % PIE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={moneyTip} />
          <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </Frame>

      <Frame title="Order Status Distribution" empty={!sts.length}>
        <PieChart>
          <Pie data={sts} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="80%" paddingAngle={2}>
            {sts.map((s) => (
              <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? C.slate} />
            ))}
          </Pie>
          <Tooltip />
          <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </Frame>
    </div>
  );
}

export function MonthlyTrendChart({ rows }: { rows: { label: string; revenue: number; grossProfit: number; netProfit: number }[] }) {
  const empty = rows.every((r) => !r.revenue && !r.netProfit);
  return (
    <Frame title="Revenue, Gross Profit and Net Profit by Month" empty={empty}>
      <LineChart data={rows} margin={{ left: -10, right: 8 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
        <YAxis tick={axis} tickFormatter={compact} tickLine={false} axisLine={false} />
        <Tooltip formatter={(v: unknown) => money(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="revenue" name="Revenue" stroke={C.accent} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="grossProfit" name="Gross profit" stroke={C.accentSoft} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="netProfit" name="Net profit" stroke={C.pos} strokeWidth={2.5} dot={false} />
      </LineChart>
    </Frame>
  );
}
