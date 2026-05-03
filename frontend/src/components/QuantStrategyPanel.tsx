import type { QuantStrategy, QuantBacktest } from '../types';

interface Props {
  data: QuantStrategy | null;
  loading?: boolean;
  onRun?: () => void;
}

const C = {
  buy:     '#059669',
  sell:    '#dc2626',
  hold:    '#d97706',
  bull:    '#059669',
  bear:    '#dc2626',
  muted:   '#9ca3af',
  dim:     '#9ca3af',
  text:    '#111827',
  subtext: '#6b7280',
  card:    '#f8fafc',
  border:  '#e5e7eb',
  blue:    '#2563eb',
};

const signalColor = (s: string) =>
  s === 'BUY' ? C.buy : s === 'SELL' ? C.sell : C.hold;

const signalBg = (s: string) =>
  s === 'BUY' ? 'rgba(5,150,105,0.08)' : s === 'SELL' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)';

function StatBox({
  label, value, color = C.text, sub,
}: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{
      background: C.card, borderRadius: 8, border: `1px solid ${C.border}`,
      padding: '10px 12px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function RunBtn({ onClick, loading }: { onClick?: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: loading ? C.card : 'rgba(37,99,235,0.08)',
        border: `1px solid ${loading ? C.border : 'rgba(37,99,235,0.3)'}`,
        borderRadius: 6, color: loading ? C.dim : C.blue,
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: 11, fontWeight: 700, padding: '4px 11px',
        letterSpacing: '0.02em', transition: 'all 0.2s', whiteSpace: 'nowrap',
      }}
    >
      {loading ? 'Analyzing…' : 'Run Strategy'}
    </button>
  );
}

function BacktestGrid({ bt }: { bt: QuantBacktest }) {
  const fmtPct = (v: number | null) => v == null ? '—' : `${v.toFixed(1)}%`;
  const fmtNum = (v: number | null) => v == null ? '—' : v.toFixed(2);
  const fmtUsd = (v: number | null) => v == null ? '—' : `$${v.toFixed(2)}`;

  const rrColor = (v: number | null) =>
    v == null ? C.muted : v >= 1.5 ? C.buy : v >= 0.8 ? C.hold : C.sell;

  const winColor = (v: number | null) =>
    v == null ? C.muted : v >= 55 ? C.buy : v >= 40 ? C.hold : C.sell;

  const ddColor  = (v: number | null) =>
    v == null ? C.muted : v <= 10 ? C.buy : v <= 20 ? C.hold : C.sell;

  const retColor = (v: number | null) =>
    v == null ? C.muted : v > 0 ? C.buy : C.sell;

  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        Backtest Results · {bt.total_trades} trades
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
        <StatBox label="Win Rate"      value={fmtPct(bt.win_rate)}       color={winColor(bt.win_rate)} />
        <StatBox label="Sharpe"        value={fmtNum(bt.sharpe)}          color={rrColor(bt.sharpe)} />
        <StatBox label="Max Drawdown"  value={fmtPct(bt.max_drawdown)}    color={ddColor(bt.max_drawdown)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <StatBox label="Total Return"  value={fmtPct(bt.total_return_pct)} color={retColor(bt.total_return_pct)} />
        <StatBox label="Profit Factor" value={fmtNum(bt.profit_factor)}    color={rrColor(bt.profit_factor)} />
        <StatBox label="Avg Win / Loss"
          value={bt.avg_win != null && bt.avg_loss != null
            ? `${fmtUsd(bt.avg_win)} / ${fmtUsd(bt.avg_loss)}`
            : '—'}
          color={C.subtext}
        />
      </div>
    </div>
  );
}

