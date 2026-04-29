import math
import threading
from datetime import datetime

import yfinance as yf
import pandas as pd
import requests as std_requests
from cachetools import TTLCache

# curl_cffi impersonates Chrome's TLS fingerprint — bypasses Yahoo Finance
# IP blocks that affect cloud providers (Render, Railway, Heroku, etc.)
try:
    from curl_cffi import requests as cffi_requests
    _session = cffi_requests.Session(impersonate="chrome110")
except ImportError:
    _session = None  # fallback to default yfinance session

_lock_info   = threading.RLock()
_lock_ohlcv  = threading.RLock()
_lock_price  = threading.RLock()
_lock_earn   = threading.RLock()
_lock_search = threading.RLock()

_cache_info   = TTLCache(maxsize=128, ttl=14400)  # 4h  — fundamentals
_cache_ohlcv  = TTLCache(maxsize=256, ttl=3600)   # 1h  — OHLCV
_cache_price  = TTLCache(maxsize=128, ttl=60)     # 60s — live price
_cache_earn   = TTLCache(maxsize=128, ttl=86400)  # 24h — earnings
_cache_search = TTLCache(maxsize=64,  ttl=600)    # 10min — search

_YF_SEARCH = "https://query2.finance.yahoo.com/v1/finance/search"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


def _ticker(symbol: str) -> yf.Ticker:
    return yf.Ticker(symbol, session=_session) if _session else yf.Ticker(symbol)


def _f(d: dict, *keys):
    """Safe float: first non-None, non-NaN value from d."""
    for k in keys:
        v = d.get(k)
        if v is None:
            continue
        try:
            fv = float(v)
            if not math.isnan(fv):
                return fv
        except (ValueError, TypeError):
            pass
    return None


def fetch_stock_info(ticker: str) -> dict:
    key = ticker.upper()
    with _lock_info:
        if key in _cache_info:
            return _cache_info[key]

    info = _ticker(key).info
    if not info.get("shortName") and not info.get("longName"):
        raise ValueError(f"Unknown ticker '{key}'. Check the symbol and try again.")

    result = {
        "ticker":                 key,
        "name":                   info.get("longName") or info.get("shortName") or key,
        "sector":                 info.get("sector") or "N/A",
        "industry":               info.get("industry") or "N/A",
        "market_cap":             _f(info, "marketCap"),
        "pe_ratio":               _f(info, "trailingPE"),
        "forward_pe":             _f(info, "forwardPE"),
        "pb_ratio":               _f(info, "priceToBook"),
        "ps_ratio":               _f(info, "priceToSalesTrailing12Months"),
        "dividend_yield":         _f(info, "dividendYield"),
        "beta":                   _f(info, "beta"),
        "52w_high":               _f(info, "fiftyTwoWeekHigh"),
        "52w_low":                _f(info, "fiftyTwoWeekLow"),
        "avg_volume":             _f(info, "averageVolume"),
        "eps":                    _f(info, "trailingEps"),
        "forward_eps":            _f(info, "forwardEps"),
        "revenue":                _f(info, "totalRevenue"),
        "gross_margins":          _f(info, "grossMargins"),
        "operating_margins":      _f(info, "operatingMargins"),
        "profit_margins":         _f(info, "profitMargins"),
        "debt_to_equity":         _f(info, "debtToEquity"),
        "free_cashflow":          _f(info, "freeCashflow"),
        "current_price":          _f(info, "currentPrice") or _f(info, "regularMarketPrice"),
        "target_mean_price":      _f(info, "targetMeanPrice"),
        "recommendation":         info.get("recommendationKey") or "N/A",
        "num_analyst_opinions":   int(info["numberOfAnalystOpinions"]) if info.get("numberOfAnalystOpinions") else None,
        "short_ratio":            _f(info, "shortRatio"),
        "short_percent_of_float": _f(info, "shortPercentOfFloat"),
        "description":            info.get("longBusinessSummary") or "",
        "website":                info.get("website") or "",
        "country":                info.get("country") or "",
        "employees":              int(info["fullTimeEmployees"]) if info.get("fullTimeEmployees") else None,
        "_source":                "yfinance",
    }

    with _lock_info:
        _cache_info[key] = result
    return result


