import type { StockInfo } from '../types';

interface Props {
  info: StockInfo & { _source?: string };
  livePrice: number | null;
  liveChange: number;
  liveChangePct: number;
}

const fmt = (n: number | null | undefined, prefix = '', suffix = '', decimals = 2) => {
  if (n == null || isNaN(n)) return 'N/A';
  if (Math.abs(n) >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T${suffix}`;
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B${suffix}`;
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(2)}M${suffix}`;
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
};

export default function PriceHeader({ info, livePrice, liveChange, liveChangePct }: Props) {
  const price = livePrice ?? info.current_price;
  const isUp = liveChange >= 0;
  const color = isUp ? '#10b981' : '#ef4444';

  return (
    <div style={{ background: '#0f1628', borderBottom: '1px solid #1e2d4a', padding: '16px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>
          {/* Name + price */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>{info.ticker}</span>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>{info.name}</span>
              {info._source === 'mock' && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 12, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 600 }}>
                  DEMO DATA
                </span>
              )}
              {info.sector !== 'N/A' && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.3)', fontWeight: 600,
                }}>
                  {info.sector}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-1px' }}>
                ${price?.toFixed(2) ?? '—'}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, color }}>
                {isUp ? '+' : ''}{liveChange.toFixed(2)} ({isUp ? '+' : ''}{liveChangePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Key stats */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {[
              { label: 'Market Cap', value: fmt(info.market_cap, '$') },
              { label: 'P/E Ratio', value: info.pe_ratio?.toFixed(1) ?? 'N/A' },
              { label: 'Beta', value: info.beta?.toFixed(2) ?? 'N/A' },
              { label: '52W High', value: `$${info['52w_high']?.toFixed(2) ?? 'N/A'}` },
              { label: '52W Low', value: `$${info['52w_low']?.toFixed(2) ?? 'N/A'}` },
              { label: 'Avg Volume', value: fmt(info.avg_volume) },
              { label: 'Analyst Target', value: `$${info.target_mean_price?.toFixed(2) ?? 'N/A'}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
