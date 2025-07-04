import os
import json
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import yfinance as yf
import mplfinance as mpf
import requests
import pytz

ALERT_WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "https://hooks.your-notify-endpoint.com")
YOUR_TIMEZONE = os.getenv("YOUR_TIMEZONE", "Europe/Berlin")
PATH_TO_SAVE_CHARTS = os.getenv("PATH_TO_SAVE_CHARTS", "/mnt/data/trade_charts")

CRYPTO = [
    "BTC-USD","ETH-USD","USDT-USD","XRP-USD","BNB-USD","SOL-USD","USDC-USD",
    "TRX-USD","DOGE-USD","WTRX-USD","STETH-USD","ADA-USD","WBTC-USD",
    "HYPE32196-USD","WSTETH-USD","SUI20947-USD","BCH-USD","LINK-USD",
    "WETH-USD","LEO-USD","AVAX-USD","WBETH-USD","XLM-USD","USDS33039-USD",
    "BTCB-USD","AETHWETH-USD","TON11419-USD","SHIB-USD","WEETH-USD",
    "LTC-USD","HBAR-USD","XMR-USD","DOT-USD","DAI-USD","USDE29470-USD",
    "BGB-USD","AETHUSDT-USD","CBBTC32994-USD","UNI7083-USD","AAVE-USD",
    "PEPE24478-USD","PI35697-USD","SUSDE-USD","OKB-USD","APT21794-USD",
    "TAO22974-USD","JITOSOL-USD","NEAR-USD","ICP-USD","CRO-USD"
]
INDICES = ["^GSPC","^DJI","^IXIC","^NYA","^XAX","^BUK100P","^RUT","^VIX","^FTSE","^GDAXI"]
FX = ["EURUSD=X","JPY=X","GBPUSD=X","AUDUSD=X","NZDUSD=X",
      "EURJPY=X","GBPJPY=X","EURGBP=X","EURCAD=X","EURSEK=X","EURCHF=X"]
COMMODS = ["GC=F","SI=F"]

SYMBOLS = CRYPTO + INDICES + FX + COMMODS

TZ = pytz.timezone(YOUR_TIMEZONE)

os.makedirs(PATH_TO_SAVE_CHARTS, exist_ok=True)

def fetch_data(symbol: str) -> pd.DataFrame:
    df = yf.download(symbol, period="200d", interval="1d", progress=False)
    df.dropna(inplace=True)
    df = df.tail(180)
    return df

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df["SMA8"] = df["Close"].rolling(8).mean()
    df["SMA21"] = df["Close"].rolling(21).mean()
    high_low = df["High"] - df["Low"]
    high_close = abs(df["High"] - df["Close"].shift())
    low_close = abs(df["Low"] - df["Close"].shift())
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    df["ATR"] = tr.rolling(14).mean()
    return df

def mark_swings(df: pd.DataFrame, lookback: int = 5) -> pd.DataFrame:
    df["swing_high"] = np.nan
    df["swing_low"] = np.nan
    for i in range(lookback, len(df) - lookback):
        window = df.iloc[i - lookback: i + lookback + 1]
        if df["High"].iloc[i] == window["High"].max():
            df.loc[df.index[i], "swing_high"] = df["High"].iloc[i]
        if df["Low"].iloc[i] == window["Low"].min():
            df.loc[df.index[i], "swing_low"] = df["Low"].iloc[i]
    return df

def build_zones(df: pd.DataFrame):
    sup = df.loc[df["swing_low"].notna(), "swing_low"].tail(3).tolist()
    res = df.loc[df["swing_high"].notna(), "swing_high"].tail(3).tolist()
    return sup, res

def compute_trend(df: pd.DataFrame) -> str:
    if len(df) < 21:
        return "range"
    closes = df["Close"]
    if (closes.tail(10) > df["SMA21"].tail(10)).all():
        return "up"
    if (closes.tail(10) < df["SMA21"].tail(10)).all():
        return "down"
    return "range"

def fibonacci_levels(df: pd.DataFrame):
    high = df["High"].max()
    low = df["Low"].min()
    fib50 = low + 0.5 * (high - low)
    fib618 = low + 0.618 * (high - low)
    return fib50, fib618

