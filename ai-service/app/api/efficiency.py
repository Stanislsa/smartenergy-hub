from fastapi import APIRouter, HTTPException, Query
from app.schemas.efficiency import EfficiencyResponse
from app.services.efficiency_service import EfficiencyService
from datetime import datetime

router = APIRouter()
efficiency_service = EfficiencyService()


@router.get("/{sensor_id}", response_model=EfficiencyResponse)
async def get_efficiency(
    sensor_id: str,
    period_days: int = Query(default=30, ge=1, le=365, description="Période d'analyse en jours")
):
    """
    Analyse l'efficacité énergétique d'un capteur.
    
    Compare la consommation actuelle avec l'historique pour identifier
    les surconsommations et générer des recommandations d'optimisation.
    
    Args:
        sensor_id: Identifiant du capteur
        period_days: Période d'analyse (1-365 jours)
    """
    try:
        analysis = efficiency_service.analyze_efficiency(sensor_id, period_days)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
