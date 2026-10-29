import sys
sys.path.insert(0, '/app')
from app.services.forecast_service import ForecastService
from app.services.cassandra_service import CassandraService
import numpy as np

service = ForecastService()
cassandra = CassandraService()

try:
    features = service.get_features_from_cassandra('SENSOR-001')
    print(f'Features shape: {features.shape}')
    print(f'Features: {features}')
    
    prediction = service.predict(features, 60, sensor_id='SENSOR-001')
    print(f'Prediction keys: {prediction.keys()}')
    print(f'Prediction: {prediction}')
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
