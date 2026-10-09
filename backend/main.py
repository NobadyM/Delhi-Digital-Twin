
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import requests
from pathlib import Path
from statistics import mean

# =========================================================
# CONFIGURATION
# =========================================================

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model" / "isolation_forest.pkl"

OPEN_METEO_URL = (
    "https://air-quality-api.open-meteo.com/v1/air-quality"
)

# =========================================================
# LOAD MACHINE LEARNING MODEL
# =========================================================

model = joblib.load(MODEL_PATH)

# =========================================================
# FASTAPI APPLICATION
# =========================================================

app = FastAPI(
    title="Delhi Digital Twin API",
    description=(
        "Real-Time Urban Air Quality Monitoring "
        "and Anomaly Detection"
    ),
    version="2.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================
# INPUT MODEL FOR MANUAL PREDICTION
# =========================================================

class AirQualityData(BaseModel):
    PM2_5: float
    PM10: float
    NO2: float
    SO2: float
    CO: float
    O3: float


# =========================================================
# DELHI MONITORING LOCATIONS
# =========================================================

DELHI_LOCATIONS = [
    {
        "name": "Central Delhi",
        "latitude": 28.6139,
        "longitude": 77.2090,
    },
    {
        "name": "North Delhi",
        "latitude": 28.7041,
        "longitude": 77.1025,
    },
    {
        "name": "South Delhi",
        "latitude": 28.5244,
        "longitude": 77.1855,
    },
    {
        "name": "East Delhi",
        "latitude": 28.6280,
        "longitude": 77.2770,
    },
    {
        "name": "West Delhi",
        "latitude": 28.6517,
        "longitude": 77.0855,
    },
    {
        "name": "North-East Delhi",
        "latitude": 28.6800,
        "longitude": 77.2800,
    },
    {
        "name": "North-West Delhi",
        "latitude": 28.7200,
        "longitude": 77.0500,
    },
    {
        "name": "South-East Delhi",
        "latitude": 28.5600,
        "longitude": 77.3000,
    },
    {
        "name": "South-West Delhi",
        "latitude": 28.5700,
        "longitude": 77.0500,
    },
]

# =========================================================
# OPEN-METEO REQUEST PARAMETERS
# =========================================================

POLLUTANT_FIELDS = [
    "pm2_5",
    "pm10",
    "nitrogen_dioxide",
    "sulphur_dioxide",
    "carbon_monoxide",
    "ozone",
]

CURRENT_FIELDS = ["us_aqi"] + POLLUTANT_FIELDS


def fetch_air_quality(latitudes, longitudes):
    """
    Fetch current US AQI and pollutant concentrations.

    Open-Meteo returns a list of response objects when
    multiple coordinates are supplied.
    """

    params = {
        "latitude": ",".join(map(str, latitudes)),
        "longitude": ",".join(map(str, longitudes)),
        "current": ",".join(CURRENT_FIELDS),
        "timezone": "Asia/Kolkata",
    }

    try:
        response = requests.get(
            OPEN_METEO_URL,
            params=params,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Open-Meteo API request failed: {exc}",
        )

    if isinstance(data, dict) and data.get("error"):
        raise HTTPException(
            status_code=502,
            detail=data.get(
                "reason",
                "Open-Meteo returned an API error",
            ),
        )

    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list) or len(data) != len(latitudes):
        raise HTTPException(
            status_code=502,
            detail="Unexpected number of locations in API response",
        )

    return data


# =========================================================
# AQI STATUS - UNITED STATES AQI SCALE
# =========================================================

def get_aqi_status(aqi):
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


# =========================================================
# POLLUTANT RESPONSE FORMAT
# =========================================================

def extract_pollutants(current):
    """
    Open-Meteo pollutant concentrations are in µg/m³.
    These are current modelled values, not 24-hour averages.
    """

    field_mapping = {
        "PM2.5": "pm2_5",
        "PM10": "pm10",
        "NO2": "nitrogen_dioxide",
        "SO2": "sulphur_dioxide",
        "CO": "carbon_monoxide",
        "O3": "ozone",
    }

    pollutants = {}

    for output_name, api_name in field_mapping.items():
        value = current.get(api_name)

        pollutants[output_name] = (
            round(float(value), 1)
            if value is not None
            else None
        )

    return pollutants


# =========================================================
# MACHINE LEARNING INPUT
# =========================================================

def create_ml_input(pollutants):
    """
    Preserve the feature order and units expected by the
    existing Isolation Forest model.

    The original project converts CO from µg/m³ to mg/m³.
    """

    if any(value is None for value in pollutants.values()):
        raise ValueError(
            "Cannot run anomaly detection with missing pollutants"
        )

    return pd.DataFrame([{
        "PM2.5": pollutants["PM2.5"],
        "PM10": pollutants["PM10"],
        "NO2": pollutants["NO2"],
        "SO2": pollutants["SO2"],
        "CO": pollutants["CO"] / 1000,
        "O3": pollutants["O3"],
    }])


# =========================================================
# ISOLATION FOREST PREDICTION
# =========================================================