def _get_ohlcv_df(ticker: str, period: str) -> pd.DataFrame:
    cache_key = (ticker.upper(), period)
    with _lock_ohlcv:
        if cache_key in _cache_ohlcv:
            return _cache_ohlcv[cache_key]

    df = _ticker(ticker.upper()).history(period=period, interval="1d", auto_adjust=True)
    df.index = df.index.tz_localize(None)
    if df.empty:
        raise ValueError(f"No price data for '{ticker}'. Check the symbol and try again.")
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

    with _lock_ohlcv:
        _cache_ohlcv[cache_key] = df
    return df


def fetch_ohlcv(ticker: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    return _get_ohlcv_df(ticker, period)


def fetch_ohlcv_for_chart(ticker: str, period: str = "3mo", interval: str = "1d") -> list:
    df = _get_ohlcv_df(ticker, period)
    return [
        {
            "date":   ts.strftime("%Y-%m-%d %H:%M"),
            "open":   round(float(row["Open"]),   4),
            "high":   round(float(row["High"]),   4),
            "low":    round(float(row["Low"]),    4),
            "close":  round(float(row["Close"]),  4),
            "volume": int(row["Volume"]),
        }
        for ts, row in df.iterrows()
    ]


def fetch_realtime_price(ticker: str) -> dict:
    key = ticker.upper()
    with _lock_price:
        if key in _cache_price:
            return _cache_price[key]

    fi    = _ticker(key).fast_info
    price = getattr(fi, "last_price", None)
    prev  = getattr(fi, "previous_close", None)
    if not price:
        raise ValueError(f"No price available for '{key}'")

    price = round(float(price), 2)
    prev  = round(float(prev), 2) if prev else price
    result = {
        "ticker":     key,
        "price":      price,
        "prev_close": prev,
        "change":     round(price - prev, 2),
        "change_pct": round((price - prev) / prev * 100, 2) if prev else 0.0,
        "volume":     None,
        "timestamp":  datetime.utcnow().isoformat(),
        "_source":    "yfinance",
    }

    with _lock_price:
        _cache_price[key] = result
    return result


def fetch_earnings_history(ticker: str) -> list:
    key = ticker.upper()
    with _lock_earn:
        if key in _cache_earn:
            return _cache_earn[key]
    try:
        eh = _ticker(key).earnings_history
        if eh is None or eh.empty:
            return []

        def _safe(v):
            try:
                f = float(v)
                return None if math.isnan(f) else f
            except Exception:
                return None

        records = []
        for ts, row in eh.tail(4).iloc[::-1].iterrows():
            quarter      = f"Q{((ts.month - 1) // 3) + 1} {ts.year}"
            actual       = _safe(row.get("Reported EPS") or row.get("epsActual"))
            estimate     = _safe(row.get("EPS Estimate") or row.get("epsEstimate"))
            surprise_pct = _safe(row.get("Surprise(%)") or row.get("surprisePercent"))
            records.append({
                "quarter":      quarter,
                "actual":       actual,
                "estimate":     estimate,
                "surprise_pct": surprise_pct,
            })

        with _lock_earn:
            _cache_earn[key] = records
        return records
    except Exception:
        return []


def search_symbols(query: str, limit: int = 8) -> list:
    cache_key = (query.strip().lower(), limit)
    with _lock_search:
        if cache_key in _cache_search:
            return _cache_search[cache_key]
    try:
        resp = std_requests.get(
            _YF_SEARCH,
            params={
                "q":                query.strip(),
                "quotesCount":      limit,
                "newsCount":        0,
                "enableFuzzyQuery": "true",
                "lang":             "en-US",
            },
            headers=_HEADERS,
            timeout=8,
        )
        resp.raise_for_status()
        allowed = {"EQUITY", "ETF", "INDEX"}
        out = [
            {
                "symbol":   item.get("symbol", ""),
                "name":     item.get("longname") or item.get("shortname") or "",
                "exchange": item.get("exchDisp") or item.get("exchange") or "",
                "type":     item.get("quoteType", ""),
            }
            for item in resp.json().get("quotes", [])
            if item.get("quoteType") in allowed
        ][:limit]
        with _lock_search:
            _cache_search[cache_key] = out
        return out
    except Exception:
        return []
