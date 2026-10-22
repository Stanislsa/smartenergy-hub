from fastapi import APIRouter, HTTPException
from app.schemas.prediction import ForecastRequest, ForecastResponse

router = APIRouter()


@router.post("/predict", response_model=ForecastResponse)
async def predict_forecast(request: ForecastRequest):
    """
    Prédit la consommation future.
    
    Note: Cette fonctionnalité n'est pas encore implémentée.
    Elle nécessite un modèle de prévision entraîné.
    """
    raise HTTPException(
        status_code=501,
        detail="Prévision non implémentée - nécessite un modèle entraîné"
    )