def rr_to_level(entry: float, stop: float, level: float, direction: str) -> float:
    risk = abs(entry - stop)
    reward = (level - entry) if direction == "long" else (entry - level)
    return reward / risk if risk > 0 else 0.0

def plot_chart(df: pd.DataFrame, symbol: str, label: str, zones):
    sup, res = zones
    add_plots = []
    if len(df) >= 60:
        idx = np.arange(len(df.tail(60)))
        y = df["Close"].tail(60).values
        slope, intercept = np.polyfit(idx, y, 1)
        line = slope * idx + intercept
        df.loc[df.tail(60).index, "trendline"] = line
        add_plots.append(mpf.make_addplot(df["trendline"], color="blue"))
    figpath = os.path.join(PATH_TO_SAVE_CHARTS, f"{symbol}_{df.index[-1].date()}.png")
    mc = mpf.make_marketcolors(up="#26a69a", down="#ef5350")
    s = mpf.make_mpf_style(marketcolors=mc)
    mpf.plot(
        df.tail(120),
        type="candle",
        style=s,
        addplot=add_plots,
        savefig=figpath,
        volume=False,
    )
    return figpath

def near_level(value: float, levels, atr: float) -> bool:
    return any(abs(value - lvl) <= atr for lvl in levels)

def check_engulfing(df: pd.DataFrame, trend: str, zones):
    sup, res = zones
    prev = df.iloc[-2]
    curr = df.iloc[-1]
    fib50, fib618 = fibonacci_levels(df)
    setups = []
    # Bullish Engulfing
    if (
        curr["Close"] > curr["Open"]
        and prev["Close"] < prev["Open"]
        and curr["Open"] <= prev["Close"]
        and curr["Close"] >= prev["Open"]
        and trend == "up"
        and (
            near_level(curr["Low"], sup, curr["ATR"])
            or near_level(curr["Low"], [fib50, fib618], curr["ATR"])
        )
    ):
        entry = curr["High"] * 1.001
        stop = curr["Low"] - curr["ATR"]
        target_zone = min([lvl for lvl in res if lvl > entry] + [entry + 2 * (entry - stop)])
        rr = rr_to_level(entry, stop, target_zone, "long")
        if rr >= 2:
            setups.append({
                "symbol": symbol,
                "date": str(curr.name.date()),
                "pattern": "Bull Engulfing",
                "direction": "long",
                "entry": round(entry, 2),
                "stop": round(stop, 2),
                "target": round(target_zone, 2),
                "rr": round(rr, 2),
            })
    # Bearish Engulfing
    if (
        curr["Close"] < curr["Open"]
        and prev["Close"] > prev["Open"]
        and curr["Open"] >= prev["Close"]
        and curr["Close"] <= prev["Open"]
        and trend == "down"
        and (
            near_level(curr["High"], res, curr["ATR"])
            or near_level(curr["High"], [fib50, fib618], curr["ATR"])
        )
    ):
        entry = curr["Low"] * 0.999
        stop = curr["High"] + curr["ATR"]
        target_zone = max([lvl for lvl in sup if lvl < entry] + [entry - 2 * (stop - entry)])
        rr = rr_to_level(entry, stop, target_zone, "short")
        if rr >= 2:
            setups.append({
                "symbol": symbol,
                "date": str(curr.name.date()),
                "pattern": "Bear Engulfing",
                "direction": "short",
                "entry": round(entry, 2),
                "stop": round(stop, 2),
                "target": round(target_zone, 2),
                "rr": round(rr, 2),
            })
    return setups

