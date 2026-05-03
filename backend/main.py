import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor

from stock_data import fetch_stock_info, fetch_ohlcv, fetch_ohlcv_for_chart, fetch_realtime_price, fetch_earnings_history, search_symbols
from indicators import compute_all_indicators
from news import fetch_stock_news
from ai_analyzer import analyze_stock
from smc_analyzer import analyze_smc
from quant_strategy import compute_quant_strategy
from trade_logger import log_analysis, get_analysis_log, init_db

app = FastAPI(title="QuantAnalyzer API", version="1.0.0")


@app.on_event("startup")
async def on_startup():
    init_db()

_origins_env = os.environ.get("ALLOW_ORIGINS", "*")
_origins = ["*"] if _origins_env == "*" else [o.strip() for o in _origins_env.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=8)


def run_sync(fn, *args, **kwargs):
    return fn(*args, **kwargs)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/search")
async def symbol_search(q: str = Query(..., min_length=1)):
    try:
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(executor, search_symbols, q.strip(), 8)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stock/{ticker}")
async def get_stock(ticker: str, period: str = Query("3mo", description="Data period: 1mo, 3mo, 6mo, 1y, 2y")):
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(executor, fetch_stock_info, ticker)
        chart = await loop.run_in_executor(executor, fetch_ohlcv_for_chart, ticker, period, "1d")
        earnings = await loop.run_in_executor(executor, fetch_earnings_history, ticker)
        return {"ticker": ticker, "info": info, "chart": chart, "earnings": earnings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/indicators/{ticker}")
async def get_indicators(ticker: str, period: str = Query("6mo")):
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(executor, fetch_ohlcv, ticker, period, "1d")
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {ticker}")
        indicators = compute_all_indicators(df)
        return {"ticker": ticker, "indicators": indicators}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/news/{ticker}")
async def get_news(ticker: str, limit: int = Query(15)):
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        news = await loop.run_in_executor(executor, fetch_stock_news, ticker, limit)
        return {"ticker": ticker, "news": news, "count": len(news)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/price/{ticker}")
async def get_realtime_price(ticker: str):
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        price_data = await loop.run_in_executor(executor, fetch_realtime_price, ticker)
        return price_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze/{ticker}")
async def analyze(ticker: str, api_key: Optional[str] = Query(None)):
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()

        info, chart, news = await asyncio.gather(
            loop.run_in_executor(executor, fetch_stock_info, ticker),
            loop.run_in_executor(executor, fetch_ohlcv_for_chart, ticker, "6mo", "1d"),
            loop.run_in_executor(executor, fetch_stock_news, ticker, 10),
        )
        df = await loop.run_in_executor(executor, fetch_ohlcv, ticker, "6mo", "1d")
        indicators = compute_all_indicators(df)
        key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        analysis = await loop.run_in_executor(
            executor, analyze_stock, ticker, info, indicators, news, chart, key
        )
        log_analysis(ticker, analysis)
        return {
            "ticker": ticker,
            "analysis": analysis,
            "indicators": indicators,
            "info": info,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/smc-analysis/{ticker}")
async def get_smc_analysis(ticker: str):
    """Rule-based SMC trade setup: entry, stop loss, and targets derived from SMC indicators."""
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(executor, fetch_ohlcv, ticker, "6mo", "1d")
        indicators = compute_all_indicators(df)
        smc          = indicators.get("smc") or {}
        atr          = indicators.get("atr") or 0
        current_price = indicators.get("current_price") or 0
        result = analyze_smc(ticker, smc, current_price, atr)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quant-strategy/{ticker}")
async def get_quant_strategy(
    ticker: str,
    period: str = Query("2y", description="History for backtest: 2y or 5y recommended"),
    account_size: float = Query(10000.0, description="Account size for position sizing"),
):
    """Trend-following pullback strategy: MA200 trend filter + RSI entry + ATR stop."""
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        df   = await loop.run_in_executor(executor, fetch_ohlcv, ticker, period, "1d")
        result = await loop.run_in_executor(executor, compute_quant_strategy, df, account_size)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/full/{ticker}")
async def get_full_dashboard(ticker: str, period: str = Query("3mo")):
    """Fetch all data in one shot for initial dashboard load."""
    ticker = ticker.upper().strip()
    try:
        loop = asyncio.get_event_loop()
        info, chart, news = await asyncio.gather(
            loop.run_in_executor(executor, fetch_stock_info, ticker),
            loop.run_in_executor(executor, fetch_ohlcv_for_chart, ticker, period, "1d"),
            loop.run_in_executor(executor, fetch_stock_news, ticker, 12),
        )
        df = await loop.run_in_executor(executor, fetch_ohlcv, ticker, "6mo", "1d")
        indicators = compute_all_indicators(df)
        earnings = await loop.run_in_executor(executor, fetch_earnings_history, ticker)
        smc_analysis = analyze_smc(
            ticker,
            indicators.get("smc") or {},
            indicators.get("current_price") or 0,
            indicators.get("atr") or 0,
        )
        return {
            "ticker":       ticker,
            "info":         info,
            "chart":        chart,
            "indicators":   indicators,
            "news":         news,
            "earnings":     earnings,
            "smc_analysis": smc_analysis,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/analysis-log")
def list_analysis_log(ticker: Optional[str] = Query(None), limit: int = Query(20)):
    logs = get_analysis_log(ticker, limit)
    return {"logs": logs, "count": len(logs)}


# Serve built React frontend — must be registered after all API routes
_dist = Path(__file__).parent.parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
