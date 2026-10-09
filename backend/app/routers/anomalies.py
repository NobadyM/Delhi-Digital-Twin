from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import AnomalyEvent
from app.schemas import AnomalyEventResponse

router = APIRouter(prefix="/api/anomalies", tags=["Anomalies"])


@router.get("", response_model=List[AnomalyEventResponse])
def get_anomalies(
    station: Optional[str] = Query(None, description="Filter by station name"),
    event_status: Optional[str] = Query(None, description="Filter by event status (e.g. ACTIVE, RESOLVED)"),
    limit: int = Query(50, ge=1, le=200, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """
    Returns stored anomaly events.
    Deterministic: Reads pre-detected, deduplicated anomaly events from persistent storage.
    Querying this endpoint never triggers model inference or fabricates new alerts.
    """
    query = db.query(AnomalyEvent)

    if station:
        query = query.filter(AnomalyEvent.station_name.ilike(f"%{station}%"))
    if event_status:
        query = query.filter(AnomalyEvent.event_status == event_status)

    events = (
        query.order_by(AnomalyEvent.detection_timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        AnomalyEventResponse(
            id=e.id,
            station_name=e.station_name,
            detection_timestamp=e.detection_timestamp,
            observation_timestamp=e.observation_timestamp,
            anomaly_type=e.anomaly_type,
            affected_parameter=e.affected_parameter,
            observed_value=e.observed_value,
            baseline_value=e.baseline_value,
            anomaly_score=e.anomaly_score,
            model_version=e.model_version,
            event_status=e.event_status,
        )
        for e in events
    ]
