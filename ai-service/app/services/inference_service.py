from app.schemas.measurement import MeasurementRequest, AnomalyResponse
from app.models.anomaly_detector import AnomalyDetector
from app.core.config import get_settings
import numpy as np

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
        if measurement.voltage is not None:
            if measurement.voltage < self.settings.voltage_min or measurement.voltage > self.settings.voltage_max:
                reasons.append(f"Tension hors plage: {measurement.voltage} V")
                is_anomaly = True
                score = max(score, 0.7)
        
        # Vérification température
        if measurement.temperature is not None and measurement.temperature > self.settings.temperature_max:
            reasons.append(f"Température excessive: {measurement.temperature} °C")
            is_anomaly = True
            score = max(score, 0.9)
        
        # Utiliser le modèle ML si disponible
        if measurement.voltage is not None and measurement.temperature is not None:
            features = np.array([[measurement.power_kw, measurement.voltage, measurement.temperature]])
            ml_is_anomaly = self.detector.classify(features)[0] == -1
            # decision_function est négative sous le seuil appris par Isolation Forest.
            decision_score = float(self.detector.decision_scores(features)[0])
            ml_anomaly_score = float(1 / (1 + np.exp(np.clip(decision_score, -50, 50))))

            if self.detector.is_trained and ml_is_anomaly:
                reasons.append("Anomalie détectée par modèle ML")
                is_anomaly = True
                score = max(score, ml_anomaly_score)
        
        severity = "HIGH" if score >= 0.8 else "MEDIUM" if score >= 0.5 else "NORMAL"
        
        return AnomalyResponse(
            sensor_id=measurement.sensor_id,
            timestamp=measurement.timestamp,
            is_anomaly=is_anomaly,
            anomaly_score=score,
            severity=severity,
            reasons=reasons,
            model_version="isolation-forest-v1" if self.detector.is_trained else "rules-v1"
        )
