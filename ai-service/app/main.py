from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api import health, anomalies, forecasts, model_status, alerts, lstm_forecasts, efficiency

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Service IA pour la détection d'anomalies énergétiques"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(anomalies.router, prefix="/api/v1/anomalies", tags=["Anomalies"])
app.include_router(forecasts.router, prefix="/api/v1/forecasts", tags=["Forecasts"])
app.include_router(model_status.router, prefix="/api/v1/model", tags=["Model"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(lstm_forecasts.router, prefix="/api/v1/lstm-forecasts", tags=["LSTM Forecasts"])
app.include_router(efficiency.router, prefix="/api/v1/efficiency", tags=["Efficiency"])


@app.get("/")
async def root():
    return {"message": "AI Service - SmartEnergy Hub", "version": settings.app_version}
