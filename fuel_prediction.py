import matplotlib
matplotlib.use('Agg')
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import random

import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Conv1D, BatchNormalization, ReLU,
    Bidirectional, LSTM, Dropout,
    MultiHeadAttention, LayerNormalization,
    Add, Dense, TimeDistributed, Layer
)
from keras.saving import register_keras_serializable
from tensorflow.keras.optimizers import Adam

###############################################################################
# 1. CONFIGURATION
###############################################################################
MAIN_FOLDER = r"C:\Users\bamir\Desktop\ipco\Optimisation"                # Where "driver-data.xlsx" might be located
DRIVERS_FOLDER = r"C:\Users\bamir\Desktop\ipco\Optimisation\80 Drivers"  # Folder containing all *_refined.csv files

# Columns of interest (we assume these are consistent across the 80 driver files)
COL_SPEED = "Speed"
COL_SLOPE = "slope"
COL_GEAR  = "Current gear shift position"
COL_FUEL  = "Trip fuel consumption"
COL_MOM_FUEL = "MomentaryFuel"  # new column we create

# Feature columns used as X
FEATURE_COLS = [COL_SPEED, COL_SLOPE, COL_GEAR]

# Sequence length (number of consecutive rows we group as one sample)
SEQ_LEN = 10

# Output model name
SAVED_MODEL_PATH = "tcn_blstm_transformer_model.keras"


###############################################################################
# 2. HELPER FUNCTIONS
###############################################################################
def transform_gear(df, gear_col=COL_GEAR):
    """
    Replace 'N' with 0, '14' with 1, etc. Then convert the entire column to numeric.
    If other values exist (e.g., 'R', 'P', or integers), handle them as needed.
    """
    df[gear_col] = df[gear_col].replace({
        'N': 0,
        '14': 1,   # if '14' might be string
        14: 1      # if 14 might be numeric
    })
    # Force column to numeric, turning problematic values into NaN
    df[gear_col] = pd.to_numeric(df[gear_col], errors='coerce')
    return df


def create_momentary_fuel(df, cum_fuel_col=COL_FUEL, new_col=COL_MOM_FUEL):
    """
    Convert cumulative fuel consumption to momentary by differencing.
    The first row's diff is set to 0 by fillna(0).
    """
    df[new_col] = df[cum_fuel_col].diff().fillna(0)
    return df


def create_sequences(df, feature_cols, target_col, seq_length=10):
    """
    Converts a DataFrame into 3D feature array X and 2D label array y:
      X shape -> (num_sequences, seq_length, num_features)
      y shape -> (num_sequences, seq_length)
    Ignores leftover rows (if total is not multiple of seq_length).
    """
    # We only keep the columns of interest
    df = df[feature_cols + [target_col]].copy()

    # Drop rows that are missing any of these columns
    df.dropna(subset=feature_cols + [target_col], inplace=True)

    # How many full sequences of length seq_length fit?
    num_full_seq = len(df) // seq_length
    # Chop off leftover rows at the end
    df = df.iloc[:num_full_seq * seq_length]

    if len(df) == 0:
        return None, None

    # Extract values and reshape
    values = df.values  # shape = (num_full_seq*seq_length, num_features+1)
    values_3d = values.reshape(num_full_seq, seq_length, -1)

    # Split into X and y
    X = values_3d[:, :, :-1]  # all but last column as features
    y = values_3d[:, :, -1]   # last column as target

    return X, y

def tcn_block(x, filters, dilations=(1, 2, 4)):
    for d in dilations:
        x_init = x
        x = Conv1D(filters, 3, padding='same', dilation_rate=d)(x)
        x = BatchNormalization()(x); x = ReLU()(x)
        x = Conv1D(filters, 3, padding='same', dilation_rate=d)(x)
        x = BatchNormalization()(x)
        if x_init.shape[-1] != filters:
            x_init = Conv1D(filters, 1, padding='same')(x_init)
        x = Add()([x, x_init]); x = ReLU()(x)
    return x


