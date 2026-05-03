import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { Indicators, OHLCVBar } from '../types';

interface Props {
  indicators: Indicators;
  chartData: OHLCVBar[];
}

// Compute rolling RSI and MACD from chart data for sub-charts
function computeRSI(data: OHLCVBar[], period = 14): number[] {
  const closes = data.map(d => d.close);
  const rsis: number[] = new Array(period).fill(NaN);
  if (closes.length <= period) return rsis;
  const gains: number[] = [], losses: number[] = [];
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(diff, 0));
    losses.push(Math.max(-diff, 0));
  }
  let avgGain = gains.reduce((a, b) => a + b) / period;
  let avgLoss = losses.reduce((a, b) => a + b) / period;
  rsis.push(100 - 100 / (1 + avgGain / (avgLoss || 0.0001)));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    rsis.push(100 - 100 / (1 + avgGain / (avgLoss || 0.0001)));
  }
  return rsis;
}

function computeEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

const RSIGauge = ({ value }: { value: number | null }) => {
  if (value == null) return null;
  const clamped = Math.max(0, Math.min(100, value));
  const color = value < 30 ? '#10b981' : value > 70 ? '#ef4444' : value > 60 ? '#f59e0b' : '#3b82f6';
  const label = value < 30 ? 'OVERSOLD' : value > 70 ? 'OVERBOUGHT' : value > 60 ? 'High' : value < 40 ? 'Low' : 'Neutral';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 120, height: 70, margin: '0 auto' }}>
        <RadialBarChart
          width={120} height={120}
          cx={60} cy={80}
          innerRadius={50} outerRadius={80}
          startAngle={180} endAngle={0}
          data={[{ value: clamped, fill: color }]}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" background={{ fill: '#e5e7eb' }} cornerRadius={4} />
        </RadialBarChart>
        <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value.toFixed(1)}</div>
          <div style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 18 }}>RSI (14)</div>
    </div>
  );
};

const Row = ({ label, value, color = '#111827', sub }: { label: string; value: string; color?: string; sub?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
    <div>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af' }}>{sub}</div>}
    </div>
    <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
  </div>
);

const Pill = ({ label, active, color }: { label: string; active: boolean; color: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: active ? `${color}15` : '#f3f4f6',
    color: active ? color : '#9ca3af',
    border: `1px solid ${active ? `${color}35` : '#e5e7eb'}`,
  }}>
    {active ? '●' : '○'} {label}
  </span>
);

