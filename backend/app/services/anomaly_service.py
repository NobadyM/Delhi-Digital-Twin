import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.models import Observation, AnomalyEvent
from app.ml.manager import model_manager

logger = logging.getLogger("delhi_twin.services.anomaly")


def evaluate_and_persist_anomaly(db: Session, obs: Observation) -> Optional[AnomalyEvent]:
    """
    Evaluates an observation using the Isolation Forest model and physical rules.
    Persists the AnomalyEvent if anomalous, deduplicating repeated detections.
    """
    pollutants = obs.to_pollutants_dict()
    prediction, score = model_manager.predict(pollutants)

    is_anomaly = (prediction == -1)

    # Secondary physical check for sudden extreme spikes
    pm25 = obs.pm25 or 0
    pm10 = obs.pm10 or 0
    is_spike = pm25 > 220 or pm10 > 400

    # Populate precomputed anomaly fields on Observation record
    obs.prediction = prediction
    obs.anomaly_score = round(score, 4)
    obs.is_anomaly = is_anomaly or is_spike
    obs.anomaly_status = "Anomaly" if obs.is_anomaly else "Normal"

    if not is_anomaly and not is_spike:
        return None

    anomaly_type = "sudden_spike" if is_spike else "isolation_forest_outlier"
    affected_param = "PM2.5/PM10" if is_spike else "MULTIVARIATE"

    # Check deduplication
    existing = db.query(AnomalyEvent).filter(
        AnomalyEvent.station_name == obs.station_name,
        AnomalyEvent.observation_timestamp == obs.observation_timestamp,
        AnomalyEvent.model_version == settings.MODEL_VERSION,
    ).first()

    if existing:
        logger.debug(f"Anomaly event already recorded for {obs.station_name} at {obs.observation_timestamp}")
        return existing

    event = AnomalyEvent(
        station_name=obs.station_name,
        detection_timestamp=datetime.now(timezone.utc),
        observation_timestamp=obs.observation_timestamp,
        anomaly_type=anomaly_type,
        affected_parameter=affected_param,
        observed_value=pm25 if is_spike else float(obs.aqi or 0),
        baseline_value=60.0 if is_spike else 150.0,
        anomaly_score=score,
        model_version=settings.MODEL_VERSION,
        event_status="ACTIVE",
    )
    db.add(event)
    return event