def transformer_block_pre_norm(x, head=4, key_dim=32, ff_dim=128, dropout=0.1):
    x_norm = LayerNormalization(epsilon=1e-6)(x)
    attn   = MultiHeadAttention(num_heads=head, key_dim=key_dim, dropout=dropout)(x_norm, x_norm)
    attn   = Dropout(dropout)(attn)
    x1     = Add()([x, attn])
    x_norm = LayerNormalization(epsilon=1e-6)(x1)
    ff     = Dense(ff_dim, activation='relu')(x_norm)
    ff     = Dense(x.shape[-1])(ff); ff = Dropout(dropout)(ff)
    x2     = Add()([x1, ff])
    return x2


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


def process_csv_file(csv_path, seq_length=SEQ_LEN):
    """
    Reads a single CSV, cleans the data, creates momentary fuel, removes negative
    values, and creates sequences (X, y).
    Returns (X, y), or (None, None) if no valid sequences.
    """
    # Read
    try:
        df = pd.read_csv(csv_path)
    except pd.errors.EmptyDataError:
        print(f"File {csv_path} is empty, skipping.")
        return None, None
    except Exception as e:
        print(f"Error reading {csv_path}: {e}")
        return None, None

    # Transform gear
    df = transform_gear(df, gear_col=COL_GEAR)

    # Convert columns to numeric
    for col in [COL_SPEED, COL_SLOPE, COL_FUEL, COL_GEAR]:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    # Drop rows with NaN
    df.dropna(subset=[COL_SPEED, COL_SLOPE, COL_GEAR, COL_FUEL], inplace=True)

    # Create momentary fuel
    df = create_momentary_fuel(df, cum_fuel_col=COL_FUEL, new_col=COL_MOM_FUEL)

    # Remove negative momentary fuel
    df = df[df[COL_MOM_FUEL] >= 0]

    # Create sequences
    X, y = create_sequences(df, FEATURE_COLS, target_col=COL_MOM_FUEL, seq_length=seq_length)
    return X, y


###############################################################################
# 3. SPLIT INTO TRAIN & TEST FILES (RANDOM 3 FILES FOR TEST)
###############################################################################
all_refined_files = [
    f for f in os.listdir(DRIVERS_FOLDER)
    if f.endswith("_refined.csv")
]

# Shuffle files so we can randomly pick 3 for test
random.shuffle(all_refined_files)

# Pick first 3 as test, the rest as train
test_files = all_refined_files[:1]
train_files = all_refined_files[1:]

print("Test files chosen (3 random):", test_files)
print("Train files (the rest):", len(train_files))

###############################################################################
# 4. COLLECT TRAINING SEQUENCES & TEST SEQUENCES
###############################################################################
training_X_list = []
training_y_list = []
test_X_list = []
test_y_list = []

# Process training files
for file_name in train_files:
    full_path = os.path.join(DRIVERS_FOLDER, file_name)
    X_tmp, y_tmp = process_csv_file(full_path, seq_length=SEQ_LEN)
    if X_tmp is not None and y_tmp is not None:
        training_X_list.append(X_tmp)
        training_y_list.append(y_tmp)

# Process test files
for file_name in test_files:
    full_path = os.path.join(DRIVERS_FOLDER, file_name)
    X_tmp, y_tmp = process_csv_file(full_path, seq_length=SEQ_LEN)
    if X_tmp is not None and y_tmp is not None:
        test_X_list.append(X_tmp)
        test_y_list.append(y_tmp)

# Concatenate all training sequences
if not training_X_list:
    raise ValueError("No training data found (training_X_list is empty).")

X_train = np.concatenate(training_X_list, axis=0)
y_train = np.concatenate(training_y_list, axis=0)

if test_X_list:
    X_test = np.concatenate(test_X_list, axis=0)
    y_test = np.concatenate(test_y_list, axis=0)
else:
    X_test, y_test = None, None

print("Training X shape:", X_train.shape, "| y shape:", y_train.shape)
if X_test is not None:
    print("Test X shape:", X_test.shape, "| y shape:", y_test.shape)
else:
    print("No test data available.")


