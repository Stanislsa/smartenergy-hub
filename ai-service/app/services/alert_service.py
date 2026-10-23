from app.schemas.alert import AlertRequest, AlertResponse, AlertSeverity
from app.schemas.measurement import MeasurementRequest
from app.core.config import get_settings
from datetime import datetime, timedelta
import uuid
from typing import List


class AlertService:
    def __init__(self):
        self.settings = get_settings()
        # Stockage en mémoire pour les alertes (à remplacer par une base de données)
        self.alerts: List[AlertResponse] = []
    
    def generate_alert(self, measurement: MeasurementRequest, anomaly_result: dict) -> AlertResponse:
        """
        Génère une alerte avec explications et recommandations.
        
        Args:
            measurement: La mesure analysée
            anomaly_result: Résultat de la détection d'anomalie
        
        Returns:
            AlertResponse avec détails complets
        """
        alert_id = str(uuid.uuid4())
        severity = self._determine_severity(anomaly_result)
        alert_type, observed_value, expected_value, threshold = self._extract_alert_details(measurement, anomaly_result)
        explanation = self._generate_explanation(alert_type, observed_value, expected_value, threshold)
        recommendations = self._generate_recommendations(alert_type, severity, observed_value, threshold)
        deviation_percent = self._calculate_deviation(observed_value, expected_value, threshold)
        
        alert = AlertResponse(
            alert_id=alert_id,
            sensor_id=measurement.sensor_id,
            timestamp=measurement.timestamp,
            severity=severity,
            alert_type=alert_type,
            observed_value=observed_value,
            expected_value=expected_value,
            threshold=threshold,
            deviation_percent=deviation_percent,
            explanation=explanation,
            recommendations=recommendations,
            created_at=datetime.utcnow(),
            model_version="rules-v1"
        )
        
        self.alerts.append(alert)
        return alert
    
    def _determine_severity(self, anomaly_result) -> AlertSeverity:
        """Détermine la gravité de l'alerte."""
        score = getattr(anomaly_result, 'anomaly_score', 0)
        if score >= 0.8:
            return AlertSeverity.CRITICAL
        elif score >= 0.5:
            return AlertSeverity.WARNING
        else:
            return AlertSeverity.INFO
    
    def _extract_alert_details(self, measurement: MeasurementRequest, anomaly_result) -> tuple:
        """Extrait les détails de l'alerte."""
        reasons = getattr(anomaly_result, 'reasons', [])
        
        if "Puissance" in str(reasons):
            return "HIGH_POWER", measurement.power_kw, self.settings.power_threshold_kw, self.settings.power_threshold_kw
        elif "Tension" in str(reasons):
            return "VOLTAGE_OUT_OF_RANGE", measurement.voltage or 0, 230.0, self.settings.voltage_max
        elif "Température" in str(reasons):
            return "HIGH_TEMPERATURE", measurement.temperature or 0, self.settings.temperature_max, self.settings.temperature_max
        else:
            return "NORMAL", measurement.power_kw, None, None
    
    def _generate_explanation(self, alert_type: str, observed: float, expected: float, threshold: float) -> str:
        """Génère une explication textuelle."""
        explanations = {
            "HIGH_POWER": f"Puissance excessive détectée: {observed:.2f} kW (seuil: {threshold:.2f} kW). La consommation dépasse la normale de {((observed - threshold) / threshold * 100):.1f}%." if threshold else f"Puissance excessive détectée: {observed:.2f} kW.",
            "VOLTAGE_OUT_OF_RANGE": f"Tension hors plage: {observed:.1f} V (plage acceptable: {self.settings.voltage_min}-{self.settings.voltage_max} V). Risque de dommage équipement.",
            "HIGH_TEMPERATURE": f"Température excessive détectée: {observed:.1f} °C (seuil: {threshold:.1f} °C). Risque de surchauffe." if threshold else f"Température excessive détectée: {observed:.1f} °C.",
            "NORMAL": "Mesure dans les limites normales. Aucune anomalie détectée."
        }
        
        return explanations.get(alert_type, "Anomalie détectée")
    
    def _generate_recommendations(self, alert_type: str, severity: AlertSeverity, observed: float, threshold: float) -> List[str]:
        """Génère des recommandations d'action."""
        recommendations = {
            "HIGH_POWER": [
                "Vérifier les équipements connectés",
                "Identifier les appareils surconsommants",
                "Envisager la déconnexion des charges non essentielles",
                "Vérifier si une consommation anormale est prévue"
            ],
            "VOLTAGE_OUT_OF_RANGE": [
                "Vérifier le réseau électrique",
                "Contrôler le transformateur",
                "Isoler les équipements sensibles",
                "Contacter le fournisseur d'électricité si persistant"
            ],
            "HIGH_TEMPERATURE": [
                "Vérifier la ventilation",
                "Réduire la charge de travail",
                "Contrôler le système de refroidissement",
                "Arrêter l'équipement si nécessaire"
            ],
            "NORMAL": ["Aucune action requise"]
        }
        
        base_recs = recommendations.get(alert_type, ["Vérifier le système"])
        
        if severity == AlertSeverity.CRITICAL:
            base_recs.insert(0, "ALERTE CRITIQUE: Action immédiate requise")
        
        return base_recs
    
    def _calculate_deviation(self, observed: float, expected: float, threshold: float) -> float:
        """Calcule le pourcentage de déviation."""
        if expected and expected > 0:
            return ((observed - expected) / expected) * 100
        elif threshold and threshold > 0:
            return ((observed - threshold) / threshold) * 100
        return 0.0
    
    def get_alerts_by_sensor(self, sensor_id: str) -> List[AlertResponse]:
        """Récupère les alertes pour un capteur."""
        return [alert for alert in self.alerts if alert.sensor_id == sensor_id]
    
    def get_active_alerts(self) -> List[AlertResponse]:
        """Récupère les alertes actives (dernières 24h)."""
        cutoff = datetime.utcnow() - timedelta(hours=24)
        return [alert for alert in self.alerts if alert.created_at >= cutoff]
