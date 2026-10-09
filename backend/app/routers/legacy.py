from statistics import mean
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Observation
from app.schemas import AirQualityData
from app.ml.manager import model_manager
from app.services.ingestion import DELHI_LOCATIONS

router = APIRouter(tags=["Legacy & Compatibility"])


@router.get("/")
def home():
    """Service root endpoint."""
    return {
        "status": "success",
        "message": "Delhi Digital Twin API is running",
    }


@router.get("/api/test")
def test():
    """Service health verification endpoint."""
    return {
        "status": "success",
        "message": "FastAPI backend is working",
    }


@router.get("/api/live")
def get_live_data(db: Session = Depends(get_db)):
    """
    Returns the latest persistent telemetry observation for Central Delhi.
    Deterministic: GET requests never invoke external APIs or re-run model inference.
    """
    obs = (
        db.query(Observation)
        .filter(Observation.station_name == "Central Delhi")
        .order_by(Observation.observation_timestamp.desc())
        .first()
    )

    if not obs:
        # Fallback to any latest observation if Central Delhi is not yet ingested
        obs = db.query(Observation).order_by(Observation.observation_timestamp.desc()).first()

    if not obs:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No telemetry observations available. Background ingestion pending.",
        )

    ts_str = obs.observation_timestamp.isoformat() if obs.observation_timestamp else None

    return {
        "status": "success",
        "source": obs.data_source,
        "aqi_scale": "US AQI",
        "location": {
            "name": obs.station_name,
            "latitude": obs.latitude,
            "longitude": obs.longitude,
        },
        "aqi": obs.aqi,
        "aqi_status": obs.aqi_status,
        "pollutants": obs.to_pollutants_dict(),
        "measurement_timestamp": ts_str,
        "prediction": obs.prediction,
        "anomaly": obs.anomaly_status,
        "anomaly_status": obs.anomaly_status,
        "is_anomaly": obs.is_anomaly,
        "anomaly_score": obs.anomaly_score,
        "quality_status": obs.quality_status,
        "freshness_status": obs.freshness_status,
    }


@router.get("/api/map-data")
def get_map_data(db: Session = Depends(get_db)):
    """
    Returns spatial telemetry across all monitored Delhi stations from persistent database.
    Deterministic: All calculations (average AQI, hotspots, rankings) are performed
    over consistent database records without live external requests.
    """
    location_results: List[Dict[str, Any]] = []

    for loc in DELHI_LOCATIONS:
        obs = (
            db.query(Observation)
            .filter(Observation.station_name == loc["name"])
            .order_by(Observation.observation_timestamp.desc())
            .first()
        )

        if obs:
            ts_str = obs.observation_timestamp.isoformat() if obs.observation_timestamp else None
            location_results.append({
                "name": obs.station_name,
                "latitude": obs.latitude,
                "longitude": obs.longitude,
                "aqi": obs.aqi,
                "aqi_status": obs.aqi_status,
                "pollutants": obs.to_pollutants_dict(),
                "measurement_timestamp": ts_str,
                "prediction": obs.prediction,
                "anomaly": obs.anomaly_status,
                "anomaly_status": obs.anomaly_status,
                "is_anomaly": obs.is_anomaly,
                "anomaly_score": obs.anomaly_score,
            })
        else:
            # Placeholder entry if station not yet ingested
            location_results.append({
                "name": loc["name"],
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
                "aqi": None,
                "aqi_status": "Unknown",
                "pollutants": {k: None for k in ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]},
                "measurement_timestamp": None,
                "prediction": 1,
                "anomaly": "Normal",
                "anomaly_status": "Normal",
                "is_anomaly": False,
                "anomaly_score": None,
            })

    valid_aqi_values = [
        item["aqi"] for item in location_results if item["aqi"] is not None
    ]
    average_aqi = mean(valid_aqi_values) if valid_aqi_values else None

    # Sort descending by AQI for ranking
    ranked_locations = sorted(
        location_results,
        key=lambda item: item["aqi"] if item["aqi"] is not None else -1,
        reverse=True,
    )

    for rank, location in enumerate(ranked_locations, start=1):
        location["hotspot_rank"] = rank
        aqi = location["aqi"]

        if average_aqi is not None and average_aqi > 0 and aqi is not None:
            relative_difference = ((aqi - average_aqi) / average_aqi) * 100
            location["relative_to_average_percent"] = round(relative_difference, 1)
            location["hotspot"] = (aqi >= average_aqi * 1.20)
        else:
            location["relative_to_average_percent"] = None
            location["hotspot"] = False

    anomaly_count = sum(1 for item in location_results if item["is_anomaly"])
    hotspot_count = sum(1 for item in location_results if item["hotspot"])

    return {
        "status": "success",
        "source": "Open-Meteo Air Quality API",
        "aqi_scale": "US AQI",
        "average_aqi": round(average_aqi, 1) if average_aqi is not None else None,
        "monitored_locations": len(location_results),
        "anomalies_detected": anomaly_count,
        "hotspots_detected": hotspot_count,
        "locations": location_results,
    }


@router.post("/api/predict")
def predict(data: AirQualityData):
    """
    Manual scenario simulation endpoint.
    Applies the Isolation Forest model using the unified ModelManager singleton.
    """
    pollutants = {
        "PM2.5": data.PM2_5,
        "PM10": data.PM10,
        "NO2": data.NO2,
        "SO2": data.SO2,
        "CO": data.CO,
        "O3": data.O3,
    }

    try:
        prediction, score = model_manager.predict(pollutants)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid prediction input: {exc}",
        )

    status_str = "Anomaly" if prediction == -1 else "Normal"

    return {
        "status": status_str,
        "prediction": prediction,
        "is_anomaly": (prediction == -1),
        "anomaly_score": round(score, 4),
        "pollutants": pollutants,
    }
