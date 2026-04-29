import math
import os
import time
import threading
from datetime import datetime, timedelta
from typing import Optional

import requests
import pandas as pd
from cachetools import TTLCache

_TD_BASE = "https://api.twelvedata.com"

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

# Twelve Data free tier: 8 API credits/minute, 800/day
# Simple rate-limit guard: track timestamps of recent calls
_rate_lock  = threading.Lock()
_call_times: list = []
_RATE_LIMIT = 8    # calls per window
_RATE_WINDOW = 62  # seconds (slight buffer over 60s)

_PERIODS_TO_OUTPUTSIZE = {
    "1mo": 23, "3mo": 66, "6mo": 132, "1y": 252, "2y": 504, "5y": 1260,
}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json",
}


def _api_key() -> str:
    return os.environ.get("TWELVE_DATA_KEY", "")


def _rate_wait():
    """Block until we're under the 8-calls/min rate limit."""
    with _rate_lock:
        now = time.time()
        # Drop calls older than the window
        cutoff = now - _RATE_WINDOW
        while _call_times and _call_times[0] < cutoff:
            _call_times.pop(0)

        if len(_call_times) >= _RATE_LIMIT:
            sleep_for = _RATE_WINDOW - (now - _call_times[0]) + 0.1
            if sleep_for > 0:
                time.sleep(sleep_for)
            # Refresh after sleep
            now = time.time()
            cutoff = now - _RATE_WINDOW
            while _call_times and _call_times[0] < cutoff:
                _call_times.pop(0)

        _call_times.append(time.time())


def _get(path: str, params: Optional[dict] = None) -> dict:
    _rate_wait()
    p = {"apikey": _api_key()}
    if params:
        p.update(params)
    resp = requests.get(f"{_TD_BASE}{path}", params=p, headers=_HEADERS, timeout=12)
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, dict) and data.get("status") == "error":
        raise ValueError(data.get("message", "Twelve Data API error"))
    return data


def _f(d: dict, *keys):
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

    # 3 Twelve Data calls — cached 4h so hits daily budget lightly
    quote = _get("/quote", {"symbol": key})
    profile = _get("/profile", {"symbol": key})
    stats_raw = _get("/statistics", {"symbol": key})

    name = quote.get("name") or profile.get("name")
    if not name:
        raise ValueError(f"Unknown ticker '{key}'. Check the symbol and try again.")

    st  = stats_raw.get("statistics", {})
    val = st.get("valuations_metrics", {})
    fin = st.get("financials", {})
    div = st.get("dividends_and_splits", {})
    shr = st.get("shares_stats", {})
    ana = st.get("analysts_outlook", {})
    sps = st.get("stock_price_summary", {})

    w52 = quote.get("fifty_two_week", {})

    result = {
        "ticker":                 key,
        "name":                   name,
        "sector":                 profile.get("sector") or "N/A",
        "industry":               profile.get("industry") or "N/A",
        "market_cap":             _f(val, "market_capitalization"),
        "pe_ratio":               _f(val, "trailing_pe"),
        "forward_pe":             _f(val, "forward_pe"),
        "pb_ratio":               _f(val, "price_to_book_mrq"),
        "ps_ratio":               _f(val, "price_to_sales_ttm"),
        "dividend_yield":         _f(div, "trailing_annual_dividend_yield"),
        "beta":                   _f(sps, "beta"),
        "52w_high":               _f(w52, "high") or _f(sps, "fifty_two_week_high"),
        "52w_low":                _f(w52, "low")  or _f(sps, "fifty_two_week_low"),
        "avg_volume":             _f(quote, "average_volume"),
        "eps":                    _f(fin, "diluted_eps_ttm"),
        "forward_eps":            None,
        "revenue":                _f(fin, "revenue_ttm"),
        "gross_margins":          _f(fin, "gross_profit_ttm") / _f(fin, "revenue_ttm")
                                  if _f(fin, "gross_profit_ttm") and _f(fin, "revenue_ttm") else None,
        "operating_margins":      _f(fin, "operating_margin_ttm"),
        "profit_margins":         _f(fin, "profit_margin"),
        "debt_to_equity":         _f(fin, "total_debt_to_equity_mrq"),
        "free_cashflow":          _f(fin, "levered_free_cash_flow_ttm"),
        "current_price":          _f(quote, "close"),
        "target_mean_price":      _f(ana, "target_mean_price"),
        "recommendation":         ana.get("recommendation_key") or "N/A",
        "num_analyst_opinions":   int(ana["number_of_analyst_opinions"]) if ana.get("number_of_analyst_opinions") else None,
        "short_ratio":            _f(shr, "short_ratio"),
        "short_percent_of_float": _f(shr, "short_percent_of_float"),
        "description":            profile.get("description") or "",
        "website":                profile.get("website") or "",
        "country":                profile.get("country") or "",
        "employees":              int(profile["employees"]) if profile.get("employees") else None,
        "_source":                "twelvedata",
    }

    with _lock_info:
        _cache_info[key] = result
    return result


