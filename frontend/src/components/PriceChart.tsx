import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { OHLCVBar, Indicators } from '../types';

interface Props {
  data: OHLCVBar[];
  indicators: Indicators;
  period: string;
  onPeriodChange: (p: string) => void;
}

const PERIODS = ['1mo', '3mo', '6mo', '1y', '2y'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      background: '#131c32', border: '1px solid #1e2d4a', borderRadius: 8,
      padding: '10px 14px', fontSize: 12, color: '#e2e8f0', minWidth: 160,
    }}>
      <div style={{ color: '#64748b', marginBottom: 6, fontSize: 11 }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
        <span style={{ color: '#94a3b8' }}>Open</span><span style={{ color: '#e2e8f0', fontWeight: 600 }}>${d.open}</span>
        <span style={{ color: '#94a3b8' }}>High</span><span style={{ color: '#10b981', fontWeight: 600 }}>${d.high}</span>
        <span style={{ color: '#94a3b8' }}>Low</span><span style={{ color: '#ef4444', fontWeight: 600 }}>${d.low}</span>
        <span style={{ color: '#94a3b8' }}>Close</span><span style={{ color: '#e2e8f0', fontWeight: 600 }}>${d.close}</span>
        <span style={{ color: '#94a3b8' }}>Volume</span><span style={{ color: '#60a5fa', fontWeight: 600 }}>{(d.volume / 1e6).toFixed(2)}M</span>
        {d.sma20 && <><span style={{ color: '#94a3b8' }}>SMA20</span><span style={{ color: '#f59e0b' }}>${d.sma20}</span></>}
        {d.sma50 && <><span style={{ color: '#94a3b8' }}>SMA50</span><span style={{ color: '#3b82f6' }}>${d.sma50}</span></>}
        {d.sma200 && <><span style={{ color: '#94a3b8' }}>SMA200</span><span style={{ color: '#8b5cf6' }}>${d.sma200}</span></>}
      </div>
    </div>
  );
};

// Compute rolling SMAs for chart overlay
function addMAs(data: OHLCVBar[], periods: number[]): any[] {
  return data.map((bar, i) => {
    const enriched: any = { ...bar };
    for (const p of periods) {
      if (i >= p - 1) {
        const slice = data.slice(i - p + 1, i + 1);
        enriched[`sma${p}`] = parseFloat((slice.reduce((s, b) => s + b.close, 0) / p).toFixed(2));
      }
    }
    return enriched;
  });
}

export default function PriceChart({ data, indicators, period, onPeriodChange }: Props) {
  const [showBB, setShowBB] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const enriched = addMAs(data, [20, 50, 200]);

  // Add BB bands to chart data using computed indicator values (approximate with rolling)
  const chartData = enriched.map((bar: any, i: number) => {
    if (i >= 19) {
      const slice = data.slice(i - 19, i + 1);
      const mean = slice.reduce((s, b) => s + b.close, 0) / 20;
      const variance = slice.reduce((s, b) => s + Math.pow(b.close - mean, 2), 0) / 20;
      const std = Math.sqrt(variance);
      bar.bb_upper = parseFloat((mean + 2 * std).toFixed(2));
      bar.bb_lower = parseFloat((mean - 2 * std).toFixed(2));
      bar.bb_mid = parseFloat(mean.toFixed(2));
    }
    return bar;
  });

  const priceMin = Math.min(...data.map(d => d.low)) * 0.99;
  const priceMax = Math.max(...data.map(d => d.high)) * 1.01;

  return (
    <div className="card" style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e2d4a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>Price Chart</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'bb', label: 'BB', active: showBB, toggle: () => setShowBB(v => !v), color: '#10b981' },
              { key: 'sma', label: 'MAs', active: showSMA, toggle: () => setShowSMA(v => !v), color: '#3b82f6' },
            ].map(({ key, label, active, toggle, color }) => (
              <button
                key={key}
                onClick={toggle}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 5,
                  background: active ? `${color}22` : 'transparent',
                  color: active ? color : '#64748b',
                  border: `1px solid ${active ? `${color}44` : '#1e2d4a'}`,
                  fontWeight: 600,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6,
                background: p === period ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: p === period ? '#60a5fa' : '#64748b',
                border: `1px solid ${p === period ? 'rgba(59,130,246,0.4)' : 'transparent'}`,
                fontWeight: 600,
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main chart */}
      <div style={{ padding: '16px 4px 0' }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={v => v.slice(0, 10)}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[priceMin, priceMax]}
              tickFormatter={v => `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Bollinger Bands */}
            {showBB && <>
              <Line dataKey="bb_upper" stroke="#10b98144" strokeWidth={1} dot={false} name="BB Upper" legendType="none" />
              <Line dataKey="bb_lower" stroke="#10b98144" strokeWidth={1} dot={false} name="BB Lower" legendType="none" />
              <Line dataKey="bb_mid" stroke="#10b98166" strokeWidth={1} strokeDasharray="4 4" dot={false} name="BB Mid" legendType="none" />
            </>}

            {/* Moving Averages */}
            {showSMA && <>
              <Line dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="SMA20" legendType="none" />
              <Line dataKey="sma50" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="SMA50" legendType="none" />
              <Line dataKey="sma200" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="SMA200" legendType="none" />
            </>}

            {/* Price line (close) */}
            <Line
              dataKey="close"
              stroke="#e2e8f0"
              strokeWidth={2}
              dot={false}
              name="Price"
              legendType="none"
            />

            {/* Support/Resistance reference lines */}
            {indicators.support_resistance?.r1 && (
              <ReferenceLine y={indicators.support_resistance.r1} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.5} label={{ value: `R1 $${indicators.support_resistance.r1}`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
            )}
            {indicators.support_resistance?.s1 && (
              <ReferenceLine y={indicators.support_resistance.s1} stroke="#10b981" strokeDasharray="6 4" strokeOpacity={0.5} label={{ value: `S1 $${indicators.support_resistance.s1}`, fill: '#10b981', fontSize: 10, position: 'right' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Volume chart */}
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} width={60} />
            <Bar
              dataKey="volume"
              fill="#3b82f6"
              opacity={0.4}
              maxBarSize={8}
              name="Volume"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MA Legend */}
      {showSMA && (
        <div style={{ display: 'flex', gap: 16, padding: '8px 20px 14px', flexWrap: 'wrap' }}>
          {[
            { color: '#e2e8f0', label: 'Price' },
            { color: '#f59e0b', label: `SMA20 $${indicators.sma20?.toFixed(2) ?? 'N/A'}` },
            { color: '#3b82f6', label: `SMA50 $${indicators.sma50?.toFixed(2) ?? 'N/A'}` },
            { color: '#8b5cf6', label: `SMA200 $${indicators.sma200?.toFixed(2) ?? 'N/A'}` },
            showBB && { color: '#10b981', label: `BB $${indicators.bb_lower?.toFixed(2) ?? 'N/A'} – $${indicators.bb_upper?.toFixed(2) ?? 'N/A'}` },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2, background: item.color, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
