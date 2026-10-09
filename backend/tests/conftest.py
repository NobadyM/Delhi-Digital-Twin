from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import Observation, Forecast, AnomalyEvent
from app.services.ingestion import DELHI_LOCATIONS
from main import app

# In-memory SQLite for test isolation
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_stations(db_session):
    """Populates initial valid observations for all 9 Delhi stations."""
    now = datetime.now(timezone.utc)
    records = []
    base_aqis = [163, 215, 120, 185, 170, 195, 210, 145, 130]

    for loc, aqi in zip(DELHI_LOCATIONS, base_aqis):
        obs = Observation(
            station_name=loc["name"],
            latitude=loc["latitude"],
            longitude=loc["longitude"],
            observation_timestamp=now,
            ingestion_timestamp=now,
            pm25=round(aqi * 0.45, 1),
            pm10=round(aqi * 0.85, 1),
            no2=35.0,
            so2=12.0,
            co=1.2,
            o3=28.0,
            aqi=aqi,
            aqi_status="Moderate" if aqi <= 200 else "Poor",
            data_source="Open-Meteo Air Quality API",
            quality_status="VALID",
            freshness_status="LIVE",
            prediction=1,
            is_anomaly=False,
            anomaly_score=0.08,
            anomaly_status="Normal",
        )
        db_session.add(obs)
        records.append(obs)

    db_session.commit()
    return records


@pytest.fixture
def mock_open_meteo_payload():
    """Returns a realistic mock response for all 9 Delhi stations."""
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:00")
    items = []
    for loc in DELHI_LOCATIONS:
        items.append({
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "timezone": "Asia/Kolkata",
            "current": {
                "time": now_str,
                "us_aqi": 165,
                "pm2_5": 75.2,
                "pm10": 140.5,
                "nitrogen_dioxide": 36.1,
                "sulphur_dioxide": 11.4,
                "carbon_monoxide": 650.0,  # µg/m³
                "ozone": 25.3,
            },
        })
    return items
