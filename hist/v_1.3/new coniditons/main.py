# API_KEY = '085cfb48-ac90-4dd9-9634-4238727ee7b8'
# TELEGRAM_TOKEN = '7587284372:AAGS_San9NXLDY95wlps-JTETaq7TUjpark'
# TELEGRAM_CHAT_ID = '-1002489992542'

import requests
import pandas as pd
import numpy as np
import time
from datetime import datetime, timedelta
import threading
import logging
import sys
import colorlog
import schedule
import json
import os
import csv
from zoneinfo import ZoneInfo
import tzlocal

# Get the local timezone
local_tz = tzlocal.get_localzone()

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Create formatter with colors for console output
console_formatter = colorlog.ColoredFormatter(
    "%(log_color)s%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    log_colors={
        'DEBUG': 'white',
        'INFO': 'cyan',
        'WARNING': 'yellow',
        'ERROR': 'red',
        'CRITICAL': 'bold_red,bg_white',
    }
)

# Console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# File handler with plain format
file_formatter = logging.Formatter(
    "%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
file_handler = logging.FileHandler('strategy.log', encoding='utf-8')
file_handler.setFormatter(file_formatter)
logger.addHandler(file_handler)

API_KEY = '085cfb48-ac90-4dd9-9634-4238727ee7b8'
TELEGRAM_TOKEN = '7587284372:AAGS_San9NXLDY95wlps-JTETaq7TUjpark'
TELEGRAM_CHAT_ID = '-1002489992542'

HEADERS = {
    'content-type': 'application/json',
    'x-api-key': API_KEY
}

# Global variables to store trade summaries and open positions
trade_summaries = []
open_positions = {}  # Key: coin, Value: list of positions

# Create a lock for API call synchronization
api_call_lock = threading.Lock()
last_api_call_time = 0

# New: Global trade ID counter
trade_id_counter = 1
trade_id_lock = threading.Lock()

# Cache for upper timeframe data to avoid redundant API calls
upper_timeframe_cache = {
    '4h': {},
    '1d': {}
}
upper_timeframe_lock = threading.Lock()

def initialize_trade_id_counter():
    global trade_id_counter
    if os.path.exists('closed_positions.csv'):
        try:
            with open('closed_positions.csv', 'r', newline='') as csvfile:
                reader = csv.DictReader(csvfile)
                trade_ids = [int(row['trade_id'].strip('#')) for row in reader if row['trade_id']]
                if trade_ids:
                    trade_id_counter = max(trade_ids) + 1
                else:
                    trade_id_counter = 1
            logger.info(f"Initialized trade_id_counter to {trade_id_counter}")
        except Exception as e:
            logger.error(f"Error initializing trade_id_counter: {e}")
            trade_id_counter = 1
    else:
        trade_id_counter = 1
        logger.info("No closed_positions.csv found. Starting trade_id_counter at 1.")

def get_next_trade_id():
    global trade_id_counter
    with trade_id_lock:
        trade_id = f"#{trade_id_counter}"
        trade_id_counter += 1
        return trade_id

def load_open_positions():
    if os.path.exists('open_positions.json'):
        with open('open_positions.json', 'r') as f:
            data = json.load(f)
            for coin, positions in data.items():
                open_positions[coin] = []
                for position in positions:
                    # Convert string dates back to datetime objects with local timezone
                    position['entry_time'] = datetime.strptime(position['entry_time'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=local_tz)
                    # Convert TP times if they exist
                    for tp in ['tp1_time', 'tp2_time', 'tp3_time']:
                        if position[tp]:
                            position[tp] = datetime.strptime(position[tp], '%Y-%m-%d %H:%M:%S').replace(tzinfo=local_tz)
                    open_positions[coin].append(position)
            logger.info("Loaded open positions from file.")
    else:
        logger.info("No open positions file found. Starting fresh.")

def save_open_positions():
    data = {}
    for coin, positions in open_positions.items():
        data[coin] = []
        for position in positions:
            # Convert datetime objects to strings for JSON serialization
            position_copy = position.copy()
            position_copy['entry_time'] = position_copy['entry_time'].strftime('%Y-%m-%d %H:%M:%S')
            # Convert TP times to strings
            for tp in ['tp1_time', 'tp2_time', 'tp3_time']:
                if position_copy[tp]:
                    position_copy[tp] = position_copy[tp].strftime('%Y-%m-%d %H:%M:%S')
                else:
                    position_copy[tp] = None
            data[coin].append(position_copy)
    with open('open_positions.json', 'w') as f:
        json.dump(data, f, indent=4)
    logger.info("Saved open positions to file.")

def save_closed_position(trade_summary):
    file_exists = os.path.isfile('closed_positions.csv')
    with open('closed_positions.csv', 'a', newline='') as csvfile:
        fieldnames = ['trade_id', 'coin', 'type', 'timeframe', 'entry_price', 'exit_price', 'profit', 'profit_percentage',
                      'entry_time', 'exit_time', 'tp1_time', 'tp2_time', 'tp3_time']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        # Convert datetime objects to strings for CSV
        trade_summary_copy = trade_summary.copy()
        trade_summary_copy['entry_time'] = trade_summary_copy['entry_time'].strftime('%m/%d/%Y %H:%M')
        trade_summary_copy['exit_time'] = trade_summary_copy['exit_time'].strftime('%m/%d/%Y %H:%M')
        for tp in ['tp1_time', 'tp2_time', 'tp3_time']:
            if trade_summary_copy[tp]:
                trade_summary_copy[tp] = trade_summary_copy[tp].strftime('%m/%d/%Y %H:%M')
            else:
                trade_summary_copy[tp] = ''
        writer.writerow(trade_summary_copy)
    logger.info(f"Saved closed position for {trade_summary['coin']} to file.")

def send_telegram_message(message):
    url = f'https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage'
    payload = {
        'chat_id': TELEGRAM_CHAT_ID,
        'text': message,
        'parse_mode': 'HTML'
    }
    try:
        response = requests.post(url, data=payload)
        if response.status_code != 200:
            logger.error(f"Failed to send message to Telegram. Status code: {response.status_code}")
    except Exception as e:
        logger.error(f"Error sending message to Telegram: {e}")

def make_api_request(url, headers, payload):
    global last_api_call_time
    with api_call_lock:
        now = time.time()
        time_since_last_call = now - last_api_call_time
        if time_since_last_call < 1:
            time.sleep(1 - time_since_last_call)
        last_api_call_time = time.time()
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
    return response

def fetch_top_coins(limit=150):
    url = 'https://api.livecoinwatch.com/coins/list'
    payload = {
        'currency': 'USD',
        'sort': 'rank',
        'order': 'ascending',
        'offset': 0,
        'limit': limit,
        'meta': False
    }
    while True:
        try:
            logger.info(f"Fetching top {limit} coins...")
            response = make_api_request(url, HEADERS, payload)
            data = response.json()
            coins = [coin['code'] for coin in data]
            # Exclude coins starting with 'USD' and 'CUSDC'
            coins = [coin for coin in coins if
                     not coin.startswith('USD') and 'USD' not in coin and coin != 'DAI' and coin != 'CUSDC']
            logger.info(f"Successfully fetched top coins: {coins[:5]}...")  # Show first 5 coins
            return coins
        except Exception as e:
            logger.error(f"Error fetching top coins: {e}")
            logger.info("Retrying in 1 minute...")
            time.sleep(60)  # Wait 1 minute before retrying

def fetch_historical_data(coin, timeframe, end_time):
    url = 'https://api.livecoinwatch.com/coins/single/history'
    data_points = 100  # Maximum data points returned by the API
    if timeframe == '1h':
        interval = timedelta(hours=(data_points - 1))
    elif timeframe == '4h':
        interval = timedelta(hours=4 * (data_points - 1))
    elif timeframe == '1d':
        interval = timedelta(days=(data_points - 1))
    else:
        logger.error(f"Invalid timeframe: {timeframe}")
        return pd.DataFrame()
    start_time = end_time - interval

    # Convert start_time and end_time to UTC timestamps for the API
    start_time_utc = start_time.astimezone(ZoneInfo('UTC'))
    end_time_utc = end_time.astimezone(ZoneInfo('UTC'))

    payload = {
        'currency': 'USD',
        'code': coin,
        'start': int(start_time_utc.timestamp() * 1000),
        'end': int(end_time_utc.timestamp() * 1000),
        'meta': True
    }
    while True:
        try:
            logger.info(f"Fetching historical data for {coin} from {start_time} to {end_time}...")
            response = make_api_request(url, HEADERS, payload)
            data = response.json()
            if 'history' in data and data['history']:
                df = pd.DataFrame(data['history'])
                # Convert dates to local timezone
                df['date'] = pd.to_datetime(df['date'], unit='ms', utc=True).dt.tz_convert(local_tz)
                df.sort_values('date', inplace=True)
                df.reset_index(drop=True, inplace=True)
                logger.info(f"Received {len(df)} data points for {coin}")
                # Log the last few dates for verification
                logger.info(f"Last data points for {coin}: {df['date'].tail()}")
                return df
            else:
                logger.warning(f"No historical data available for {coin}")
                return pd.DataFrame()
        except Exception as e:
            logger.error(f"Error fetching historical data for {coin}: {e}")
            logger.info("Retrying in 1 minute...")
            time.sleep(60)  # Wait 1 minute before retrying

def calculate_indicators(df):
    logger.info("Calculating indicators...")
    # Calculate True Range (TR)
    df['previous_close'] = df['rate'].shift(1)
    df['high_low'] = df['rate'] - df['rate']
    df['high_prev_close'] = abs(df['rate'] - df['previous_close'])
    df['low_prev_close'] = abs(df['rate'] - df['previous_close'])
    df['tr'] = df[['high_low', 'high_prev_close', 'low_prev_close']].max(axis=1)

    # Calculate ATR(14)
    df['atr'] = df['tr'].rolling(window=14).mean()

    # Ichimoku Components
    high_9 = df['rate'].rolling(window=9).max()
    low_9 = df['rate'].rolling(window=9).min()
    df['tenkan_sen'] = (high_9 + low_9) / 2

    high_26 = df['rate'].rolling(window=26).max()
    low_26 = df['rate'].rolling(window=26).min()
    df['kijun_sen'] = (high_26 + low_26) / 2

    df['senkou_span_a'] = ((df['tenkan_sen'] + df['kijun_sen']) / 2).shift(26)

    high_52 = df['rate'].rolling(window=52).max()
    low_52 = df['rate'].rolling(window=52).min()
    df['senkou_span_b'] = ((high_52 + low_52) / 2).shift(26)

    df['chikou_span'] = df['rate'].shift(-26)
    logger.info("Indicators calculated successfully.")
    return df

def apply_trading_strategy(df, coin, timeframe):
    logger.info(f"Applying trading strategy for {coin} on {timeframe} timeframe...")

    if coin not in open_positions:
        open_positions[coin] = []

    # Check if DataFrame is empty
    if df.empty:
        logger.warning(f"No data for {coin}, cannot apply strategy.")
        return

    # Get the last (latest) row of data
    row = df.iloc[-1]

    # Log current price and time
    current_price = row['rate']
    current_time = row['date']

    # Log current price and data time
    logger.info(f"Current price for {coin}: {current_price:.9f} at {current_time} (Local Time)")

    # Log system time and time difference
    current_system_time = datetime.now(local_tz)
    time_diff = current_system_time - current_time
    logger.info(f"System time (Local): {current_system_time}")
    logger.info(f"Time difference between system time and data time: {time_diff}")

    # Skip if indicators are not available
    if pd.isna(row['atr']) or pd.isna(row['kijun_sen']) or pd.isna(row['senkou_span_a']) or pd.isna(row['senkou_span_b']):
        logger.warning(f"Indicators not available for {coin}, cannot apply strategy.")
        return

    atr = row['atr']
    kijun_sen = row['kijun_sen']
    senkou_span_a = row['senkou_span_a']
    senkou_span_b = row['senkou_span_b']
    kumo_top = max(senkou_span_a, senkou_span_b)
    kumo_bottom = min(senkou_span_a, senkou_span_b)

    # Get the previous row to determine crossovers
    if len(df) >= 2:
        prev_row = df.iloc[-2]
        prev_price = prev_row['rate']
        prev_kumo_top = max(prev_row['senkou_span_a'], prev_row['senkou_span_b'])
        prev_kumo_bottom = min(prev_row['senkou_span_a'], prev_row['senkou_span_b'])
    else:
        logger.warning(f"Not enough data for {coin} to determine crossovers.")
        return

    # Entry Conditions
    # Only process entry conditions if we're on the scheduled timeframe
    if timeframe != '1h':
        # Check if there is already an open position on this coin and timeframe
        if not any(pos['timeframe'] == timeframe for pos in open_positions[coin]):
            # Adjust ATR for 4h and 1d timeframes to be half of 1h
            adjusted_atr = atr / 2  # Modification 1

            # Long Entry Condition
            if (current_price > prev_price + (0.5 * adjusted_atr)) and \
               current_price > kumo_top and not(prev_price > prev_kumo_top):
               
                # Store a pending position awaiting confirmation without setting SL and TPs
                pending_position = {
                    'trade_id': get_next_trade_id(),
                    'coin': coin,
                    'type': 'long',
                    'entry_price': current_price,  # To be set upon confirmation
                    'adjusted_atr': adjusted_atr,
                    'original_atr': atr,
                    'stop_loss': None,  # To be set upon confirmation
                    'take_profit1': None,  # To be set upon confirmation
                    'take_profit2': None,  # To be set upon confirmation
                    'take_profit3': None,  # To be set upon confirmation
                    'size': 1.0,
                    'status': 'pending_confirmation',  # New status
                    'entry_time': current_time,  # Use entry_time instead of index
                    'timeframe': timeframe,
                    'tp1_time': None,
                    'tp2_time': None,
                    'tp3_time': None,
                    'accumulated_profit': 0.0,
                    'sl_moved_to_entry': False  # New: Flag to indicate if SL moved to entry
                }
                open_positions[coin].append(pending_position)
                save_open_positions()
                logger.info(f"Pending LONG position {pending_position['trade_id']} on {coin} awaiting confirmation.")
                # Notify via Telegram about pending position
                send_telegram_message(
                    f"⏳ <b>Pending LONG Position {pending_position['trade_id']}</b> on <b>{coin}</b> at <b>{current_price:.9f}</b> "
                    f"({timeframe} timeframe). Awaiting confirmation."
                )

            # Short Entry Condition
            elif (current_price < prev_price - (0.5 * adjusted_atr)) and \
                 current_price < kumo_bottom and not(prev_price < prev_kumo_bottom):
                # Store a pending position awaiting confirmation without setting SL and TPs
                pending_position = {
                    'trade_id': get_next_trade_id(),
                    'coin': coin,
                    'type': 'short',
                    'entry_price': current_price,  # To be set upon confirmation
                    'adjusted_atr': adjusted_atr,
                    'original_atr': atr,
                    'stop_loss': None,  # To be set upon confirmation
                    'take_profit1': None,  # To be set upon confirmation
                    'take_profit2': None,  # To be set upon confirmation
                    'take_profit3': None,  # To be set upon confirmation
                    'size': 1.0,
                    'status': 'pending_confirmation',  # New status
                    'entry_time': current_time,  # Use entry_time instead of index
                    'timeframe': timeframe,
                    'tp1_time': None,
                    'tp2_time': None,
                    'tp3_time': None,
                    'accumulated_profit': 0.0,
                    'sl_moved_to_entry': False  # New: Flag to indicate if SL moved to entry
                }
                open_positions[coin].append(pending_position)
                save_open_positions()
                logger.info(f"Pending SHORT position {pending_position['trade_id']} on {coin} awaiting confirmation.")
                # Notify via Telegram about pending position
                send_telegram_message(
                    f"⏳ <b>Pending SHORT Position {pending_position['trade_id']}</b> on <b>{coin}</b> at <b>{current_price:.9f}</b> "
                    f"({timeframe} timeframe). Awaiting confirmation."
                )
    else:
        # Modified conditions for 1h timeframe
        if not any(pos['timeframe'] == timeframe for pos in open_positions[coin]):
            # Long Entry Condition for 1h timeframe
            if (current_price > prev_price + (0.5 * atr)) and \
               current_price > kumo_top and not(prev_price > prev_kumo_top):
                # Store a pending position awaiting confirmation without setting SL and TPs
                pending_position = {
                    'trade_id': get_next_trade_id(),
                    'coin': coin,
                    'type': 'long',
                    'entry_price': current_price,  # To be set upon confirmation
                    'adjusted_atr': atr / 2,  # Half ATR for 1h as per request
                    'original_atr': atr,
                    'stop_loss': None,  # To be set upon confirmation
                    'take_profit1': None,  # To be set upon confirmation
                    'take_profit2': None,  # To be set upon confirmation
                    'take_profit3': None,  # To be set upon confirmation
                    'size': 1.0,
                    'status': 'pending_confirmation',  # New status
                    'entry_time': current_time,  # Use entry_time instead of index
                    'timeframe': timeframe,
                    'tp1_time': None,
                    'tp2_time': None,
                    'tp3_time': None,
                    'accumulated_profit': 0.0,
                    'sl_moved_to_entry': False  # New: Flag to indicate if SL moved to entry
                }
                open_positions[coin].append(pending_position)
                save_open_positions()
                logger.info(f"Pending LONG position {pending_position['trade_id']} on {coin} awaiting confirmation.")
                # Notify via Telegram about pending position
                send_telegram_message(
                    f"⏳ <b>Pending LONG Position {pending_position['trade_id']}</b> on <b>{coin}</b> at <b>{current_price:.9f}</b> "
                    f"({timeframe} timeframe). Awaiting confirmation."
                )

            # Short Entry Condition for 1h timeframe
            elif (current_price < prev_price - (0.5 * atr)) and \
                 current_price < kumo_bottom and not(prev_price < prev_kumo_bottom):
                # Store a pending position awaiting confirmation without setting SL and TPs
                pending_position = {
                    'trade_id': get_next_trade_id(),
                    'coin': coin,
                    'type': 'short',
                    'entry_price': current_price,  # To be set upon confirmation
                    'adjusted_atr': atr / 2,  # Half ATR for 1h as per request
                    'original_atr': atr,
                    'stop_loss': None,  # To be set upon confirmation
                    'take_profit1': None,  # To be set upon confirmation
                    'take_profit2': None,  # To be set upon confirmation
                    'take_profit3': None,  # To be set upon confirmation
                    'size': 1.0,
                    'status': 'pending_confirmation',  # New status
                    'entry_time': current_time,  # Use entry_time instead of index
                    'timeframe': timeframe,
                    'tp1_time': None,
                    'tp2_time': None,
                    'tp3_time': None,
                    'accumulated_profit': 0.0,
                    'sl_moved_to_entry': False  # New: Flag to indicate if SL moved to entry
                }
                open_positions[coin].append(pending_position)
                save_open_positions()
                logger.info(f"Pending SHORT position {pending_position['trade_id']} on {coin} awaiting confirmation.")
                # Notify via Telegram about pending position
                send_telegram_message(
                    f"⏳ <b>Pending SHORT Position {pending_position['trade_id']}</b> on <b>{coin}</b> at <b>{current_price:.9f}</b> "
                    f"({timeframe} timeframe). Awaiting confirmation."
                )

def confirm_pending_positions():
    logger.info("Confirming pending positions...")
    coins = list(open_positions.keys())
    for coin in coins:
        positions = open_positions[coin]
        for position in positions:
            if position['status'] == 'pending_confirmation':
                timeframe = position['timeframe']
                confirmation_timeframe = timeframe  # Confirmation candle is in the same timeframe

                # Fetch the latest candles
                end_time = get_last_completed_period_end_time(timeframe)
                df = fetch_historical_data(coin, timeframe, end_time)
                if df.empty:
                    logger.warning(f"No sufficient data for {coin} on {timeframe} timeframe to confirm position.")
                    continue
                df = calculate_indicators(df)

                # Get the latest candle time
                latest_candle_time = df.iloc[-1]['date']

                # Ensure there's a new candle for confirmation by comparing times
                if latest_candle_time <= position['entry_time']:
                    logger.info(f"Waiting for the next candle to confirm position {position['trade_id']} on {coin}.")
                    continue  # Wait for the next candle

                # Find the candle that closes after the entry_time
                confirmation_candle = df[df['date'] > position['entry_time']].iloc[0] if not df[df['date'] > position['entry_time']].empty else None

                if confirmation_candle is None:
                    logger.info(f"Waiting for the next candle to confirm position {position['trade_id']} on {coin}.")
                    continue  # No new candle yet

                # Determine confirmation criteria based on position type
                confirmation_met = False
                if position['type'] == 'long':
                    required_move = 0.4 * position['original_atr'] if timeframe == '1h' else 0.2 * position['original_atr']
                    # Correct calculation of move
                    move = confirmation_candle['rate'] - (position['entry_price'] if position['entry_price'] else position['entry_price'] or 0)
                    if move >= required_move:
                        # Check upper timeframe confirmations
                        if check_upper_timeframe_confirmation(coin, 'long'):
                            confirmation_met = True
                elif position['type'] == 'short':
                    required_move = 0.4 * position['original_atr'] if timeframe == '1h' else 0.2 * position['original_atr']
                    # Correct calculation of move
                    move = (position['entry_price'] if position['entry_price'] else position['entry_price'] or 0) - confirmation_candle['rate']
                    if move >= required_move:
                        # Check upper timeframe confirmations
                        if check_upper_timeframe_confirmation(coin, 'short'):
                            confirmation_met = True

                if confirmation_met:
                    # Set entry price, SL, and TPs
                    position['entry_price'] = confirmation_candle['rate']
                    position['stop_loss'] = position['entry_price'] - (2 * position['adjusted_atr']) if position['type'] == 'long' else position['entry_price'] + (2 * position['adjusted_atr'])
                    position['take_profit1'] = position['entry_price'] + (2 * position['adjusted_atr']) if position['type'] == 'long' else position['entry_price'] - (2 * position['adjusted_atr'])
                    position['take_profit2'] = position['entry_price'] + (4 * position['adjusted_atr']) if position['type'] == 'long' else position['entry_price'] - (4 * position['adjusted_atr'])
                    position['take_profit3'] = position['entry_price'] + (6 * position['adjusted_atr']) if position['type'] == 'long' else position['entry_price'] - (6 * position['adjusted_atr'])
                    position['status'] = 'open'
                    save_open_positions()
                    logger.critical(f"Confirmed {position['type'].upper()} Position {position['trade_id']} on {coin} at {position['entry_price']:.9f}")
                    # Send Telegram message with position details
                    send_telegram_message(
                        f"✅ <b>Confirmed {position['type'].upper()} Position {position['trade_id']}</b>\n"
                        f"<b>Coin:</b> {coin}\n"
                        f"<b>Entry Price:</b> {position['entry_price']:.9f}\n"
                        f"<b>Timeframe:</b> {timeframe}\n"
                        f"<b>Entry Time:</b> {position['entry_time'].strftime('%Y-%m-%d %H:%M:%S')}\n"
                        f"<b>Stop Loss:</b> {position['stop_loss']:.9f}\n"
                        f"<b>Take Profit1:</b> {position['take_profit1']:.9f}\n"
                        f"<b>Take Profit2:</b> {position['take_profit2']:.9f}\n"
                        f"<b>Take Profit3:</b> {position['take_profit3']:.9f}"
                    )
                else:
                    # Confirmation failed
                    position['status'] = 'failed_confirmation'
                    save_open_positions()
                    logger.info(f"Confirmation FAILED for {position['type'].upper()} Position {position['trade_id']} on {coin}. Position was not opened.")
                    # Notify via Telegram without red tick
                    send_telegram_message(
                        f"⚠️ <b>Confirmation Failed</b> for {position['type'].upper()} Position {position['trade_id']} on <b>{coin}</b>.\n"
                        f"Position was not opened."
                    )
                    # Remove the failed position
                    positions.remove(position)
                    save_open_positions()

def check_upper_timeframe_confirmation(coin, position_type):
    """
    Checks if the price is above Senkou Span A for longs or below Senkou Span B for shorts
    in the upper timeframes.
    """
    confirmation = True
    upper_timeframes = []
    if position_type == 'long':
        upper_timeframes = ['4h', '1d']
    elif position_type == 'short':
        upper_timeframes = ['4h', '1d']

    for upper_tf in upper_timeframes:
        # Check cache first
        with upper_timeframe_lock:
            if coin in upper_timeframe_cache[upper_tf]:
                df = upper_timeframe_cache[upper_tf][coin]
            else:
                end_time = get_last_completed_period_end_time(upper_tf)
                df = fetch_historical_data(coin, upper_tf, end_time)
                if df.empty:
                    logger.warning(f"No data for {coin} on {upper_tf} timeframe.")
                    return False
                df = calculate_indicators(df)
                upper_timeframe_cache[upper_tf][coin] = df  # Cache the data

        latest_row = df.iloc[-1]
        if position_type == 'long':
            if latest_row['rate'] <= latest_row['senkou_span_a']:
                logger.info(f"{coin} price is not above Senkou Span A on {upper_tf} timeframe.")
                return False
        elif position_type == 'short':
            if latest_row['rate'] >= latest_row['senkou_span_b']:
                logger.info(f"{coin} price is not below Senkou Span B on {upper_tf} timeframe.")
                return False

    return confirmation

def check_pending_confirmations():
    logger.info("Checking pending position confirmations...")
    confirm_pending_positions()

def check_exit_conditions():
    logger.info("Checking exit conditions for open positions...")
    coins = list(open_positions.keys())
    for coin in coins:
        positions = open_positions[coin]
        positions_to_remove = []
        for position in positions:
            if position['status'] == 'open':
                timeframe = position['timeframe']
                end_time = get_last_completed_period_end_time(timeframe)
                df = fetch_historical_data(coin, timeframe, end_time)
                if df.empty:
                    logger.warning(f"No data for {coin} on {timeframe} timeframe, skipping.")
                    continue
                df = calculate_indicators(df)
                row = df.iloc[-1]
                current_price = row['rate']
                atr = row['atr']
                kijun_sen = row['kijun_sen']

                pos_type = position['type']
                entry_price = position['entry_price']
                stop_loss = position['stop_loss']
                take_profit1 = position['take_profit1']
                take_profit2 = position['take_profit2']
                take_profit3 = position['take_profit3']
                size = position['size']
                accumulated_profit = position['accumulated_profit']
                trade_id = position['trade_id']  # New: Get trade_id

                # Log current price and stop loss for debugging
                logger.info(f"{coin} {pos_type.upper()} Position {trade_id}: Current Price = {current_price}, Stop Loss = {stop_loss}")

                if pos_type == 'long':
                    # Check Take Profit 3 first
                    if current_price >= take_profit3 and not position['tp3_time']:
                        # Take Profit 3 Hit - Close Position
                        profit = ((current_price - entry_price) / entry_price) * position['size'] * 100
                        accumulated_profit += profit
                        position['tp3_time'] = row['date']
                        trade_summary = {
                            'trade_id': trade_id,  # New: Include trade_id
                            'coin': coin,
                            'type': 'long',
                            'timeframe': position['timeframe'],
                            'entry_price': entry_price,
                            'exit_price': take_profit3,
                            'profit': accumulated_profit,
                            'profit_percentage': accumulated_profit,
                            'entry_time': position['entry_time'],
                            'exit_time': row['date'],
                            'tp1_time': position.get('tp1_time'),
                            'tp2_time': position.get('tp2_time'),
                            'tp3_time': position.get('tp3_time'),
                        }
                        update_trade_summaries(trade_summary)
                        save_closed_position(trade_summary)
                        positions_to_remove.append(position)
                        logger.critical(
                            f"Closed LONG position {trade_id} on {coin} at {current_price:.9f} (Take Profit 3). Total Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"🎯 <b>Take Profit 3 Hit</b> on LONG position {trade_id} of <b>{coin}</b> at <b>{current_price:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Position closed. Total Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price >= take_profit2 and size >= 0.25 and not position['tp2_time']:
                        # Take Profit 2 Hit
                        profit = ((current_price - entry_price) / entry_price) * 0.75 * 100
                        accumulated_profit += profit
                        position['size'] = 0.25
                        position['stop_loss'] = take_profit1  # Move Stop Loss to TP1
                        position['tp2_time'] = row['date']
                        position['accumulated_profit'] = accumulated_profit
                        save_open_positions()
                        logger.warning(
                            f"Take Profit 2 reached on {coin} at {current_price:.9f}. Position size reduced to {position['size']:.2f}. Accumulated Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"✅ <b>Take Profit 2 Hit</b> on LONG position {trade_id} of <b>{coin}</b> at <b>{current_price:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Position size reduced. Accumulated Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price >= take_profit1 and size >= 0.5 and not position['tp1_time']:
                        # Take Profit 1 Hit
                        profit = ((current_price - entry_price) / entry_price) * 0.5 * 100
                        accumulated_profit += profit
                        position['size'] = 0.5
                        position['stop_loss'] = entry_price  # Move Stop Loss to Entry Price
                        position['tp1_time'] = row['date']
                        position['accumulated_profit'] = accumulated_profit
                        position['sl_moved_to_entry'] = True  # New: SL moved to entry
                        save_open_positions()
                        logger.warning(
                            f"Take Profit 1 reached on {coin} at {current_price:.9f}. Position size reduced to {position['size']:.2f}. Accumulated Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"✅ <b>Take Profit 1 Hit</b> on LONG position {trade_id} of <b>{coin}</b> at <b>{current_price:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Position size reduced. Accumulated Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price <= stop_loss:
                        # Stop Loss Hit
                        profit = ((stop_loss - entry_price) / entry_price) * position['size'] * 100
                        accumulated_profit += profit
                        trade_summary = {
                            'trade_id': trade_id,
                            'coin': coin,
                            'type': 'long',
                            'timeframe': position['timeframe'],
                            'entry_price': entry_price,
                            'exit_price': current_price,
                            'profit': accumulated_profit,
                            'profit_percentage': accumulated_profit,
                            'entry_time': position['entry_time'],
                            'exit_time': row['date'],
                            'tp1_time': position.get('tp1_time'),
                            'tp2_time': position.get('tp2_time'),
                            'tp3_time': position.get('tp3_time'),
                        }
                        update_trade_summaries(trade_summary)
                        save_closed_position(trade_summary)
                        positions_to_remove.append(position)
                        logger.critical(
                            f"Closed LONG position {trade_id} on {coin} at {stop_loss:.9f} (Stop Loss). Total Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"❌ <b>Stop Loss Hit</b> on LONG position {trade_id} of <b>{coin}</b> at <b>{stop_loss:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\nTotal Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price < kijun_sen:
                        # Close if price closes below Kijun-sen
                        profit = ((current_price - entry_price) / entry_price) * position['size'] * 100
                        accumulated_profit += profit
                        trade_summary = {
                            'trade_id': trade_id,
                            'coin': coin,
                            'type': 'long',
                            'timeframe': position['timeframe'],
                            'entry_price': entry_price,
                            'exit_price': current_price,
                            'profit': accumulated_profit,
                            'profit_percentage': accumulated_profit,
                            'entry_time': position['entry_time'],
                            'exit_time': row['date'],
                            'tp1_time': position.get('tp1_time'),
                            'tp2_time': position.get('tp2_time'),
                            'tp3_time': position.get('tp3_time'),
                        }
                        update_trade_summaries(trade_summary)
                        save_closed_position(trade_summary)
                        positions_to_remove.append(position)
                        logger.critical(
                            f"Closed LONG position {trade_id} on {coin} at {current_price:.9f} (Below Kijun-sen). Total Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"⚠️ <b>Closed LONG Position {trade_id}</b> on <b>{coin}</b> at <b>{current_price:.9f}</b> (Below Kijun-sen).\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Total Profit: <b>{accumulated_profit:.2f}%</b>"
                        )

                elif pos_type == 'short':
                    # Check Take Profit 3 first
                    if current_price <= take_profit3 and not position['tp3_time']:
                        # Take Profit 3 Hit - Close Position
                        profit = ((entry_price - current_price) / entry_price) * position['size'] * 100
                        accumulated_profit += profit
                        position['tp3_time'] = row['date']
                        trade_summary = {
                            'trade_id': trade_id,
                            'coin': coin,
                            'type': 'short',
                            'timeframe': position['timeframe'],
                            'entry_price': entry_price,
                            'exit_price': take_profit3,
                            'profit': accumulated_profit,
                            'profit_percentage': accumulated_profit,
                            'entry_time': position['entry_time'],
                            'exit_time': row['date'],
                            'tp1_time': position.get('tp1_time'),
                            'tp2_time': position.get('tp2_time'),
                            'tp3_time': position.get('tp3_time'),
                        }
                        update_trade_summaries(trade_summary)
                        save_closed_position(trade_summary)
                        positions_to_remove.append(position)
                        logger.critical(
                            f"Closed SHORT position {trade_id} on {coin} at {current_price:.9f} (Take Profit 3). Total Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"🎯 <b>Take Profit 3 Hit</b> on SHORT position {trade_id} of <b>{coin}</b> at <b>{current_price:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Position closed. Total Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price <= take_profit2 and size >= 0.25 and not position['tp2_time']:
                        # Take Profit 2 Hit
                        profit = ((entry_price - current_price) / entry_price) * 0.75 * 100
                        accumulated_profit += profit
                        position['size'] = 0.25
                        position['stop_loss'] = take_profit1  # Move Stop Loss to TP1
                        position['tp2_time'] = row['date']
                        position['accumulated_profit'] = accumulated_profit
                        save_open_positions()
                        logger.warning(
                            f"Take Profit 2 reached on {coin} at {current_price:.9f}. Position size reduced to {position['size']:.2f}. Accumulated Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"✅ <b>Take Profit 2 Hit</b> on SHORT position {trade_id} of <b>{coin}</b> at <b>{current_price:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Position size reduced. Accumulated Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price <= take_profit1 and size >= 0.5 and not position['tp1_time']:
                        # Take Profit 1 Hit
                        profit = ((entry_price - current_price) / entry_price) * 0.5 * 100
                        accumulated_profit += profit
                        position['size'] = 0.5
                        position['stop_loss'] = entry_price  # Move Stop Loss to Entry Price
                        position['tp1_time'] = row['date']
                        position['accumulated_profit'] = accumulated_profit
                        position['sl_moved_to_entry'] = True  # New: SL moved to entry
                        save_open_positions()
                        logger.warning(
                            f"Take Profit 1 reached on {coin} at {current_price:.9f}. Position size reduced to {position['size']:.2f}. Accumulated Profit: {accumulated_profit:.2f}%")
                        # Send Telegram message with trade_id and profit
                        time_diff = datetime.now(local_tz) - row['date']
                        send_telegram_message(
                            f"✅ <b>Take Profit 1 Hit</b> on SHORT position {trade_id} of <b>{coin}</b> at <b>{current_price:.9f}</b>.\n"
                            f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                            f"Position size reduced. Accumulated Profit: <b>{accumulated_profit:.2f}%</b>"
                        )
                    elif current_price >= stop_loss:
                        # Stop Loss Hit
                        profit = ((entry_price - stop_loss) / entry_price) * position['size'] * 100
                        accumulated_profit += profit
                        trade_summary = {
                            'trade_id': trade_id,
                            'coin': coin,
                            'type': 'short',
                            'timeframe': position['timeframe'],
                            'entry_price': entry_price,
                            'exit_price': current_price,
                            'profit': accumulated_profit,
                            'profit_percentage': accumulated_profit,
                            'entry_time': position['entry_time'],
                            'exit_time': row['date'],
                            'tp1_time': position.get('tp1_time'),
                            'tp2_time': position.get('tp2_time'),
                            'tp3_time': position.get('tp3_time'),
                        }
                        update_trade_summaries(trade_summary)
                        save_closed_position(trade_summary)
                        positions_to_remove.append(position)
                        logger.critical(
                            f"Closed SHORT position {trade_id} on {coin} at {stop_loss:.9f} (Stop Loss). Total Profit: {accumulated_profit:.2f}%")
                        # Determine if SL was moved to entry
                        if position.get('sl_moved_to_entry', False):
                            time_diff = datetime.now(local_tz) - row['date']
                            # SL was moved to entry; show green tick
                            send_telegram_message(
                                f"✅ <b>Stop Loss Hit (Risk-Free)</b> on SHORT position {trade_id} of <b>{coin}</b> at <b>{stop_loss:.9f}</b>.\n"
                                f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                                f"Total Profit: <b>{accumulated_profit:.2f}%</b>"
                            )
                        else:
                            # Normal SL hit
                            time_diff = datetime.now(local_tz) - row['date']
                            send_telegram_message(
                                f"❌ <b>Stop Loss Hit</b> on SHORT position {trade_id} of <b>{coin}</b> at <b>{stop_loss:.9f}</b>.\n"
                                f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                                f"Total Profit: <b>{accumulated_profit:.2f}%</b>"
                            )
                    # Close condition based on Kijun-sen
                    if pos_type == 'short':
                        if current_price > kijun_sen:
                            # Close if price closes above Kijun-sen
                            profit = ((entry_price - current_price) / entry_price) * position['size'] * 100
                            accumulated_profit += profit
                            trade_summary = {
                                'trade_id': trade_id,
                                'coin': coin,
                                'type': 'short',
                                'timeframe': position['timeframe'],
                                'entry_price': entry_price,
                                'exit_price': current_price,
                                'profit': accumulated_profit,
                                'profit_percentage': accumulated_profit,
                                'entry_time': position['entry_time'],
                                'exit_time': row['date'],
                                'tp1_time': position.get('tp1_time'),
                                'tp2_time': position.get('tp2_time'),
                                'tp3_time': position.get('tp3_time'),
                            }
                            update_trade_summaries(trade_summary)
                            save_closed_position(trade_summary)
                            positions_to_remove.append(position)
                            logger.critical(
                                f"Closed SHORT position {trade_id} on {coin} at {current_price:.9f} (Above Kijun-sen). Total Profit: {accumulated_profit:.2f}%")
                            # Send Telegram message with trade_id and profit
                            time_diff = datetime.now(local_tz) - row['date']
                            send_telegram_message(
                                f"⚠️ <b>Closed SHORT Position {trade_id}</b> on <b>{coin}</b> at <b>{current_price:.9f}</b> (Above Kijun-sen).\n"
                                f"Time: {row['date']} (Local Time)\nOccurred {int(time_diff.total_seconds() / 60)} minutes ago.\n"
                                f"Total Profit: <b>{accumulated_profit:.2f}%</b>"
                            )

        # Remove closed positions
        for position in positions_to_remove:
            open_positions[coin].remove(position)
        if positions_to_remove:
            save_open_positions()

def update_trade_summaries(trade_summary):
    trade_summaries.append(trade_summary)
    # You can add additional code here to process trade summaries if needed

def get_last_completed_period_end_time(timeframe):
    now = datetime.now(local_tz)
    if timeframe == '1h':
        # Subtract one hour to get the last completed candle
        end_time = (now).replace(minute=0, second=0, microsecond=0)
    elif timeframe == '4h':
        # Calculate the last completed 4h candle
        hours = (now.hour // 4) * 4
        end_time = now.replace(hour=hours, minute=0, second=0, microsecond=0) 
    elif timeframe == '1d':
        # Get the last completed day
        end_time = (now.replace(hour=0, minute=0, second=0, microsecond=0))
    else:
        raise ValueError(f"Invalid timeframe: {timeframe}")
    logger.info(f"Calculated end_time for {timeframe} timeframe: {end_time} (Local Time)")
    return end_time

def run_strategy(timeframe):
    try:
        logger.info(f"Starting strategy run for {timeframe} timeframe")
        coins = fetch_top_coins()
        for coin in coins:
            logger.info(f"Processing {coin} on {timeframe} timeframe")
            end_time = get_last_completed_period_end_time(timeframe)
            df = fetch_historical_data(coin, timeframe, end_time)
            if df.empty:
                logger.warning(f"No data for {coin} on {timeframe} timeframe, skipping.")
                continue
            df = calculate_indicators(df)
            apply_trading_strategy(df, coin, timeframe)
        logger.info(f"Strategy run complete for {timeframe} timeframe")
    except Exception as e:
        logger.error(f"Error in run_strategy for {timeframe}: {e}")

def confirm_and_apply():
    try:
        logger.info("Starting confirmation for pending positions...")
        check_pending_confirmations()
    except Exception as e:
        logger.error(f"Error in confirm_and_apply: {e}")

def schedule_strategy():
    # Initialize trade_id_counter
    initialize_trade_id_counter()

    # Load open positions from file
    load_open_positions()

    # Schedule run_strategy for different timeframes
    schedule.every().hour.at(":04").do(run_strategy, timeframe='1h')  # 1h candle closes at hh:00
    schedule.every(4).hours.at(":05").do(run_strategy, timeframe='4h')  # 4h candle closes at hh:00, hh:04, etc.
    schedule.every().day.at("00:10").do(run_strategy, timeframe='1d')  # 1d candle closes at 00:00

    # Schedule confirmation for pending positions
    schedule.every().hour.at(":03").do(confirm_and_apply)  # Confirmation runs shortly after candle closes

    # Schedule check_exit_conditions to run every hour
    schedule.every().hour.at(":02").do(check_exit_conditions)

    # Remove immediate strategy runs at startup
    # threading.Thread(target=run_strategy, args=('1h',)).start()
    # threading.Thread(target=run_strategy, args=('4h',)).start()
    # threading.Thread(target=run_strategy, args=('1d',)).start()
    # threading.Thread(target=check_exit_conditions).start()
    # threading.Thread(target=confirm_and_apply).start()

    while True:
        schedule.run_pending()
        time.sleep(1)

def check_upper_timeframes_for_positions():
    """
    This function ensures that the upper timeframe data is cached and updated.
    It should be called whenever an upper timeframe strategy runs.
    """
    try:
        logger.info("Updating upper timeframe cache...")
        coins = fetch_top_coins()
        for upper_tf in ['4h', '1d']:
            end_time = get_last_completed_period_end_time(upper_tf)
            for coin in coins:
                df = fetch_historical_data(coin, upper_tf, end_time)
                if df.empty:
                    logger.warning(f"No data for {coin} on {upper_tf} timeframe.")
                    continue
                df = calculate_indicators(df)
                with upper_timeframe_lock:
                    upper_timeframe_cache[upper_tf][coin] = df
        logger.info("Upper timeframe cache updated successfully.")
    except Exception as e:
        logger.error(f"Error updating upper timeframe cache: {e}")

def main():
    logger.info("Starting the trading bot...")
    # Log the local timezone for verification
    logger.info(f"Local timezone set to: {local_tz}")

    # Update upper timeframe cache at startup
    threading.Thread(target=check_upper_timeframes_for_positions).start()
    schedule_strategy()

if __name__ == '__main__':
    main()
