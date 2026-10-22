from app.schemas.measurement import MeasurementRequest, AnomalyResponse
from app.models.anomaly_detector import AnomalyDetector
from app.core.config import get_settings

class InferenceService:
    def __init__(self):
        self.settings = get_settings()
        self.detector = AnomalyDetector()
    
    def detect_anomaly(self, measurement: MeasurementRequest) -> AnomalyResponse:
        # Règles métier
        reasons = []
        is_anomaly = False
        score = 0.0
        
        # Vérification puissance
        if measurement.power_kw > self.settings.power_threshold_kw:
            reasons.append(f"Puissance excessive: {measurement.power_kw} kW")
            is_anomaly = True
            score = max(score, 0.8)
        
        # Vérification tension
        if measurement.voltage:
            if measurement.voltage < self.settings.voltage_min or measurement.voltage > self.settings.voltage_max:
                reasons.append(f"Tension hors plage: {measurement.voltage} V")
                is_anomaly = True
                score = max(score, 0.7)
        
        # Vérification température
        if measurement.temperature and measurement.temperature > self.settings.temperature_max:
            reasons.append(f"Température excessive: {measurement.temperature} °C")
            is_anomaly = True
            score = max(score, 0.9)
        
        severity = "HIGH" if score >= 0.8 else "MEDIUM" if score >= 0.5 else "NORMAL"
        
        return AnomalyResponse(
            sensor_id=measurement.sensor_id,
            timestamp=measurement.timestamp,
            is_anomaly=is_anomaly,
            anomaly_score=score,
            severity=severity,
            reasons=reasons,
            model_version="rules-v1"
        )
