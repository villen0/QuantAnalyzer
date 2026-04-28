import pandas as pd
import numpy as np


def compute_rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def compute_macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def compute_bollinger_bands(close: pd.Series, period: int = 20, std_dev: float = 2.0):
    sma = close.rolling(window=period).mean()
    std = close.rolling(window=period).std()
    upper = sma + std_dev * std
    lower = sma - std_dev * std
    return upper, sma, lower


def compute_sma(close: pd.Series, period: int) -> pd.Series:
    return close.rolling(window=period).mean()


def compute_ema(close: pd.Series, period: int) -> pd.Series:
    return close.ewm(span=period, adjust=False).mean()


def compute_vwap(df: pd.DataFrame) -> pd.Series:
    typical_price = (df["High"] + df["Low"] + df["Close"]) / 3
    vwap = (typical_price * df["Volume"]).cumsum() / df["Volume"].cumsum()
    return vwap


def compute_atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_low = df["High"] - df["Low"]
    high_close = (df["High"] - df["Close"].shift()).abs()
    low_close = (df["Low"] - df["Close"].shift()).abs()
    true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return true_range.rolling(window=period).mean()


def compute_stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    low_min = df["Low"].rolling(window=k_period).min()
    high_max = df["High"].rolling(window=k_period).max()
    k = 100 * (df["Close"] - low_min) / (high_max - low_min).replace(0, np.nan)
    d = k.rolling(window=d_period).mean()
    return k, d


def compute_fibonacci_levels(df: pd.DataFrame, lookback: int = 50):
    recent = df.tail(lookback)
    high = recent["High"].max()
    low = recent["Low"].min()
    diff = high - low
    levels = {
        "0.0": low,
        "0.236": low + 0.236 * diff,
        "0.382": low + 0.382 * diff,
        "0.5": low + 0.5 * diff,
        "0.618": low + 0.618 * diff,
        "0.786": low + 0.786 * diff,
        "1.0": high,
    }
    return levels


def compute_support_resistance(df: pd.DataFrame, lookback: int = 60):
    recent = df.tail(lookback)
    closes = recent["Close"]
    support = float(closes.min())
    resistance = float(closes.max())

    # Pivot points from recent high/low/close
    pivot = (recent["High"].iloc[-1] + recent["Low"].iloc[-1] + recent["Close"].iloc[-1]) / 3
    r1 = 2 * pivot - recent["Low"].iloc[-1]
    s1 = 2 * pivot - recent["High"].iloc[-1]
    r2 = pivot + (recent["High"].iloc[-1] - recent["Low"].iloc[-1])
    s2 = pivot - (recent["High"].iloc[-1] - recent["Low"].iloc[-1])

    return {
        "support": round(float(support), 2),
        "resistance": round(float(resistance), 2),
        "pivot": round(float(pivot), 2),
        "r1": round(float(r1), 2),
        "r2": round(float(r2), 2),
        "s1": round(float(s1), 2),
        "s2": round(float(s2), 2),
    }


def compute_all_indicators(df: pd.DataFrame) -> dict:
    close = df["Close"]
    volume = df["Volume"]

    rsi = compute_rsi(close)
    macd_line, signal_line, macd_hist = compute_macd(close)
    bb_upper, bb_mid, bb_lower = compute_bollinger_bands(close)
    sma20 = compute_sma(close, 20)
    sma50 = compute_sma(close, 50)
    sma100 = compute_sma(close, 100)
    sma200 = compute_sma(close, 200)
    ema9 = compute_ema(close, 9)
    ema21 = compute_ema(close, 21)
    atr = compute_atr(df)
    stoch_k, stoch_d = compute_stochastic(df)
    avg_volume = volume.rolling(20).mean()
    volume_ratio = volume / avg_volume.replace(0, np.nan)

    last = -1
    current_price = float(close.iloc[last])
    fib = compute_fibonacci_levels(df)
    sr = compute_support_resistance(df)

    def safe_float(series, idx=-1):
        val = series.iloc[idx]
        if pd.isna(val):
            return None
        return round(float(val), 4)

    # MA crossover signals — cast to Python bool to avoid numpy.bool_ serialization issues
    golden_cross_50_200 = bool(
        sma50.iloc[-1] > sma200.iloc[-1] and sma50.iloc[-2] <= sma200.iloc[-2]
        if len(df) > 2 else False
    )
    death_cross_50_200 = bool(
        sma50.iloc[-1] < sma200.iloc[-1] and sma50.iloc[-2] >= sma200.iloc[-2]
        if len(df) > 2 else False
    )

    sma200_val = safe_float(sma200)
    sma50_val = safe_float(sma50)
    price_above_sma200 = bool(current_price > sma200_val) if sma200_val is not None else None
    price_above_sma50 = bool(current_price > sma50_val) if sma50_val is not None else None

    bb_width = (bb_upper.iloc[last] - bb_lower.iloc[last]) / bb_mid.iloc[last] if not pd.isna(bb_mid.iloc[last]) else None
    bb_position = (current_price - bb_lower.iloc[last]) / (bb_upper.iloc[last] - bb_lower.iloc[last]) if not pd.isna(bb_lower.iloc[last]) else None

    return {
        "current_price": current_price,
        "rsi": safe_float(rsi),
        "macd": safe_float(macd_line),
        "macd_signal": safe_float(signal_line),
        "macd_histogram": safe_float(macd_hist),
        "bb_upper": safe_float(bb_upper),
        "bb_mid": safe_float(bb_mid),
        "bb_lower": safe_float(bb_lower),
        "bb_width": round(bb_width, 4) if bb_width else None,
        "bb_position": round(bb_position, 4) if bb_position else None,
        "sma20": safe_float(sma20),
        "sma50": safe_float(sma50),
        "sma100": safe_float(sma100),
        "sma200": safe_float(sma200),
        "ema9": safe_float(ema9),
        "ema21": safe_float(ema21),
        "atr": safe_float(atr),
        "stoch_k": safe_float(stoch_k),
        "stoch_d": safe_float(stoch_d),
        "volume": int(volume.iloc[last]),
        "avg_volume_20": int(avg_volume.iloc[last]) if not pd.isna(avg_volume.iloc[last]) else None,
        "volume_ratio": safe_float(volume_ratio),
        "price_above_sma200": price_above_sma200,
        "price_above_sma50": price_above_sma50,
        "golden_cross_50_200": golden_cross_50_200,
        "death_cross_50_200": death_cross_50_200,
        "fibonacci": {k: round(v, 2) for k, v in fib.items()},
        "support_resistance": sr,
    }
