'use client';
import React from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
} from 'recharts';
import { ChartTooltipContent, typeColor, fmt } from './util';

const GRID = 'rgba(255,255,255,0.05)';
const AXIS = '#62666d';
const PANEL_CYAN = '#67e8f9';
const LINEAR_VIOLET = '#7170ff';

interface CommonProps { data: any[]; }

export function SparkArea({
  data, xKey = 'date', yKey, color = LINEAR_VIOLET, valueFormatter, hideXAxis,
}: CommonProps & { xKey?: string; yKey: string; color?: string; valueFormatter?: (v: any) => string; hideXAxis?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: hideXAxis ? 0 : 4 }}>
        <defs>
          <linearGradient id={`g-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.32} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey={xKey} stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false} axisLine={{ stroke: GRID }} hide={hideXAxis}
          tickFormatter={(v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? fmt.dateShort(v) : String(v))}
          minTickGap={20}
        />
        <YAxis
          stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false}
          axisLine={false} width={48}
          tickFormatter={(v) => valueFormatter ? valueFormatter(v) : String(v)}
        />
        <Tooltip
          cursor={{ stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 }}
          content={<ChartTooltipContent valueFormatter={valueFormatter} />}
        />
        <Area
          type="monotone" dataKey={yKey} stroke={color} strokeWidth={1.5}
          fill={`url(#g-${yKey})`} dot={false} activeDot={{ r: 3, fill: color, stroke: 'transparent' }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SparkLine({
  data, xKey, yKey, color = PANEL_CYAN, valueFormatter,
}: CommonProps & { xKey: string; yKey: string; color?: string; valueFormatter?: (v: any) => string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={48}
          tickFormatter={(v) => valueFormatter ? valueFormatter(v) : String(v)} domain={[0, 100]} />
        <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.12)' }} content={<ChartTooltipContent valueFormatter={valueFormatter} />} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={1.5} dot={{ r: 2, fill: color, stroke: 'transparent' }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TypeDonut({
  data, dataKey = 'judgments', nameKey = 'type', innerRatio = 0.62,
}: CommonProps & { dataKey?: string; nameKey?: string; innerRatio?: number }) {
  const total = data.reduce((s, d) => s + (d[dataKey] || 0), 0);
  return (
    <div className="ch-donut-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltipContent valueFormatter={(v: number) => `${fmt.int(v)} (${total ? ((v / total) * 100).toFixed(1) : '0.0'}%)`} />} />
          <Pie
            data={data} dataKey={dataKey} nameKey={nameKey}
            innerRadius={`${innerRatio * 100}%`} outerRadius="100%"
            paddingAngle={1} stroke="#0f1011" strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d, i) => <Cell key={i} fill={typeColor(d[nameKey])} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="ch-donut-center">
        <div className="ch-donut-n">{fmt.int(total)}</div>
        <div className="ch-donut-label">total</div>
      </div>
    </div>
  );
}

export function TrustBars({ data }: { data: { label: string; raters: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltipContent valueFormatter={(v: number) => `${fmt.int(v)} raters`} />} />
        <Bar dataKey="raters" fill={LINEAR_VIOLET} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
