import { useState, useEffect, useCallback, useRef } from 'react';
import StockSearch from './components/StockSearch';
import PriceHeader from './components/PriceHeader';
import PriceChart from './components/PriceChart';
import AIDecision from './components/AIDecision';
import IndicatorPanel from './components/IndicatorPanel';
import NewsPanel from './components/NewsPanel';
import SMCPanel from './components/SMCPanel';
import SMCAnalysisPanel from './components/SMCAnalysisPanel';
import QuantStrategyPanel from './components/QuantStrategyPanel';
import { fetchDashboard, fetchAnalysis, fetchPrice, fetchSMCAnalysis, fetchQuantStrategy } from './api/client';
import type { DashboardData, AIAnalysis, SMCAnalysis, QuantStrategy } from './types';

type Tab = 'indicators' | 'news';

const TABS: { key: Tab; label: string }[] = [
  { key: 'indicators', label: 'Technical' },
  { key: 'news',       label: 'News'      },
];

export default function App() {
  const [ticker, setTicker] = useState('');
  const [period, setPeriod] = useState('3mo');
  const [tab, setTab] = useState<Tab>('indicators');
  const [data, setData] = useState<DashboardData | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [smcAnalysis, setSmcAnalysis] = useState<SMCAnalysis | null>(null);
  const [quantStrategy, setQuantStrategy] = useState<QuantStrategy | null>(null);
  const [quantLoading, setQuantLoading] = useState(false);
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
    setTab('indicators');
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

  return (
    <div style={{ minHeight: '100vh', background: '#22c55e' }}>
      <StockSearch onSearch={handleSearch} loading={loading} />

      {data && (
        <PriceHeader
          info={data.info}
          livePrice={livePrice}
          liveChange={liveChange}
          liveChangePct={liveChangePct}
        />
      )}

      {/* Tabs — only shown when a stock is loaded */}
      {data && (
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb', padding: '0 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 0 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                background: 'none', border: 'none',
                color: tab === t.key ? '#2563eb' : '#6b7280',
                padding: '12px 20px', fontSize: 13, fontWeight: 600,
                borderBottom: `2px solid ${tab === t.key ? '#2563eb' : 'transparent'}`,
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: 15, marginBottom: 8, color: '#6b7280' }}>Loading {ticker}...</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Fetching price data, indicators & news</div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '14px 18px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            {tab === 'indicators' && (
              <div className="main-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <PriceChart data={data.chart} indicators={data.indicators} period={period} onPeriodChange={handlePeriodChange} />
                  <IndicatorPanel indicators={data.indicators} chartData={data.chart} />
                  {data.indicators.smc && (
                    <SMCPanel smc={data.indicators.smc} currentPrice={data.indicators.current_price} />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <SMCAnalysisPanel smc={smcAnalysis} loading={loading} smcLoading={smcLoading} onRunAnalysis={handleRunSMCAnalysis} />
                  <QuantStrategyPanel data={quantStrategy} loading={quantLoading} onRun={handleRunQuantStrategy} />
                  <AIDecision analysis={analysis} onAnalyze={handleAnalyze} analyzing={analyzing} ticker={ticker} />
                </div>
              </div>
            )}

            {tab === 'news' && (
              <div className="main-grid">
                <NewsPanel news={data.news} />
                <AIDecision analysis={analysis} onAnalyze={handleAnalyze} analyzing={analyzing} ticker={ticker} />
              </div>
            )}
          </>
        )}

        {!loading && !data && !error && (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 68, height: 68, borderRadius: 18, marginBottom: 22,
              background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              boxShadow: '0 0 40px #3b82f630',
            }}>
              <span style={{ fontSize: 30 }}>📈</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 10, letterSpacing: '-0.4px' }}>
              Welcome to QuantAnalyzer
            </div>
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 32, maxWidth: 460, margin: '0 auto 32px' }}>
              Search any stock or ETF to get real-time data,
              technical analysis, SMC signals, and AI-powered trade decisions.
            </div>
            <div className="feature-grid">
              {[
                { icon: '🕯️', title: 'Live Charts',   desc: 'Candlestick charts with Bollinger Bands & volume' },
                { icon: '🧠', title: 'AI Analysis',    desc: 'Groq-powered BUY / SELL / HOLD verdict' },
                { icon: '🏦', title: 'SMC Strategy',   desc: 'Order blocks, FVGs, BOS/CHoCH and liquidity zones' },
                { icon: '📊', title: 'Quant Strategy', desc: 'MA200 + RSI pullback system with backtesting' },
              ].map(f => (
                <div key={f.title} style={{
                  background: '#ffffff', border: '1px solid #e5e7eb',
                  borderRadius: 12, padding: '16px 14px', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 28, fontSize: 12, color: '#374151' }}>
              Try: AAPL · TSLA · NVDA · SPY · BTC-USD
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
