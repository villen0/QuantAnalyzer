import os
import json
from groq import Groq
from typing import Optional


def build_analysis_prompt(ticker: str, info: dict, indicators: dict, news: list, chart_data: list) -> str:
    def m(v):
        if v is None: return "N/A"
        if abs(v) >= 1e12: return f"${v/1e12:.2f}T"
        if abs(v) >= 1e9:  return f"${v/1e9:.2f}B"
        if abs(v) >= 1e6:  return f"${v/1e6:.2f}M"
        return f"${v:,.0f}"

    def pct(v):
        return f"{(v or 0)*100:.1f}%" if v is not None else "N/A"

    recent_prices = chart_data[-10:] if len(chart_data) >= 10 else chart_data
    price_summary = ", ".join([f"{d['date'][:10]}: ${d['close']}" for d in recent_prices])

    news_summary = ""
    if news:
        for item in news[:8]:
            news_summary += f"  - [{item['sentiment'].upper()}] {item['title']} ({item['source']}, {item['published'][:10]})\n"
    else:
        news_summary = "  No recent news available.\n"

    sr            = indicators.get("support_resistance", {})
    fib           = indicators.get("fibonacci", {})
    volume_ratio  = indicators.get("volume_ratio")
    atr           = indicators.get("atr")
    current_price = indicators.get("current_price")

    prompt = f"""You are a senior quantitative analyst. Analyze {ticker} ({info.get('name', ticker)}) using fundamentals and price action to deliver a precise BUY / SELL / HOLD recommendation.

═══════════════════════════════════════
COMPANY & FUNDAMENTALS
═══════════════════════════════════════
Sector: {info.get('sector', 'N/A')} | Industry: {info.get('industry', 'N/A')}
Market Cap: {m(info.get('market_cap'))} | Beta: {info.get('beta') or 'N/A'}
Current Price: ${current_price} | 52W High: {info.get('52w_high') or 'N/A'} | 52W Low: {info.get('52w_low') or 'N/A'}
P/E (TTM): {info.get('pe_ratio') or 'N/A'} | P/B: {info.get('pb_ratio') or 'N/A'} | P/S: {info.get('ps_ratio') or 'N/A'}
EPS (TTM): {info.get('eps') or 'N/A'} | Revenue: {m(info.get('revenue'))}
Gross Margin: {pct(info.get('gross_margins'))} | Op Margin: {pct(info.get('operating_margins'))} | Net Margin: {pct(info.get('profit_margins'))}
Debt/Equity: {info.get('debt_to_equity') or 'N/A'} | Free Cash Flow: {m(info.get('free_cashflow'))}
Dividend Yield: {pct(info.get('dividend_yield')) if info.get('dividend_yield') else 'N/A'}

═══════════════════════════════════════
TREND & PRICE ACTION
═══════════════════════════════════════
ATR(14): {atr} (volatility / position sizing)

Moving Averages:
  EMA9: ${indicators.get('ema9', 'N/A')} | EMA21: ${indicators.get('ema21', 'N/A')}
  SMA20: ${indicators.get('sma20', 'N/A')} | SMA50: ${indicators.get('sma50', 'N/A')}
  SMA100: ${indicators.get('sma100', 'N/A')} | SMA200: ${indicators.get('sma200', 'N/A')}
  Price vs SMA50: {"ABOVE ✓" if indicators.get('price_above_sma50') else "BELOW ✗"}
  Price vs SMA200: {"ABOVE ✓" if indicators.get('price_above_sma200') else "BELOW ✗"}
  {"⚡ GOLDEN CROSS (50/200) detected!" if indicators.get('golden_cross_50_200') else ""}
  {"💀 DEATH CROSS (50/200) detected!" if indicators.get('death_cross_50_200') else ""}

Support & Resistance (Pivot Points):
  Resistance 2: ${sr.get('r2', 'N/A')} | Resistance 1: ${sr.get('r1', 'N/A')}
  Pivot: ${sr.get('pivot', 'N/A')}
  Support 1: ${sr.get('s1', 'N/A')} | Support 2: ${sr.get('s2', 'N/A')}
  Range Support: ${sr.get('support', 'N/A')} | Range Resistance: ${sr.get('resistance', 'N/A')}

Fibonacci Retracement (last 50 bars):
  High: ${fib.get('1.0', 'N/A')} | 0.786: ${fib.get('0.786', 'N/A')} | 0.618: ${fib.get('0.618', 'N/A')}
  0.5: ${fib.get('0.5', 'N/A')} | 0.382: ${fib.get('0.382', 'N/A')} | Low: ${fib.get('0.0', 'N/A')}

Volume:
  Current: {(indicators.get('volume') or 0):,} | 20d Avg: {(indicators.get('avg_volume_20') or 0):,}
  Ratio: {f'{volume_ratio:.2f}x' if volume_ratio else 'N/A'} {"→ HIGH volume (confirms move)" if volume_ratio and volume_ratio > 1.5 else "→ Low volume (weak)" if volume_ratio and volume_ratio < 0.7 else "→ Normal volume"}

Recent Prices (last 10 bars):
{price_summary}

═══════════════════════════════════════
NEWS SENTIMENT
═══════════════════════════════════════
{news_summary}
═══════════════════════════════════════
REQUIRED OUTPUT (strict JSON only)
═══════════════════════════════════════
{{
  "decision": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": <integer 0-100>,
  "entry_price": <float or null>,
  "stop_loss": <float or null>,
  "profit_target": <float or null>,
  "risk_reward_ratio": <float or null>,
  "time_horizon": "short-term (days)" | "medium-term (weeks)" | "long-term (months)",
  "trend": {{
    "daily": "bullish" | "bearish" | "neutral",
    "weekly": "bullish" | "bearish" | "neutral",
    "overall": "bullish" | "bearish" | "neutral"
  }},
  "technical_summary": "<2-3 sentences on price action, trend, and key levels>",
  "fundamental_summary": "<2-3 sentences on valuation and financial health>",
  "risk_factors": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "catalysts": ["<catalyst 1>", "<catalyst 2>"],
  "news_sentiment": "bullish" | "bearish" | "neutral" | "mixed",
  "key_levels": {{
    "must_hold": <float>,
    "breakout_target": <float>
  }},
  "reasoning": "<3-5 sentences with specific price levels, valuations, and news>"
}}

Output ONLY valid JSON. No markdown, no extra text."""
    return prompt


