import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Search, TrendingUp, X } from 'lucide-react';
import { fetchSearch } from '../api/client';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

interface Props {
  onSearch: (ticker: string) => void;
  loading: boolean;
}

export default function StockSearch({ onSearch, loading }: Props) {
  const [value, setValue] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetchSearch(q);
        setResults(res.results);
        setOpen(res.results.length > 0);
        setHighlighted(-1);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const commit = (ticker: string) => {
    onSearch(ticker.toUpperCase());
    setValue('');
    setOpen(false);
    setResults([]);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted >= 0 && results[highlighted]) {
        commit(results[highlighted].symbol);
      } else {
        const t = value.trim().toUpperCase();
        if (t) commit(t);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const typeColor = (type: string) => {
    if (type === 'ETF') return '#f59e0b';
    if (type === 'Index') return '#8b5cf6';
    return '#3b82f6';
  };

  return (
    <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px' }}>QuantAnalyzer</div>
            <div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>AI Trading Intelligence</div>
          </div>
        </div>

        {/* Search box */}
        <div ref={wrapperRef} style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: searching ? '#2563eb' : '#9ca3af', transition: 'color 0.2s' }}
              />
              <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value.toUpperCase())}
                onKeyDown={handleKey}
                onFocus={() => { if (results.length > 0) setOpen(true); }}
                placeholder="Search Stock"
                autoComplete="off"
                spellCheck={false}
                style={{ paddingLeft: 38, paddingRight: value ? 34 : 12, width: '100%', fontSize: 14, fontWeight: 500 }}
              />
              {value && (
                <button
                  onClick={() => { setValue(''); setResults([]); setOpen(false); }}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 0, color: '#9ca3af', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => { const t = value.trim().toUpperCase(); if (t) commit(t); }}
              disabled={loading}
              style={{
                background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '0 20px', fontSize: 14, fontWeight: 600,
                opacity: loading ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              {loading ? 'Loading…' : 'Search'}
            </button>
          </div>

          {/* Dropdown */}
          {open && results.length > 0 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: '#ffffff', border: '1px solid #e5e7eb',
              borderRadius: 10, overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 1000,
            }}>
              {results.map((r, i) => (
                <button
                  key={`${r.symbol}-${i}`}
                  onMouseDown={e => { e.preventDefault(); commit(r.symbol); }}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '10px 14px',
                    background: i === highlighted ? 'rgba(37,99,235,0.05)' : 'transparent',
                    border: 'none', borderBottom: i < results.length - 1 ? '1px solid #f3f4f6' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    minWidth: 52, textAlign: 'center',
                    background: 'rgba(37,99,235,0.08)', borderRadius: 5,
                    padding: '2px 6px', fontSize: 12, fontWeight: 700,
                    color: '#2563eb', fontFamily: 'monospace',
                  }}>
                    {r.symbol}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                      {r.exchange}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: `${typeColor(r.type)}22`, color: typeColor(r.type),
                    flexShrink: 0,
                  }}>
                    {r.type === 'Common Stock' ? 'STOCK' : r.type.toUpperCase()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
