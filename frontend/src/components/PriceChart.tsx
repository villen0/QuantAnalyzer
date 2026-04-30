import { useState, useEffect } from 'react';
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

// ── Tooltip ──────────────────────────────────────────────────────────────────

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
        <span style={{ color: '#94a3b8' }}>Open</span>  <span style={{ fontWeight: 600 }}>${d.open}</span>
        <span style={{ color: '#94a3b8' }}>High</span>  <span style={{ color: '#10b981', fontWeight: 600 }}>${d.high}</span>
        <span style={{ color: '#94a3b8' }}>Low</span>   <span style={{ color: '#ef4444', fontWeight: 600 }}>${d.low}</span>
        <span style={{ color: '#94a3b8' }}>Close</span> <span style={{ fontWeight: 600 }}>${d.close}</span>
        <span style={{ color: '#94a3b8' }}>Volume</span><span style={{ color: '#60a5fa', fontWeight: 600 }}>{(d.volume / 1e6).toFixed(2)}M</span>
        {d.sma20  && <><span style={{ color: '#94a3b8' }}>SMA20</span> <span style={{ color: '#f59e0b' }}>${d.sma20}</span></>}
        {d.sma50  && <><span style={{ color: '#94a3b8' }}>SMA50</span> <span style={{ color: '#3b82f6' }}>${d.sma50}</span></>}
        {d.sma200 && <><span style={{ color: '#94a3b8' }}>SMA200</span><span style={{ color: '#8b5cf6' }}>${d.sma200}</span></>}
      </div>
    </div>
  );
};

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
      color:      active ? color         : '#64748b',
      border:     `1px solid ${active ? `${color}44` : '#1e2d4a'}`,
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
  const [visibleBars, setVisibleBars] = useState<number | null>(null); // null = all

  // Reset zoom when new data loads (ticker or period changed)
  useEffect(() => { setVisibleBars(null); }, [data]);

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
        padding: '14px 20px 10px', borderBottom: '1px solid #1e2d4a', flexWrap: 'wrap', gap: 8,
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
        padding: '8px 20px', borderBottom: '1px solid #1e2d4a',
      }}>
        {/* Chart type */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['candle', 'line'] as const).map(type => (
            <button key={type} onClick={() => setChartType(type)} style={{
              fontSize: 11, padding: '4px 12px', borderRadius: 6, fontWeight: 600,
              background: chartType === type ? 'rgba(59,130,246,0.15)' : 'transparent',
              color:      chartType === type ? '#60a5fa'                : '#64748b',
              border:     `1px solid ${chartType === type ? 'rgba(59,130,246,0.4)' : '#1e2d4a'}`,
            }}>
              {type === 'candle' ? '🕯 Candlestick' : '📈 Line'}
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zoom</span>
          <button onClick={zoomOut} disabled={!canZoomOut} style={{
            width: 26, height: 26, borderRadius: 6, fontWeight: 700, fontSize: 14,
            background: canZoomOut ? '#1e2d4a' : 'transparent',
            color: canZoomOut ? '#94a3b8' : '#334155',
            border: '1px solid #1e2d4a',
          }}>−</button>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#60a5fa',
            minWidth: 44, textAlign: 'center',
          }}>
            {zoomPct}%
          </span>
          <button onClick={zoomIn} disabled={!canZoomIn} style={{
            width: 26, height: 26, borderRadius: 6, fontWeight: 700, fontSize: 14,
            background: canZoomIn ? '#1e2d4a' : 'transparent',
            color: canZoomIn ? '#94a3b8' : '#334155',
            border: '1px solid #1e2d4a',
          }}>+</button>
          {visibleBars && (
            <button onClick={() => setVisibleBars(null)} style={{
              fontSize: 10, padding: '3px 8px', borderRadius: 5, fontWeight: 600,
              background: 'transparent', color: '#475569',
              border: '1px solid #1e2d4a',
            }}>
              Reset
            </button>
          )}
          <span style={{ fontSize: 10, color: '#334155' }}>{shown} bars</span>
        </div>
      </div>

      {/* ── Price chart ─── */}
      <div style={{ padding: '16px 4px 0' }}>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={displayData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barCategoryGap={0}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" vertical={false} />
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
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false} axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[priceMin, priceMax]}
              tickFormatter={v => `$${v.toFixed(0)}`}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false} axisLine={false} width={60}
            />
            <Tooltip content={<CustomTooltip />} />

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
                dataKey="close" stroke="#e2e8f0" strokeWidth={2}
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
            <YAxis tickFormatter={v => `${(v / 1e6).toFixed(0)}M`} tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} width={60} />
            <Bar dataKey="volume" fill="#3b82f6" opacity={0.4} maxBarSize={8} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* MA Legend */}
      {showSMA && (
        <div style={{ display: 'flex', gap: 16, padding: '8px 20px 4px', flexWrap: 'wrap' }}>
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

      {/* ── Robinhood-style period selector ─── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 2,
        padding: '10px 20px 14px', borderTop: '1px solid #1e2d4a',
      }}>
        {PERIOD_BUTTONS.map(btn => {
          const active = btn.api === period;
          return (
            <button
              key={btn.api}
              onClick={() => onPeriodChange(btn.api)}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 6, fontWeight: 700,
                background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                color:      active ? '#f59e0b'                : '#475569',
                border:     `1px solid ${active ? 'rgba(245,158,11,0.35)' : 'transparent'}`,
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
