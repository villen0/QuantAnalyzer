export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockInfo {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  market_cap: number | null;
  pe_ratio: number | null;
  forward_pe: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  dividend_yield: number | null;
  beta: number | null;
  "52w_high": number | null;
  "52w_low": number | null;
  avg_volume: number | null;
  eps: number | null;
  forward_eps: number | null;
  revenue: number | null;
  gross_margins: number | null;
  operating_margins: number | null;
  profit_margins: number | null;
  debt_to_equity: number | null;
  free_cashflow: number | null;
  current_price: number | null;
  target_mean_price: number | null;
  recommendation: string;
  num_analyst_opinions: number | null;
  short_ratio: number | null;
  short_percent_of_float: number | null;
  description: string;
  country: string;
  employees: number | null;
  website: string;
}

export interface SMCOrderBlock {
  high: number;
  low: number;
  mitigated: boolean;
}

export interface SMCFairValueGap {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  size: number;
  mitigated: boolean;
}

export interface SMCData {
  market_structure: 'bullish' | 'bearish' | 'ranging';
  bos: { direction: string; level: number } | null;
  choch: { direction: string; level: number; description: string } | null;
  order_blocks: { bullish: SMCOrderBlock[]; bearish: SMCOrderBlock[] };
  fair_value_gaps: SMCFairValueGap[];
  liquidity: { sell_side: number[]; buy_side: number[] };
  premium_discount: { zone: 'premium' | 'discount' | 'equilibrium'; equilibrium: number; range_high: number; range_low: number };
  swing_highs: number[];
  swing_lows: number[];
}

export interface Indicators {
  current_price: number;
  rsi: number | null;
  macd: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bb_upper: number | null;
  bb_mid: number | null;
  bb_lower: number | null;
  bb_width: number | null;
  bb_position: number | null;
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  atr: number | null;
  stoch_k: number | null;
  stoch_d: number | null;
  volume: number;
  avg_volume_20: number | null;
  volume_ratio: number | null;
  price_above_sma200: boolean | null;
  price_above_sma50: boolean | null;
  golden_cross_50_200: boolean;
  death_cross_50_200: boolean;
  fibonacci: Record<string, number>;
  smc?: SMCData;
  support_resistance: {
    support: number;
    resistance: number;
    pivot: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  };
}

export type Decision = 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL';

export interface AIAnalysis {
  ticker: string;
  decision: Decision;
  confidence: number;
  entry_price: number | null;
  stop_loss: number | null;
  profit_target: number | null;
  risk_reward_ratio: number | null;
  time_horizon: string;
  trend: {
    daily: 'bullish' | 'bearish' | 'neutral';
    weekly: 'bullish' | 'bearish' | 'neutral';
    overall: 'bullish' | 'bearish' | 'neutral';
  };
  technical_summary: string;
  fundamental_summary: string;
  risk_factors: string[];
  catalysts: string[];
  news_sentiment: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  key_levels: {
    must_hold: number | null;
    breakout_target: number | null;
  };
  reasoning: string;
  source: string;
  error?: string;
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  published: string;
  image: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface Trade {
  id: number;
  ticker: string;
  action: string;
  price: number;
  shares: number;
  total_value: number;
  ai_decision: string;
  ai_confidence: number;
  ai_reasoning: string;
  technical_summary: string;
  stop_loss: number | null;
  profit_target: number | null;
  risk_reward: number | null;
  notes: string;
  timestamp: string;
}

export interface DashboardData {
  ticker: string;
  info: StockInfo;
  chart: OHLCVBar[];
  indicators: Indicators;
  news: NewsItem[];
  earnings: Array<{
    quarter: string;
    actual: number | null;
    estimate: number | null;
    surprise_pct: number | null;
  }>;
}
