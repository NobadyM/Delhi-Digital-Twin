import logging
import time
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import requests
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Observation, Forecast, WorkerLog
from app.services.anomaly_service import evaluate_and_persist_anomaly
from app.ml.forecaster import generate_forecasts_for_observation

logger = logging.getLogger("delhi_twin.services.ingestion")

DELHI_LOCATIONS = [
    {"name": "Central Delhi", "latitude": 28.6139, "longitude": 77.2090},
    {"name": "North Delhi", "latitude": 28.7041, "longitude": 77.1025},
    {"name": "South Delhi", "latitude": 28.5244, "longitude": 77.1855},
    {"name": "East Delhi", "latitude": 28.6280, "longitude": 77.2770},
    {"name": "West Delhi", "latitude": 28.6517, "longitude": 77.0855},
    {"name": "North-East Delhi", "latitude": 28.6800, "longitude": 77.2800},
    {"name": "North-West Delhi", "latitude": 28.7200, "longitude": 77.0500},
    {"name": "South-East Delhi", "latitude": 28.5600, "longitude": 77.3000},
    {"name": "South-West Delhi", "latitude": 28.5700, "longitude": 77.0500},
]

POLLUTANT_FIELDS = [
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "carbon_monoxide",
    "ozone",
]

CURRENT_FIELDS = ["us_aqi"] + POLLUTANT_FIELDS


def map_aqi_status(aqi: Optional[int]) -> str:
    if aqi is None:
        return "Unknown"
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"


