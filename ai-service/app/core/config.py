from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "AI Service"
    app_version: str = "0.1.0"
    port: int = 8085
    host: str = "0.0.0.0"
    
    # Model paths
    anomaly_model_path: str = "artifacts/anomaly_detector/model_v1.joblib"
    
    # Anomaly thresholds
    power_threshold_kw: float = 10.0
    voltage_min: float = 210.0
    voltage_max: float = 250.0
    temperature_max: float = 80.0
    
    model_config = {"env_file": ".env"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
