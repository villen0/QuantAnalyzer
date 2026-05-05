import { useState, useEffect, useRef } from 'react';
import type { StockInfo } from '../types';

interface Props {
  info: StockInfo & { _source?: string };
  livePrice: number | null;
  liveChange: number;
  liveChangePct: number;
}

export default function PriceHeader({ info, livePrice, liveChange, liveChangePct }: Props) {
  const price  = livePrice ?? info.current_price;
  const isUp   = liveChange >= 0;
  const chgCol = isUp ? '#10b981' : '#ef4444';

  const prevPriceRef  = useRef<number | null>(null);
  const [flash, setFlash]           = useState<'up' | 'down' | null>(null);
  const [tick,  setTick]            = useState<'up' | 'down' | null>(null);
  const [priceCol, setPriceCol]     = useState<string>('#10b981');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [fetching, setFetching]     = useState(false);

  useEffect(() => {
    if (livePrice == null) return;

    // Brief "fetching" pulse on every poll
    setFetching(true);
    const tf = setTimeout(() => setFetching(false), 600);

    const prev = prevPriceRef.current;
    if (prev != null && livePrice !== prev) {
      const dir = livePrice > prev ? 'up' : 'down';
      const col = dir === 'up' ? '#10b981' : '#ef4444';
      setFlash(dir);
      setTick(dir);
      setPriceCol(col);
      const t1 = setTimeout(() => setFlash(null), 900);
      const t2 = setTimeout(() => setTick(null), 2200);
      prevPriceRef.current = livePrice;
      setLastUpdated(new Date().toLocaleTimeString());
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(tf); };
    }
    prevPriceRef.current = livePrice;
    setLastUpdated(new Date().toLocaleTimeString());
    return () => clearTimeout(tf);
  }, [livePrice]);

  const flashBg =
    flash === 'up'   ? 'rgba(16,185,129,0.15)' :
    flash === 'down' ? 'rgba(239,68,68,0.15)'  : 'transparent';

  return (
    <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '14px 16px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Ticker row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{info.ticker}</span>
          {/* LIVE dot */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '0.08em' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: fetching ? '#f59e0b' : '#10b981',
              animation: 'livePulse 1.8s ease-in-out infinite',
              transition: 'background 0.3s',
            }} />
            {fetching ? 'UPDATING' : 'LIVE'}
          </span>
        </div>

        {/* Price row */}
        <div style={{
          display: 'inline-flex', alignItems: 'baseline', gap: 10,
          padding: '4px 10px', borderRadius: 10,
          background: flashBg,
          transition: 'background 0.2s ease',
        }}>
          <span style={{
            fontSize: 36, fontWeight: 800, letterSpacing: '-1.5px',
            color: priceCol,
            transition: 'color 0.4s ease',
          }}>
            ${price?.toFixed(2) ?? '—'}
          </span>

          {tick && (
            <span style={{
              fontSize: 18, fontWeight: 900,
              color: tick === 'up' ? '#10b981' : '#ef4444',
              animation: 'tickFade 2.2s ease-out forwards',
            }}>
              {tick === 'up' ? '▲' : '▼'}
            </span>
          )}

          <span style={{ fontSize: 15, fontWeight: 600, color: chgCol }}>
            {isUp ? '+' : ''}{liveChange.toFixed(2)}{' '}
            <span style={{ fontSize: 13 }}>({isUp ? '+' : ''}{liveChangePct.toFixed(2)}%)</span>
          </span>
        </div>

        {/* Timestamp */}
        {lastUpdated && (
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, paddingLeft: 10 }}>
            Updated {lastUpdated}
          </div>
        )}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.8); }
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
          70%  { opacity: 0.6; transform: translateY(-5px); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
