import yfinance as yf
import pandas as pd
from datetime import datetime
from typing import Optional


def _live_available(ticker: str) -> bool:
    """Quick check if Yahoo Finance is reachable."""
    try:
        stock = yf.Ticker(ticker)
        hist = stock.history(period="2d", timeout=4)
        return not hist.empty
    except Exception:
        return False


def fetch_stock_info(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if info is None or not isinstance(info, dict):
            raise ValueError("No info returned")
        # Check we got something useful
        if not info.get("longName") and not info.get("shortName") and not info.get("currentPrice"):
            raise ValueError("Empty info")
        return {
            "ticker": ticker.upper(),
            "name": info.get("longName") or info.get("shortName", ticker.upper()),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "pb_ratio": info.get("priceToBook"),
            "ps_ratio": info.get("priceToSalesTrailing12Months"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
            "52w_high": info.get("fiftyTwoWeekHigh"),
            "52w_low": info.get("fiftyTwoWeekLow"),
            "avg_volume": info.get("averageVolume"),
            "eps": info.get("trailingEps"),
            "forward_eps": info.get("forwardEps"),
            "revenue": info.get("totalRevenue"),
            "gross_margins": info.get("grossMargins"),
            "operating_margins": info.get("operatingMargins"),
            "profit_margins": info.get("profitMargins"),
            "debt_to_equity": info.get("debtToEquity"),
            "free_cashflow": info.get("freeCashflow"),
            "current_price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "target_mean_price": info.get("targetMeanPrice"),
            "recommendation": info.get("recommendationKey", "N/A"),
            "num_analyst_opinions": info.get("numberOfAnalystOpinions"),
            "short_ratio": info.get("shortRatio"),
            "short_percent_of_float": info.get("shortPercentOfFloat"),
            "earnings_date": str(info.get("earningsTimestamp", "")) if info.get("earningsTimestamp") else None,
            "description": info.get("longBusinessSummary", ""),
            "website": info.get("website", ""),
            "country": info.get("country", ""),
            "employees": info.get("fullTimeEmployees"),
            "_source": "live",
        }
    except Exception:
        from mock_data import mock_stock_info
        result = mock_stock_info(ticker)
        result["_source"] = "mock"
        return result


def fetch_ohlcv(ticker: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval, timeout=10)
        if df.empty:
            raise ValueError("Empty dataframe")
        df.index = pd.to_datetime(df.index)
        df.index = df.index.tz_localize(None)
        return df
    except Exception:
        # Build mock DataFrame
        from mock_data import mock_ohlcv_for_chart
        bars = mock_ohlcv_for_chart(ticker, period)
        records = []
        for b in bars:
            records.append({
                "Open": b["open"],
                "High": b["high"],
                "Low": b["low"],
                "Close": b["close"],
                "Volume": b["volume"],
                "Dividends": 0,
                "Stock Splits": 0,
            })
        if not records:
            return pd.DataFrame()
        df = pd.DataFrame(records)
        df.index = pd.to_datetime([b["date"] for b in bars])
        return df


def fetch_ohlcv_for_chart(ticker: str, period: str = "3mo", interval: str = "1d") -> list:
    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=period, interval=interval, timeout=10)
        if df.empty:
            raise ValueError("Empty")
        df.index = pd.to_datetime(df.index)
        df.index = df.index.tz_localize(None)
        records = []
        for ts, row in df.iterrows():
            records.append({
                "date": ts.strftime("%Y-%m-%d %H:%M"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        return records
    except Exception:
        from mock_data import mock_ohlcv_for_chart
        return mock_ohlcv_for_chart(ticker, period)


def fetch_realtime_price(ticker: str) -> dict:
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        if not info:
            raise ValueError("No info")
        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose")
        prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
        if not price:
            raise ValueError("No price")
        change = price - prev_close if price and prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close else 0
        return {
            "ticker": ticker.upper(),
            "price": round(price, 2),
            "prev_close": round(prev_close, 2) if prev_close else None,
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume": info.get("volume") or info.get("regularMarketVolume"),
            "timestamp": datetime.utcnow().isoformat(),
            "_source": "live",
        }
    except Exception:
        from mock_data import mock_realtime_price
        result = mock_realtime_price(ticker)
        result["_source"] = "mock"
        return result


def fetch_earnings_history(ticker: str) -> list:
    try:
        stock = yf.Ticker(ticker)
        earnings = stock.quarterly_earnings
        if earnings is None or earnings.empty:
            raise ValueError("No earnings")
        records = []
        for idx, row in earnings.iterrows():
            records.append({
                "quarter": str(idx),
                "actual": row.get("Actual"),
                "estimate": row.get("Estimate"),
                "surprise_pct": row.get("Surprise(%)"),
            })
        return records[:4]
    except Exception:
        from mock_data import mock_earnings
        return mock_earnings(ticker)