export default function IndicatorPanel({ indicators, chartData }: Props) {
  const ind = indicators;
  const rsiColor = (ind.rsi ?? 50) < 30 ? '#10b981' : (ind.rsi ?? 50) > 70 ? '#ef4444' : '#3b82f6';
  const macdBull = (ind.macd ?? 0) > (ind.macd_signal ?? 0);

  // RSI sub-chart data
  const rsiValues = computeRSI(chartData);
  const rsiChartData = chartData.map((d, i) => ({ date: d.date.slice(0, 10), rsi: isNaN(rsiValues[i]) ? null : parseFloat(rsiValues[i].toFixed(1)) }));

  // MACD sub-chart data
  const closes = chartData.map(d => d.close);
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine, 9);
  const macdChartData = chartData.map((d, i) => ({
    date: d.date.slice(0, 10),
    macd: parseFloat(macdLine[i].toFixed(3)),
    signal: parseFloat(signalLine[i].toFixed(3)),
    hist: parseFloat((macdLine[i] - signalLine[i]).toFixed(3)),
  })).slice(-60);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* RSI + MACD gauges row */}
      <div className="card">
        <div className="card-header">Technical Indicators</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
          <RSIGauge value={ind.rsi} />

          <div>
            {/* MACD */}
            <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MACD (12,26,9)</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: macdBull ? '#10b981' : '#ef4444' }}>
                  {macdBull ? '▲ Bullish' : '▼ Bearish'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'MACD', value: ind.macd?.toFixed(3) ?? 'N/A', color: macdBull ? '#10b981' : '#ef4444' },
                  { label: 'Signal', value: ind.macd_signal?.toFixed(3) ?? 'N/A', color: '#f59e0b' },
                  { label: 'Hist', value: ind.macd_histogram?.toFixed(3) ?? 'N/A', color: (ind.macd_histogram ?? 0) > 0 ? '#10b981' : '#ef4444' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stochastic + BB */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Stochastic %K</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: (ind.stoch_k ?? 50) < 20 ? '#10b981' : (ind.stoch_k ?? 50) > 80 ? '#ef4444' : '#111827' }}>
                  {ind.stoch_k?.toFixed(1) ?? 'N/A'}
                </div>
                <div style={{ fontSize: 9, color: '#6b7280' }}>{(ind.stoch_k ?? 50) < 20 ? 'Oversold' : (ind.stoch_k ?? 50) > 80 ? 'Overbought' : 'Neutral'}</div>
              </div>
              <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>BB Position</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {ind.bb_position != null ? `${(ind.bb_position * 100).toFixed(0)}%` : 'N/A'}
                </div>
                <div style={{ fontSize: 9, color: '#6b7280' }}>{(ind.bb_position ?? 0.5) > 0.8 ? 'Near Upper Band' : (ind.bb_position ?? 0.5) < 0.2 ? 'Near Lower Band' : 'Mid Band'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* MA signals */}
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill label="Above SMA50" active={!!ind.price_above_sma50} color="#10b981" />
          <Pill label="Above SMA200" active={!!ind.price_above_sma200} color="#10b981" />
          {ind.golden_cross_50_200 && <Pill label="Golden Cross" active={true} color="#f59e0b" />}
          {ind.death_cross_50_200 && <Pill label="Death Cross" active={true} color="#ef4444" />}
          <Pill label="MACD Bull" active={macdBull} color="#10b981" />
          <Pill label="RSI<30 (Oversold)" active={(ind.rsi ?? 50) < 30} color="#10b981" />
          <Pill label="RSI>70 (Overbought)" active={(ind.rsi ?? 50) > 70} color="#ef4444" />
        </div>
      </div>

      {/* RSI Chart */}
      <div className="card" style={{ padding: '16px 20px 10px' }}>
        <div className="card-header" style={{ marginBottom: 10 }}>RSI (14) History</div>
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={rsiChartData.slice(-60)} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}`} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={28} ticks={[30, 50, 70]} />
            <Tooltip
              formatter={(v: any) => [`${Number(v).toFixed(1)}`, 'RSI']}
              contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#111827' }}
              labelStyle={{ color: '#9ca3af', fontSize: 10 }}
            />
            <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={50} stroke="#e5e7eb" strokeDasharray="2 6" />
            <Line dataKey="rsi" stroke={rsiColor} strokeWidth={1.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* MACD Chart */}
      <div className="card" style={{ padding: '16px 20px 10px' }}>
        <div className="card-header" style={{ marginBottom: 10 }}>MACD Histogram</div>
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={macdChartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 11, color: '#111827' }}
              labelStyle={{ color: '#9ca3af', fontSize: 10 }}
            />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Line dataKey="macd" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="MACD" />
            <Line dataKey="signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Moving averages table */}
      <div className="card">
        <div className="card-header">Moving Averages & Key Levels</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div>
            {[
              { label: 'EMA 9', value: ind.ema9, sub: 'Fast EMA' },
              { label: 'EMA 21', value: ind.ema21, sub: 'Slow EMA' },
              { label: 'SMA 20', value: ind.sma20, sub: '1-month avg' },
              { label: 'SMA 50', value: ind.sma50, sub: '2.5-month avg' },
              { label: 'SMA 100', value: ind.sma100, sub: '5-month avg' },
              { label: 'SMA 200', value: ind.sma200, sub: '1-year avg' },
            ].map(({ label, value, sub }) => {
              const price = ind.current_price;
              const color = value ? (price > value ? '#10b981' : '#ef4444') : '#9ca3af';
              return (
                <Row key={label} label={label} value={value ? `$${value.toFixed(2)}` : 'N/A'} color={color} sub={sub} />
              );
            })}
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Support & Resistance</div>
            {[
              { label: 'Resistance 2', value: ind.support_resistance?.r2, color: '#ef4444' },
              { label: 'Resistance 1', value: ind.support_resistance?.r1, color: '#f87171' },
              { label: 'Pivot', value: ind.support_resistance?.pivot, color: '#9ca3af' },
              { label: 'Support 1', value: ind.support_resistance?.s1, color: '#059669' },
              { label: 'Support 2', value: ind.support_resistance?.s2, color: '#10b981' },
            ].map(({ label, value, color }) => (
              <Row key={label} label={label} value={value ? `$${value.toFixed(2)}` : 'N/A'} color={color} />
            ))}

            <div style={{ marginTop: 10, fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Volume</div>
            <Row label="Current" value={`${(ind.volume / 1e6).toFixed(2)}M`} />
            <Row label="20d Avg" value={ind.avg_volume_20 ? `${(ind.avg_volume_20 / 1e6).toFixed(2)}M` : 'N/A'} />
            <Row label="Volume Ratio" value={ind.volume_ratio ? `${ind.volume_ratio.toFixed(2)}x` : 'N/A'}
              color={(ind.volume_ratio ?? 1) > 1.5 ? '#f59e0b' : '#111827'}
            />
            <Row label="ATR (14)" value={ind.atr ? `$${ind.atr.toFixed(2)}` : 'N/A'} />
          </div>
        </div>
      </div>

      {/* Fibonacci */}
      <div className="card">
        <div className="card-header">Fibonacci Retracement Levels</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {Object.entries(ind.fibonacci || {}).reverse().map(([level, price]) => {
            const pct = parseFloat(level);
            const isKey = [0.618, 0.382, 0.5].includes(pct);
            const curr = ind.current_price;
            const isNear = Math.abs(curr - price) / curr < 0.015;
            return (
              <div key={level} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 0', borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 2, background: isKey ? '#f59e0b' : '#e5e7eb', borderRadius: 1 }} />
                  <span style={{ fontSize: 12, color: isKey ? '#f59e0b' : '#9ca3af', fontWeight: isKey ? 700 : 400 }}>
                    {(pct * 100).toFixed(1)}%{isKey ? ' ★' : ''}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: isNear ? '#f59e0b' : '#111827' }}>
                  ${(price as number).toFixed(2)}{isNear ? ' ←' : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
