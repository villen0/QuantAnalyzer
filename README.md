# QuantAnalyzer — AI Stock Intelligence Dashboard

A professional stock analysis dashboard powered by **Claude AI** (Sonnet 4.6) combining six institutional-grade frameworks to give you clear **BUY / SELL / HOLD** signals.

## Features

- **Live Price Monitoring** — Real-time price polling with change indicators
- **Technical Analysis** — RSI, MACD, Bollinger Bands, Stochastic, ATR, Support/Resistance, Fibonacci levels
- **Moving Averages** — SMA 20/50/100/200, EMA 9/21 with Golden/Death Cross detection
- **Chart Visualizations** — Candlestick price chart with MA overlays, Volume, RSI & MACD sub-charts
- **News Sentiment** — Financial news with automatic bullish/bearish/neutral classification
- **AI Analysis** — Claude AI synthesizes all data using 6 institutional frameworks:
  - Citadel-Grade Technical Analysis (primary signal)
  - Morgan Stanley DCF Valuation context
  - Bridgewater Risk Assessment
  - JPMorgan Earnings Analysis
  - Renaissance Technologies Pattern Finding
  - McKinsey Macro Impact Assessment
- **Trade Journal** — Log and review all trades with AI context attached
- **Fundamentals Panel** — P/E, margins, FCF, earnings history, analyst targets

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11 + FastAPI + uvicorn |
| AI | Anthropic Claude Sonnet 4.6 |
| Data | yfinance (with realistic demo fallback) |
| Indicators | pandas + numpy (custom implementations) |
| Storage | SQLite (trade log + analysis history) |
| Frontend | React 18 + TypeScript + Vite |
| Charts | Recharts |
| Styling | Tailwind CSS v4 |

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
uvicorn main:app --port 8000 --reload
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Or use the combined start script

```bash
chmod +x start.sh
./start.sh
```

Open **http://localhost:5173**

## API Key

The app works **without** an API key using rule-based technical analysis fallback.  
Add your Anthropic key in `backend/.env` or enter it directly in the AI Decision panel for full Claude-powered analysis.

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Demo Mode

When Yahoo Finance is not accessible (sandboxed environments), the app automatically switches to realistic simulated data for 8 pre-configured tickers: **AAPL, TSLA, NVDA, MSFT, AMZN, GOOGL, META, SPY**.

## Project Structure

```
QuantAnalyzer/
├── backend/
│   ├── main.py           # FastAPI app + all endpoints
│   ├── stock_data.py     # yfinance + mock data fallback
│   ├── indicators.py     # RSI, MACD, BB, SMAs, ATR, Stochastic, Fibonacci
│   ├── news.py           # News fetching + sentiment analysis
│   ├── ai_analyzer.py    # Claude AI analysis with 6-framework prompt
│   ├── mock_data.py      # Realistic demo data generator
│   ├── trade_logger.py   # SQLite trade & analysis logging
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx               # Main app shell + routing
│       ├── api/client.ts         # API calls
│       ├── types/index.ts        # TypeScript types
│       └── components/
│           ├── StockSearch.tsx   # Search bar + quick picks
│           ├── PriceHeader.tsx   # Live price + key stats
│           ├── PriceChart.tsx    # Candlestick + MA + volume
│           ├── AIDecision.tsx    # BUY/SELL/HOLD panel
│           ├── IndicatorPanel.tsx # RSI gauge, MACD, MAs, Fibonacci
│           ├── NewsPanel.tsx     # News feed + sentiment
│           ├── FundamentalsPanel.tsx # Valuation + earnings
│           └── TradeLog.tsx      # Trade journal
├── start.sh
└── README.md
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/full/{ticker}` | All dashboard data in one call |
| GET | `/api/price/{ticker}` | Live price |
| GET | `/api/indicators/{ticker}` | All technical indicators |
| GET | `/api/news/{ticker}` | News + sentiment |
| POST | `/api/analyze/{ticker}` | Run Claude AI analysis |
| GET/POST/DELETE | `/api/trades` | Trade log CRUD |
| GET | `/docs` | Interactive API docs |

## AI Decision Framework

The Claude AI prompt is modeled after institutional trading desks:

**STRONG BUY** — Multiple converging bullish signals across technicals + fundamentals  
**BUY** — Favorable risk/reward with clear entry setup  
**HOLD** — Mixed signals, no clear edge  
**SELL** — Deteriorating technicals or overvaluation  
**STRONG SELL** — Multiple bearish signals, elevated downside risk  

Each call includes: entry price, stop-loss, profit target, risk:reward ratio, key support/resistance levels, and detailed reasoning.

> **Disclaimer**: This tool is for educational purposes only. Do not make financial decisions based solely on AI output.
