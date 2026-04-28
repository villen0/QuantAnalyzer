import { useState } from 'react';
import { Plus, Trash2, ClipboardList } from 'lucide-react';
import type { Trade, AIAnalysis } from '../types';

interface Props {
  trades: Trade[];
  onLog: (trade: Omit<Trade, 'id' | 'timestamp' | 'total_value'>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  ticker: string;
  analysis: AIAnalysis | null;
  currentPrice: number | null;
}

export default function TradeLog({ trades, onLog, onDelete, ticker, analysis, currentPrice }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    action: 'BUY',
    price: currentPrice?.toFixed(2) || '',
    shares: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.price || !form.shares) return;
    setSaving(true);
    await onLog({
      ticker,
      action: form.action,
      price: parseFloat(form.price),
      shares: parseFloat(form.shares),
      ai_decision: analysis?.decision || '',
      ai_confidence: analysis?.confidence || 0,
      ai_reasoning: analysis?.reasoning || '',
      technical_summary: analysis?.technical_summary || '',
      stop_loss: analysis?.stop_loss || null,
      profit_target: analysis?.profit_target || null,
      risk_reward: analysis?.risk_reward_ratio || null,
      notes: form.notes,
    });
    setSaving(false);
    setShowForm(false);
    setForm({ action: 'BUY', price: currentPrice?.toFixed(2) || '', shares: '', notes: '' });
  };

  const totalBuys = trades.filter(t => t.action === 'BUY').reduce((s, t) => s + t.total_value, 0);
  const totalSells = trades.filter(t => t.action === 'SELL').reduce((s, t) => s + t.total_value, 0);

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <ClipboardList size={14} color="#3b82f6" />
          Trade Journal
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          style={{
            background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)',
            color: '#60a5fa', borderRadius: 6, padding: '5px 12px',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={13} /> Log Trade
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total Trades', value: trades.length, color: '#e2e8f0' },
          { label: 'Total Bought', value: `$${totalBuys.toFixed(2)}`, color: '#10b981' },
          { label: 'Total Sold', value: `$${totalSells.toFixed(2)}`, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center', padding: '8px', background: '#0f1628', borderRadius: 8, border: '1px solid #1e2d4a' }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ marginBottom: 16, padding: '14px', background: '#0f1628', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>Log New Trade — {ticker}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Action</label>
              <select
                value={form.action}
                onChange={e => setForm(f => ({ ...f, action: e.target.value }))}
                style={{ width: '100%', background: '#131c32', border: '1px solid #1e2d4a', color: '#e2e8f0', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
              >
                <option>BUY</option>
                <option>SELL</option>
                <option>HOLD</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Price ($)</label>
              <input type="text" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} style={{ width: '100%' }} placeholder="0.00" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Shares</label>
              <input type="text" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} style={{ width: '100%' }} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%' }} placeholder="Optional notes" />
            </div>
          </div>
          {analysis && (
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
              AI suggests: <span style={{ fontWeight: 700, color: '#a78bfa' }}>{analysis.decision}</span> ({analysis.confidence}% confidence)
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={saving || !form.price || !form.shares}
              style={{
                flex: 1, background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                color: 'white', border: 'none', borderRadius: 7,
                padding: '8px', fontSize: 13, fontWeight: 700,
                opacity: saving || !form.price || !form.shares ? 0.6 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Save Trade'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'transparent', border: '1px solid #1e2d4a',
                color: '#64748b', borderRadius: 7, padding: '8px 16px', fontSize: 13,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Date', 'Ticker', 'Action', 'Price', 'Shares', 'Value', 'AI Call', 'S/L', 'Target', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1e2d4a', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#475569', fontSize: 13 }}>No trades logged yet. Use the button above to log your first trade.</td></tr>
            ) : trades.map(trade => (
              <tr key={trade.id} style={{ borderBottom: '1px solid #1a2540' }}>
                <td style={{ padding: '8px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>{trade.timestamp?.slice(0, 10)}</td>
                <td style={{ padding: '8px 8px', fontWeight: 700, color: '#e2e8f0' }}>{trade.ticker}</td>
                <td style={{ padding: '8px 8px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: trade.action === 'BUY' ? 'rgba(16,185,129,0.15)' : trade.action === 'SELL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                    color: trade.action === 'BUY' ? '#10b981' : trade.action === 'SELL' ? '#ef4444' : '#f59e0b',
                  }}>
                    {trade.action}
                  </span>
                </td>
                <td style={{ padding: '8px 8px', color: '#e2e8f0', fontWeight: 600 }}>${trade.price?.toFixed(2)}</td>
                <td style={{ padding: '8px 8px', color: '#94a3b8' }}>{trade.shares}</td>
                <td style={{ padding: '8px 8px', color: '#e2e8f0', fontWeight: 600 }}>${trade.total_value?.toFixed(2)}</td>
                <td style={{ padding: '8px 8px' }}>
                  {trade.ai_decision && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: ['BUY','STRONG BUY'].includes(trade.ai_decision) ? 'rgba(16,185,129,0.15)' : ['SELL','STRONG SELL'].includes(trade.ai_decision) ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: ['BUY','STRONG BUY'].includes(trade.ai_decision) ? '#10b981' : ['SELL','STRONG SELL'].includes(trade.ai_decision) ? '#ef4444' : '#f59e0b',
                    }}>
                      {trade.ai_decision} {trade.ai_confidence ? `${trade.ai_confidence}%` : ''}
                    </span>
                  )}
                </td>
                <td style={{ padding: '8px 8px', color: '#ef4444' }}>{trade.stop_loss ? `$${trade.stop_loss.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '8px 8px', color: '#10b981' }}>{trade.profit_target ? `$${trade.profit_target.toFixed(2)}` : '—'}</td>
                <td style={{ padding: '8px 8px' }}>
                  <button
                    onClick={() => onDelete(trade.id)}
                    style={{ background: 'transparent', border: 'none', color: '#475569', padding: 2 }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
