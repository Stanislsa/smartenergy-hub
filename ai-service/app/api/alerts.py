from fastapi import APIRouter, HTTPException
from app.schemas.alert import AlertRequest, AlertResponse, AlertHistoryResponse, ActiveAlertsResponse
from app.schemas.measurement import MeasurementRequest
from app.services.alert_service import AlertService
from app.services.inference_service import InferenceService

router = APIRouter()
alert_service = AlertService()
inference_service = InferenceService()


@router.post("/", response_model=AlertResponse)
async def create_alert(request: AlertRequest):
    """
    Génère une alerte à partir d'une mesure.
    
    Analyse la mesure, détecte les anomalies et génère une alerte
    avec explications et recommandations.
    """
    try:
        # Détecter anomalie directement depuis AlertRequest
        measurement = MeasurementRequest(
            sensor_id=request.sensor_id,
            timestamp=request.timestamp,
            power_kw=request.power_kw,
            voltage=request.voltage,
            temperature=request.temperature
        )
        
        # Détecter anomalie
        anomaly_result = inference_service.detect_anomaly(measurement)
        
        # Générer alerte
        alert = alert_service.generate_alert(measurement, anomaly_result)
        
        return alert
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/active", response_model=ActiveAlertsResponse)
async def get_active_alerts():
    """
    Récupère toutes les alertes actives (dernières 24h).
    """
    try:
        alerts = alert_service.get_active_alerts()
        
        return ActiveAlertsResponse(
            total_active=len(alerts),
            alerts=alerts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{sensor_id}", response_model=AlertHistoryResponse)
async def get_alert_history(sensor_id: str, limit: int = 100):
    """
    Récupère l'historique des alertes pour un capteur.
    
    Args:
        sensor_id: Identifiant du capteur
        limit: Nombre maximum d'alertes à retourner
    """
    try:
        alerts = alert_service.get_alerts_by_sensor(sensor_id)
        alerts = alerts[-limit:] if len(alerts) > limit else alerts
        
        return AlertHistoryResponse(
            sensor_id=sensor_id,
            total_alerts=len(alerts),
            alerts=alerts
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
