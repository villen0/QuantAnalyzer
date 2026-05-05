import { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  createChart, ColorType, CrosshairMode, LineStyle,
  CandlestickSeries, LineSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type SeriesType,
} from 'lightweight-charts';
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

// ── OHLCV strip — lives in the header bar (no chart overlap) ─────────────────

interface CardHandle { update: (bar: any) => void }

const OHLCVCard = forwardRef<CardHandle, { initial: any }>(({ initial }, ref) => {
  const [bar, setBar] = useState<any>(initial);
  useImperativeHandle(ref, () => ({ update: setBar }), []);

  if (!bar) return null;
  const isUp = bar.close >= bar.open;
  const chg  = bar.close - bar.open;
  const pct  = bar.open > 0 ? (chg / bar.open) * 100 : 0;
  const col  = isUp ? '#059669' : '#dc2626';
  const vol  = bar.volume >= 1e9
    ? `${(bar.volume / 1e9).toFixed(2)}B`
    : `${(bar.volume / 1e6).toFixed(2)}M`;
  const timeStr = bar.date?.includes(' ') ? bar.date.slice(11, 16) : '';
  const dateLabel = timeStr && timeStr !== '00:00'
    ? bar.date.slice(0, 16) + ' ET'
    : bar.date?.slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ color: '#9ca3af', fontSize: 10 }}>{dateLabel}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: col, letterSpacing: '-0.5px' }}>
          ${bar.close.toFixed(2)}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: col }}>
          {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{chg.toFixed(2)} ({isUp ? '+' : ''}{pct.toFixed(2)}%)
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' }}>
        {([
          { l: 'O', v: bar.open,  c: '#6b7280' },
          { l: 'H', v: bar.high,  c: '#059669' },
          { l: 'L', v: bar.low,   c: '#dc2626' },
          { l: 'C', v: bar.close, c: col },
        ] as { l: string; v: number; c: string }[]).map(({ l, v, c }) => (
          <span key={l} style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: '#9ca3af' }}>{l} </span>
            <span style={{ color: c, fontWeight: 600 }}>${v.toFixed(2)}</span>
          </span>
        ))}
        <span style={{ whiteSpace: 'nowrap', color: '#9ca3af' }}>
          Vol <span style={{ color: '#2563eb', fontWeight: 600 }}>{vol}</span>
        </span>
      </div>
    </div>
  );
});

// ── Data enrichment ───────────────────────────────────────────────────────────

