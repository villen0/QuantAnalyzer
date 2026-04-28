import yfinance as yf
from datetime import datetime
from typing import Optional


def fetch_stock_news(ticker: str, limit: int = 15) -> list:
    try:
        stock = yf.Ticker(ticker)
        raw_news = stock.news or []
        if not raw_news:
            raise ValueError("No news")
        articles = []
        for item in raw_news[:limit]:
            content = item.get("content", {})
            pub_date = content.get("pubDate") or ""
            try:
                parsed_date = datetime.fromisoformat(pub_date.replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M")
            except Exception:
                parsed_date = pub_date

            provider = content.get("provider", {})
            thumbnail = content.get("thumbnail", {})
            resolutions = thumbnail.get("resolutions", []) if thumbnail else []
            img_url = resolutions[0].get("url", "") if resolutions else ""

            articles.append({
                "title": content.get("title", ""),
                "summary": content.get("summary", ""),
                "url": content.get("canonicalUrl", {}).get("url", "") if content.get("canonicalUrl") else "",
                "source": provider.get("displayName", "") if provider else "",
                "published": parsed_date,
                "image": img_url,
                "sentiment": _basic_sentiment(content.get("title", "") + " " + content.get("summary", "")),
            })
        if not articles:
            raise ValueError("Empty articles")
        return articles
    except Exception:
        from mock_data import mock_news
        return mock_news(ticker)[:limit]


def _basic_sentiment(text: str) -> str:
    text_lower = text.lower()
    bullish_words = [
        "surge", "soar", "rally", "beat", "record", "growth", "profit", "gain",
        "upgrade", "outperform", "buy", "strong", "positive", "rise", "boost",
        "bullish", "opportunity", "exceed", "optimistic", "recovery", "breakout",
        "momentum", "high", "above", "better", "approve",
    ]
    bearish_words = [
        "fall", "drop", "decline", "miss", "loss", "weak", "downgrade", "sell",
        "underperform", "bearish", "risk", "concern", "warning", "cut", "lower",
        "poor", "disappointing", "recession", "crash", "plunge", "tumble", "below",
        "worse", "layoff", "bankrupt", "sue", "investigation", "fine", "debt",
    ]
    bull_score = sum(1 for w in bullish_words if w in text_lower)
    bear_score = sum(1 for w in bearish_words if w in text_lower)
    if bull_score > bear_score:
        return "bullish"
    elif bear_score > bull_score:
        return "bearish"
    return "neutral"