def analyze_stock(ticker: str, info: dict, indicators: dict, news: list, chart_data: list, api_key: Optional[str] = None) -> dict:
    key = api_key or os.environ.get("GROQ_API_KEY", "")
    if not key:
        return _fallback_analysis(ticker, indicators, info)

    client = Groq(api_key=key)
    prompt = build_analysis_prompt(ticker, info, indicators, news, chart_data)

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2048,
            messages=[
                {"role": "system", "content": "You are an elite quantitative analyst. Always respond with valid JSON only. No markdown, no extra text."},
                {"role": "user", "content": prompt},
            ],
        )
        raw = completion.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw)
        result["source"] = "groq-llama-3.3-70b"
        result["ticker"] = ticker.upper()
        return result
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse error: {e}", "raw": raw, "ticker": ticker.upper()}
    except Exception as e:
        return {"error": str(e), "ticker": ticker.upper()}


def _fallback_analysis(ticker: str, indicators: dict, info: dict) -> dict:
    """Rule-based fallback when no Groq API key is provided."""
    score = 0
    price_above_sma50  = indicators.get("price_above_sma50")
    price_above_sma200 = indicators.get("price_above_sma200")
    volume_ratio       = indicators.get("volume_ratio")

    if price_above_sma50:
        score += 1
    elif price_above_sma50 is False:
        score -= 1

    if price_above_sma200:
        score += 1
    elif price_above_sma200 is False:
        score -= 1

    if volume_ratio and volume_ratio > 1.5:
        score += 1 if score > 0 else -1

    if indicators.get("golden_cross_50_200"):
        score += 2
    if indicators.get("death_cross_50_200"):
        score -= 2

    if score >= 3:
        decision, confidence = "BUY", 60
    elif score <= -3:
        decision, confidence = "SELL", 60
    else:
        decision, confidence = "HOLD", 50

    sr    = indicators.get("support_resistance", {})
    price = indicators.get("current_price", 0)
    atr   = indicators.get("atr") or 0

    def _mc(v):
        if v is None: return "N/A"
        if abs(v) >= 1e9: return f"${v/1e9:.1f}B"
        if abs(v) >= 1e6: return f"${v/1e6:.1f}M"
        return f"${v:,.0f}"

    return {
        "ticker":             ticker.upper(),
        "decision":           decision,
        "confidence":         confidence,
        "entry_price":        round(price, 2),
        "stop_loss":          round(price - 2 * atr, 2) if atr else None,
        "profit_target":      round(price + 3 * atr, 2) if atr else None,
        "risk_reward_ratio":  1.5,
        "time_horizon":       "medium-term (weeks)",
        "trend": {
            "daily":   "bullish" if score > 0 else "bearish" if score < 0 else "neutral",
            "weekly":  "bullish" if price_above_sma50  else "bearish",
            "overall": "bullish" if price_above_sma200 else "bearish",
        },
        "technical_summary":   f"Price is {'above' if price_above_sma200 else 'below'} SMA200. Add GROQ_API_KEY for full AI analysis.",
        "fundamental_summary": f"P/E: {info.get('pe_ratio') or 'N/A'}, Market Cap: {_mc(info.get('market_cap'))}.",
        "risk_factors":        ["No API key — analysis is rule-based only", "Verify with full AI analysis"],
        "catalysts":           ["Technical setup based on moving averages"],
        "news_sentiment":      "neutral",
        "key_levels": {
            "must_hold":       sr.get("s1") or sr.get("support"),
            "breakout_target": sr.get("r1") or sr.get("resistance"),
        },
        "reasoning": f"Score-based decision ({score} points from SMA signals). Set GROQ_API_KEY for comprehensive AI analysis.",
        "source":    "rule-based-fallback",
    }
