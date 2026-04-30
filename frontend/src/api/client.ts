import axios from 'axios';
import type { DashboardData, AIAnalysis, Trade, SMCAnalysis, QuantStrategy } from '../types';

const api = axios.create({ baseURL: '/api', timeout: 60000 });

export const fetchDashboard = (ticker: string, period = '3mo'): Promise<DashboardData> =>
  api.get(`/full/${ticker}?period=${period}`).then(r => r.data);

export const fetchPrice = (ticker: string) =>
  api.get(`/price/${ticker}`).then(r => r.data);

export const fetchAnalysis = (ticker: string, apiKey?: string): Promise<{ analysis: AIAnalysis; indicators: any; info: any }> => {
  const params = apiKey ? `?api_key=${apiKey}` : '';
  return api.post(`/analyze/${ticker}${params}`).then(r => r.data);
};

export const fetchTrades = (ticker?: string): Promise<{ trades: Trade[]; count: number }> => {
  const params = ticker ? `?ticker=${ticker}` : '';
  return api.get(`/trades${params}`).then(r => r.data);
};

export const logTrade = (trade: Omit<Trade, 'id' | 'timestamp' | 'total_value'>) =>
  api.post('/trades', trade).then(r => r.data);

export const deleteTrade = (id: number) =>
  api.delete(`/trades/${id}`).then(r => r.data);

export const fetchSearch = (q: string): Promise<{ results: { symbol: string; name: string; exchange: string; type: string }[] }> =>
  api.get(`/search?q=${encodeURIComponent(q)}`).then(r => r.data);

export const fetchAnalysisLog = (ticker?: string) => {
  const params = ticker ? `?ticker=${ticker}` : '';
  return api.get(`/analysis-log${params}`).then(r => r.data);
};

export const fetchSMCAnalysis = (ticker: string): Promise<SMCAnalysis> =>
  api.get(`/smc-analysis/${ticker}`).then(r => r.data);

export const fetchQuantStrategy = (
  ticker: string,
  period = '2y',
  accountSize = 10000,
): Promise<QuantStrategy> =>
  api.get(`/quant-strategy/${ticker}?period=${period}&account_size=${accountSize}`).then(r => r.data);
