from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db
from app.models import Observation, WorkerLog
from app.schemas import HealthResponse, ModelStatusResponse
from app.ml.manager import model_manager
from app.services.worker import ingestion_worker

router = APIRouter(tags=["System Health & Admin"])


@router.get("/api/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)):
    """
    System health check returning database connectivity, active station count,
    latest ingestion timestamp, data freshness status, and model readiness.
    """
    # Check DB
    db_ok = False
    station_count = 0
    last_obs_time = None
    freshness = "UNAVAILABLE"

    try:
        db.execute(text("SELECT 1"))
        db_ok = True

        latest_obs = (
            db.query(Observation)
            .order_by(Observation.ingestion_timestamp.desc())
            .first()
        )
        if latest_obs:
            last_obs_time = latest_obs.ingestion_timestamp
            freshness = latest_obs.freshness_status

        station_count = db.query(Observation.station_name).distinct().count()
    except Exception:
        db_ok = False

    return HealthResponse(
        status="healthy" if (db_ok and model_manager.is_loaded()) else "degraded",
        database_connected=db_ok,
        active_stations_count=station_count,
        last_ingestion_timestamp=last_obs_time,
        data_freshness=freshness,
        model_loaded=model_manager.is_loaded(),
        worker_running=ingestion_worker._running,
        version=settings.APP_VERSION,
    )


@router.get("/api/model/status", response_model=ModelStatusResponse)
def get_model_status():
    """
    Model status endpoint detailing algorithm parameters, active version,
    feature ordering, loaded state, and last inference execution.
    """
    contamination = 0.05
    if model_manager.is_loaded() and hasattr(model_manager.model, "contamination"):
        contamination = float(model_manager.model.contamination)

    return ModelStatusResponse(
        model_name="Air Quality Anomaly Detector",
        version=model_manager.version,
        algorithm="Isolation Forest (scikit-learn)",
        features=model_manager.features,
        is_loaded=model_manager.is_loaded(),
        contamination=contamination,
        last_inference_timestamp=model_manager.last_inference_time,
    )


@router.post("/api/admin/trigger-ingestion")
async def trigger_ingestion(x_admin_key: str = Header(None)):
    """
    Administrative endpoint to trigger controlled data ingestion and forecast cycle.
    Protected by token check in production.
    """
    if settings.ENVIRONMENT == "production" and x_admin_key != "delhi-digital-twin-secure-key":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing administration key",
        )

    res = await ingestion_worker.trigger_once()
    return {
        "status": "success",
        "result": res,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }
