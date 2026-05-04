import { useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
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

const PERIODS = [
  { label: '1D', api: '1d' },
  { label: '1W', api: '5d' },
  { label: '1M', api: '1mo' },
  { label: '3M', api: '3mo' },
  { label: 'YTD', api: 'ytd' },
  { label: '1Y', api: '1y' },
  { label: '5Y', api: '5y' },
  { label: 'MAX', api: 'max' },
];

// ── Floating OHLCV card — pinned top-left inside chart, isolated renders ─────

interface InfoBarHandle { update: (bar: any) => void }

const InfoCard = forwardRef<InfoBarHandle, { initial: any }>(({ initial }, ref) => {
  const [bar, setBar] = useState<any>(initial);
  useImperativeHandle(ref, () => ({ update: setBar }), []);

  if (!bar) return null;
  const isUp = bar.close >= bar.open;
  const pct  = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
  const col  = isUp ? '#059669' : '#dc2626';
  const vol  = bar.volume >= 1e9
    ? `${(bar.volume / 1e9).toFixed(2)}B`
    : `${(bar.volume / 1e6).toFixed(2)}M`;
  const date = bar.date?.includes(' ')
    ? bar.date.slice(0, 16) + ' ET'
    : bar.date?.slice(0, 10);

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      fontSize: 11, minWidth: 160,
      pointerEvents: 'none',
    }}>
      {/* Date */}
      <div style={{ color: '#9ca3af', marginBottom: 6, fontSize: 10 }}>{date}</div>
      {/* Close + change */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 7 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: col, letterSpacing: '-0.5px' }}>
          ${bar.close.toFixed(2)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: col }}>
          {isUp ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
      {/* OHLC */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', paddingTop: 6, borderTop: '1px solid #f1f5f9', marginBottom: 6 }}>
        {[
          { l: 'Open',  v: bar.open,  c: '#6b7280' },
          { l: 'High',  v: bar.high,  c: '#059669' },
          { l: 'Low',   v: bar.low,   c: '#dc2626' },
          { l: 'Close', v: bar.close, c: col },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
            <span style={{ color: '#9ca3af' }}>{l}</span>
            <span style={{ color: c, fontWeight: 600 }}>${v.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {/* Volume */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 5, borderTop: '1px solid #f1f5f9' }}>
        <span style={{ color: '#9ca3af' }}>Vol</span>
        <span style={{ color: '#2563eb', fontWeight: 600 }}>{vol}</span>
      </div>
    </div>
  );
});

// ── Data helpers ──────────────────────────────────────────────────────────────

function enrich(data: OHLCVBar[]): any[] {
  const out = data.map((bar, i) => {
    const e: any = { ...bar };
    for (const p of [20, 50, 200]) {
      if (i >= p - 1) {
        const sl = data.slice(i - p + 1, i + 1);
        e[`sma${p}`] = +(sl.reduce((s, b) => s + b.close, 0) / p).toFixed(2);
      }
    }
    if (i >= 19) {
      const sl = data.slice(i - 19, i + 1);
      const mean = sl.reduce((s, b) => s + b.close, 0) / 20;
      const std  = Math.sqrt(sl.reduce((s, b) => s + (b.close - mean) ** 2, 0) / 20);
      e.bb_upper = +(mean + 2 * std).toFixed(2);
      e.bb_lower = +(mean - 2 * std).toFixed(2);
      e.bb_mid   = +mean.toFixed(2);
    }
    return e;
  });
  return out;
}

// ── Candlestick shape ─────────────────────────────────────────────────────────

function CandleShape({ x, width, background, payload }: any) {
  if (!payload || !background || background.height <= 0) return null;
  const { open = 0, high = 0, low = 0, close = 0, priceMin, priceMax } = payload;
  const range = priceMax - priceMin;
  if (range <= 0) return null;

  const isUp  = close >= open;
  const color = isUp ? '#10b981' : '#ef4444';
  const toY   = (p: number) => background.y + background.height * (1 - (p - priceMin) / range);

  const bodyTop = Math.min(toY(open), toY(close));
  const bodyH   = Math.max(Math.abs(toY(open) - toY(close)), 1);
  const cw      = Math.max(width * 0.6, 1.5);
  const cx      = x + width / 2;

  return (
    <g>
      <line x1={cx} y1={toY(high)} x2={cx} y2={toY(low)} stroke={color} strokeWidth={1} />
      <rect
        x={cx - cw / 2} y={bodyTop} width={cw} height={bodyH}
        fill={isUp ? color : 'transparent'} stroke={color} strokeWidth={1}
      />
    </g>
  );
}

// ── Pill toggle ───────────────────────────────────────────────────────────────

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, padding: '2px 9px', borderRadius: 20, fontWeight: 600,
      background: active ? `${color}15` : '#f3f4f6',
      color: active ? color : '#9ca3af',
      border: `1px solid ${active ? `${color}40` : '#e5e7eb'}`,
      transition: 'all 0.15s',
    }}>{label}</button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceChart({ data, indicators, period, onPeriodChange }: Props) {
  const [showBB,  setShowBB]  = useState(false);
  const [showSMA, setShowSMA] = useState(false);
  const infoRef = useRef<InfoBarHandle>(null);

  // Enrich data once — stable between renders unless data changes
  const displayData = useMemo(() => {
    const enriched = enrich(data);
    const pMin = Math.min(...enriched.map(d => d.low)) * 0.99;
    const pMax = Math.max(...enriched.map(d => d.high)) * 1.01;
    // Embed domain into each row so CandleShape can access it as payload prop
    return enriched.map(d => ({ ...d, priceMin: pMin, priceMax: pMax }));
  }, [data]);

  const priceMin = displayData[0]?.priceMin ?? 0;
  const priceMax = displayData[0]?.priceMax ?? 1;

  const xFmt = useCallback((v: string) => {
    if (!v) return '';
    const d = new Date(v.replace(' ', 'T'));
    if (period === '1d') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (period === '5y' || period === 'max') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [period]);

  // Update InfoBar imperatively — zero chart re-renders on hover
  const handleMouseMove = useCallback((e: any) => {
    const p = e?.activePayload?.[0]?.payload;
    if (p?.open != null && p?.high != null) infoRef.current?.update(p);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const last = displayData[displayData.length - 1];
    if (last) infoRef.current?.update(last);
  }, [displayData]);

  const lastBar = displayData[displayData.length - 1];

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
      }}>
        <span className="card-header" style={{ marginBottom: 0 }}>Price Chart</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill label="BB"  active={showBB}  color="#10b981" onClick={() => setShowBB(v => !v)} />
          <Pill label="MAs" active={showSMA} color="#3b82f6" onClick={() => setShowSMA(v => !v)} />
        </div>
      </div>

      {/* ── Chart — card overlay pinned top-left, never causes chart re-render ─── */}
      <div style={{ height: 360, flexShrink: 0, position: 'relative' }}>
        <InfoCard ref={infoRef} initial={lastBar} />
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayData}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap={0}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <CartesianGrid stroke="#f1f5f9" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date" tickFormatter={xFmt}
              tick={{ fontSize: 10, fill: '#c4c9d4' }} tickLine={false} axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[priceMin, priceMax]}
              tickFormatter={v => `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: '#c4c9d4' }} tickLine={false} axisLine={false}
              width={52} orientation="right"
            />
            <Tooltip content={() => null} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />

            {showBB && <>
              <Line dataKey="bb_upper" stroke="#10b98130" strokeWidth={1} dot={false} legendType="none" isAnimationActive={false} />
              <Line dataKey="bb_lower" stroke="#10b98130" strokeWidth={1} dot={false} legendType="none" isAnimationActive={false} />
              <Line dataKey="bb_mid"   stroke="#10b98155" strokeWidth={1} strokeDasharray="3 3" dot={false} legendType="none" isAnimationActive={false} />
            </>}
            {showSMA && <>
              <Line dataKey="sma20"  stroke="#f59e0b" strokeWidth={1.5} dot={false} legendType="none" isAnimationActive={false} />
              <Line dataKey="sma50"  stroke="#3b82f6" strokeWidth={1.5} dot={false} legendType="none" isAnimationActive={false} />
              <Line dataKey="sma200" stroke="#8b5cf6" strokeWidth={1.5} dot={false} legendType="none" isAnimationActive={false} />
            </>}

            <Bar dataKey="close" shape={<CandleShape />} isAnimationActive={false} />

            {indicators.support_resistance?.r1 && (
              <ReferenceLine y={indicators.support_resistance.r1} stroke="#ef444466" strokeDasharray="5 4"
                label={{ value: 'R1', fill: '#ef4444', fontSize: 9, position: 'insideTopRight' }} />
            )}
            {indicators.support_resistance?.s1 && (
              <ReferenceLine y={indicators.support_resistance.s1} stroke="#10b98166" strokeDasharray="5 4"
                label={{ value: 'S1', fill: '#10b981', fontSize: 9, position: 'insideBottomRight' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* ── Period tabs — Robinhood underline style ─── */}
      <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
        {PERIODS.map(btn => {
          const active = btn.api === period;
          return (
            <button
              key={btn.api}
              onClick={() => onPeriodChange(btn.api)}
              style={{
                flex: 1, padding: '12px 0 10px', fontSize: 12,
                fontWeight: active ? 700 : 500,
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
                color: active ? '#111827' : '#9ca3af',
                transition: 'color 0.15s, border-color 0.15s',
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
