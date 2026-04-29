import { useState, useEffect, useCallback, useRef } from 'react';
import StockSearch from './components/StockSearch';
import PriceHeader from './components/PriceHeader';
import PriceChart from './components/PriceChart';
import AIDecision from './components/AIDecision';
import IndicatorPanel from './components/IndicatorPanel';
import NewsPanel from './components/NewsPanel';
import TradeLog from './components/TradeLog';
import FundamentalsPanel from './components/FundamentalsPanel';
import SMCPanel from './components/SMCPanel';
import { fetchDashboard, fetchAnalysis, fetchPrice, fetchTrades, logTrade, deleteTrade } from './api/client';
import type { DashboardData, AIAnalysis, Trade } from './types';

type Tab = 'overview' | 'indicators' | 'fundamentals' | 'news' | 'trades';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'indicators', label: 'Technical' },
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'news', label: 'News' },
  { key: 'trades', label: 'Trade Log' },
];

export default function App() {
  const [ticker, setTicker] = useState('AAPL');
  const [period, setPeriod] = useState('3mo');
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveChange, setLiveChange] = useState(0);
  const [liveChangePct, setLiveChangePct] = useState(0);
  const priceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (t: string, p: string) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setLivePrice(null);
    try {
      const d = await fetchDashboard(t, p);
      setData(d);
      if (d.info?.current_price) {
        setLivePrice(d.info.current_price);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrades = useCallback(async () => {
    try {
      const res = await fetchTrades();
      setTrades(res.trades);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadData(ticker, period);
    loadTrades();
  }, []);

  // Live price polling every 8s
  useEffect(() => {
    if (!ticker) return;
    const poll = async () => {
      try {
        const p = await fetchPrice(ticker);
        if (p.price) {
          setLivePrice(p.price);
          setLiveChange(p.change || 0);
          setLiveChangePct(p.change_pct || 0);
        }
      } catch { /* ignore */ }
    };
    poll();
    priceInterval.current = setInterval(poll, 15000);
    return () => { if (priceInterval.current) clearInterval(priceInterval.current); };
  }, [ticker]);

  const handleSearch = (t: string) => {
    setTicker(t);
    setTab('overview');
    loadData(t, period);
  };

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
    loadData(ticker, p);
  };

  const handleAnalyze = async (apiKey: string) => {
    setAnalyzing(true);
    try {
      const result = await fetchAnalysis(ticker, apiKey || undefined);
      setAnalysis(result.analysis);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLogTrade = async (trade: Omit<Trade, 'id' | 'timestamp' | 'total_value'>) => {
    await logTrade(trade);
    await loadTrades();
  };

  const handleDeleteTrade = async (id: number) => {
    await deleteTrade(id);
    await loadTrades();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a' }}>
      <StockSearch onSearch={handleSearch} loading={loading} currentTicker={ticker} />

      {data && (
        <PriceHeader
          info={data.info}
          livePrice={livePrice}
          liveChange={liveChange}
          liveChangePct={liveChangePct}
        />
      )}

      {/* Tabs */}
      <div style={{ background: '#0f1628', borderBottom: '1px solid #1e2d4a', padding: '0 24px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none',
                color: tab === t.key ? '#60a5fa' : '#64748b',
                padding: '12px 20px', fontSize: 13, fontWeight: 600,
                borderBottom: `2px solid ${tab === t.key ? '#3b82f6' : 'transparent'}`,
                transition: 'all 0.2s',
              }}
            >
              {t.label}
              {t.key === 'trades' && trades.length > 0 && (
                <span style={{ marginLeft: 6, background: 'rgba(59,130,246,0.2)', color: '#60a5fa', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                  {trades.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
            <div style={{ fontSize: 15, marginBottom: 8 }}>Loading {ticker}...</div>
            <div style={{ fontSize: 12 }}>Fetching price data, indicators & news</div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            {tab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
                {/* Left column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <PriceChart
                    data={data.chart}
                    indicators={data.indicators}
                    period={period}
                    onPeriodChange={handlePeriodChange}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <IndicatorPanel indicators={data.indicators} chartData={data.chart} />
                    <NewsPanel news={data.news} />
                  </div>
                  {data.indicators.smc && (
                    <SMCPanel smc={data.indicators.smc} currentPrice={data.indicators.current_price} />
                  )}
                </div>

                {/* Right column — AI */}
                <div>
                  <AIDecision
                    analysis={analysis}
                    onAnalyze={handleAnalyze}
                    analyzing={analyzing}
                    ticker={ticker}
                  />
                </div>
              </div>
            )}

            {tab === 'indicators' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <PriceChart data={data.chart} indicators={data.indicators} period={period} onPeriodChange={handlePeriodChange} />
                  <IndicatorPanel indicators={data.indicators} chartData={data.chart} />
                  {data.indicators.smc && (
                    <SMCPanel smc={data.indicators.smc} currentPrice={data.indicators.current_price} />
                  )}
                </div>
                <AIDecision analysis={analysis} onAnalyze={handleAnalyze} analyzing={analyzing} ticker={ticker} />
              </div>
            )}

            {tab === 'fundamentals' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
                <FundamentalsPanel info={data.info} earnings={data.earnings} />
                <AIDecision analysis={analysis} onAnalyze={handleAnalyze} analyzing={analyzing} ticker={ticker} />
              </div>
            )}

            {tab === 'news' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
                <NewsPanel news={data.news} />
                <AIDecision analysis={analysis} onAnalyze={handleAnalyze} analyzing={analyzing} ticker={ticker} />
              </div>
            )}

            {tab === 'trades' && (
              <TradeLog
                trades={trades}
                onLog={handleLogTrade}
                onDelete={handleDeleteTrade}
                ticker={ticker}
                analysis={analysis}
                currentPrice={livePrice ?? data.info.current_price}
              />
            )}
          </>
        )}

        {!loading && !data && !error && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Search a stock to begin</div>
            <div style={{ fontSize: 13 }}>Enter any ticker symbol above to get AI-powered analysis</div>
          </div>
        )}
      </div>
    </div>
  );
}