def _get_ohlcv_df(ticker: str, period: str) -> pd.DataFrame:
    cache_key = (ticker.upper(), period)
    with _lock_ohlcv:
        if cache_key in _cache_ohlcv:
            return _cache_ohlcv[cache_key]

    outputsize = _PERIODS_TO_OUTPUTSIZE.get(period, 66)
    data = _get("/time_series", {
        "symbol":     ticker.upper(),
        "interval":   "1day",
        "outputsize": outputsize,
        "order":      "ASC",        # chronological
    })

    values = data.get("values", [])
    if not values:
        raise ValueError(f"No price data for '{ticker}'. Check the symbol and try again.")

    df = pd.DataFrame(values)
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.set_index("datetime")
    df = df.rename(columns={"open": "Open", "high": "High", "low": "Low",
                             "close": "Close", "volume": "Volume"})
    df = df[["Open", "High", "Low", "Close", "Volume"]].astype(float)
    df.index.name = None

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

    data = _get("/quote", {"symbol": key})
    price = _f(data, "close")
    if not price:
        raise ValueError(f"No price available for '{key}'")

    prev       = _f(data, "previous_close") or price
    change     = _f(data, "change") or round(price - prev, 2)
    change_pct = _f(data, "percent_change") or (round((price - prev) / prev * 100, 2) if prev else 0.0)

    result = {
        "ticker":     key,
        "price":      round(price, 2),
        "prev_close": round(prev, 2),
        "change":     round(change, 2),
        "change_pct": round(change_pct, 2),
        "volume":     int(data.get("volume") or 0) or None,
        "timestamp":  datetime.utcnow().isoformat(),
        "_source":    "twelvedata",
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
        data = _get("/earnings", {
            "symbol":     key,
            "type":       "eps",
            "period":     "quarterly",
            "outputsize": 4,
        })
        items = data.get("earnings", [])
        if not items:
            return []

        def _safe(v):
            try:
                f = float(v)
                return None if math.isnan(f) else f
            except Exception:
                return None

        records = []
        for item in items[:4]:
            date_str = item.get("date", "")
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                quarter = f"Q{((dt.month - 1) // 3) + 1} {dt.year}"
            except Exception:
                quarter = date_str

            actual      = _safe(item.get("eps_actual"))
            estimate    = _safe(item.get("eps_estimate"))
            surprise    = _safe(item.get("surprise_pct"))

            records.append({
                "quarter":      quarter,
                "actual":       actual,
                "estimate":     estimate,
                "surprise_pct": surprise,
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
        data = _get("/symbol_search", {"symbol": query.strip(), "outputsize": limit})
        items = data.get("data", [])
        allowed = {"Common Stock", "ETF"}
        out = [
            {
                "symbol":   item.get("symbol", ""),
                "name":     item.get("instrument_name") or "",
                "exchange": item.get("exchange") or "",
                "type":     item.get("instrument_type", ""),
            }
            for item in items
            if item.get("instrument_type") in allowed
        ][:limit]
        with _lock_search:
            _cache_search[cache_key] = out
        return out
    except Exception:
        return []
