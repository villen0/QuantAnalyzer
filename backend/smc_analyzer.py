"""
SMC (Smart Money Concepts) rule-based trade setup calculator.
Given pre-computed SMC indicators, derives entry, stop loss, and targets.
"""


def analyze_smc(ticker: str, smc: dict, current_price: float, atr: float) -> dict:
    if not smc or not current_price:
        return _neutral(ticker, "Insufficient data for SMC analysis")

    ms     = smc.get("market_structure", "ranging")
    choch  = smc.get("choch")
    bos    = smc.get("bos")
    pd_inf = smc.get("premium_discount", {})
    obs    = smc.get("order_blocks", {})
    fvgs   = smc.get("fair_value_gaps", [])
    liq    = smc.get("liquidity", {})

    # --- Directional bias ---
    if choch:
        bias = choch.get("direction", "neutral")
    elif ms == "bullish":
        bias = "bullish"
    elif ms == "bearish":
        bias = "bearish"
    else:
        bias = "neutral"

    if bias == "neutral":
        return _neutral(ticker, "Market structure is ranging — waiting for directional break")

    pd_zone = pd_inf.get("zone", "equilibrium")
    eq      = pd_inf.get("equilibrium", current_price)
    rng_hi  = pd_inf.get("range_high", current_price * 1.1)
    rng_lo  = pd_inf.get("range_low",  current_price * 0.9)

    # --- Confluence scoring ---
    conf = 0
    if choch:
        conf += 2
    elif bos:
        conf += 1
    if (bias == "bullish" and pd_zone in ("discount", "equilibrium")) or \
       (bias == "bearish" and pd_zone in ("premium", "equilibrium")):
        conf += 1

    active_bull_obs = [o for o in obs.get("bullish", []) if not o.get("mitigated")]
    active_bear_obs = [o for o in obs.get("bearish", []) if not o.get("mitigated")]
    bull_fvgs = [f for f in fvgs if f.get("type") == "bullish" and not f.get("mitigated")]
    bear_fvgs = [f for f in fvgs if f.get("type") == "bearish" and not f.get("mitigated")]

    sell_side = sorted(liq.get("sell_side", []))
    buy_side  = sorted(liq.get("buy_side",  []), reverse=True)

    buf = (atr or 0) * 0.5
    entry = stop_loss = target_1 = target_2 = None
    setup_type = entry_note = invalidation = ""

    # --- Bullish setup ---
    if bias == "bullish":
        obs_below = [o for o in active_bull_obs if o["high"] < current_price]
        if obs_below:
            ob = max(obs_below, key=lambda o: o["high"])
            entry      = round((ob["high"] + ob["low"]) / 2, 2)
            stop_loss  = round(ob["low"] - buf, 2)
            setup_type = "Bullish OB Retest"
            entry_note = f"Pullback to OB ${ob['low']:.2f}–${ob['high']:.2f}"
            conf += 1
            if any(f["bottom"] <= ob["high"] and f["top"] >= ob["low"] for f in bull_fvgs):
                conf += 1
                setup_type = "Bullish OB + FVG Confluence"
        elif bull_fvgs:
            fvg        = bull_fvgs[0]
            entry      = round((fvg["top"] + fvg["bottom"]) / 2, 2)
            stop_loss  = round(fvg["bottom"] - buf, 2)
            setup_type = "Bullish FVG Fill"
            entry_note = f"FVG fill zone ${fvg['bottom']:.2f}–${fvg['top']:.2f}"
        else:
            return _neutral(ticker, f"Bullish bias ({ms}) but no active OB or FVG pullback setup found")

        above    = [l for l in sell_side if l > (entry or current_price)]
        target_1 = round(above[0], 2) if above else round((entry or current_price) * 1.02, 2)
        target_2 = round(rng_hi, 2)
        invalidation = f"Close below ${stop_loss:.2f}"

    # --- Bearish setup ---
    else:
        obs_above = [o for o in active_bear_obs if o["low"] > current_price]
        if obs_above:
            ob = min(obs_above, key=lambda o: o["low"])
            entry      = round((ob["high"] + ob["low"]) / 2, 2)
            stop_loss  = round(ob["high"] + buf, 2)
            setup_type = "Bearish OB Retest"
            entry_note = f"Rally into OB ${ob['low']:.2f}–${ob['high']:.2f}"
            conf += 1
            if any(f["bottom"] <= ob["high"] and f["top"] >= ob["low"] for f in bear_fvgs):
                conf += 1
                setup_type = "Bearish OB + FVG Confluence"
        elif bear_fvgs:
            fvg        = bear_fvgs[0]
            entry      = round((fvg["top"] + fvg["bottom"]) / 2, 2)
            stop_loss  = round(fvg["top"] + buf, 2)
            setup_type = "Bearish FVG Fill"
            entry_note = f"FVG fill zone ${fvg['bottom']:.2f}–${fvg['top']:.2f}"
        else:
            return _neutral(ticker, f"Bearish bias ({ms}) but no active OB or FVG setup found")

        below    = [l for l in buy_side if l < (entry or current_price)]
        target_1 = round(below[0], 2) if below else round((entry or current_price) * 0.98, 2)
        target_2 = round(rng_lo, 2)
        invalidation = f"Close above ${stop_loss:.2f}"

    # --- Risk/reward ---
    rr = None
    if entry is not None and stop_loss is not None and target_1 is not None:
        risk   = abs(entry - stop_loss)
        reward = abs(target_1 - entry)
        rr     = round(reward / risk, 2) if risk > 0 else None

    confidence = min(90, 40 + conf * 10)

    # --- Reasoning text ---
    parts = []
    if choch:
        parts.append(f"CHoCH {choch['direction']} at ${choch['level']:.2f} signals reversal")
    elif bos:
        parts.append(f"BOS {bos['direction']} at ${bos['level']:.2f} confirms direction")
    parts.append(f"Market structure: {ms.upper()}")
    parts.append(f"Price is in {pd_zone.upper()} zone (EQ ${eq:.2f})")
    if entry:
        parts.append(f"{setup_type} — entry ${entry:.2f}, SL ${stop_loss:.2f}")

    return {
        "ticker":           ticker.upper(),
        "bias":             bias,
        "market_structure": ms,
        "setup_type":       setup_type,
        "entry":            entry,
        "stop_loss":        stop_loss,
        "target_1":         target_1,
        "target_2":         target_2,
        "risk_reward":      rr,
        "confidence":       confidence,
        "reasoning":        ". ".join(parts) + ".",
        "entry_note":       entry_note,
        "invalidation":     invalidation,
        "bos":              bos,
        "choch":            choch,
        "pd_zone":          pd_zone,
    }


def _neutral(ticker: str, reason: str) -> dict:
    return {
        "ticker":           ticker.upper(),
        "bias":             "neutral",
        "market_structure": "ranging",
        "setup_type":       "No Setup",
        "entry":            None,
        "stop_loss":        None,
        "target_1":         None,
        "target_2":         None,
        "risk_reward":      None,
        "confidence":       30,
        "reasoning":        reason,
        "entry_note":       "Wait for clear market structure break",
        "invalidation":     "N/A",
        "bos":              None,
        "choch":            None,
        "pd_zone":          "equilibrium",
    }
