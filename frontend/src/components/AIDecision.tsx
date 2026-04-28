import { useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, Shield, Zap, RefreshCw } from 'lucide-react';
import type { AIAnalysis, Decision } from '../types';

interface Props {
  analysis: AIAnalysis | null;
  onAnalyze: (key: string) => void;
  analyzing: boolean;
  ticker?: string;
}

const DECISION_CONFIG: Record<Decision, { bg: string; border: string; text: string; glow: string; icon: any; label: string }> = {
  'STRONG BUY': { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.5)', text: '#10b981', glow: 'rgba(16,185,129,0.3)', icon: TrendingUp, label: 'STRONG BUY' },
  'BUY':         { bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.4)', text: '#34d399', glow: 'rgba(52,211,153,0.2)', icon: TrendingUp, label: 'BUY' },
  'HOLD':        { bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.4)', text: '#f59e0b', glow: 'rgba(245,158,11,0.2)', icon: Minus,      label: 'HOLD' },
  'SELL':        { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)', text: '#ef4444',  glow: 'rgba(239,68,68,0.2)', icon: TrendingDown, label: 'SELL' },
  'STRONG SELL': { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.6)', text: '#ef4444',  glow: 'rgba(239,68,68,0.35)', icon: TrendingDown, label: 'STRONG SELL' },
};

const trendIcon = (t: string) => {
  if (t === 'bullish') return <span style={{ color: '#10b981', fontSize: 11, fontWeight: 700 }}>▲ Bullish</span>;
  if (t === 'bearish') return <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>▼ Bearish</span>;
  return <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700 }}>→ Neutral</span>;
};

const sentimentColor = (s: string) => ({ bullish: '#10b981', bearish: '#ef4444', neutral: '#94a3b8', mixed: '#f59e0b' }[s] || '#94a3b8');

export default function AIDecision({ analysis, onAnalyze, analyzing }: Props) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('anthropic_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const handleAnalyze = () => {
    if (apiKey) localStorage.setItem('anthropic_key', apiKey);
    onAnalyze(apiKey);
  };

  const cfg = analysis ? DECISION_CONFIG[analysis.decision] : null;
  const DecIcon = cfg?.icon;

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <Brain size={14} color="#8b5cf6" />
        AI Analysis — Citadel + Morgan Stanley Framework
      </div>

      {/* API Key setup */}
      {!analysis && (
        <div style={{ marginBottom: 16 }}>
          {showKeyInput ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                style={{ flex: 1, fontSize: 13 }}
              />
              <button
                onClick={() => setShowKeyInput(false)}
                style={{ background: '#1e2d4a', border: '1px solid #2d4060', color: '#94a3b8', borderRadius: 6, padding: '0 12px', fontSize: 12 }}
              >
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowKeyInput(true)}
              style={{
                width: '100%', background: 'rgba(139,92,246,0.08)', border: '1px dashed rgba(139,92,246,0.3)',
                color: '#a78bfa', borderRadius: 8, padding: '8px 12px', fontSize: 12,
                marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {apiKey ? '✓ API Key set — click to update' : '⚙ Set Anthropic API Key (optional)'}
            </button>
          )}
        </div>
      )}

      {/* Analyze button */}
      {!analysis ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ marginBottom: 16, color: '#64748b', fontSize: 13 }}>
            AI will analyze technical indicators, fundamentals,<br />
            news sentiment, and multi-framework signals.
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            style={{
              background: analyzing ? '#1e2d4a' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '12px 28px', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8, margin: '0 auto',
              opacity: analyzing ? 0.7 : 1,
            }}
          >
            {analyzing ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : <><Brain size={16} /> Run AI Analysis</>}
          </button>
          <div style={{ marginTop: 12, fontSize: 11, color: '#475569' }}>
            Without API key: uses rule-based technical analysis
          </div>
        </div>
      ) : (
        <div>
          {/* Decision badge */}
          {cfg && DecIcon && (
            <div style={{
              background: cfg.bg,
              border: `2px solid ${cfg.border}`,
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 16,
              boxShadow: `0 0 40px ${cfg.glow}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <DecIcon size={28} color={cfg.text} />
                  <span style={{ fontSize: 28, fontWeight: 900, color: cfg.text, letterSpacing: '-0.5px' }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>Confidence</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cfg.text }}>{analysis.confidence}%</div>
                </div>
              </div>
              {/* Confidence bar */}
              <div style={{ height: 4, background: '#1e2d4a', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${analysis.confidence}%`, background: cfg.text, borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )}

          {/* Trade Plan */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { icon: <Target size={13} color="#3b82f6" />, label: 'Entry', value: analysis.entry_price ? `$${analysis.entry_price.toFixed(2)}` : 'N/A', color: '#3b82f6' },
              { icon: <Shield size={13} color="#ef4444" />, label: 'Stop Loss', value: analysis.stop_loss ? `$${analysis.stop_loss.toFixed(2)}` : 'N/A', color: '#ef4444' },
              { icon: <TrendingUp size={13} color="#10b981" />, label: 'Target', value: analysis.profit_target ? `$${analysis.profit_target.toFixed(2)}` : 'N/A', color: '#10b981' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{ background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>{icon}<span style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span></div>
                <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Risk/Reward + Horizon */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Risk:Reward</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>
                {analysis.risk_reward_ratio ? `1 : ${analysis.risk_reward_ratio.toFixed(2)}` : 'N/A'}
              </div>
            </div>
            <div style={{ background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Time Horizon</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{analysis.time_horizon}</div>
            </div>
          </div>

          {/* Trend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '10px 12px', background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8 }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Daily</div>
              {trendIcon(analysis.trend.daily)}
            </div>
            <div style={{ width: 1, background: '#1e2d4a' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Weekly</div>
              {trendIcon(analysis.trend.weekly)}
            </div>
            <div style={{ width: 1, background: '#1e2d4a' }} />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Overall</div>
              {trendIcon(analysis.trend.overall)}
            </div>
          </div>

          {/* Key Levels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Must Hold Support</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>${analysis.key_levels?.must_hold?.toFixed(2) ?? 'N/A'}</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Breakout Target</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>${analysis.key_levels?.breakout_target?.toFixed(2) ?? 'N/A'}</div>
            </div>
          </div>

          {/* Reasoning */}
          <div style={{ background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>AI Reasoning</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{analysis.reasoning}</div>
          </div>

          {/* Technical summary */}
          <div style={{ background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Technical Summary</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{analysis.technical_summary}</div>
          </div>

          {/* Fundamental summary */}
          <div style={{ background: '#0f1628', border: '1px solid #1e2d4a', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Fundamental Summary</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>{analysis.fundamental_summary}</div>
          </div>

          {/* Catalysts */}
          {analysis.catalysts?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Catalysts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analysis.catalysts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <Zap size={11} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {analysis.risk_factors?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Risk Factors</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {analysis.risk_factors.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertTriangle size={11} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* News sentiment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>News Sentiment:</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: sentimentColor(analysis.news_sentiment), textTransform: 'uppercase' }}>
              {analysis.news_sentiment}
            </span>
          </div>

          {/* Source + Re-analyze */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #1e2d4a' }}>
            <span style={{ fontSize: 10, color: '#475569' }}>Source: {analysis.source}</span>
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              style={{
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
                color: '#a78bfa', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <RefreshCw size={11} /> Re-analyze
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
