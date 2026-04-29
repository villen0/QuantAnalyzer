import os
import time
import requests
import pandas as pd
from datetime import datetime, timezone, timedelta

_BASE = "https://api.twelvedata.com"
_HEADERS = {"User-Agent": "QuantAnalyzer/1.0"}

# Trading-day outputsize per period
_PERIOD_SIZE = {
    "1mo": 30, "3mo": 90, "6mo": 185,
    "1y": 260, "2y": 520, "5y": 1300,
}


def _key() -> str:
    k = os.environ.get("TWELVE_DATA_KEY", "")
    if not k:
        raise RuntimeError(
            "TWELVE_DATA_KEY is not set. "
            "Get a free key at twelvedata.com and add it to your Render environment."
        )
    return k


def _get(path: str, **params) -> dict:
    params["apikey"] = _key()
    for attempt in range(3):
        r = requests.get(
            f"{_BASE}{path}", params=params,
            headers=_HEADERS, timeout=15,
        )
        if r.status_code == 429:
            time.sleep(2 ** attempt)
            continue
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("status") == "error":
            raise ValueError(data.get("message", f"Twelve Data error for {path}"))
        return data
    raise RuntimeError("Twelve Data rate limit — please try again in a moment.")


def _f(d: dict, *keys):
    """Safe float extraction from nested dict."""
    for k in keys:
        v = d.get(k)
        if v not in (None, "", "N/A", "-", "None"):
            try:
                return float(v)
            except (ValueError, TypeError):
                pass
    return None


def fetch_stock_info(ticker: str) -> dict:
    quote = _get("/quote", symbol=ticker)
    if not quote.get("name"):
        raise ValueError(f"Unknown ticker '{ticker}'. Check the symbol and try again.")

    # Statistics — may not be available on all free plans; handled gracefully
    try:
        stats  = _get("/statistics", symbol=ticker).get("statistics", {})
        vm     = stats.get("valuations_metrics", {})
        inc    = stats.get("financials", {}).get("income_statement", {})
        bs     = stats.get("financials", {}).get("balance_sheet", {})
        cf     = stats.get("financials", {}).get("cash_flow_statement", {})
        stk    = stats.get("stock_statistics", {})
    except Exception:
        vm = inc = bs = cf = stk = {}

    fw52 = quote.get("fifty_two_week", {})

    return {
        "ticker":                 ticker.upper(),
        "name":                   quote.get("name", ticker.upper()),
        "sector":                 quote.get("sector") or "N/A",
        "industry":               quote.get("industry") or "N/A",
        "market_cap":             _f(quote, "market_cap"),
        "pe_ratio":               _f(vm, "trailing_pe"),
        "forward_pe":             _f(vm, "forward_pe"),
        "pb_ratio":               _f(vm, "price_to_book_mrq"),
        "ps_ratio":               _f(vm, "price_to_sales_ttm"),
        "dividend_yield":         _f(quote, "dividend_yield"),
        "beta":                   _f(quote, "beta"),
        "52w_high":               _f(fw52, "high"),
        "52w_low":                _f(fw52, "low"),
        "avg_volume":             _f(quote, "average_volume"),
        "eps":                    _f(vm, "trailing_eps"),
        "forward_eps":            _f(vm, "forward_eps"),
        "revenue":                _f(inc, "total_revenue"),
        "gross_margins":          _f(inc, "gross_profit_margin"),
        "operating_margins":      _f(inc, "operating_income_margin"),
        "profit_margins":         _f(inc, "net_profit_margin"),
        "debt_to_equity":         _f(bs, "total_debt_to_equity_mrq"),
        "free_cashflow":          _f(cf, "free_cash_flow"),
        "current_price":          _f(quote, "close"),
        "target_mean_price":      None,
        "recommendation":         "N/A",
        "num_analyst_opinions":   None,
        "short_ratio":            _f(stk, "short_ratio"),
        "short_percent_of_float": _f(stk, "short_percent_of_float"),
        "description":            "",
        "website":                "",
        "country":                quote.get("country", ""),
        "employees":              None,
        "_source":                "live",
    }


def _parse_series(data: dict) -> list[dict]:
    values = data.get("values", [])
    if not values:
        raise ValueError("Empty time series")
    records = []
    for bar in values:
        records.append({
            "date":   bar["datetime"] + " 00:00" if len(bar["datetime"]) == 10 else bar["datetime"],
            "open":   round(float(bar["open"]), 4),
            "high":   round(float(bar["high"]), 4),
            "low":    round(float(bar["low"]), 4),
            "close":  round(float(bar["close"]), 4),
            "volume": int(bar.get("volume", 0) or 0),
        })
    # Twelve Data returns newest-first; sort chronologically
    records.sort(key=lambda x: x["date"])
    return records


def fetch_ohlcv(ticker: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    size = _PERIOD_SIZE.get(period, 90)
    data = _get("/time_series", symbol=ticker, interval="1day", outputsize=size)
    bars = _parse_series(data)
    df = pd.DataFrame([{
        "Open": b["open"], "High": b["high"], "Low": b["low"],
        "Close": b["close"], "Volume": b["volume"],
        "Dividends": 0, "Stock Splits": 0,
    } for b in bars])
    df.index = pd.to_datetime([b["date"] for b in bars])
    return df


def fetch_ohlcv_for_chart(ticker: str, period: str = "3mo", interval: str = "1d") -> list:
    size = _PERIOD_SIZE.get(period, 90)
    data = _get("/time_series", symbol=ticker, interval="1day", outputsize=size)
    return _parse_series(data)


def fetch_realtime_price(ticker: str) -> dict:
    quote = _get("/quote", symbol=ticker)
    price = _f(quote, "close")
    if not price:
        raise ValueError(f"No price for {ticker}")
    prev_close = _f(quote, "previous_close") or price
    change     = _f(quote, "change") or 0.0
    change_pct = _f(quote, "percent_change") or 0.0
    return {
        "ticker":     ticker.upper(),
        "price":      round(price, 2),
        "prev_close": round(prev_close, 2),
        "change":     round(change, 2),
        "change_pct": round(change_pct, 2),
        "volume":     int(_f(quote, "volume") or 0) or None,
        "timestamp":  datetime.utcnow().isoformat(),
        "_source":    "live",
    }


def search_symbols(query: str, limit: int = 8) -> list:
    try:
        data = _get("/symbol_search", symbol=query, outputsize=limit)
        results = data.get("data", [])
        out = []
        for r in results:
            if r.get("instrument_type") not in ("Common Stock", "ETF", "Index"):
                continue
            out.append({
                "symbol":   r.get("symbol", ""),
                "name":     r.get("instrument_name", ""),
                "exchange": r.get("exchange", ""),
                "type":     r.get("instrument_type", ""),
            })
        return out[:limit]
    except Exception:
        return []


def fetch_earnings_history(ticker: str) -> list:
    try:
        data = _get("/earnings", symbol=ticker, type="quarterly")
        earnings = data.get("earnings", data if isinstance(data, list) else [])
        records = []
        for item in earnings[:4]:
            records.append({
                "quarter":      item.get("period", ""),
                "actual":       _f(item, "actual"),
                "estimate":     _f(item, "estimate"),
                "surprise_pct": _f(item, "surprise_percent"),
            })
        return records
    except Exception:
        return []
