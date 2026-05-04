import { useState, useCallback } from 'react';
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

const PERIOD_BUTTONS = [
  { label: '1D',  api: '1d'  },
  { label: '1W',  api: '5d'  },
  { label: '1M',  api: '1mo' },
  { label: '3M',  api: '3mo' },
  { label: 'YTD', api: 'ytd' },
  { label: '1Y',  api: '1y'  },
  { label: '5Y',  api: '5y'  },
  { label: 'MAX', api: 'max' },
];

// ── Fixed info bar ────────────────────────────────────────────────────────────

function InfoBar({ bar }: { bar: any }) {
  const isUp = bar ? bar.close >= bar.open : true;
  const changePct = bar && bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
  const col = isUp ? '#059669' : '#dc2626';
  const vol = bar && bar.volume >= 1e9
    ? `${(bar.volume / 1e9).toFixed(2)}B`
    : bar ? `${(bar.volume / 1e6).toFixed(2)}M` : '—';
  const dateStr = bar
    ? bar.date?.includes(' ') ? bar.date.slice(0, 16) + ' ET' : bar.date?.slice(0, 10)
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 16,
      padding: '0 20px', fontSize: 11, background: '#fafafa',
      borderBottom: '1px solid #f3f4f6',
      height: 34, overflow: 'hidden',
    }}>
      <span style={{ color: '#9ca3af', flexShrink: 0 }}>{dateStr}</span>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>O <b style={{ color: '#111827' }}>{bar ? `$${bar.open.toFixed(2)}` : '—'}</b></span>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>H <b style={{ color: '#059669' }}>{bar ? `$${bar.high.toFixed(2)}` : '—'}</b></span>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>L <b style={{ color: '#dc2626' }}>{bar ? `$${bar.low.toFixed(2)}` : '—'}</b></span>
      <span style={{ color: '#6b7280', flexShrink: 0 }}>C <b style={{ color: col }}>{bar ? `$${bar.close.toFixed(2)}` : '—'}</b></span>
      <span style={{ color: col, fontWeight: 700, flexShrink: 0 }}>{bar ? `${isUp ? '▲' : '▼'} ${Math.abs(changePct).toFixed(2)}%` : ''}</span>
      <span style={{ color: '#9ca3af', flexShrink: 0 }}>Vol <b style={{ color: '#6b7280' }}>{vol}</b></span>
    </div>
  );
}

// ── MA computation ────────────────────────────────────────────────────────────

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

function addBB(data: any[]): any[] {
  return data.map((bar, i) => {
    if (i >= 19) {
      const slice = data.slice(i - 19, i + 1);
      const mean = slice.reduce((s: number, b: any) => s + b.close, 0) / 20;
      const std  = Math.sqrt(slice.reduce((s: number, b: any) => s + (b.close - mean) ** 2, 0) / 20);
      bar.bb_upper = parseFloat((mean + 2 * std).toFixed(2));
      bar.bb_lower = parseFloat((mean - 2 * std).toFixed(2));
      bar.bb_mid   = parseFloat(mean.toFixed(2));
    }
    return bar;
  });
}

// ── Candlestick shape ─────────────────────────────────────────────────────────

function makeCandleShape(priceMin: number, priceMax: number) {
  return function CandleShape({ x, width, background, payload }: any) {
    if (!payload || !background || background.height <= 0) return null;
    const { open = 0, high = 0, low = 0, close = 0 } = payload;
    const range = priceMax - priceMin;
    if (range <= 0) return null;

    const isGreen = close >= open;
    const color   = isGreen ? '#10b981' : '#ef4444';
    const toY = (p: number) => background.y + background.height * (1 - (p - priceMin) / range);

    const bodyTop = Math.min(toY(open), toY(close));
    const bodyH   = Math.max(Math.abs(toY(open) - toY(close)), 1);
    const cw      = Math.max(width * 0.65, 2);
    const cx      = x + width / 2;

    return (
      <g>
        <line x1={cx} y1={toY(high)} x2={cx} y2={toY(low)} stroke={color} strokeWidth={1} />
        <rect x={cx - cw / 2} y={bodyTop} width={cw} height={bodyH}
          fill={isGreen ? color : 'transparent'} stroke={color} strokeWidth={1} />
      </g>
    );
  };
}

