import pandas as pd

df = pd.read_csv(
    r'C:\Users\s_alizadehnia\Downloads\Car_Soren+ TC CNG_16 g 219 ir 22_Data_06_28_2025, 08_45_00_to_06_30_2025, 08_45_00.csv')

df['distance_km'] = df['Vehicle_Speed'] / 3600

results = []

trip_ids = df['trip'].unique()

for trip_id in trip_ids:
    trip_df = df[df['trip'] == trip_id]

    # trip_df['speed_diff'] = trip_df['Vehicle_Speed'].diff()

    # total_acc = trip_df.loc[trip_df['speed_diff'] > 0, 'speed_diff'].mean()
    # total_dec = trip_df.loc[trip_df['speed_diff'] < 0, 'speed_diff'].abs().mean()

    # throttle_mean = trip_df['Throttle_position'].mean()
    # Accelerator_pedal_position_mean = trip_df['Accelerator_pedal_position'].mean()
    # Coolant_temperature_mean = trip_df['Coolant_temperature'].mean()
    # Vehicle_Speed_mean = trip_df['Vehicle_Speed'].mean()
    # Engine_speed_mean = trip_df['Engine_speed'].mean()
    # Vehicle_Speed_mean = trip_df['Vehicle_Speed'].mean()

    total_distance = trip_df['distance_km'].sum()

    cng_df = trip_df[trip_df['SS_B_CNG'] == 1]
    total_distance1 = cng_df['distance_km'].sum()
    total_cng = cng_df['FS_FlVofKgSNG'].sum()

    cng_df['speed_diff'] = cng_df['Vehicle_Speed'].diff()

    total_acc = cng_df.loc[cng_df['speed_diff'] > 0, 'speed_diff'].mean()
    total_dec = cng_df.loc[cng_df['speed_diff'] < 0, 'speed_diff'].abs().mean()

    throttle_mean = cng_df['Throttle_position'].mean()
    Accelerator_pedal_position_mean = cng_df['Accelerator_pedal_position'].mean()
    Coolant_temperature_mean = cng_df['Coolant_temperature'].mean()
    Vehicle_Speed_mean = cng_df['Vehicle_Speed'].mean()
    Engine_speed_mean = cng_df['Engine_speed'].mean()
    Vehicle_Speed_mean = cng_df['Vehicle_Speed'].mean()

    cng_consumption_per_km = (total_cng / total_distance1) / 10 if total_distance1 > 0 else 0

    results.append({
        'trip': trip_id,
        'total_distance_km': total_distance,
        'cng_distance_km': total_distance1,
        'total_cng': total_cng,
        'CNG_consumption_per_km': cng_consumption_per_km,
        'mean_acceleration': total_acc,
        'mean_dec': total_dec,
        'throttle_mean': throttle_mean,
        'Accelerator_pedal_position_mean': Accelerator_pedal_position_mean,
        'Coolant_temperature_mean': Coolant_temperature_mean,
        'Engine_speed_mean': Engine_speed_mean,
        'Vehicle_Speed_mean': Vehicle_Speed_mean
    })

results_df = pd.DataFrame(results)
results_df.to_csv(r'C:\Users\s_alizadehnia\Downloads\tps.csv', index=False)