def check_inside_bar(df: pd.DataFrame, trend: str, zones):
    sup, res = zones
    prev = df.iloc[-2]
    curr = df.iloc[-1]
    fib50, fib618 = fibonacci_levels(df)
    setups = []
    if curr["High"] <= prev["High"] and curr["Low"] >= prev["Low"]:
        # continuation
        if trend == "up" and near_level(curr["Low"], sup + [fib50, fib618], curr["ATR"]):
            entry = prev["High"] * 1.001
            stop = curr["Low"] - curr["ATR"]
            target_zone = min([lvl for lvl in res if lvl > entry] + [entry + 2 * (entry - stop)])
            rr = rr_to_level(entry, stop, target_zone, "long")
            if rr >= 2:
                setups.append({
                    "symbol": symbol,
                    "date": str(curr.name.date()),
                    "pattern": "Bull Inside Bar",
                    "direction": "long",
                    "entry": round(entry, 2),
                    "stop": round(stop, 2),
                    "target": round(target_zone, 2),
                    "rr": round(rr, 2),
                })
        if trend == "down" and near_level(curr["High"], res + [fib50, fib618], curr["ATR"]):
            entry = prev["Low"] * 0.999
            stop = curr["High"] + curr["ATR"]
            target_zone = max([lvl for lvl in sup if lvl < entry] + [entry - 2 * (stop - entry)])
            rr = rr_to_level(entry, stop, target_zone, "short")
            if rr >= 2:
                setups.append({
                    "symbol": symbol,
                    "date": str(curr.name.date()),
                    "pattern": "Bear Inside Bar",
                    "direction": "short",
                    "entry": round(entry, 2),
                    "stop": round(stop, 2),
                    "target": round(target_zone, 2),
                    "rr": round(rr, 2),
                })
    else:
        # false breakout
        if (
            prev["High"] <= df.iloc[-3]["High"]
            and prev["Low"] >= df.iloc[-3]["Low"]
        ):
            mother = df.iloc[-3]
            if curr["Close"] < mother["High"] and curr["Close"] > mother["Low"]:
                if curr["High"] > mother["High"] and trend != "down":
                    entry = mother["Low"] * 0.999
                    stop = curr["High"] + curr["ATR"]
                    target_zone = max([lvl for lvl in sup if lvl < entry] + [entry - 2 * (stop - entry)])
                    rr = rr_to_level(entry, stop, target_zone, "short")
                    if rr >= 2:
                        setups.append({
                            "symbol": symbol,
                            "date": str(curr.name.date()),
                            "pattern": "IB False Break",
                            "direction": "short",
                            "entry": round(entry, 2),
                            "stop": round(stop, 2),
                            "target": round(target_zone, 2),
                            "rr": round(rr, 2),
                        })
                if curr["Low"] < mother["Low"] and trend != "up":
                    entry = mother["High"] * 1.001
                    stop = curr["Low"] - curr["ATR"]
                    target_zone = min([lvl for lvl in res if lvl > entry] + [entry + 2 * (entry - stop)])
                    rr = rr_to_level(entry, stop, target_zone, "long")
                    if rr >= 2:
                        setups.append({
                            "symbol": symbol,
                            "date": str(curr.name.date()),
                            "pattern": "IB False Break",
                            "direction": "long",
                            "entry": round(entry, 2),
                            "stop": round(stop, 2),
                            "target": round(target_zone, 2),
                            "rr": round(rr, 2),
                        })
    return setups

def post_alert(payload: dict, chart_path: str):
    payload["chart"] = f"file://{chart_path}"
    try:
        requests.post(ALERT_WEBHOOK_URL, json=payload, timeout=10)
    except Exception:
        pass

def process_symbol(symbol: str):
    df = fetch_data(symbol)
    if df.empty:
        return []
    df = add_indicators(df)
    df = mark_swings(df)
    zones = build_zones(df)
    trend = compute_trend(df)
    setups = []
    setups.extend(check_engulfing(df, trend, zones))
    setups.extend(check_inside_bar(df, trend, zones))
    final_setups = []
    for s in setups:
        chart_path = plot_chart(df, symbol, s["pattern"], zones)
        s["chart"] = f"file://{chart_path}"
        post_alert(s, chart_path)
        final_setups.append(s)
    return final_setups

def run():
    all_setups = []
    for symbol in SYMBOLS:
        setups = process_symbol(symbol)
        all_setups.extend(setups)
    if not all_setups:
        print("NO_NEW_SETUPS")
    else:
        print(json.dumps(all_setups, indent=2))

if __name__ == "__main__":
    run()
