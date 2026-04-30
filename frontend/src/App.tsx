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
import SMCAnalysisPanel from './components/SMCAnalysisPanel';
import QuantStrategyPanel from './components/QuantStrategyPanel';
import { fetchDashboard, fetchAnalysis, fetchPrice, fetchTrades, logTrade, deleteTrade, fetchSMCAnalysis, fetchQuantStrategy } from './api/client';
import type { DashboardData, AIAnalysis, Trade, SMCAnalysis, QuantStrategy } from './types';

type Tab = 'overview' | 'indicators' | 'fundamentals' | 'news' | 'trades';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'indicators', label: 'Technical' },
  { key: 'fundamentals', label: 'Fundamentals' },
  { key: 'news', label: 'News' },
  { key: 'trades', label: 'Trade Log' },
];

export default function App() {
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState('3mo');
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<DashboardData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [smcAnalysis, setSmcAnalysis] = useState<SMCAnalysis | null>(null);
  const [quantStrategy, setQuantStrategy] = useState<QuantStrategy | null>(null);
  const [quantLoading, setQuantLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [smcLoading, setSmcLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveChange, setLiveChange] = useState(0);
  const [liveChangePct, setLiveChangePct] = useState(0);
  const priceInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (t: string, p: string) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSmcAnalysis(null);
    setQuantStrategy(null);
    setLivePrice(null);
    try {
      const d = await fetchDashboard(t, p);
      setData(d);
      if (d.smc_analysis) setSmcAnalysis(d.smc_analysis);
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
    loadTrades();
  }, []);

  // Live price polling every 5 min
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
    priceInterval.current = setInterval(poll, 300000);
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

  const handleRunQuantStrategy = async () => {
    setQuantLoading(true);
    try {
      const result = await fetchQuantStrategy(ticker);
      setQuantStrategy(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Strategy analysis failed');
    } finally {
      setQuantLoading(false);
    }
  };

  const handleRunSMCAnalysis = async () => {
    setSmcLoading(true);
    try {
      const result = await fetchSMCAnalysis(ticker);
      setSmcAnalysis(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'SMC analysis failed');
    } finally {
      setSmcLoading(false);
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

                {/* Right column — SMC analysis + Quant Strategy + AI */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SMCAnalysisPanel smc={smcAnalysis} loading={loading} smcLoading={smcLoading} onRunAnalysis={handleRunSMCAnalysis} />
                  <QuantStrategyPanel
                    data={quantStrategy}
                    loading={quantLoading}
                    onRun={handleRunQuantStrategy}
                  />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <SMCAnalysisPanel smc={smcAnalysis} loading={loading} smcLoading={smcLoading} onRunAnalysis={handleRunSMCAnalysis} />
                  <QuantStrategyPanel
                    data={quantStrategy}
                    loading={quantLoading}
                    onRun={handleRunQuantStrategy}
                  />
                  <AIDecision analysis={analysis} onAnalyze={handleAnalyze} analyzing={analyzing} ticker={ticker} />
                </div>
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
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 68, height: 68, borderRadius: 18, marginBottom: 22,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 0 40px #3b82f630',
            }}>
              <span style={{ fontSize: 30 }}>📈</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#e2e8f0', marginBottom: 10, letterSpacing: '-0.4px' }}>
              Welcome to QuantAnalyzer
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 44, maxWidth: 460, margin: '0 auto 44px' }}>
              Search any stock or ETF in the bar above to get real-time data,
              technical analysis, SMC signals, and AI-powered trade decisions.
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 14, maxWidth: 720, margin: '0 auto',
            }}>
              {[
                { icon: '🕯️', title: 'Live Charts',       desc: 'Candlestick charts with EMA, Bollinger Bands & volume' },
                { icon: '🧠', title: 'AI Analysis',        desc: 'Groq-powered reasoning with a clear BUY / SELL / HOLD verdict' },
                { icon: '🏦', title: 'SMC Strategy',       desc: 'Order blocks, FVGs, BOS/CHoCH and liquidity zones' },
                { icon: '📊', title: 'Quant Strategy',     desc: 'MA200 + RSI pullback system with full backtesting metrics' },
                { icon: '📋', title: 'Fundamentals',       desc: 'P/E, revenue, margins, analyst ratings and more' },
                { icon: '📓', title: 'Trade Log',          desc: 'Log and track your trades with real-time P&L' },
              ].map(f => (
                <div key={f.title} style={{
                  background: '#0f1628', border: '1px solid #1e2d4a',
                  borderRadius: 12, padding: '18px 16px', textAlign: 'left',
                  transition: 'border-color 0.2s',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 5 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 36, fontSize: 12, color: '#334155' }}>
              Try searching: AAPL · TSLA · NVDA · SPY · BTC-USD
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