def parse_timestamp(ts_str: Optional[str]) -> datetime:
    if not ts_str:
        return datetime.now(timezone.utc)
    try:
        # ISO timestamp from Open-Meteo (e.g., '2026-10-09T21:30')
        dt = datetime.fromisoformat(ts_str)
        if dt.tzinfo is None:
            # Open-Meteo returns timezone Asia/Kolkata (UTC+5:30)
            dt = dt.replace(tzinfo=timezone(timedelta(hours=5, minutes=30))).astimezone(timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


def fetch_open_meteo_data(retries: int = 2) -> List[Dict[str, Any]]:
    latitudes = [loc["latitude"] for loc in DELHI_LOCATIONS]
    longitudes = [loc["longitude"] for loc in DELHI_LOCATIONS]

    params = {
        "latitude": ",".join(map(str, latitudes)),
        "longitude": ",".join(map(str, longitudes)),
        "current": ",".join(CURRENT_FIELDS),
        "timezone": "Asia/Kolkata",
    }

    last_error = None
    for attempt in range(retries):
        try:
            response = requests.get(
                settings.OPEN_METEO_URL,
                params=params,
                timeout=settings.REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                data = [data]
            if isinstance(data, list) and len(data) == len(DELHI_LOCATIONS):
                return data
            raise ValueError(f"Unexpected response length: expected {len(DELHI_LOCATIONS)}, got {len(data)}")
        except Exception as exc:
            last_error = exc
            logger.warning(f"Fetch attempt {attempt + 1}/{retries} failed: {exc}")
            if attempt < retries - 1:
                time.sleep(2 ** attempt)

    raise last_error or RuntimeError("Failed to fetch data from Open-Meteo")


def validate_and_normalize_measurement(current: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates pollutant values and normalizes units.
    """
    def sanitize(val, min_val, max_val):
        if val is None:
            return None
        try:
            num = float(val)
            if num < min_val or num > max_val:
                return None
            return round(num, 2)
        except (ValueError, TypeError):
            return None

    pm25 = sanitize(current.get("pm2_5"), 0, 1500)
    pm10 = sanitize(current.get("pm10"), 0, 2500)
    no2 = sanitize(current.get("nitrogen_dioxide"), 0, 1000)
    so2 = sanitize(current.get("sulphur_dioxide"), 0, 1000)
    raw_co = sanitize(current.get("carbon_monoxide"), 0, 100000)
    o3 = sanitize(current.get("ozone"), 0, 1000)

    # Normalize CO from µg/m³ to mg/m³ if needed
    co = round(raw_co / 1000.0, 2) if raw_co and raw_co > 15 else raw_co

    aqi_raw = current.get("us_aqi")
    aqi = int(round(float(aqi_raw))) if aqi_raw is not None else None

    # Quality check
    quality = "VALID"
    if pm25 is None and pm10 is None and aqi is None:
        quality = "SUSPICIOUS"

    return {
        "pm25": pm25,
        "pm10": pm10,
        "no2": no2,
        "so2": so2,
        "co": co,
        "o3": o3,
        "aqi": aqi,
        "quality_status": quality,
    }


def update_freshness_statuses(db: Session):
    """
    Sets freshness_status to STALE if last observation exceeds threshold.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.STALE_THRESHOLD_MINUTES)
    db.query(Observation).filter(
        Observation.observation_timestamp < cutoff,
        Observation.freshness_status == "LIVE",
    ).update({"freshness_status": "STALE"}, synchronize_session=False)


def run_ingestion_pipeline(db: Session) -> Dict[str, Any]:
    """
    Executes a complete ingestion run:
    1. Fetches source data from Open-Meteo.
    2. Validates and normalizes records.
    3. Deduplicates against Observation table.
    4. Persists new observations.
    5. Triggers anomaly detection and multi-horizon forecasts.
    6. Updates freshness and logs execution in WorkerLog.
    """
    worker_log = WorkerLog(
        job_name="open_meteo_ingestion",
        started_at=datetime.now(timezone.utc),
        status="RUNNING",
    )
    db.add(worker_log)
    db.commit()

    records_ingested = 0
    try:
        api_data = fetch_open_meteo_data()
        now_utc = datetime.now(timezone.utc)

        for loc_cfg, loc_data in zip(DELHI_LOCATIONS, api_data):
            current = loc_data.get("current", {})
            obs_time = parse_timestamp(current.get("time"))
            norm = validate_and_normalize_measurement(current)

            # Check if this exact observation already exists for this station
            existing = db.query(Observation).filter(
                Observation.station_name == loc_cfg["name"],
                Observation.observation_timestamp == obs_time,
            ).first()

            if existing:
                logger.debug(f"Observation for {loc_cfg['name']} at {obs_time} already exists. Skipping.")
                continue

            # Determine freshness
            freshness = "LIVE"
            if (now_utc - obs_time) > timedelta(minutes=settings.STALE_THRESHOLD_MINUTES):
                freshness = "STALE"
            elif (now_utc - obs_time) > timedelta(minutes=settings.DELAYED_THRESHOLD_MINUTES):
                freshness = "DELAYED"

            obs = Observation(
                station_name=loc_cfg["name"],
                latitude=loc_cfg["latitude"],
                longitude=loc_cfg["longitude"],
                observation_timestamp=obs_time,
                ingestion_timestamp=now_utc,
                pm25=norm["pm25"],
                pm10=norm["pm10"],
                no2=norm["no2"],
                so2=norm["so2"],
                co=norm["co"],
                o3=norm["o3"],
                aqi=norm["aqi"],
                aqi_status=map_aqi_status(norm["aqi"]),
                data_source="Open-Meteo Air Quality API",
                quality_status=norm["quality_status"],
                freshness_status=freshness,
                raw_data=current,
            )
            db.add(obs)
            db.flush()  # assign ID

            # Evaluate Anomaly
            evaluate_and_persist_anomaly(db, obs)

            # Generate and Persist Forecasts
            forecasts = generate_forecasts_for_observation(obs)
            for fc in forecasts:
                # Replace existing forecast for this station/target/model
                db.query(Forecast).filter(
                    Forecast.station_name == fc.station_name,
                    Forecast.target_timestamp == fc.target_timestamp,
                    Forecast.model_version == fc.model_version,
                ).delete()
                db.add(fc)

            records_ingested += 1

        update_freshness_statuses(db)

        worker_log.status = "SUCCESS"
        worker_log.records_ingested = records_ingested
        worker_log.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Ingestion pipeline completed successfully. {records_ingested} new records committed.")
        return {"status": "success", "records_ingested": records_ingested}

    except Exception as exc:
        db.rollback()
        logger.error(f"Ingestion pipeline failed: {exc}", exc_info=True)
        worker_log.status = "FAILED"
        worker_log.error_message = str(exc)
        worker_log.completed_at = datetime.now(timezone.utc)
        db.commit()
        return {"status": "failed", "error": str(exc), "records_ingested": 0}