// ── Toggle pill ───────────────────────────────────────────────────────────────

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
      background: active ? `${color}15` : 'transparent',
      color:      active ? color         : '#9ca3af',
      border:     `1px solid ${active ? `${color}40` : '#e5e7eb'}`,
    }}>{label}</button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceChart({ data, indicators, period, onPeriodChange }: Props) {
  const [showBB,  setShowBB]  = useState(false);
  const [showSMA, setShowSMA] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<any>(null);

  const handleMouseMove  = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload) setHoveredBar(e.activePayload[0].payload);
  }, []);
  const handleMouseLeave = useCallback(() => setHoveredBar(null), []);

  const displayData = addBB(addMAs(data, [20, 50, 200]));
  const priceMin    = Math.min(...displayData.map((d: any) => d.low))  * 0.99;
  const priceMax    = Math.max(...displayData.map((d: any) => d.high)) * 1.01;
  const CandleShape = makeCandleShape(priceMin, priceMax);

  return (
    <div className="card" style={{ padding: 0 }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid #e5e7eb',
      }}>
        <span className="card-header" style={{ marginBottom: 0 }}>Price Chart</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill label="BB"   active={showBB}  color="#10b981" onClick={() => setShowBB(v => !v)} />
          <Pill label="MAs"  active={showSMA} color="#3b82f6" onClick={() => setShowSMA(v => !v)} />
        </div>
      </div>

      {/* Info bar */}
      <InfoBar bar={hoveredBar ?? displayData[displayData.length - 1]} />

      {/* Chart — fixed height container prevents layout shift on hover */}
      <div style={{ padding: '8px 4px 0', height: 356, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height={348}>
          <ComposedChart
            data={displayData}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            barCategoryGap={0}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={v => {
                if (!v) return '';
                const d = new Date(v.replace(' ', 'T'));
                if (period === '1d') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                if (period === '5y' || period === 'max') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false} axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[priceMin, priceMax]}
              tickFormatter={v => `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false} axisLine={false} width={56}
              orientation="right"
            />
            <Tooltip content={() => null} cursor={{ stroke: '#d1d5db', strokeWidth: 1 }} />

            {showBB && <>
              <Line dataKey="bb_upper" stroke="#10b98140" strokeWidth={1} dot={false} legendType="none" />
              <Line dataKey="bb_lower" stroke="#10b98140" strokeWidth={1} dot={false} legendType="none" />
              <Line dataKey="bb_mid"   stroke="#10b98166" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="none" />
            </>}

            {showSMA && <>
              <Line dataKey="sma20"  stroke="#f59e0b" strokeWidth={1.5} dot={false} legendType="none" />
              <Line dataKey="sma50"  stroke="#3b82f6" strokeWidth={1.5} dot={false} legendType="none" />
              <Line dataKey="sma200" stroke="#8b5cf6" strokeWidth={1.5} dot={false} legendType="none" />
            </>}

            <Bar dataKey="close" shape={<CandleShape />} isAnimationActive={false} />

            {indicators.support_resistance?.r1 && (
              <ReferenceLine y={indicators.support_resistance.r1} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.4}
                label={{ value: `R1`, fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} />
            )}
            {indicators.support_resistance?.s1 && (
              <ReferenceLine y={indicators.support_resistance.s1} stroke="#10b981" strokeDasharray="6 4" strokeOpacity={0.4}
                label={{ value: `S1`, fill: '#10b981', fontSize: 9, position: 'insideBottomRight' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Period selector — Robinhood underline style */}
      <div style={{ display: 'flex', justifyContent: 'center', borderTop: '1px solid #f3f4f6', padding: '0 20px' }}>
        {PERIOD_BUTTONS.map(btn => {
          const active = btn.api === period;
          return (
            <button
              key={btn.api}
              onClick={() => onPeriodChange(btn.api)}
              style={{
                fontSize: 12, padding: '12px 14px 10px', fontWeight: active ? 700 : 500,
                background: 'transparent', border: 'none',
                color: active ? '#111827' : '#9ca3af',
                borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
                transition: 'all 0.15s',
                letterSpacing: '0.01em',
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
