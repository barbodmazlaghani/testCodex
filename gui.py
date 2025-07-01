import pandas as pd
import numpy as np
import tkinter as tk
from tkinter import filedialog, ttk, messagebox
import matplotlib
matplotlib.use('TkAgg')
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.pyplot as plt
import os

import tensorflow as tf
from tensorflow.keras.models import load_model
from tensorflow.keras.layers import Layer
from keras.saving import register_keras_serializable

SEQ_LEN = 10
MODEL_PATH = "tcn_blstm_transformer_model.keras"

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


def compute_slope(df, alt_col, dist_col):
    df["_alt_diff"] = df[alt_col].diff()
    df["_dist_diff"] = df[dist_col].diff().replace(0, np.nan)
    df["slope"] = (df["_alt_diff"] / (df["_dist_diff"] * 1000)).fillna(0)
    return df


def create_momentary_fuel(df, cum_col):
    df["momentary_fuel"] = df[cum_col].diff().fillna(0)
    df.loc[df["momentary_fuel"] < 0, "momentary_fuel"] = 0
    return df


def create_sequences(df, feature_cols, target_col, seq_length):
    df = df[feature_cols + [target_col]].dropna()
    num_full = len(df) // seq_length
    df = df.iloc[:num_full * seq_length]
    if len(df) == 0:
        return None, None
    values = df.values.reshape(num_full, seq_length, -1)
    X = values[:, :, :-1]
    y = values[:, :, -1]
    return X, y


def predict_gasoline(df, speed_col, slope_col, gear_col):
    feature_cols = [speed_col, slope_col, gear_col]
    model = load_model(MODEL_PATH)
    X, _ = create_sequences(df, feature_cols, target_col=speed_col, seq_length=SEQ_LEN)
    if X is None:
        return pd.Series(dtype=float)
    preds = model.predict(X)
    preds_flat = preds.reshape(-1)
    idx = df.index[: len(preds_flat)]
    return pd.Series(preds_flat, index=idx)


def process_file(path, cols):
    df = pd.read_csv(path)
    compute_slope(df, cols['altitude'], cols['distance'])
    create_momentary_fuel(df, cols['cng_fuel'])

    df['pred_gasoline'] = predict_gasoline(
        df,
        speed_col=cols['speed'],
        slope_col='slope',
        gear_col=cols['gear']
    )
    return df


def export_results(df, out_path):
    df.to_csv(out_path, index=False)
    messagebox.showinfo("Export", f"Results exported to {out_path}")


class Application(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Fuel Consumption Predictor")
        self.geometry("900x600")
        self.create_widgets()
        self.data = None

    def create_widgets(self):
        frm = ttk.Frame(self)
        frm.pack(fill='x', padx=10, pady=10)

        self.path_var = tk.StringVar()
        ttk.Entry(frm, textvariable=self.path_var, width=60).pack(side='left')
        ttk.Button(frm, text="Browse", command=self.browse).pack(side='left', padx=5)
        ttk.Button(frm, text="Process", command=self.process).pack(side='left', padx=5)
        ttk.Button(frm, text="Export CSV", command=self.export).pack(side='left', padx=5)

        # Variable selection frame
        opt_frame = ttk.Frame(self)
        opt_frame.pack(fill='x', padx=10, pady=5)

        self.plot_opts = {
            'Predicted Gasoline': {
                'column': 'pred_gasoline',
                'var': tk.IntVar(value=1),
                'axis': tk.StringVar(value='left'),
            },
            'CNG Consumption': {
                'column': 'momentary_fuel',
                'var': tk.IntVar(value=1),
                'axis': tk.StringVar(value='right'),
            },
            'Speed': {
                'column': 'Vehicle_Speed',
                'var': tk.IntVar(value=0),
                'axis': tk.StringVar(value='left'),
            },
            'Gear': {
                'column': 'Current_gear_shift_position_(Current_gear)',
                'var': tk.IntVar(value=0),
                'axis': tk.StringVar(value='left'),
            },
            'Slope': {
                'column': 'slope',
                'var': tk.IntVar(value=0),
                'axis': tk.StringVar(value='left'),
            },
        }

        for i, (name, cfg) in enumerate(self.plot_opts.items()):
            cb = ttk.Checkbutton(opt_frame, text=name, variable=cfg['var'])
            cb.grid(row=0, column=i*2, sticky='w')
            menu = ttk.Combobox(opt_frame, textvariable=cfg['axis'], values=['left', 'right'], width=7)
            menu.grid(row=0, column=i*2 + 1, padx=2)

        self.fig, self.ax_left = plt.subplots(figsize=(8, 4))
        self.ax_right = self.ax_left.twinx()
        self.canvas = FigureCanvasTkAgg(self.fig, master=self)
        self.canvas.get_tk_widget().pack(fill='both', expand=True)

    def browse(self):
        file_path = filedialog.askopenfilename(filetypes=[('CSV files', '*.csv')])
        if file_path:
            self.path_var.set(file_path)

    def process(self):
        path = self.path_var.get()
        if not path:
            messagebox.showwarning("Input", "Please select a CSV file")
            return
        cols = {
            'speed': 'Vehicle_Speed',
            'gear': 'Current_gear_shift_position_(Current_gear)',
            'altitude': 'altitude',
            'distance': 'Cumulative_mileage',
            'cng_fuel': 'FS_FlVofKgSNG'
        }
        try:
            self.data = process_file(path, cols)
        except Exception as e:
            messagebox.showerror("Error", str(e))
            return

        self.show_chart()

    def show_chart(self):
        if self.data is None or 'pred_gasoline' not in self.data:
            return

        self.ax_left.clear()
        self.ax_right.clear()

        left_labels = []
        right_labels = []

        for name, cfg in self.plot_opts.items():
            if not cfg['var'].get():
                continue
            col = cfg['column']
            if col not in self.data:
                continue
            axis = self.ax_left if cfg['axis'].get() == 'left' else self.ax_right
            axis.plot(self.data[col], label=name)
            if cfg['axis'].get() == 'left':
                left_labels.append(name)
            else:
                right_labels.append(name)

        self.ax_left.set_xlabel('Time Index')
        self.ax_left.set_ylabel(', '.join(left_labels) if left_labels else 'Left Axis')
        self.ax_right.set_ylabel(', '.join(right_labels) if right_labels else 'Right Axis')

        handles_left, labels_left = self.ax_left.get_legend_handles_labels()
        handles_right, labels_right = self.ax_right.get_legend_handles_labels()
        self.ax_left.legend(handles_left + handles_right, labels_left + labels_right)

        self.fig.tight_layout()
        self.canvas.draw()

    def export(self):
        if self.data is None:
            messagebox.showwarning("No Data", "No data to export")
            return
        out_path = filedialog.asksaveasfilename(defaultextension='.csv', filetypes=[('CSV files', '*.csv')])
        if out_path:
            export_results(self.data, out_path)


if __name__ == '__main__':
    app = Application()
    app.mainloop()