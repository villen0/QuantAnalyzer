import type { SMCData } from '../types';

interface Props {
  smc: SMCData;
  currentPrice: number;
}

const Badge = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', padding: '3px 10px',
    borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    color, background: bg, border: `1px solid ${color}44`,
  }}>{label}</span>
);

const Row = ({ label, value, color = '#e2e8f0', sub }: { label: string; value: string; color?: string; sub?: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #1a2540' }}>
    <div>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>{label}</span>
      {sub && <div style={{ fontSize: 10, color: '#475569' }}>{sub}</div>}
    </div>
    <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
  </div>
);

const structureColor = (s: string) =>
  s === 'bullish' ? '#10b981' : s === 'bearish' ? '#ef4444' : '#94a3b8';

export default function SMCPanel({ smc, currentPrice }: Props) {
  const ms = smc.market_structure;
  const pd = smc.premium_discount;
  const pdColor = pd.zone === 'premium' ? '#ef4444' : pd.zone === 'discount' ? '#10b981' : '#f59e0b';
  const pdLabel = pd.zone === 'premium' ? 'PREMIUM' : pd.zone === 'discount' ? 'DISCOUNT' : 'EQUILIBRIUM';

  // Gauge bar for premium/discount
  const pct = pd.range_high > pd.range_low
    ? Math.min(100, Math.max(0, ((currentPrice - pd.range_low) / (pd.range_high - pd.range_low)) * 100))
    : 50;

  return (
    <div className="card">
      <div className="card-header">Smart Money Concepts (SMC)</div>

      {/* Top row: Structure + BOS/CHoCH + PD zone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        {/* Market Structure */}
        <div style={{ background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Market Structure
          </div>
          <Badge
            label={ms.toUpperCase()}
            color={structureColor(ms)}
            bg={`${structureColor(ms)}18`}
          />
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>
            {ms === 'bullish' ? 'HH + HL pattern' : ms === 'bearish' ? 'LH + LL pattern' : 'No clear direction'}
          </div>
        </div>

        {/* BOS / CHoCH */}
        <div style={{ background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Structure Break
          </div>
          {smc.choch ? (
            <>
              <Badge
                label={`CHoCH ${smc.choch.direction === 'bullish' ? '▲' : '▼'}`}
                color={smc.choch.direction === 'bullish' ? '#10b981' : '#ef4444'}
                bg={smc.choch.direction === 'bullish' ? '#10b98118' : '#ef444418'}
              />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>${smc.choch.level.toFixed(2)}</div>
            </>
          ) : smc.bos ? (
            <>
              <Badge
                label={`BOS ${smc.bos.direction === 'bullish' ? '▲' : '▼'}`}
                color={smc.bos.direction === 'bullish' ? '#3b82f6' : '#f59e0b'}
                bg={smc.bos.direction === 'bullish' ? '#3b82f618' : '#f59e0b18'}
              />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>${smc.bos.level.toFixed(2)}</div>
            </>
          ) : (
            <>
              <Badge label="NO BREAK" color="#475569" bg="#47556918" />
              <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>Watching for break</div>
            </>
          )}
        </div>

        {/* Premium / Discount */}
        <div style={{ background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a', padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            P/D Zone
          </div>
          <Badge label={pdLabel} color={pdColor} bg={`${pdColor}18`} />
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 6 }}>EQ: ${pd.equilibrium.toFixed(2)}</div>
        </div>
      </div>

      {/* Premium/Discount range bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 4 }}>
          <span>Discount ${pd.range_low.toFixed(2)}</span>
          <span>EQ ${pd.equilibrium.toFixed(2)}</span>
          <span>Premium ${pd.range_high.toFixed(2)}</span>
        </div>
        <div style={{ position: 'relative', height: 8, background: 'linear-gradient(to right, #10b98133, #f59e0b33, #ef444433)', borderRadius: 4 }}>
          <div style={{
            position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
            left: `${pct}%`, width: 10, height: 10, borderRadius: '50%',
            background: pdColor, boxShadow: `0 0 6px ${pdColor}`,
            border: '2px solid #0a0e1a',
          }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 1, height: 14, background: '#f59e0b66' }} />
        </div>
      </div>

      {/* Order Blocks */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Order Blocks
        </div>
        {smc.order_blocks.bullish.every(o => o.mitigated) && smc.order_blocks.bearish.every(o => o.mitigated) && (
          <div style={{ fontSize: 12, color: '#475569', padding: '4px 0' }}>No active order blocks detected</div>
        )}
        {smc.order_blocks.bullish.map((ob, i) => (
          <div key={`bull-ob-${i}`} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 8px', borderRadius: 6, marginBottom: 4,
            background: ob.mitigated ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.1)',
            border: `1px solid ${ob.mitigated ? '#1e2d4a' : '#10b98133'}`,
            opacity: ob.mitigated ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>▲ Bullish OB</span>
              <span style={{ fontSize: 10, color: '#475569' }}>${ob.low.toFixed(2)} – ${ob.high.toFixed(2)}</span>
            </div>
            <span style={{ fontSize: 10, color: ob.mitigated ? '#475569' : '#10b981', fontWeight: 600 }}>
              {ob.mitigated ? 'Mitigated' : currentPrice >= ob.low && currentPrice <= ob.high ? '⚡ In OB' : 'Active'}
            </span>
          </div>
        ))}
        {smc.order_blocks.bearish.map((ob, i) => (
          <div key={`bear-ob-${i}`} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 8px', borderRadius: 6, marginBottom: 4,
            background: ob.mitigated ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${ob.mitigated ? '#1e2d4a' : '#ef444433'}`,
            opacity: ob.mitigated ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>▼ Bearish OB</span>
              <span style={{ fontSize: 10, color: '#475569' }}>${ob.low.toFixed(2)} – ${ob.high.toFixed(2)}</span>
            </div>
            <span style={{ fontSize: 10, color: ob.mitigated ? '#475569' : '#ef4444', fontWeight: 600 }}>
              {ob.mitigated ? 'Mitigated' : currentPrice >= ob.low && currentPrice <= ob.high ? '⚡ In OB' : 'Active'}
            </span>
          </div>
        ))}
      </div>

      {/* Fair Value Gaps */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Fair Value Gaps (FVG / Imbalance)
        </div>
        {smc.fair_value_gaps.length === 0 && (
          <div style={{ fontSize: 12, color: '#475569', padding: '4px 0' }}>No recent FVGs detected</div>
        )}
        {smc.fair_value_gaps.map((fvg, i) => {
          const isBull = fvg.type === 'bullish';
          const col = isBull ? '#10b981' : '#ef4444';
          return (
            <div key={`fvg-${i}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 8px', borderRadius: 6, marginBottom: 4,
              background: fvg.mitigated ? `${col}06` : `${col}10`,
              border: `1px solid ${fvg.mitigated ? '#1e2d4a' : col + '33'}`,
              opacity: fvg.mitigated ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: col }}>{isBull ? '▲' : '▼'} {isBull ? 'Bullish' : 'Bearish'} FVG</span>
                <span style={{ fontSize: 10, color: '#475569' }}>${fvg.bottom.toFixed(2)} – ${fvg.top.toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: fvg.mitigated ? '#475569' : col, fontWeight: 600 }}>
                  {fvg.mitigated ? 'Filled' : 'Open'}
                </div>
                <div style={{ fontSize: 9, color: '#475569' }}>gap ${fvg.size.toFixed(2)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Liquidity */}
      <div>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Liquidity Pools
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>Sell-Side (above)</div>
            {smc.liquidity.sell_side.length === 0
              ? <div style={{ fontSize: 11, color: '#475569' }}>None identified</div>
              : smc.liquidity.sell_side.map((l, i) => (
                <Row key={i} label={`SSL ${i + 1}`} value={`$${l.toFixed(2)}`} color="#ef4444" />
              ))
            }
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginBottom: 4 }}>Buy-Side (below)</div>
            {smc.liquidity.buy_side.length === 0
              ? <div style={{ fontSize: 11, color: '#475569' }}>None identified</div>
              : smc.liquidity.buy_side.map((l, i) => (
                <Row key={i} label={`BSL ${i + 1}`} value={`$${l.toFixed(2)}`} color="#10b981" />
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
