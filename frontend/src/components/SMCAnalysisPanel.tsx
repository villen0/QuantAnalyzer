import type { SMCAnalysis } from '../types';

interface Props {
  smc: SMCAnalysis | null;
  loading?: boolean;
}

const biasColor = (bias: string) =>
  bias === 'bullish' ? '#10b981' : bias === 'bearish' ? '#ef4444' : '#94a3b8';

const biasBg = (bias: string) =>
  bias === 'bullish' ? '#10b98118' : bias === 'bearish' ? '#ef444418' : '#94a3b818';

const LevelBox = ({
  label, value, color = '#e2e8f0', sub,
}: { label: string; value: string; color?: string; sub?: string }) => (
  <div style={{
    background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a',
    padding: '10px 12px', textAlign: 'center',
  }}>
    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
      {label}
    </div>
    <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function SMCAnalysisPanel({ smc, loading }: Props) {
  if (loading) {
    return (
      <div className="card">
        <div className="card-header">SMC Analysis</div>
        <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: 13 }}>
          Computing SMC setup…
        </div>
      </div>
    );
  }

  if (!smc) {
    return (
      <div className="card">
        <div className="card-header">SMC Analysis</div>
        <div style={{ textAlign: 'center', padding: '30px', color: '#475569', fontSize: 13 }}>
          No SMC data available
        </div>
      </div>
    );
  }

  const bc = biasColor(smc.bias);
  const bb = biasBg(smc.bias);
  const hasSetup = smc.entry !== null;

  return (
    <div className="card">
      <div className="card-header">
        SMC Analysis
        <span style={{ float: 'right', fontSize: 10, color: '#475569', fontWeight: 400, marginTop: 1 }}>
          Rule-based · Auto
        </span>
      </div>

      {/* Bias + setup type header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '4px 14px',
          borderRadius: 20, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
          color: bc, background: bb, border: `1px solid ${bc}44`,
        }}>
          {smc.bias.toUpperCase()}
        </span>
        <span style={{ fontSize: 12, color: '#64748b' }}>{smc.setup_type}</span>
      </div>

      {/* BOS / CHoCH signal */}
      {(smc.choch || smc.bos) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          padding: '7px 10px', borderRadius: 7,
          background: smc.choch ? '#10b98112' : '#3b82f612',
          border: `1px solid ${smc.choch ? '#10b98130' : '#3b82f630'}`,
        }}>
          {smc.choch ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: smc.choch.direction === 'bullish' ? '#10b981' : '#ef4444' }}>
                CHoCH {smc.choch.direction === 'bullish' ? '▲' : '▼'}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Change of Character at ${smc.choch.level.toFixed(2)}
              </span>
            </>
          ) : smc.bos ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, color: smc.bos.direction === 'bullish' ? '#3b82f6' : '#f59e0b' }}>
                BOS {smc.bos.direction === 'bullish' ? '▲' : '▼'}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                Break of Structure at ${smc.bos.level.toFixed(2)}
              </span>
            </>
          ) : null}
        </div>
      )}

      {/* Price levels grid */}
      {hasSetup ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <LevelBox
              label="Entry"
              value={`$${smc.entry!.toFixed(2)}`}
              color="#60a5fa"
            />
            <LevelBox
              label="Stop Loss"
              value={`$${smc.stop_loss!.toFixed(2)}`}
              color="#ef4444"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <LevelBox
              label="Target 1"
              value={`$${smc.target_1!.toFixed(2)}`}
              color="#10b981"
              sub="Primary target"
            />
            <LevelBox
              label="Target 2"
              value={smc.target_2 != null ? `$${smc.target_2.toFixed(2)}` : 'N/A'}
              color="#f59e0b"
              sub="Extended target"
            />
          </div>

          {/* R:R + confidence row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{
              flex: 1, background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a',
              padding: '8px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Risk / Reward</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: smc.risk_reward && smc.risk_reward >= 2 ? '#10b981' : smc.risk_reward && smc.risk_reward >= 1 ? '#f59e0b' : '#ef4444' }}>
                {smc.risk_reward != null ? `1 : ${smc.risk_reward.toFixed(2)}` : 'N/A'}
              </div>
            </div>
            <div style={{ flex: 1, background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a', padding: '8px 12px' }}>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>Confidence</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 5 }}>{smc.confidence}%</div>
              <div style={{ height: 5, borderRadius: 3, background: '#1e2d4a', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${smc.confidence}%`,
                  background: smc.confidence >= 70 ? '#10b981' : smc.confidence >= 50 ? '#f59e0b' : '#ef4444',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          </div>

          {/* Entry note */}
          {smc.entry_note && (
            <div style={{
              padding: '8px 12px', borderRadius: 7, marginBottom: 10,
              background: '#60a5fa0e', border: '1px solid #60a5fa22',
              fontSize: 12, color: '#93c5fd',
            }}>
              <span style={{ fontWeight: 700, marginRight: 4 }}>Entry:</span>
              {smc.entry_note}
            </div>
          )}

          {/* Invalidation */}
          {smc.invalidation && smc.invalidation !== 'N/A' && (
            <div style={{
              padding: '8px 12px', borderRadius: 7, marginBottom: 10,
              background: '#ef44440e', border: '1px solid #ef444422',
              fontSize: 12, color: '#fca5a5',
            }}>
              <span style={{ fontWeight: 700, marginRight: 4 }}>Invalidation:</span>
              {smc.invalidation}
            </div>
          )}
        </>
      ) : (
        <div style={{
          padding: '16px 12px', borderRadius: 8, marginBottom: 14,
          background: '#1e2d4a20', border: '1px solid #1e2d4a',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>No active setup</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
            {smc.entry_note || 'Wait for clear market structure break'}
          </div>
        </div>
      )}

      {/* P/D zone */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Premium / Discount Zone</span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: smc.pd_zone === 'premium' ? '#ef4444' : smc.pd_zone === 'discount' ? '#10b981' : '#f59e0b',
        }}>
          {smc.pd_zone.toUpperCase()}
        </span>
      </div>

      {/* Reasoning */}
      <div style={{ borderTop: '1px solid #1e2d4a', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Analysis
        </div>
        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>
          {smc.reasoning}
        </p>
      </div>
    </div>
  );
}
