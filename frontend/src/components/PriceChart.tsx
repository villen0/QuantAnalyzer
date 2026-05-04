import { useState, useEffect, useCallback } from 'react';
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

// ── Fixed info bar (shown above chart, updates on hover) ─────────────────────

function InfoBar({ bar }: { bar: any; period: string }) {
  if (!bar) return <div style={{ height: 28 }} />;
  const isUp = bar.close >= bar.open;
  const change = bar.close - bar.open;
  const changePct = bar.open > 0 ? (change / bar.open) * 100 : 0;
  const col = isUp ? '#059669' : '#dc2626';
  const vol = bar.volume >= 1e9
    ? `${(bar.volume / 1e9).toFixed(2)}B`
    : `${(bar.volume / 1e6).toFixed(2)}M`;
  const dateStr = bar.date?.includes(' ')
    ? bar.date.slice(0, 16) + ' ET'
    : bar.date?.slice(0, 10);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 14px',
      padding: '5px 20px', borderBottom: '1px solid #f3f4f6',
      fontSize: 11, background: '#fafafa',
    }}>
      <span style={{ color: '#9ca3af', fontWeight: 500 }}>{dateStr}</span>
      <span style={{ color: '#6b7280' }}>O <b style={{ color: '#111827' }}>${bar.open.toFixed(2)}</b></span>
      <span style={{ color: '#6b7280' }}>H <b style={{ color: '#059669' }}>${bar.high.toFixed(2)}</b></span>
      <span style={{ color: '#6b7280' }}>L <b style={{ color: '#dc2626' }}>${bar.low.toFixed(2)}</b></span>
      <span style={{ color: '#6b7280' }}>C <b style={{ color: col }}>${bar.close.toFixed(2)}</b></span>
      <span style={{ color: col, fontWeight: 700 }}>
        {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
      </span>
      <span style={{ color: '#9ca3af' }}>Vol <b style={{ color: '#6b7280' }}>{vol}</b></span>
    </div>
  );
}

// ── Indicators overlay ────────────────────────────────────────────────────────

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
// Recharts passes `background` to every Bar shape: {x, y, width, height} of the
// full chart column. Combined with the explicit price domain we can convert any
// price value to a pixel y-coordinate without touching Recharts internals.

