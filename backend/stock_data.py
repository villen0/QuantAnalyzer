import math
import os
import threading
from datetime import datetime
from typing import Optional

import requests
import pandas as pd
from cachetools import TTLCache

_FMP_BASE = "https://financialmodelingprep.com/api"

_lock_info   = threading.RLock()
_lock_ohlcv  = threading.RLock()
_lock_price  = threading.RLock()
_lock_earn   = threading.RLock()
_lock_search = threading.RLock()

_cache_info   = TTLCache(maxsize=128, ttl=86400)  # 24h — fundamentals (FMP 250/day budget)
_cache_ohlcv  = TTLCache(maxsize=256, ttl=7200)   # 2h  — OHLCV / indicators
_cache_price  = TTLCache(maxsize=128, ttl=600)    # 10min — live price
_cache_earn   = TTLCache(maxsize=128, ttl=86400)  # 24h — earnings
_cache_search = TTLCache(maxsize=64,  ttl=600)    # 10min — search

_PERIODS_TO_DAYS = {
    "1mo": 32, "3mo": 93, "6mo": 185, "1y": 366, "2y": 732, "5y": 1827,
}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}


def _api_key() -> str:
    return os.environ.get("FMP_API_KEY", "demo")


def _get(path: str, params: Optional[dict] = None):
    url = f"{_FMP_BASE}{path}"
    p = {"apikey": _api_key()}
    if params:
        p.update(params)
    resp = requests.get(url, params=p, headers=_HEADERS, timeout=12)
    resp.raise_for_status()
    return resp.json()


def _f(d: dict, *keys):
    """Safe float: returns the first non-None, non-NaN numeric value from d[key]."""
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

    # 3 FMP calls — cached 24h so costs ~3 req/ticker/day
    quote_list   = _get(f"/v3/quote/{key}")
    profile_list = _get(f"/v3/profile/{key}")
    ratios_list  = _get(f"/v3/ratios-ttm/{key}")

    q = (quote_list   if isinstance(quote_list,   list) and quote_list   else [{}])[0]
    p = (profile_list if isinstance(profile_list, list) and profile_list else [{}])[0]
    r = (ratios_list  if isinstance(ratios_list,  list) and ratios_list  else [{}])[0]

    if not q.get("name") and not p.get("companyName"):
        raise ValueError(f"Unknown ticker '{key}'. Check the symbol and try again.")

    market_cap  = _f(q, "marketCap")
    ps_ratio    = _f(r, "priceToSalesRatioTTM", "priceSalesRatioTTM")
    revenue     = round(market_cap / ps_ratio, 0) if market_cap and ps_ratio else None

    fcf_per_share = _f(r, "freeCashFlowPerShareTTM")
    shares        = _f(q, "sharesOutstanding")
    free_cashflow = round(fcf_per_share * shares, 0) if fcf_per_share and shares else None

    result = {
        "ticker":                 key,
        "name":                   p.get("companyName") or q.get("name") or key,
        "sector":                 p.get("sector") or "N/A",
        "industry":               p.get("industry") or "N/A",
        "market_cap":             market_cap,
        "pe_ratio":               _f(q, "pe"),
        "forward_pe":             None,
        "pb_ratio":               _f(r, "priceToBookRatioTTM"),
        "ps_ratio":               ps_ratio,
        "dividend_yield":         _f(r, "dividendYieldTTM", "dividendYielTTM"),
        "beta":                   _f(p, "beta") or _f(q, "beta"),
        "52w_high":               _f(q, "yearHigh"),
        "52w_low":                _f(q, "yearLow"),
        "avg_volume":             _f(q, "avgVolume"),
        "eps":                    _f(q, "eps"),
        "forward_eps":            None,
        "revenue":                revenue,
        "gross_margins":          _f(r, "grossProfitMarginTTM"),
        "operating_margins":      _f(r, "operatingProfitMarginTTM"),
        "profit_margins":         _f(r, "netProfitMarginTTM"),
        "debt_to_equity":         _f(r, "debtEquityRatioTTM"),
        "free_cashflow":          free_cashflow,
        "current_price":          _f(q, "price"),
        "target_mean_price":      None,
        "recommendation":         "N/A",
        "num_analyst_opinions":   None,
        "short_ratio":            None,
        "short_percent_of_float": None,
        "description":            p.get("description") or "",
        "website":                p.get("website") or "",
        "country":                p.get("country") or "",
        "employees":              int(p["fullTimeEmployees"]) if p.get("fullTimeEmployees") else None,
        "_source":                "fmp",
    }

    with _lock_info:
        _cache_info[key] = result
    return result


def _get_ohlcv_df(ticker: str, period: str) -> pd.DataFrame:
    cache_key = (ticker.upper(), period)
    with _lock_ohlcv:
        if cache_key in _cache_ohlcv:
            return _cache_ohlcv[cache_key]

    days = _PERIODS_TO_DAYS.get(period, 93)
    data = _get(f"/v3/historical-price-full/{ticker.upper()}", {"timeseries": days})

    historical = data.get("historical", []) if isinstance(data, dict) else []
    if not historical:
        raise ValueError(f"No price data for '{ticker}'. Check the symbol and try again.")

    # FMP returns newest-first — reverse to chronological order
    rows = list(reversed(historical))

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date")
    df = df.rename(columns={"open": "Open", "high": "High", "low": "Low",
                             "close": "Close", "volume": "Volume"})
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
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

    data = _get(f"/v3/quote/{key}")
    q = (data if isinstance(data, list) and data else [{}])[0]

    price = _f(q, "price")
    if not price:
        raise ValueError(f"No price available for '{key}'")

    prev       = _f(q, "previousClose") or price
    change     = _f(q, "change") or round(price - prev, 2)
    change_pct = _f(q, "changesPercentage") or (round((price - prev) / prev * 100, 2) if prev else 0.0)

    result = {
        "ticker":     key,
        "price":      round(price, 2),
        "prev_close": round(prev, 2),
        "change":     round(change, 2),
        "change_pct": round(change_pct, 2),
        "volume":     int(q.get("volume") or 0) or None,
        "timestamp":  datetime.utcnow().isoformat(),
        "_source":    "fmp",
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
        data = _get(f"/v3/earnings-surprises/{key}")
        if not data or not isinstance(data, list):
            return []

        def _safe(v):
            try:
                f = float(v)
                return None if math.isnan(f) else f
            except Exception:
                return None

        records = []
        for item in data[:4]:
            date_str = item.get("date", "")
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                quarter = f"Q{((dt.month - 1) // 3) + 1} {dt.year}"
            except Exception:
                quarter = date_str

            actual   = _safe(item.get("actualEarningResult"))
            estimate = _safe(item.get("estimatedEarning"))
            surprise = None
            if actual is not None and estimate is not None and estimate != 0:
                surprise = round((actual - estimate) / abs(estimate) * 100, 2)

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
        data = _get("/v3/search", {"query": query.strip(), "limit": limit})
        if not isinstance(data, list):
            return []
        out = [
            {
                "symbol":   item.get("symbol", ""),
                "name":     item.get("name") or "",
                "exchange": item.get("stockExchange") or item.get("exchangeShortName") or "",
                "type":     "STOCK",
            }
            for item in data
            if item.get("symbol")
        ][:limit]
        with _lock_search:
            _cache_search[cache_key] = out
        return out
    except Exception:
        return []