def analyse_location(current):
    """
    Use the same Isolation Forest decision rule for
    /api/live and /api/map-data.

    -1 = anomaly
     1 = normal
    """

    pollutants = extract_pollutants(current)

    aqi_value = current.get("us_aqi")
    aqi = int(round(float(aqi_value))) if aqi_value is not None else None

    result = {
        "aqi": aqi,
        "aqi_status": get_aqi_status(aqi),
        "pollutants": pollutants,
        "measurement_timestamp": current.get("time"),
        "prediction": None,
        "anomaly": "Unknown",
        "anomaly_status": "Unknown",
        "is_anomaly": False,
        "anomaly_score": None,
    }

    try:
        input_data = create_ml_input(pollutants)

        prediction = int(model.predict(input_data)[0])
        score = float(model.decision_function(input_data)[0])

        result.update({
            "prediction": prediction,
            "anomaly": (
                "Anomaly" if prediction == -1 else "Normal"
            ),
            "anomaly_status": (
                "Anomaly" if prediction == -1 else "Normal"
            ),
            "is_anomaly": prediction == -1,
            "anomaly_score": score,
        })

    except (ValueError, TypeError, KeyError):
        # Missing or invalid pollutant inputs should not
        # crash the entire dashboard.
        pass

    return result


# =========================================================
# HOME ENDPOINT
# =========================================================

@app.get("/")
def home():
    return {
        "status": "success",
        "message": "Delhi Digital Twin API is running",
    }


# =========================================================
# TEST ENDPOINT
# =========================================================

@app.get("/api/test")
def test():
    return {
        "status": "success",
        "message": "FastAPI backend is working",
    }


# =========================================================
# LIVE CENTRAL DELHI DATA
# =========================================================

@app.get("/api/live")
def get_live_data():
    data = fetch_air_quality(
        [28.6139],
        [77.2090],
    )

    current = data[0].get("current", {})
    analysis = analyse_location(current)

    return {
        "status": "success",
        "source": "Open-Meteo Air Quality API",
        "aqi_scale": "US AQI",
        "location": {
            "name": "Central Delhi",
            "latitude": 28.6139,
            "longitude": 77.2090,
        },
        **analysis,
    }


# =========================================================
# MANUAL ML PREDICTION ENDPOINT
# =========================================================

@app.post("/api/predict")
def predict(data: AirQualityData):
    """
    Manual input endpoint.

    The CO input is assumed to be in µg/m³, consistent
    with the original dashboard's convention.
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
        input_data = create_ml_input(pollutants)

        prediction = int(model.predict(input_data)[0])
        score = float(model.decision_function(input_data)[0])

    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid prediction input: {exc}",
        )

    status = "Anomaly" if prediction == -1 else "Normal"

    return {
        "status": status,
        "prediction": prediction,
        "is_anomaly": prediction == -1,
        "anomaly_score": score,
        "pollutants": pollutants,
    }


# =========================================================
# MULTI-LOCATION MAP DATA
# =========================================================

@app.get("/api/map-data")
def get_map_data():
    latitudes = [
        location["latitude"]
        for location in DELHI_LOCATIONS
    ]

    longitudes = [
        location["longitude"]
        for location in DELHI_LOCATIONS
    ]

    api_data = fetch_air_quality(latitudes, longitudes)

    location_results = []

    for location, data in zip(DELHI_LOCATIONS, api_data):
        current = data.get("current", {})
        analysis = analyse_location(current)

        location_results.append({
            "name": location["name"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            **analysis,
        })

    # =====================================================
    # CITY-WIDE MEAN OF AVAILABLE LOCATION AQI VALUES
    # =====================================================

    valid_aqi_values = [
        item["aqi"]
        for item in location_results
        if item["aqi"] is not None
    ]

    average_aqi = (
        mean(valid_aqi_values)
        if valid_aqi_values
        else None
    )

    # =====================================================
    # RANK LOCATIONS AND IDENTIFY RELATIVE HOTSPOTS
    # =====================================================

    ranked_locations = sorted(
        location_results,
        key=lambda item: (
            item["aqi"]
            if item["aqi"] is not None
            else -1
        ),
        reverse=True,
    )

    for rank, location in enumerate(ranked_locations, start=1):
        location["hotspot_rank"] = rank

        aqi = location["aqi"]

        if average_aqi is not None and average_aqi > 0 and aqi is not None:
            relative_difference = (
                (aqi - average_aqi) / average_aqi
            ) * 100

            location["relative_to_average_percent"] = round(
                relative_difference, 1
            )

            location["hotspot"] = (
                aqi >= average_aqi * 1.20
            )

        else:
            location["relative_to_average_percent"] = None
            location["hotspot"] = False

    anomaly_count = sum(
        1
        for item in location_results
        if item["is_anomaly"]
    )

    hotspot_count = sum(
        1
        for item in location_results
        if item["hotspot"]
    )

    return {
        "status": "success",
        "source": "Open-Meteo Air Quality API",
        "aqi_scale": "US AQI",
        "average_aqi": (
            round(average_aqi, 1)
            if average_aqi is not None
            else None
        ),
        "monitored_locations": len(location_results),
        "anomalies_detected": anomaly_count,
        "hotspots_detected": hotspot_count,
        "locations": location_results,
    }