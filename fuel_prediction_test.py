import matplotlib
matplotlib.use('TkAgg')
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

import tensorflow as tf
from tensorflow.keras.models import load_model, Sequential
from tensorflow.keras.layers import Dense, Layer
from tensorflow.keras.optimizers import Adam
from keras.saving import register_keras_serializable

@register_keras_serializable()
class AddPositionalEncoding(Layer):
    def __init__(self, seq_len, **kwargs):
        super().__init__(**kwargs)
        self.seq_len = seq_len

    def build(self, input_shape):
        d_model = int(input_shape[-1])
        pos = np.arange(self.seq_len)[:, np.newaxis]
        i = np.arange(d_model)[np.newaxis, :]
        angle_rates = 1 / np.power(10000.0, (2*(i//2))/np.float32(d_model))
        angle_rads = pos * angle_rates
        angle_rads[:, 0::2] = np.sin(angle_rads[:, 0::2])
        angle_rads[:, 1::2] = np.cos(angle_rads[:, 1::2])
        self.pos_enc = tf.constant(angle_rads, dtype=self.dtype)[None, ...]

    def call(self, x):
        return x + tf.cast(self.pos_enc, x.dtype)

    def get_config(self):
        config = super().get_config()
        config.update({"seq_len": self.seq_len})
        return config


###############################################################################
# 1. ASK USER FOR INPUT
###############################################################################
file_path = input("Enter the path to your CSV or Excel file: ")

# Ask user about column names in their file
col_speed = input("Enter the column name for Speed: ")
col_slope = input("Enter the column name for Slope: ")
col_gear  = input("Enter the column name for Gear (e.g. 'Current gear shift position'): ")
col_fuel  = input("Enter the column name for *cumulative* Fuel Consumption: ")

# We will create a new column for momentary fuel
col_mom_fuel = "MomentaryFuel"

# Feature columns (dynamically assigned from user input)
feature_cols = [col_speed, col_slope, col_gear]

seq_length = 10
model_path = "tcn_blstm_transformer_model.keras"  # path to the trained model

###############################################################################
# 2. HELPER FUNCTIONS
###############################################################################
def transform_gear(df, gear_col):
    """
    Example gear transformation: replace 'N'->0, '14'->1.
    Adjust or remove this logic if your data doesn't need it.
    """
    df[gear_col] = df[gear_col].replace({
        'N': 0,
        '14': 1,
        14: 1
    })
    # Force column to numeric
    df[gear_col] = pd.to_numeric(df[gear_col], errors='coerce')
    return df

def create_momentary_fuel(df, cum_fuel_col, new_col):
    df[new_col] = df[cum_fuel_col].diff().fillna(0)
    return df

def create_sequences(df, feature_cols, target_col, seq_length):
    """
    Converts a DataFrame into 3D feature array X and 2D label array y.
    """
    df = df[feature_cols + [target_col]].copy()
    df.dropna(subset=feature_cols + [target_col], inplace=True)

    num_full_seq = len(df) // seq_length
    df = df.iloc[:num_full_seq * seq_length]

    if len(df) == 0:
        return None, None

    values = df.values
    values_3d = values.reshape(num_full_seq, seq_length, -1)

    X = values_3d[:, :, :-1]
    y = values_3d[:, :, -1]

    return X, y

###############################################################################
# 3. READ THE INPUT FILE (CSV or EXCEL)
###############################################################################
# Decide if it's CSV or Excel by extension (you could refine this logic)
if file_path.lower().endswith(".csv"):
    df = pd.read_csv(file_path)
else:
    # Assume Excel format
    df = pd.read_excel(file_path)

# Convert columns to numeric if possible
for c in [col_speed, col_slope, col_gear, col_fuel]:
    if c in df.columns:
        df[c] = pd.to_numeric(df[c], errors='coerce')
    else:
        print(f"Warning: Column '{c}' not found in data. Predictions may fail.")
        # You could handle that more gracefully if needed.

# Gear transform (optional, if your data has gear like 'N' or '14')
df = transform_gear(df, gear_col=col_gear)

# Drop rows that are NaN in any required column
df.dropna(subset=[col_speed, col_slope, col_gear, col_fuel], inplace=True)

# Create momentary fuel
df = create_momentary_fuel(df, cum_fuel_col=col_fuel, new_col=col_mom_fuel)

# Remove negative momentary fuel
df = df[df[col_mom_fuel] >= 0].copy()

###############################################################################
# 4. CREATE SEQUENCES
###############################################################################
X, y = create_sequences(df, feature_cols, target_col=col_mom_fuel, seq_length=seq_length)

if X is None or y is None:
    print("Not enough valid data to create sequences. Exiting.")
    exit()

print("Data shape for inference:", X.shape, y.shape)

###############################################################################
# 5. LOAD MODEL & PREDICT
###############################################################################
try:
    # model = load_model(model_path, compile=False)
    model = load_model(model_path)
    print(f"Loaded model from {model_path}")
except Exception as e:
    print(f"Error loading model from {model_path}: {e}")
    exit()
# model.compile(optimizer="adam", loss="mean_squared_error")

preds = model.predict(X)
preds_flat = preds.reshape(-1)
y_flat = y.reshape(-1)

###############################################################################
# 6. PLOT RESULTS
###############################################################################
plt.figure()
plt.plot(y_flat, label="Real Momentary Fuel")
plt.plot(preds_flat, label="Predicted Momentary Fuel")
plt.title("Momentary Fuel Consumption: Real vs Predicted")
plt.xlabel("Time Steps (flattened sequences)")
plt.ylabel("Fuel Consumption")
plt.legend()
plt.show()

real_cum = np.cumsum(y_flat)
pred_cum = np.cumsum(preds_flat)

plt.figure()
plt.plot(real_cum, label="Real Cumulative Fuel")
plt.plot(pred_cum, label="Predicted Cumulative Fuel")
plt.title("Cumulative Fuel Consumption: Real vs Predicted")
plt.xlabel("Time Steps (flattened sequences)")
plt.ylabel("Cumulative Fuel")
plt.legend()
plt.show()
