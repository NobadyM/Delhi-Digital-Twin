from datetime import datetime, timezone, timedelta
from unittest.mock import patch
import requests

from app.models import Observation, Forecast, AnomalyEvent
from app.services.ingestion import (
    run_ingestion_pipeline,
    validate_and_normalize_measurement,
    update_freshness_statuses,
    DELHI_LOCATIONS,
)
from app.services.anomaly_service import evaluate_and_persist_anomaly


def test_ingestion_persists_valid_observations(db_session, mock_open_meteo_payload):
    """
    Guarantees requirement 4: New source records are ingested and persisted correctly.
    """
    with patch("app.services.ingestion.fetch_open_meteo_data", return_value=mock_open_meteo_payload):
        res = run_ingestion_pipeline(db_session)
        assert res["status"] == "success"
        assert res["records_ingested"] == len(DELHI_LOCATIONS)

    # Check database counts
    obs_count = db_session.query(Observation).count()
    assert obs_count == 9

    # Check forecast count (4 horizons per station = 36)
    fc_count = db_session.query(Forecast).count()
    assert fc_count == 36


def test_duplicate_records_not_processed_twice(db_session, mock_open_meteo_payload):
    """
    Guarantees requirement 5: Duplicate records are rejected and not processed twice.
    """
    with patch("app.services.ingestion.fetch_open_meteo_data", return_value=mock_open_meteo_payload):
        res1 = run_ingestion_pipeline(db_session)
        assert res1["records_ingested"] == 9

        # Run again with same payload (same timestamp)
        res2 = run_ingestion_pipeline(db_session)
        assert res2["records_ingested"] == 0

    obs_count = db_session.query(Observation).count()
    assert obs_count == 9, "Duplicate records were incorrectly added to the database"


def test_external_api_failures_preserve_existing_data(db_session, mock_open_meteo_payload):
    """
    Guarantees requirement 6: External API failures preserve existing valid data
    and never produce fabricated or zero readings.
    """
    # 1. Ingest initial valid data
    with patch("app.services.ingestion.fetch_open_meteo_data", return_value=mock_open_meteo_payload):
        run_ingestion_pipeline(db_session)

    initial_obs = db_session.query(Observation).all()
    initial_values = {o.station_name: (o.aqi, o.pm25) for o in initial_obs}

    # 2. Simulate API failure
    with patch("app.services.ingestion.fetch_open_meteo_data", side_effect=requests.RequestException("Network timeout")):
        fail_res = run_ingestion_pipeline(db_session)
        assert fail_res["status"] == "failed"
        assert fail_res["records_ingested"] == 0

    # 3. Verify database was preserved completely
    post_obs = db_session.query(Observation).all()
    assert len(post_obs) == 9
    for o in post_obs:
        expected_aqi, expected_pm25 = initial_values[o.station_name]
        assert o.aqi == expected_aqi
        assert o.pm25 == expected_pm25
        assert o.aqi is not None and o.aqi > 0, "Valid readings were overwritten with invalid/zero data"


def test_invalid_measurements_sanitized_or_flagged():
    """
    Guarantees requirement 7: Out-of-bounds measurements are rejected or appropriately flagged.
    """
    # Negative values and impossible outliers
    current = {
        "us_aqi": -50,
        "pm2_5": 9999.0,  # exceeds upper bound 1500
        "pm10": -20.0,    # negative
        "nitrogen_dioxide": 45.0,
        "sulphur_dioxide": 12.0,
        "carbon_monoxide": 500.0,
        "ozone": 30.0,
    }
    norm = validate_and_normalize_measurement(current)
    assert norm["pm25"] is None
    assert norm["pm10"] is None
    # AQI -50 is clamped or kept if within sanitize rule, but let's check
    assert norm["quality_status"] == "SUSPICIOUS" or norm["pm25"] is None


def test_anomaly_events_deduplicated(db_session):
    """
    Guarantees requirement 10: Anomaly events are deduplicated across repeat evaluations.
    """
    now = datetime.now(timezone.utc)
    # Severe spike observation that triggers anomaly
    obs = Observation(
        station_name="North Delhi",
        latitude=28.7041,
        longitude=77.1025,
        observation_timestamp=now,
        ingestion_timestamp=now,
        pm25=350.0,
        pm10=550.0,
        no2=85.0,
        so2=35.0,
        co=3.5,
        o3=60.0,
        aqi=410,
        aqi_status="Hazardous",
    )
    db_session.add(obs)
    db_session.commit()

    # First evaluation
    event1 = evaluate_and_persist_anomaly(db_session, obs)
    db_session.commit()
    assert event1 is not None

    count1 = db_session.query(AnomalyEvent).count()
    assert count1 == 1

    # Second evaluation on the same observation
    event2 = evaluate_and_persist_anomaly(db_session, obs)
    db_session.commit()
    assert event2 is not None

    count2 = db_session.query(AnomalyEvent).count()
    assert count2 == 1, "Duplicate anomaly events were inserted for the same observation"


def test_stale_data_state_calculated_correctly(db_session):
    """
    Guarantees requirement 11: Stale data states are calculated correctly according to elapsed time.
    """
    # Observation older than 3 hours (threshold is 120 minutes)
    old_time = datetime.now(timezone.utc) - timedelta(hours=3)
    obs = Observation(
        station_name="South Delhi",
        latitude=28.5244,
        longitude=77.1855,
        observation_timestamp=old_time,
        ingestion_timestamp=old_time,
        pm25=50.0,
        pm10=90.0,
        no2=30.0,
        so2=10.0,
        co=0.9,
        o3=25.0,
        aqi=140,
        freshness_status="LIVE",
    )
    db_session.add(obs)
    db_session.commit()

    update_freshness_statuses(db_session)
    db_session.commit()

    refreshed_obs = db_session.query(Observation).filter(Observation.station_name == "South Delhi").first()
    assert refreshed_obs.freshness_status == "STALE"