function makeCandleShape(priceMin: number, priceMax: number) {
  return function CandleShape({ x, width, background, payload }: any) {
    if (!payload || !background || background.height <= 0) return null;
    const { open = 0, high = 0, low = 0, close = 0 } = payload;
    const range = priceMax - priceMin;
    if (range <= 0) return null;

    const isGreen = close >= open;
    const color   = isGreen ? '#10b981' : '#ef4444';

    const toY = (p: number) =>
      background.y + background.height * (1 - (p - priceMin) / range);

    const highY  = toY(high);
    const lowY   = toY(low);
    const openY  = toY(open);
    const closeY = toY(close);

    const bodyTop = Math.min(openY, closeY);
    const bodyH   = Math.max(Math.abs(openY - closeY), 1);
    const cw      = Math.max(width * 0.65, 2);
    const cx      = x + width / 2;

    return (
      <g>
        {/* Wick */}
        <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
        {/* Body */}
        <rect
          x={cx - cw / 2} y={bodyTop} width={cw} height={bodyH}
          fill={isGreen ? color : 'transparent'}
          stroke={color} strokeWidth={1}
        />
      </g>
    );
  };
}

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function ToggleBtn({
  label, active, color, onClick,
}: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: '3px 8px', borderRadius: 5, fontWeight: 600,
      background: active ? `${color}22` : 'transparent',
      color:      active ? color         : '#9ca3af',
      border:     `1px solid ${active ? `${color}44` : '#e5e7eb'}`,
    }}>
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PriceChart({ data, indicators, period, onPeriodChange }: Props) {
  const [showBB,    setShowBB]    = useState(true);
  const [showSMA,   setShowSMA]   = useState(true);
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [visibleBars, setVisibleBars] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<any>(null);

  // Reset zoom when new data loads (ticker or period changed)
  useEffect(() => { setVisibleBars(null); }, [data]);

  const handleMouseMove = useCallback((e: any) => {
    if (e?.activePayload?.[0]?.payload) setHoveredBar(e.activePayload[0].payload);
  }, []);
  const handleMouseLeave = useCallback(() => setHoveredBar(null), []);

  // Build full enriched dataset
  const enriched   = addBB(addMAs(data, [20, 50, 200]));
  const totalBars  = enriched.length;

  // Clamp visible count and slice to most-recent N bars
  const shown = visibleBars ? Math.min(visibleBars, totalBars) : totalBars;
  const displayData = enriched.slice(-shown);

  // Y-domain from the visible window
  const priceMin = Math.min(...displayData.map((d: any) => d.low))  * 0.99;
  const priceMax = Math.max(...displayData.map((d: any) => d.high)) * 1.01;

  // Zoom controls (25% steps, min 10 bars)
  const zoomIn = () =>
    setVisibleBars(Math.max(10, Math.round(shown * 0.75)));
  const zoomOut = () => {
    const next = Math.round(shown / 0.75);
    setVisibleBars(next >= totalBars ? null : next);
  };
  const zoomPct = Math.round((shown / totalBars) * 100);
  const canZoomIn  = shown > 10;
  const canZoomOut = shown < totalBars;

  const CandleShape = makeCandleShape(priceMin, priceMax);

  return (
    <div className="card" style={{ padding: 0 }}>

      {/* ── Row 1: title + overlays ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px 10px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="card-header" style={{ marginBottom: 0 }}>Price Chart</span>
          <ToggleBtn label="BB"  active={showBB}  color="#10b981" onClick={() => setShowBB(v => !v)} />
          <ToggleBtn label="MAs" active={showSMA} color="#3b82f6" onClick={() => setShowSMA(v => !v)} />
        </div>
      </div>

      {/* ── Row 2: chart type + zoom ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px', borderBottom: '1px solid #e5e7eb',
      }}>
        {/* Chart type */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['candle', 'line'] as const).map(type => (
            <button key={type} onClick={() => setChartType(type)} style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 6, fontWeight: 600,
              background: chartType === type ? 'rgba(59,130,246,0.15)' : 'transparent',
              color:      chartType === type ? '#2563eb'                : '#9ca3af',
              border:     `1px solid ${chartType === type ? 'rgba(59,130,246,0.4)' : '#e5e7eb'}`,
            }}>
              {type === 'candle' ? '🕯 Candlestick' : '📈 Line'}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zoom</span>
          <button onClick={zoomOut} disabled={!canZoomOut} style={{
            width: 26, height: 26, borderRadius: 6, fontWeight: 700, fontSize: 14,
            background: canZoomOut ? '#e5e7eb' : 'transparent',
            color: canZoomOut ? '#6b7280' : '#d1d5db',
            border: '1px solid #e5e7eb',
          }}>−</button>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#2563eb',
            minWidth: 44, textAlign: 'center',
          }}>
            {zoomPct}%
          </span>
          <button onClick={zoomIn} disabled={!canZoomIn} style={{
            width: 26, height: 26, borderRadius: 6, fontWeight: 700, fontSize: 14,
            background: canZoomIn ? '#e5e7eb' : 'transparent',
            color: canZoomIn ? '#6b7280' : '#d1d5db',
            border: '1px solid #e5e7eb',
          }}>+</button>
          {visibleBars && (
            <button onClick={() => setVisibleBars(null)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 5, fontWeight: 600,
              background: 'transparent', color: '#9ca3af',
              border: '1px solid #e5e7eb',
            }}>
              Reset
            </button>
          )}
          <span style={{ fontSize: 10, color: '#d1d5db' }}>{shown} bars</span>
        </div>
      </div>

      {/* ── Fixed info bar ─── */}
      <InfoBar bar={hoveredBar ?? displayData[displayData.length - 1]} period={period} />

      {/* ── Price chart ─── */}
      <div style={{ padding: '8px 4px 0' }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart
            data={displayData}
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            barCategoryGap={0}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={v => {
                if (!v) return '';
                const d = new Date(v.replace(' ', 'T'));
                if (period === '1d') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                if (period === '5d') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
              tickLine={false} axisLine={false} width={60}
            />
            <Tooltip content={() => null} cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }} />

            {/* Bollinger Bands */}
            {showBB && <>
              <Line dataKey="bb_upper" stroke="#10b98144" strokeWidth={1} dot={false} legendType="none" />
              <Line dataKey="bb_lower" stroke="#10b98144" strokeWidth={1} dot={false} legendType="none" />
              <Line dataKey="bb_mid"   stroke="#10b98166" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="none" />
            </>}

            {/* Moving Averages */}
            {showSMA && <>
              <Line dataKey="sma20"  stroke="#f59e0b" strokeWidth={1.5} dot={false} legendType="none" />
              <Line dataKey="sma50"  stroke="#3b82f6" strokeWidth={1.5} dot={false} legendType="none" />
              <Line dataKey="sma200" stroke="#8b5cf6" strokeWidth={1.5} dot={false} legendType="none" />
            </>}

            {/* Candlestick bars (candle mode) */}
            {chartType === 'candle' && (
              <Bar
                dataKey="close"
                shape={<CandleShape />}
                isAnimationActive={false}
              />
            )}

            {/* Close line (line mode) */}
            {chartType === 'line' && (
              <Line
                dataKey="close" stroke="#2563eb" strokeWidth={2}
                dot={false} legendType="none"
              />
            )}

            {/* Support / Resistance */}
            {indicators.support_resistance?.r1 && (
              <ReferenceLine y={indicators.support_resistance.r1} stroke="#ef4444" strokeDasharray="6 4" strokeOpacity={0.5}
                label={{ value: `R1 $${indicators.support_resistance.r1}`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
            )}
            {indicators.support_resistance?.s1 && (
              <ReferenceLine y={indicators.support_resistance.s1} stroke="#10b981" strokeDasharray="6 4" strokeOpacity={0.5}
                label={{ value: `S1 $${indicators.support_resistance.s1}`, fill: '#10b981', fontSize: 10, position: 'right' }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Volume */}
        <ResponsiveContainer width="100%" height={80}>
          <ComposedChart data={displayData} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={60} />
            <Bar dataKey="volume" fill="#3b82f6" opacity={0.4} maxBarSize={8} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MA Legend */}
      {showSMA && (
        <div style={{ display: 'flex', gap: 16, padding: '8px 20px 4px', flexWrap: 'wrap' }}>
          {[
            { color: '#2563eb', label: 'Price' },
            { color: '#f59e0b', label: `SMA20 $${indicators.sma20?.toFixed(2) ?? 'N/A'}` },
            { color: '#3b82f6', label: `SMA50 $${indicators.sma50?.toFixed(2) ?? 'N/A'}` },
            { color: '#8b5cf6', label: `SMA200 $${indicators.sma200?.toFixed(2) ?? 'N/A'}` },
            showBB && { color: '#10b981', label: `BB $${indicators.bb_lower?.toFixed(2) ?? 'N/A'} – $${indicators.bb_upper?.toFixed(2) ?? 'N/A'}` },
          ].filter(Boolean).map((item: any) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 20, height: 2, background: item.color, borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: '#6b7280' }}>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Robinhood-style period selector ─── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 2,
        padding: '10px 20px 14px', borderTop: '1px solid #e5e7eb',
      }}>
        {PERIOD_BUTTONS.map(btn => {
          const active = btn.api === period;
          return (
            <button
              key={btn.api}
              onClick={() => onPeriodChange(btn.api)}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700,
                background: active ? 'rgba(217,119,6,0.1)' : 'transparent',
                color:      active ? '#d97706'                : '#6b7280',
                border:     `1px solid ${active ? 'rgba(217,119,6,0.3)' : 'transparent'}`,
                transition: 'all 0.15s',
                letterSpacing: '0.02em',
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