###############################################################################
# 5. OPTIONAL: SHOW HISTOGRAMS
###############################################################################
def show_histograms(X, y, feature_names, title_prefix=""):
    """
    Plots separate histograms for each feature in X and for the label array y.
    X can be shape (samples, seq_len, num_features).
    """
    if X is None or y is None:
        print(f"No data to show for {title_prefix}")
        return

    if len(X.shape) == 3:
        # Flatten out the sequence dimension
        X_flat = X.reshape(-1, X.shape[2])
    else:
        X_flat = X

    y_flat = y.reshape(-1)

    for i, fname in enumerate(feature_names):
        plt.figure()
        plt.hist(X_flat[:, i], bins=50)
        plt.title(f"{title_prefix} {fname} Distribution")
        plt.xlabel(fname)
        plt.ylabel("Count")
        plt.show()

    plt.figure()
    plt.hist(y_flat, bins=50)
    plt.title(f"{title_prefix} Momentary Fuel Distribution")
    plt.xlabel("Momentary Fuel")
    plt.ylabel("Count")
    plt.show()

# Show histograms for training
show_histograms(X_train, y_train, FEATURE_COLS, title_prefix="Training")

# Show histograms for test (if available)
if X_test is not None:
    show_histograms(X_test, y_test, FEATURE_COLS, title_prefix="Test")


###############################################################################
# 6. BUILD AND TRAIN THE MODEL
###############################################################################
inputs = Input(shape=(SEQ_LEN, len(FEATURE_COLS)))
x = Conv1D(64, 1, padding='same')(inputs)
x = BatchNormalization()(x); x = ReLU()(x)
x = tcn_block(x, 64)
x = Bidirectional(LSTM(64, return_sequences=True))(x)
x = Dropout(0.2)(x)
x = Bidirectional(LSTM(32, return_sequences=True))(x)

x = AddPositionalEncoding(SEQ_LEN)(x)
x = transformer_block_pre_norm(x)
x = transformer_block_pre_norm(x)
outputs = TimeDistributed(Dense(1))(x)

model = Model(inputs, outputs)

# Compile
learning_rate = 0.001
model.compile(optimizer=Adam(learning_rate=learning_rate), loss='mean_squared_error')
model.summary()

history = model.fit(
    X_train,
    y_train.reshape(y_train.shape[0], y_train.shape[1], 1),
    epochs=200,
    batch_size=32,
    validation_split=0.1
)

# Plot training & validation loss
plt.figure()
plt.plot(history.history['loss'], label='Train Loss')
plt.plot(history.history['val_loss'], label='Validation Loss')
plt.title("Training & Validation Loss")
plt.xlabel("Epoch")
plt.ylabel("Loss (MSE)")
plt.legend()
plt.show()


###############################################################################
# 7. EVALUATE ON THE TEST SET & SAVE MODEL
###############################################################################
if X_test is not None and len(X_test) > 0:
    test_loss = model.evaluate(
        X_test,
        y_test.reshape(y_test.shape[0], y_test.shape[1], 1)
    )
    print("Test loss (MSE):", test_loss)

    preds = model.predict(X_test)
    preds_flat = preds.reshape(-1)
    y_test_flat = y_test.reshape(-1)

    # Plot Real vs Predicted momentary fuel
    plt.figure()
    plt.plot(y_test_flat, label="Real Momentary Fuel")
    plt.plot(preds_flat, label="Predicted Momentary Fuel")
    plt.title("Momentary Fuel Consumption: Real vs Predicted")
    plt.xlabel("Time Steps (flattened sequences)")
    plt.ylabel("Fuel Consumption")
    plt.legend()
    plt.show()

    # Plot Real vs Predicted cumulative fuel
    real_cum = np.cumsum(y_test_flat)
    pred_cum = np.cumsum(preds_flat)

    plt.figure()
    plt.plot(real_cum, label="Real Cumulative Fuel")
    plt.plot(pred_cum, label="Predicted Cumulative Fuel")
    plt.title("Cumulative Fuel Consumption: Real vs Predicted")
    plt.xlabel("Time Steps (flattened sequences)")
    plt.ylabel("Cumulative Fuel")
    plt.legend()
    plt.show()

else:
    print("No test data to evaluate.")

# SAVE THE MODEL
model.save(SAVED_MODEL_PATH)
print(f"Model saved to {SAVED_MODEL_PATH}")
