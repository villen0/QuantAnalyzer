import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { NewsItem } from '../types';

interface Props {
  news: NewsItem[];
}

const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
  const config: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    bullish: { icon: TrendingUp, color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Bullish' },
    bearish: { icon: TrendingDown, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Bearish' },
    neutral: { icon: Minus, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', label: 'Neutral' },
  };
  const cfg = config[sentiment] || config.neutral;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <Icon size={9} />{cfg.label}
    </span>
  );
};

export default function NewsPanel({ news }: Props) {
  const bullish = news.filter(n => n.sentiment === 'bullish').length;
  const bearish = news.filter(n => n.sentiment === 'bearish').length;
  const neutral = news.length - bullish - bearish;

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        News & Sentiment
      </div>

      {/* Sentiment summary */}
      {news.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{bullish}</div>
            <div style={{ fontSize: 9, color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bullish</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#ef4444' }}>{bearish}</div>
            <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bearish</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '8px', background: 'rgba(156,163,175,0.08)', borderRadius: 8, border: '1px solid rgba(156,163,175,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#9ca3af' }}>{neutral}</div>
            <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Neutral</div>
          </div>
        </div>
      )}

      {/* Sentiment bar */}
      {news.length > 0 && (
        <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
          <div style={{ flex: bullish, background: '#10b981' }} />
          <div style={{ flex: neutral, background: '#d1d5db' }} />
          <div style={{ flex: bearish, background: '#ef4444' }} />
        </div>
      )}

      {/* News list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto' }}>
        {news.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No recent news found.</div>
        ) : news.map((item, i) => (
          <div
            key={i}
            style={{
              padding: '10px 12px',
              background: '#f9fafb',
              border: `1px solid ${item.sentiment === 'bullish' ? 'rgba(5,150,105,0.2)' : item.sentiment === 'bearish' ? 'rgba(220,38,38,0.2)' : '#e5e7eb'}`,
              borderRadius: 8,
              transition: 'border-color 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 600, color: '#111827', textDecoration: 'none', lineHeight: 1.4, flex: 1 }}
              >
                {item.title}
              </a>
              {item.url && <ExternalLink size={11} color="#9ca3af" style={{ flexShrink: 0, marginTop: 2 }} />}
            </div>
            {item.summary && (
              <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.summary}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SentimentBadge sentiment={item.sentiment} />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{item.source}</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>·</span>
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{item.published?.slice(0, 10)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