export default function QuantStrategyPanel({ data, loading, onRun }: Props) {
  const header = (
    <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>Quant Strategy</span>
      <RunBtn onClick={onRun} loading={!!loading} />
    </div>
  );

  if (loading) {
    return (
      <div className="card">
        {header}
        <div style={{ textAlign: 'center', padding: '30px', color: C.dim, fontSize: 13 }}>
          Running backtest…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        {header}
        <div style={{ textAlign: 'center', padding: '28px 16px', color: C.dim, fontSize: 13 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>📊</div>
          <div style={{ color: C.subtext, marginBottom: 4 }}>Trend-Following Pullback Strategy</div>
          <div style={{ fontSize: 11, color: C.dim }}>
            MA200 trend filter · RSI(14) entry · ATR(14) stop · 1% risk sizing
          </div>
        </div>
      </div>
    );
  }

  const { signal, entry, stop_loss, take_profit, rr_ratio,
          position_size_shares, risk_amount, account_size,
          indicators: ind, backtest: bt } = data;

  const sc  = signalColor(signal);
  const sbg = signalBg(signal);
  const hasSetup = signal !== 'HOLD';

  return (
    <div className="card">
      {header}

      {/* Signal + trend row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          padding: '4px 16px', borderRadius: 20,
          fontSize: 13, fontWeight: 800, letterSpacing: '0.08em',
          color: sc, background: sbg, border: `1px solid ${sc}44`,
        }}>
          {signal}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: ind.trend === 'bullish' ? C.bull : C.bear,
        }}>
          {ind.trend === 'bullish' ? '▲' : '▼'} {ind.trend.toUpperCase()}
        </span>
        <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>
          RSI {ind.rsi.toFixed(1)}
          <span style={{
            marginLeft: 5,
            color: ind.rsi_zone === 'oversold' ? C.buy
                 : ind.rsi_zone === 'overbought' ? C.sell
                 : C.muted,
            fontWeight: 600,
          }}>
            ({ind.rsi_zone})
          </span>
        </span>
      </div>

      {/* Market indicators bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14,
      }}>
        <StatBox label="Price"  value={`$${ind.price.toFixed(2)}`}         color={C.text} />
        <StatBox label="MA 200" value={ind.ma200 != null ? `$${ind.ma200.toFixed(2)}` : '—'}
          color={ind.trend === 'bullish' ? C.bull : C.bear} />
        <StatBox label="RSI 14" value={ind.rsi.toFixed(1)}
          color={ind.rsi_zone === 'oversold' ? C.buy : ind.rsi_zone === 'overbought' ? C.sell : C.subtext} />
        <StatBox label="ATR 14" value={ind.atr.toFixed(2)} color={C.subtext} />
      </div>

      {/* Trade setup (BUY / SELL only) */}
      {hasSetup ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
            <StatBox label="Entry"       value={`$${entry!.toFixed(2)}`}       color={C.blue} />
            <StatBox label="Stop Loss"   value={`$${stop_loss!.toFixed(2)}`}   color={C.sell} />
            <StatBox label="Take Profit" value={`$${take_profit!.toFixed(2)}`} color={C.buy} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
            <StatBox
              label="R : R"
              value={rr_ratio != null ? `1 : ${rr_ratio.toFixed(1)}` : '—'}
              color={rr_ratio && rr_ratio >= 2 ? C.buy : C.hold}
            />
            <StatBox
              label="Position Size"
              value={`${position_size_shares} shares`}
              color={C.subtext}
              sub={`$${risk_amount.toFixed(0)} risk`}
            />
            <StatBox
              label="Account Risk"
              value={`${((risk_amount / account_size) * 100).toFixed(1)}%`}
              color={C.subtext}
              sub={`of $${account_size.toLocaleString()}`}
            />
          </div>

          {/* Alt exit note */}
          <div style={{
            padding: '7px 12px', borderRadius: 7, marginBottom: 14,
            background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)',
            fontSize: 11, color: '#d97706',
          }}>
            <span style={{ fontWeight: 700 }}>Alt exit (Option B):</span> Close when RSI returns to 50
            {' '}(currently {ind.rsi.toFixed(1)})
          </div>
        </>
      ) : (
        <div style={{
          padding: '14px 12px', borderRadius: 8, marginBottom: 14, textAlign: 'center',
          background: '#f3f4f6', border: `1px solid ${C.border}`,
        }}>
          <div style={{ fontSize: 12, color: C.muted }}>
            {ind.trend === 'bullish'
              ? `Waiting for RSI < 30 pullback (currently ${ind.rsi.toFixed(1)})`
              : `Waiting for RSI > 70 rally (currently ${ind.rsi.toFixed(1)})`}
          </div>
        </div>
      )}

      {/* Backtest */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
        {bt.total_trades === 0 ? (
          <div style={{ textAlign: 'center', color: C.dim, fontSize: 12 }}>
            No trades triggered in the backtest window.
          </div>
        ) : (
          <BacktestGrid bt={bt} />
        )}
      </div>
    </div>
  );
}
