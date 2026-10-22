from fastapi import APIRouter, HTTPException
from app.schemas.measurement import MeasurementRequest, AnomalyResponse
from app.services.inference_service import InferenceService

router = APIRouter()
inference_service = InferenceService()


@router.post("/predict", response_model=AnomalyResponse)
async def predict_anomaly(measurement: MeasurementRequest):
    try:
        result = inference_service.detect_anomaly(measurement)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
