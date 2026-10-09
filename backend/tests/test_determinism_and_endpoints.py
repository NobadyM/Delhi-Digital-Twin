from app.models import Observation, Forecast
from app.ml.forecaster import generate_forecasts_for_observation


def test_repeated_get_does_not_create_observations(client, seed_stations, db_session):
    """
    Guarantees requirement 1: GET requests must NEVER generate new observations.
    Refreshing the frontend must not alter database records.
    """
    initial_count = db_session.query(Observation).count()
    assert initial_count == 9

    # Call /api/live 5 times
    for _ in range(5):
        res = client.get("/api/live")
        assert res.status_code == 200

    # Call /api/map-data 5 times
    for _ in range(5):
        res = client.get("/api/map-data")
        assert res.status_code == 200

    post_count = db_session.query(Observation).count()
    assert post_count == initial_count, f"Observation count changed from {initial_count} to {post_count}"


def test_unchanged_database_records_produce_identical_responses(client, seed_stations):
    """
    Guarantees requirement 2: Unchanged database records produce consistent, deterministic API responses.
    """
    first_live = client.get("/api/live").json()
    second_live = client.get("/api/live").json()
    assert first_live == second_live, "Successive /api/live responses differed without database change"

    first_map = client.get("/api/map-data").json()
    second_map = client.get("/api/map-data").json()
    assert first_map == second_map, "Successive /api/map-data responses differed without database change"


def test_repeated_forecast_requests_return_stored_forecast(client, seed_stations, db_session):
    """
    Guarantees requirement 3: Repeated forecast requests return the stored forecast without recalculating.
    """
    # Seed forecasts for Central Delhi
    central_obs = (
        db_session.query(Observation)
        .filter(Observation.station_name == "Central Delhi")
        .first()
    )
    forecasts = generate_forecasts_for_observation(central_obs)
    for fc in forecasts:
        db_session.add(fc)
    db_session.commit()

    res1 = client.get("/api/forecasts?station=Central+Delhi").json()
    res2 = client.get("/api/forecasts?station=Central+Delhi").json()

    assert len(res1) == 4
    assert res1 == res2
    assert res1[0]["forecast_horizon_hours"] == 6
    assert "predicted_aqi" in res1[0]
    assert "confidence_lower" in res1[0]


def test_legacy_contracts_compatibility(client, seed_stations):
    """
    Guarantees requirement 12: Existing frontend integrations remain 100% compatible.
    Verifies field names and types for /api/live, /api/map-data, /api/predict.
    """
    # Test /api/live
    live_res = client.get("/api/live")
    assert live_res.status_code == 200
    live_data = live_res.json()
    assert live_data["status"] == "success"
    assert live_data["location"]["name"] == "Central Delhi"
    assert "aqi" in live_data
    assert "aqi_status" in live_data
    assert "pollutants" in live_data
    for p in ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]:
        assert p in live_data["pollutants"]
    assert "is_anomaly" in live_data
    assert "anomaly_score" in live_data
    assert "measurement_timestamp" in live_data

    # Test /api/map-data
    map_res = client.get("/api/map-data")
    assert map_res.status_code == 200
    map_data = map_res.json()
    assert map_data["status"] == "success"
    assert "average_aqi" in map_data
    assert map_data["monitored_locations"] == 9
    assert len(map_data["locations"]) == 9
    loc0 = map_data["locations"][0]
    assert "hotspot_rank" in loc0
    assert "relative_to_average_percent" in loc0
    assert "hotspot" in loc0

    # Test /api/predict
    pred_res = client.post(
        "/api/predict",
        json={
            "PM2_5": 85.0,
            "PM10": 150.0,
            "NO2": 32.0,
            "SO2": 14.0,
            "CO": 1.2,
            "O3": 28.0,
        },
    )
    assert pred_res.status_code == 200
    pred_data = pred_res.json()
    assert pred_data["status"] in ["Normal", "Anomaly"]
    assert "is_anomaly" in pred_data
    assert "anomaly_score" in pred_data
    assert pred_data["prediction"] in [1, -1]


def test_health_and_model_status_endpoints(client, seed_stations):
    """
    Tests /api/health and /api/model/status standard endpoints.
    """
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    health_data = health_res.json()
    assert health_data["database_connected"] is True
    assert health_data["active_stations_count"] == 9
    assert health_data["data_freshness"] == "LIVE"

    status_res = client.get("/api/model/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "Isolation Forest" in status_data["algorithm"]
    assert status_data["features"] == ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]
