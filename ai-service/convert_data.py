import json
import pandas as pd

# Load synthetic data
data = json.load(open('../scripts/synthetic_data.json'))

# Flatten all sensor data
rows = []
for sensor_id in data.keys():
    rows.extend(data[sensor_id])

# Create DataFrame
df = pd.DataFrame(rows)

# Rename columns to match training script expectations
df['measured_at'] = pd.to_datetime(df['timestamp'])
df = df.drop('timestamp', axis=1)
df = df.rename(columns={'sensorId': 'sensor_id', 'powerKw': 'power_kw'})

# Save to CSV
df.to_csv('data/raw/dataset.csv', index=False)
print(f'Created dataset.csv with {len(df)} rows')
