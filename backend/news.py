import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from urllib.parse import quote


def fetch_stock_news(ticker: str, limit: int = 15) -> list:
    articles = _fetch_google_news(ticker, limit)
    if not articles:
        articles = _fetch_yahoo_rss(ticker, limit)
    if not articles:
        from mock_data import mock_news
        return mock_news(ticker)[:limit]
    return articles[:limit]


def _fetch_google_news(ticker: str, limit: int) -> list:
    query = quote(f"{ticker} stock")
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return []
        articles = []
        for item in channel.findall("item")[:limit]:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            source_el = item.find("{http://purl.org/rss/1.0/modules/content/}encoded")
            source = item.findtext("source") or ""
            try:
                parsed = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%d %H:%M")
            except Exception:
                parsed = pub_date[:16] if pub_date else ""
            articles.append({
                "title": title,
                "summary": "",
                "url": link,
                "source": source,
                "published": parsed,
                "image": "",
                "sentiment": _basic_sentiment(title),
            })
        return articles
    except Exception:
        return []


def _fetch_yahoo_rss(ticker: str, limit: int) -> list:
    url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        channel = root.find("channel")
        if channel is None:
            return []
        articles = []
        for item in channel.findall("item")[:limit]:
            title = item.findtext("title", "")
            link = item.findtext("link", "")
            pub_date = item.findtext("pubDate", "")
            desc = item.findtext("description", "")
            try:
                parsed = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z").strftime("%Y-%m-%d %H:%M")
            except Exception:
                parsed = pub_date[:16] if pub_date else ""
            articles.append({
                "title": title,
                "summary": desc,
                "url": link,
                "source": "Yahoo Finance",
                "published": parsed,
                "image": "",
                "sentiment": _basic_sentiment(title + " " + desc),
            })
        return articles
    except Exception:
        return []


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
