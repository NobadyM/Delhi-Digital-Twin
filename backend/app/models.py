from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    JSON,
    Text,
    UniqueConstraint,
    Index,
)
from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Observation(Base):
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    station_name = Column(String(64), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    observation_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    ingestion_timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    no2 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    co = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)

    aqi = Column(Integer, nullable=True)
    aqi_status = Column(String(32), default="Unknown", nullable=False)
    data_source = Column(String(64), default="Open-Meteo Air Quality API", nullable=False)
    quality_status = Column(String(32), default="VALID", nullable=False)
    freshness_status = Column(String(32), default="LIVE", nullable=False)

    # Pre-computed anomaly metrics calculated once at ingestion time
    prediction = Column(Integer, default=1, nullable=False)
    is_anomaly = Column(Boolean, default=False, nullable=False)
    anomaly_score = Column(Float, nullable=True)
    anomaly_status = Column(String(32), default="Normal", nullable=False)

    raw_data = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("station_name", "observation_timestamp", name="uq_station_observation_time"),
        Index("idx_station_time", "station_name", "observation_timestamp"),
    )

    def to_pollutants_dict(self):
        return {
            "PM2.5": self.pm25,
            "PM10": self.pm10,
            "NO2": self.no2,
            "SO2": self.so2,
            "CO": self.co,
            "O3": self.o3,
        }


class Forecast(Base):
    __tablename__ = "forecasts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    station_name = Column(String(64), nullable=False, index=True)
    generation_timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    target_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    forecast_horizon_hours = Column(Integer, nullable=False)

    predicted_aqi = Column(Integer, nullable=False)
    predicted_pm25 = Column(Float, nullable=True)
    predicted_pm10 = Column(Float, nullable=True)
    predicted_pollutants = Column(JSON, nullable=False)

    model_version = Column(String(64), nullable=False)
    cutoff_timestamp = Column(DateTime(timezone=True), nullable=False)
    confidence_lower = Column(Float, nullable=True)
    confidence_upper = Column(Float, nullable=True)

    __table_args__ = (
        UniqueConstraint("station_name", "target_timestamp", "model_version", name="uq_station_target_model"),
        Index("idx_forecast_station_target", "station_name", "target_timestamp"),
    )


class AnomalyEvent(Base):
    __tablename__ = "anomaly_events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    station_name = Column(String(64), nullable=False, index=True)
    detection_timestamp = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    observation_timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    anomaly_type = Column(String(64), default="isolation_forest_outlier", nullable=False)
    affected_parameter = Column(String(64), default="ALL", nullable=False)
    observed_value = Column(Float, nullable=True)
    baseline_value = Column(Float, nullable=True)
    anomaly_score = Column(Float, nullable=False)

    model_version = Column(String(64), nullable=False)
    event_status = Column(String(32), default="ACTIVE", nullable=False)

    __table_args__ = (
        UniqueConstraint("station_name", "observation_timestamp", "model_version", name="uq_station_obs_model_anomaly"),
        Index("idx_anomaly_station_time", "station_name", "observation_timestamp"),
    )


class WorkerLog(Base):
    __tablename__ = "worker_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_name = Column(String(64), nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(32), default="RUNNING", nullable=False)
    records_ingested = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
