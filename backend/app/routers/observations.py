from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Observation
from app.schemas import ObservationResponse

router = APIRouter(prefix="/api/observations", tags=["Observations"])


@router.get("/latest", response_model=List[ObservationResponse])
def get_latest_observations(
    station: Optional[str] = Query(None, description="Filter by station name"),
    db: Session = Depends(get_db),
):
    """
    Returns the most recent valid observation for each station or a specific station.
    """
    query = db.query(Observation)
    if station:
        obs = (
            query.filter(Observation.station_name.ilike(f"%{station}%"))
            .order_by(Observation.observation_timestamp.desc())
            .first()
        )
        if not obs:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No observations found for station '{station}'",
            )
        return [
            ObservationResponse(
                id=obs.id,
                station_name=obs.station_name,
                latitude=obs.latitude,
                longitude=obs.longitude,
                observation_timestamp=obs.observation_timestamp,
                ingestion_timestamp=obs.ingestion_timestamp,
                aqi=obs.aqi,
                aqi_status=obs.aqi_status,
                pollutants=obs.to_pollutants_dict(),
                data_source=obs.data_source,
                quality_status=obs.quality_status,
                freshness_status=obs.freshness_status,
            )
        ]

    # Return latest observation per distinct station
    stations = db.query(Observation.station_name).distinct().all()
    results = []
    for (st_name,) in stations:
        latest = (
            db.query(Observation)
            .filter(Observation.station_name == st_name)
            .order_by(Observation.observation_timestamp.desc())
            .first()
        )
        if latest:
            results.append(
                ObservationResponse(
                    id=latest.id,
                    station_name=latest.station_name,
                    latitude=latest.latitude,
                    longitude=latest.longitude,
                    observation_timestamp=latest.observation_timestamp,
                    ingestion_timestamp=latest.ingestion_timestamp,
                    aqi=latest.aqi,
                    aqi_status=latest.aqi_status,
                    pollutants=latest.to_pollutants_dict(),
                    data_source=latest.data_source,
                    quality_status=latest.quality_status,
                    freshness_status=latest.freshness_status,
                )
            )

    return results


@router.get("/history", response_model=List[ObservationResponse])
def get_observation_history(
    station: Optional[str] = Query(None, description="Filter by station name"),
    limit: int = Query(50, ge=1, le=500, description="Page limit"),
    offset: int = Query(0, ge=0, description="Offset"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated historical observations.
    """
    query = db.query(Observation)
    if station:
        query = query.filter(Observation.station_name.ilike(f"%{station}%"))

    records = (
        query.order_by(Observation.observation_timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        ObservationResponse(
            id=r.id,
            station_name=r.station_name,
            latitude=r.latitude,
            longitude=r.longitude,
            observation_timestamp=r.observation_timestamp,
            ingestion_timestamp=r.ingestion_timestamp,
            aqi=r.aqi,
            aqi_status=r.aqi_status,
            pollutants=r.to_pollutants_dict(),
            data_source=r.data_source,
            quality_status=r.quality_status,
            freshness_status=r.freshness_status,
        )
        for r in records
    ]
