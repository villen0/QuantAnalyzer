import { useState, type KeyboardEvent } from 'react';
import { Search, TrendingUp } from 'lucide-react';

const POPULAR = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'SPY'];

interface Props {
  onSearch: (ticker: string) => void;
  loading: boolean;
  currentTicker: string;
}

export default function StockSearch({ onSearch, loading, currentTicker }: Props) {
  const [value, setValue] = useState('');

  const submit = () => {
    const t = value.trim().toUpperCase();
    if (t) {
      onSearch(t);
      setValue('');
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div style={{ background: '#0f1628', borderBottom: '1px solid #1e2d4a', padding: '14px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <TrendingUp size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.3px' }}>QuantAnalyzer</div>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Trading Intelligence</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200, maxWidth: 400 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value.toUpperCase())}
              onKeyDown={handleKey}
              placeholder="Enter ticker (e.g. AAPL)"
              style={{ paddingLeft: 38, width: '100%', fontSize: 14, fontWeight: 500 }}
            />
          </div>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              background: loading ? '#1e2d4a' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white', border: 'none', borderRadius: 8,
              padding: '0 20px', fontSize: 14, fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Loading...' : 'Analyze'}
          </button>
        </div>

        {/* Quick picks */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {POPULAR.map(t => (
            <button
              key={t}
              onClick={() => onSearch(t)}
              style={{
                background: t === currentTicker ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: t === currentTicker ? '#60a5fa' : '#94a3b8',
                border: `1px solid ${t === currentTicker ? 'rgba(59,130,246,0.4)' : '#1e2d4a'}`,
                borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Period selector placeholder — rendered in parent */}
      </div>
    </div>
  );
}
