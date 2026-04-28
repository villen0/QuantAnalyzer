import type { StockInfo } from '../types';

interface Props {
  info: StockInfo;
  earnings: Array<{ quarter: string; actual: number | null; estimate: number | null; surprise_pct: number | null }>;
}

const pct = (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : 'N/A';
const fmt = (v: number | null | undefined, prefix = '', suffix = '', dec = 2) => {
  if (v == null || isNaN(v)) return 'N/A';
  if (Math.abs(v) >= 1e12) return `${prefix}${(v / 1e12).toFixed(1)}T${suffix}`;
  if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(1)}B${suffix}`;
  if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(1)}M${suffix}`;
  return `${prefix}${v.toFixed(dec)}${suffix}`;
};

const Row = ({ label, value, color = '#e2e8f0' }: { label: string; value: string; color?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1a2540' }}>
    <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color }}>{value}</span>
  </div>
);

export default function FundamentalsPanel({ info, earnings }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Valuation */}
      <div className="card">
        <div className="card-header">Valuation (Morgan Stanley Framework)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div>
            <Row label="P/E (TTM)" value={info.pe_ratio?.toFixed(2) ?? 'N/A'} />
            <Row label="Forward P/E" value={info.forward_pe?.toFixed(2) ?? 'N/A'} />
            <Row label="P/B Ratio" value={info.pb_ratio?.toFixed(2) ?? 'N/A'} />
            <Row label="P/S Ratio" value={info.ps_ratio?.toFixed(2) ?? 'N/A'} />
            <Row label="EPS (TTM)" value={info.eps ? `$${info.eps.toFixed(2)}` : 'N/A'} color={info.eps && info.eps > 0 ? '#10b981' : '#ef4444'} />
            <Row label="Forward EPS" value={info.forward_eps ? `$${info.forward_eps.toFixed(2)}` : 'N/A'} />
          </div>
          <div>
            <Row label="Revenue" value={fmt(info.revenue, '$')} />
            <Row label="Gross Margin" value={pct(info.gross_margins)} color={info.gross_margins && info.gross_margins > 0.3 ? '#10b981' : '#f59e0b'} />
            <Row label="Op. Margin" value={pct(info.operating_margins)} color={info.operating_margins && info.operating_margins > 0.15 ? '#10b981' : info.operating_margins && info.operating_margins < 0 ? '#ef4444' : '#f59e0b'} />
            <Row label="Net Margin" value={pct(info.profit_margins)} color={info.profit_margins && info.profit_margins > 0.1 ? '#10b981' : info.profit_margins && info.profit_margins < 0 ? '#ef4444' : '#f59e0b'} />
            <Row label="Free Cash Flow" value={fmt(info.free_cashflow, '$')} color={info.free_cashflow && info.free_cashflow > 0 ? '#10b981' : '#ef4444'} />
            <Row label="Debt/Equity" value={info.debt_to_equity?.toFixed(2) ?? 'N/A'} color={info.debt_to_equity && info.debt_to_equity > 2 ? '#ef4444' : info.debt_to_equity && info.debt_to_equity < 0.5 ? '#10b981' : '#f59e0b'} />
          </div>
        </div>
      </div>

      {/* Risk metrics */}
      <div className="card">
        <div className="card-header">Risk Metrics (Bridgewater Framework)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div>
            <Row label="Beta" value={info.beta?.toFixed(2) ?? 'N/A'} color={info.beta && info.beta > 1.5 ? '#ef4444' : info.beta && info.beta < 0.5 ? '#10b981' : '#f59e0b'} />
            <Row label="Short % Float" value={info.short_percent_of_float ? pct(info.short_percent_of_float) : 'N/A'} color={info.short_percent_of_float && info.short_percent_of_float > 0.1 ? '#ef4444' : '#e2e8f0'} />
            <Row label="Short Ratio" value={info.short_ratio?.toFixed(1) ?? 'N/A'} />
            <Row label="Dividend Yield" value={info.dividend_yield ? pct(info.dividend_yield) : 'N/A'} color="#10b981" />
          </div>
          <div>
            <Row label="Analyst Target" value={info.target_mean_price ? `$${info.target_mean_price.toFixed(2)}` : 'N/A'} />
            <Row label="Analysts" value={info.num_analyst_opinions?.toString() ?? 'N/A'} />
            <Row label="Recommendation" value={info.recommendation?.toUpperCase() ?? 'N/A'}
              color={['strong_buy','buy'].includes(info.recommendation) ? '#10b981' : ['sell','strong_sell'].includes(info.recommendation) ? '#ef4444' : '#f59e0b'} />
            <Row label="Country" value={info.country || 'N/A'} />
          </div>
        </div>
      </div>

      {/* Earnings history */}
      {earnings.length > 0 && (
        <div className="card">
          <div className="card-header">Earnings History (JPMorgan Framework)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Quarter', 'Actual EPS', 'Estimate', 'Surprise %'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '5px 8px', fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1e2d4a' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {earnings.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a2540' }}>
                    <td style={{ padding: '7px 8px', color: '#94a3b8' }}>{e.quarter}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 600, color: '#e2e8f0' }}>{e.actual != null ? `$${e.actual.toFixed(2)}` : 'N/A'}</td>
                    <td style={{ padding: '7px 8px', color: '#94a3b8' }}>{e.estimate != null ? `$${e.estimate.toFixed(2)}` : 'N/A'}</td>
                    <td style={{ padding: '7px 8px', fontWeight: 700, color: e.surprise_pct && e.surprise_pct > 0 ? '#10b981' : e.surprise_pct && e.surprise_pct < 0 ? '#ef4444' : '#94a3b8' }}>
                      {e.surprise_pct != null ? `${e.surprise_pct > 0 ? '+' : ''}${e.surprise_pct.toFixed(1)}%` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Company description */}
      {info.description && (
        <div className="card">
          <div className="card-header">Company Overview</div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
            {info.description.slice(0, 600)}{info.description.length > 600 ? '...' : ''}
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {info.employees && <span style={{ fontSize: 11, color: '#64748b' }}>👥 {info.employees.toLocaleString()} employees</span>}
            {info.website && <a href={info.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#60a5fa', textDecoration: 'none' }}>🌐 {info.website}</a>}
            <span style={{ fontSize: 11, color: '#64748b' }}>🏭 {info.industry}</span>
          </div>
        </div>
      )}
    </div>
  );
}