function enrich(data: OHLCVBar[]): any[] {
  return data.map((bar, i) => {
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
}

// ── Time helpers ──────────────────────────────────────────────────────────────

// Always return a UTCTimestamp (number) so param.time in crosshair callbacks is
// always a number — string dates get converted to BusinessDay objects by
// lightweight-charts, making String(param.time) === "[object Object]" and
// breaking the map lookup.
function toChartTime(dateStr: string): number {
  if (dateStr.includes(' ')) {
    // Intraday: "2024-01-01 09:30:00" — parse as local time (matches display)
    return Math.floor(new Date(dateStr.replace(' ', 'T')).getTime() / 1000);
  }
  // Daily: use noon UTC to keep the displayed date correct in all timezones
  return Math.floor(new Date(dateStr.slice(0, 10) + 'T12:00:00Z').getTime() / 1000);
}

// ── Pill toggle ───────────────────────────────────────────────────────────────

function Pill({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 10, padding: '2px 9px', borderRadius: 20, fontWeight: 600,
      background: active ? `${color}15` : '#f3f4f6',
      color: active ? color : '#9ca3af',
      border: `1px solid ${active ? `${color}40` : '#e5e7eb'}`,
    }}>{label}</button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SeriesRefs {
  candle:  ISeriesApi<'Candlestick'> | null;
  volume:  ISeriesApi<'Histogram'>   | null;
  sma20:   ISeriesApi<'Line'>        | null;
  sma50:   ISeriesApi<'Line'>        | null;
  sma200:  ISeriesApi<'Line'>        | null;
  bbUpper: ISeriesApi<'Line'>        | null;
  bbLower: ISeriesApi<'Line'>        | null;
  bbMid:   ISeriesApi<'Line'>        | null;
}

export default function PriceChart({ data, indicators, period, onPeriodChange }: Props) {
  const [showBB,  setShowBB]  = useState(false);
  const [showSMA, setShowSMA] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<SeriesRefs>({
    candle: null, volume: null,
    sma20: null, sma50: null, sma200: null,
    bbUpper: null, bbLower: null, bbMid: null,
  });
  const cardRef = useRef<CardHandle>(null);

  const enrichedData = useMemo(() => enrich(data), [data]);
  const lastBar      = enrichedData[enrichedData.length - 1];
  const isIntraday   = period === '1d' || period === '5d';

  // ── Build / rebuild chart on data or period change ────────────────────────
  useEffect(() => {
    if (!containerRef.current || !enrichedData.length) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#9ca3af',
        fontSize: 11,
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#d1d5db', labelBackgroundColor: '#374151' },
        horzLine: { color: '#d1d5db', labelBackgroundColor: '#374151' },
      },
      rightPriceScale: {
        borderColor: '#f1f5f9',
        scaleMargins: { top: 0.05, bottom: 0.22 },
      },
      timeScale: {
        borderColor: '#f1f5f9',
        timeVisible: isIntraday,
        secondsVisible: false,
        rightOffset: 5,
      },
    });
    chartRef.current = chart;

    // Candlestick series
    const candle = chart.addSeries(CandlestickSeries, {
      upColor:       '#26a69a',
      downColor:     '#ef5350',
      borderVisible: false,
      wickUpColor:   '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Volume histogram — bottom 20% via separate price scale
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });

    // MA overlay lines (hidden by default)
    const mkLine = (color: string, width: 1 | 2 = 2) => chart.addSeries(LineSeries, {
      color, lineWidth: width,
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false, visible: false,
    });
    const sma20  = mkLine('#f59e0b', 1);
    const sma50  = mkLine('#3b82f6');
    const sma200 = mkLine('#8b5cf6');

    // Bollinger Bands (hidden by default)
    const mkBB = (dashed = false) => chart.addSeries(LineSeries, {
      color: '#10b981', lineWidth: 1,
      lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false, visible: false,
    });
    const bbUpper = mkBB();
    const bbLower = mkBB();
    const bbMid   = mkBB(true);

    seriesRef.current = { candle, volume, sma20, sma50, sma200, bbUpper, bbLower, bbMid };

    // Feed data — toChartTime always returns a number (UTCTimestamp)
    const t = (d: string) => toChartTime(d);

    candle.setData(enrichedData.map(d => ({
      time: t(d.date) as any,
      open: d.open, high: d.high, low: d.low, close: d.close,
    })));
    volume.setData(enrichedData.map(d => ({
      time:  t(d.date) as any,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(38,166,154,0.5)' : 'rgba(239,83,80,0.5)',
    })));

    const lineData = (key: string) =>
      enrichedData.filter(d => d[key] != null).map(d => ({ time: t(d.date) as any, value: d[key] }));

    sma20.setData(lineData('sma20'));
    sma50.setData(lineData('sma50'));
    sma200.setData(lineData('sma200'));
    bbUpper.setData(lineData('bb_upper'));
    bbLower.setData(lineData('bb_lower'));
    bbMid.setData(lineData('bb_mid'));

    // Support / Resistance price lines
    const sr = indicators.support_resistance;
    if (sr?.r1) candle.createPriceLine({ price: sr.r1, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'R1' });
    if (sr?.s1) candle.createPriceLine({ price: sr.s1, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'S1' });

    chart.timeScale().fitContent();

    // Crosshair → OHLCV card
    // Key is the UTCTimestamp number — param.time is always a number since we
    // never provide string dates (which would come back as BusinessDay objects).
    const timeToBar = new Map<number, any>(enrichedData.map(d => [t(d.date), d]));

    chart.subscribeCrosshairMove(param => {
      if (!param.point || param.time == null) {
        if (lastBar) cardRef.current?.update(lastBar);
        return;
      }
      const orig = timeToBar.get(param.time as number);
      if (orig) cardRef.current?.update(orig);
    });

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [enrichedData, period, indicators, isIntraday, lastBar]);

  // ── Toggle overlays without rebuilding the chart ──────────────────────────
  useEffect(() => {
    const { sma20, sma50, sma200 } = seriesRef.current;
    (sma20  as ISeriesApi<SeriesType> | null)?.applyOptions({ visible: showSMA });
    (sma50  as ISeriesApi<SeriesType> | null)?.applyOptions({ visible: showSMA });
    (sma200 as ISeriesApi<SeriesType> | null)?.applyOptions({ visible: showSMA });
  }, [showSMA]);

  useEffect(() => {
    const { bbUpper, bbLower, bbMid } = seriesRef.current;
    (bbUpper as ISeriesApi<SeriesType> | null)?.applyOptions({ visible: showBB });
    (bbLower as ISeriesApi<SeriesType> | null)?.applyOptions({ visible: showBB });
    (bbMid   as ISeriesApi<SeriesType> | null)?.applyOptions({ visible: showBB });
  }, [showBB]);

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Header — row 1: title + toggles, row 2: OHLCV strip */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span className="card-header" style={{ marginBottom: 0 }}>Price Chart</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Pill label="BB"  active={showBB}  color="#10b981" onClick={() => setShowBB(v => !v)} />
            <Pill label="MAs" active={showSMA} color="#3b82f6" onClick={() => setShowSMA(v => !v)} />
          </div>
        </div>
        <OHLCVCard ref={cardRef} initial={lastBar} />
      </div>

      {/* Chart container */}
      <div style={{ flexShrink: 0 }}>
        <div ref={containerRef} />
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', borderTop: '1px solid #f1f5f9', flexShrink: 0, overflowX: 'auto' }}>
        {PERIODS.map(btn => {
          const active = btn.api === period;
          return (
            <button key={btn.api} onClick={() => onPeriodChange(btn.api)} style={{
              flex: '1 0 auto', padding: '10px 4px', fontSize: 12, minWidth: 38,
              fontWeight: active ? 700 : 500,
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${active ? '#2563eb' : 'transparent'}`,
              color: active ? '#111827' : '#9ca3af',
              transition: 'color 0.15s, border-color 0.15s',
            }}>
              {btn.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
