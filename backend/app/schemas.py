from datetime import datetime
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


class PollutantsDict(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    PM2_5: Optional[float] = Field(None, alias="PM2.5")
    PM10: Optional[float] = None
    NO2: Optional[float] = None
    SO2: Optional[float] = None
    CO: Optional[float] = None
    O3: Optional[float] = None


class AirQualityData(BaseModel):
    PM2_5: float
    PM10: float
    NO2: float
    SO2: float
    CO: float
    O3: float


class LocationCoordinates(BaseModel):
    name: str
    latitude: float
    longitude: float


class ObservationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_name: str
    latitude: float
    longitude: float
    observation_timestamp: datetime
    ingestion_timestamp: datetime
    aqi: Optional[int]
    aqi_status: str
    pollutants: Dict[str, Optional[float]]
    data_source: str
    quality_status: str
    freshness_status: str


class ForecastItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    station_name: str
    forecast_horizon_hours: int
    generation_timestamp: datetime
    target_timestamp: datetime
    predicted_aqi: int
    predicted_pollutants: Dict[str, Optional[float]]
    confidence_lower: Optional[float] = None
    confidence_upper: Optional[float] = None
    model_version: str


class AnomalyEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    station_name: str
    detection_timestamp: datetime
    observation_timestamp: datetime
    anomaly_type: str
    affected_parameter: str
    observed_value: Optional[float] = None
    baseline_value: Optional[float] = None
    anomaly_score: float
    model_version: str
    event_status: str


class HealthResponse(BaseModel):
    status: str
    database_connected: bool
    active_stations_count: int
    last_ingestion_timestamp: Optional[datetime]
    data_freshness: str
    model_loaded: bool
    worker_running: bool
    version: str


class ModelStatusResponse(BaseModel):
    model_name: str
    version: str
    algorithm: str
    features: List[str]
    is_loaded: bool
    contamination: float
    last_inference_timestamp: Optional[datetime] = None


# Legacy Contracts for existing frontend
class LegacyLocationItem(BaseModel):
    name: str
    latitude: float
    longitude: float
    aqi: Optional[int]
    aqi_status: str
    pollutants: Dict[str, Optional[float]]
    measurement_timestamp: Optional[str]
    prediction: Optional[int]
    anomaly: str
    anomaly_status: str
    is_anomaly: bool
    anomaly_score: Optional[float]
    hotspot_rank: Optional[int] = None
    relative_to_average_percent: Optional[float] = None
    hotspot: bool = False


class LegacyMapDataResponse(BaseModel):
    status: str
    source: str
    aqi_scale: str
    average_aqi: Optional[float]
    monitored_locations: int
    anomalies_detected: int
    hotspots_detected: int
    locations: List[Dict[str, Any]]


class LegacyLiveResponse(BaseModel):
    status: str
    source: str
    aqi_scale: str
    location: Dict[str, Any]
    aqi: Optional[int]
    aqi_status: str
    pollutants: Dict[str, Optional[float]]
    measurement_timestamp: Optional[str]
    prediction: Optional[int]
    anomaly: str
    anomaly_status: str
    is_anomaly: bool
    anomaly_score: Optional[float]
