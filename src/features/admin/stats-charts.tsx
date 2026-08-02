'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatMoney } from '@/lib/money';

const PIE_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

export type DailyPoint = { day: string; revenue: number; orders: number };
export type HourPoint = { hour: number; orders: number };
export type CategoryPoint = { category: string; revenue: number; units: number };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-border bg-card rounded-2xl border p-4">
      <h2 className="font-display mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function DailyRevenueChart({ data }: { data: DailyPoint[] }) {
  return (
    <ChartCard title="Ventas por día">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={70} tickFormatter={(v) => formatMoney(v)} />
          <Tooltip formatter={(value: number) => formatMoney(value)} />
          <Line type="monotone" dataKey="revenue" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function OrdersByHourChart({ data }: { data: HourPoint[] }) {
  return (
    <ChartCard title="Pedidos por hora">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="hour" tick={{ fontSize: 12 }} tickFormatter={(h) => `${h}h`} />
          <YAxis tick={{ fontSize: 12 }} width={30} allowDecimals={false} />
          <Tooltip labelFormatter={(h) => `${h}:00`} />
          <Bar dataKey="orders" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TopCategoriesChart({ data }: { data: CategoryPoint[] }) {
  if (data.length === 0) {
    return (
      <ChartCard title="Top categorías">
        <p className="text-muted-foreground py-16 text-center text-sm">Sin datos en este rango.</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Top categorías">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="revenue" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2}>
            {data.map((entry, index) => (
              <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatMoney(value)} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 space-y-1">
        {data.map((entry, index) => (
          <li key={entry.category} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              {entry.category}
            </span>
            <span className="text-muted-foreground">{formatMoney(entry.revenue)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}
