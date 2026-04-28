import { useState, useEffect, useRef } from 'react';
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
  if (Math.abs(n) >= 1e9)  return `${prefix}${(n / 1e9).toFixed(2)}B${suffix}`;
  if (Math.abs(n) >= 1e6)  return `${prefix}${(n / 1e6).toFixed(2)}M${suffix}`;
  return `${prefix}${n.toFixed(decimals)}${suffix}`;
};

export default function PriceHeader({ info, livePrice, liveChange, liveChangePct }: Props) {
  const price = livePrice ?? info.current_price;
  const isUp = liveChange >= 0;
  const color = isUp ? '#10b981' : '#ef4444';

  const prevPriceRef = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [tick, setTick] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (livePrice == null) return;
    const prev = prevPriceRef.current;
    if (prev != null && livePrice !== prev) {
      const dir = livePrice > prev ? 'up' : 'down';
      setFlash(dir);
      setTick(dir);
      const t1 = setTimeout(() => setFlash(null), 800);
      const t2 = setTimeout(() => setTick(null), 2000);
      prevPriceRef.current = livePrice;
      setLastUpdated(new Date().toLocaleTimeString());
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    prevPriceRef.current = livePrice;
    setLastUpdated(new Date().toLocaleTimeString());
  }, [livePrice]);

  const flashBg =
    flash === 'up'   ? 'rgba(16,185,129,0.18)' :
    flash === 'down' ? 'rgba(239,68,68,0.18)'  : 'transparent';

  return (
    <div style={{ background: '#0f1628', borderBottom: '1px solid #1e2d4a', padding: '16px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, flexWrap: 'wrap' }}>

          {/* Name + live price */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#e2e8f0' }}>{info.ticker}</span>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>{info.name}</span>
              {info.sector !== 'N/A' && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                  background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
                  border: '1px solid rgba(59,130,246,0.3)', fontWeight: 600,
                }}>
                  {info.sector}
                </span>
              )}
              {/* LIVE indicator */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'livePulse 1.8s ease-in-out infinite', display: 'inline-block' }} />
                LIVE
              </span>
            </div>

            {/* Price row with flash */}
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 10,
              padding: '6px 12px', borderRadius: 10,
              background: flashBg,
              transition: 'background 0.15s ease',
              animation: flash ? `priceFlash${flash === 'up' ? 'Up' : 'Down'} 0.8s ease-out` : undefined,
            }}>
              <span style={{
                fontSize: 38, fontWeight: 800, color: '#e2e8f0', letterSpacing: '-1.5px',
                transition: 'color 0.3s ease',
              }}>
                ${price?.toFixed(2) ?? '—'}
              </span>

              {/* Tick arrow */}
              {tick && (
                <span style={{
                  fontSize: 18, fontWeight: 900,
                  color: tick === 'up' ? '#10b981' : '#ef4444',
                  animation: 'tickFade 2s ease-out forwards',
                }}>
                  {tick === 'up' ? '▲' : '▼'}
                </span>
              )}

              <span style={{ fontSize: 16, fontWeight: 600, color }}>
                {isUp ? '+' : ''}{liveChange.toFixed(2)}{' '}
                <span style={{ fontSize: 14 }}>({isUp ? '+' : ''}{liveChangePct.toFixed(2)}%)</span>
              </span>
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <div style={{ fontSize: 10, color: '#475569', marginTop: 4, paddingLeft: 12 }}>
                Updated {lastUpdated}
              </div>
            )}
          </div>

          {/* Key stats */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
            {[
              { label: 'Market Cap',      value: fmt(info.market_cap, '$') },
              { label: 'P/E Ratio',       value: info.pe_ratio?.toFixed(1) ?? 'N/A' },
              { label: 'Beta',            value: info.beta?.toFixed(2) ?? 'N/A' },
              { label: '52W High',        value: `$${info['52w_high']?.toFixed(2) ?? 'N/A'}` },
              { label: '52W Low',         value: `$${info['52w_low']?.toFixed(2) ?? 'N/A'}` },
              { label: 'Avg Volume',      value: fmt(info.avg_volume) },
              { label: 'Analyst Target',  value: `$${info.target_mean_price?.toFixed(2) ?? 'N/A'}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0.6); }
          50%       { opacity: 0.6; transform: scale(0.85); box-shadow: 0 0 0 4px rgba(16,185,129,0); }
        }
        @keyframes priceFlashUp {
          0%   { background: rgba(16,185,129,0.35); }
          100% { background: transparent; }
        }
        @keyframes priceFlashDown {
          0%   { background: rgba(239,68,68,0.35); }
          100% { background: transparent; }
        }
        @keyframes tickFade {
          0%   { opacity: 1; transform: translateY(0); }
          60%  { opacity: 0.8; transform: translateY(-4px); }
          100% { opacity: 0; transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
