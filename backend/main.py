from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import requests


# =========================================================
# CONFIGURATION
# =========================================================

MODEL_PATH = "model/isolation_forest.pkl"

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
    description="Real-Time Urban Air Quality Monitoring and Anomaly Detection",
    version="1.0"
)


# =========================================================
# CORS CONFIGURATION
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
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
# HELPER: CALCULATE RECENT AVERAGE
# =========================================================

def latest_average(values, hours):
    valid_values = [
        float(value)
        for value in values[-hours:]
        if value is not None
    ]

    if not valid_values:
        return None

    return sum(valid_values) / len(valid_values)


# =========================================================
# ADAPTIVE ANOMALY DETECTION
# =========================================================

def adaptive_anomaly_detection(scores):
    """
    Detect anomalies relative to the current Delhi
    live-data distribution.

    Isolation Forest produces lower scores for more
    unusual observations.

    A location is considered anomalous when its score
    is more than one standard deviation below the
    current Delhi mean score.
    """

    if not scores:
        return []

    scores_series = pd.Series(scores)

    mean_score = scores_series.mean()
    std_score = scores_series.std(ddof=0)

    threshold = mean_score - std_score

    return [
        score < threshold
        for score in scores
    ]


# =========================================================
# AQI SUB-INDEX CALCULATION
# =========================================================

def calculate_sub_index(concentration, breakpoints):

    if concentration is None:
        return None

    for bp in breakpoints:

        if bp["low"] <= concentration <= bp["high"]:

            return (
                (
                    (bp["aqi_high"] - bp["aqi_low"])
                    / (bp["high"] - bp["low"])
                )
                * (concentration - bp["low"])
                + bp["aqi_low"]
            )

    return None


# =========================================================
# AQI CALCULATION FOR ONE OPEN-METEO LOCATION
# =========================================================

def calculate_location_aqi(location_data):

    hourly = location_data.get("hourly", {})

    hourly_pm25 = hourly.get("pm2_5", [])
    hourly_pm10 = hourly.get("pm10", [])
    hourly_no2 = hourly.get("nitrogen_dioxide", [])
    hourly_so2 = hourly.get("sulphur_dioxide", [])
    hourly_co = hourly.get("carbon_monoxide", [])
    hourly_o3 = hourly.get("ozone", [])


    # -----------------------------------------------------
    # Recent averages
    # -----------------------------------------------------

    avg_pm25 = latest_average(hourly_pm25, 24)
    avg_pm10 = latest_average(hourly_pm10, 24)
    avg_no2 = latest_average(hourly_no2, 24)
    avg_so2 = latest_average(hourly_so2, 24)
    avg_co = latest_average(hourly_co, 8)
    avg_o3 = latest_average(hourly_o3, 8)


    # -----------------------------------------------------
    # PM2.5 AQI
    # -----------------------------------------------------

    pm25_index = calculate_sub_index(
        avg_pm25,
        [
            {"low": 0, "high": 30, "aqi_low": 0, "aqi_high": 50},
            {"low": 31, "high": 60, "aqi_low": 51, "aqi_high": 100},
            {"low": 61, "high": 90, "aqi_low": 101, "aqi_high": 200},
            {"low": 91, "high": 120, "aqi_low": 201, "aqi_high": 300},
            {"low": 121, "high": 250, "aqi_low": 301, "aqi_high": 400},
            {"low": 251, "high": 500, "aqi_low": 401, "aqi_high": 500}
        ]
    )


    # -----------------------------------------------------
    # PM10 AQI
    # -----------------------------------------------------

    pm10_index = calculate_sub_index(
        avg_pm10,
        [
            {"low": 0, "high": 50, "aqi_low": 0, "aqi_high": 50},
            {"low": 51, "high": 100, "aqi_low": 51, "aqi_high": 100},
            {"low": 101, "high": 250, "aqi_low": 101, "aqi_high": 200},
            {"low": 251, "high": 350, "aqi_low": 201, "aqi_high": 300},
            {"low": 351, "high": 430, "aqi_low": 301, "aqi_high": 400},
            {"low": 431, "high": 500, "aqi_low": 401, "aqi_high": 500}
        ]
    )


    # -----------------------------------------------------
    # NO2 AQI
    # -----------------------------------------------------

    no2_index = calculate_sub_index(
        avg_no2,
        [
            {"low": 0, "high": 40, "aqi_low": 0, "aqi_high": 50},
            {"low": 41, "high": 80, "aqi_low": 51, "aqi_high": 100},
            {"low": 81, "high": 180, "aqi_low": 101, "aqi_high": 200},
            {"low": 181, "high": 280, "aqi_low": 201, "aqi_high": 300},
            {"low": 281, "high": 400, "aqi_low": 301, "aqi_high": 400},
            {"low": 401, "high": 800, "aqi_low": 401, "aqi_high": 500}
        ]
    )


    # -----------------------------------------------------
    # SO2 AQI
    # -----------------------------------------------------

    so2_index = calculate_sub_index(
        avg_so2,
        [
            {"low": 0, "high": 40, "aqi_low": 0, "aqi_high": 50},
            {"low": 41, "high": 80, "aqi_low": 51, "aqi_high": 100},
            {"low": 81, "high": 380, "aqi_low": 101, "aqi_high": 200},
            {"low": 381, "high": 800, "aqi_low": 201, "aqi_high": 300},
            {"low": 801, "high": 1600, "aqi_low": 301, "aqi_high": 400},
            {"low": 1601, "high": 2620, "aqi_low": 401, "aqi_high": 500}
        ]
    )


    # -----------------------------------------------------
    # CO AQI
    #
    # Open-Meteo CO is converted from µg/m³ to mg/m³
    # -----------------------------------------------------

    co_index = calculate_sub_index(
        avg_co / 1000 if avg_co is not None else None,
        [
            {"low": 0, "high": 1.0, "aqi_low": 0, "aqi_high": 50},
            {"low": 1.1, "high": 2.0, "aqi_low": 51, "aqi_high": 100},
            {"low": 2.1, "high": 10.0, "aqi_low": 101, "aqi_high": 200},
            {"low": 10.1, "high": 17.0, "aqi_low": 201, "aqi_high": 300},
            {"low": 17.1, "high": 34.0, "aqi_low": 301, "aqi_high": 400},
            {"low": 34.1, "high": 50.0, "aqi_low": 401, "aqi_high": 500}
        ]
    )


    # -----------------------------------------------------
    # O3 AQI
    # -----------------------------------------------------

    o3_index = calculate_sub_index(
        avg_o3,
        [
            {"low": 0, "high": 50, "aqi_low": 0, "aqi_high": 50},
            {"low": 51, "high": 100, "aqi_low": 51, "aqi_high": 100},
            {"low": 101, "high": 168, "aqi_low": 101, "aqi_high": 200},
            {"low": 169, "high": 208, "aqi_low": 201, "aqi_high": 300},
            {"low": 209, "high": 748, "aqi_low": 301, "aqi_high": 400},
            {"low": 749, "high": 1000, "aqi_low": 401, "aqi_high": 500}
        ]
    )


    # -----------------------------------------------------
    # Final AQI
    # -----------------------------------------------------

    sub_indices = [
        index
        for index in [
            pm25_index,
            pm10_index,
            no2_index,
            so2_index,
            co_index,
            o3_index
        ]
        if index is not None
    ]

    if not sub_indices:
        return None

    return round(max(sub_indices))


# =========================================================
# HELPER: BUILD ML INPUT
# =========================================================

def create_ml_input(pollutants):

    return pd.DataFrame([{
        "PM2.5": pollutants["PM2.5"],
        "PM10": pollutants["PM10"],
        "NO2": pollutants["NO2"],
        "SO2": pollutants["SO2"],

        # Open-Meteo CO is µg/m³.
        # Model training data uses mg/m³.
        "CO": pollutants["CO"] / 1000,

        "O3": pollutants["O3"]
    }])


# =========================================================
# HELPER: AQI STATUS
# =========================================================

def get_aqi_status(aqi):

    if aqi is None:
        return "Unknown"

    if aqi <= 50:
        return "Good"

    if aqi <= 100:
        return "Satisfactory"

    if aqi <= 200:
        return "Moderate"

    if aqi <= 300:
        return "Poor"

    if aqi <= 400:
        return "Very Poor"

    return "Severe"


# =========================================================
# HOME ENDPOINT
# =========================================================

@app.get("/")
def home():

    return {
        "message": "Delhi Digital Twin API is running"
    }


# =========================================================
# TEST ENDPOINT
# =========================================================

@app.get("/api/test")
def test():

    return {
        "status": "success",
        "message": "FastAPI backend is working"
    }


# =========================================================
# LIVE DELHI AIR QUALITY ENDPOINT
# =========================================================

@app.get("/api/live")
def get_live_data():

    params = {
        "latitude": 28.6139,
        "longitude": 77.2090,

        "current": (
            "us_aqi,"
            "pm2_5,"
            "pm10,"
            "nitrogen_dioxide,"
            "sulphur_dioxide,"
            "carbon_monoxide,"
            "ozone"
        ),

        "hourly": (
            "pm2_5,"
            "pm10,"
            "nitrogen_dioxide,"
            "sulphur_dioxide,"
            "carbon_monoxide,"
            "ozone"
        ),

        "past_days": 2
    }


    response = requests.get(
        OPEN_METEO_URL,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    data = response.json()

    current = data.get("current", {})
    hourly = data.get("hourly", {})


    # -----------------------------------------------------
    # Calculate pollutant averages
    # -----------------------------------------------------

    avg_pm25 = latest_average(
        hourly.get("pm2_5", []),
        24
    )

    avg_pm10 = latest_average(
        hourly.get("pm10", []),
        24
    )

    avg_no2 = latest_average(
        hourly.get("nitrogen_dioxide", []),
        24
    )

    avg_so2 = latest_average(
        hourly.get("sulphur_dioxide", []),
        24
    )

    avg_co = latest_average(
        hourly.get("carbon_monoxide", []),
        8
    )

    avg_o3 = latest_average(
        hourly.get("ozone", []),
        8
    )


    pollutants = {
        "PM2.5": round(
            avg_pm25 if avg_pm25 is not None else 0,
            1
        ),

        "PM10": round(
            avg_pm10 if avg_pm10 is not None else 0,
            1
        ),

        "NO2": round(
            avg_no2 if avg_no2 is not None else 0,
            1
        ),

        "SO2": round(
            avg_so2 if avg_so2 is not None else 0,
            1
        ),

        "CO": round(
            avg_co if avg_co is not None else 0,
            1
        ),

        "O3": round(
            avg_o3 if avg_o3 is not None else 0,
            1
        )
    }


    # -----------------------------------------------------
    # Calculate AQI
    # -----------------------------------------------------

    aqi = calculate_location_aqi(data)


    # -----------------------------------------------------
    # Isolation Forest score
    # -----------------------------------------------------

    input_data = create_ml_input(pollutants)

    anomaly_score = float(
        model.decision_function(input_data)[0]
    )

    # Keep the original Isolation Forest prediction
    # available for transparency.
    model_prediction = int(
        model.predict(input_data)[0]
    )


    # -----------------------------------------------------
    # Live endpoint anomaly status
    #
    # This endpoint represents Central Delhi only.
    # The final city-wide adaptive classification is
    # calculated in /api/map-data.
    # -----------------------------------------------------

    if model_prediction == -1:
        anomaly_status = "Anomaly"
        is_anomaly = True
    else:
        anomaly_status = "Normal"
        is_anomaly = False


    return {

        "status": "success",

        "source": "Open-Meteo Air Quality API",

        "location": {
            "name": "Central Delhi",
            "latitude": 28.6139,
            "longitude": 77.2090
        },

        "aqi": aqi,

        "aqi_status": get_aqi_status(aqi),

        "anomaly": anomaly_status,

        "prediction": model_prediction,

        "is_anomaly": is_anomaly,

        "anomaly_score": anomaly_score,

        "pollutants": pollutants,

        "measurement_timestamp": current.get("time")
    }


# =========================================================
# MANUAL ML PREDICTION ENDPOINT
# =========================================================

@app.post("/api/predict")
def predict(data: AirQualityData):

    input_data = pd.DataFrame([{

        "PM2.5": data.PM2_5,

        "PM10": data.PM10,

        "NO2": data.NO2,

        "SO2": data.SO2,

        "CO": data.CO,

        "O3": data.O3

    }])


    prediction = model.predict(input_data)[0]


    if prediction == -1:
        status = "Anomaly"
    else:
        status = "Normal"


    return {

        "status": status,

        "prediction": int(prediction),

        "pollutants": {

            "PM2.5": data.PM2_5,

            "PM10": data.PM10,

            "NO2": data.NO2,

            "SO2": data.SO2,

            "CO": data.CO,

            "O3": data.O3

        }

    }


# =========================================================
# MULTIPLE DELHI LOCATIONS
# =========================================================

DELHI_LOCATIONS = [

    {
        "name": "Central Delhi",
        "latitude": 28.6139,
        "longitude": 77.2090
    },

    {
        "name": "North Delhi",
        "latitude": 28.7041,
        "longitude": 77.1025
    },

    {
        "name": "South Delhi",
        "latitude": 28.5244,
        "longitude": 77.1855
    },

    {
        "name": "East Delhi",
        "latitude": 28.6280,
        "longitude": 77.2770
    },

    {
        "name": "West Delhi",
        "latitude": 28.6517,
        "longitude": 77.0855
    },

    {
        "name": "North-East Delhi",
        "latitude": 28.6800,
        "longitude": 77.2800
    },

    {
        "name": "North-West Delhi",
        "latitude": 28.7200,
        "longitude": 77.0500
    },

    {
        "name": "South-East Delhi",
        "latitude": 28.5600,
        "longitude": 77.3000
    },

    {
        "name": "South-West Delhi",
        "latitude": 28.5700,
        "longitude": 77.0500
    }

]


# =========================================================
# MULTIPLE LOCATION MAP DATA
# =========================================================

@app.get("/api/map-data")
def get_map_data():

    params = {

        "latitude": ",".join(
            str(location["latitude"])
            for location in DELHI_LOCATIONS
        ),

        "longitude": ",".join(
            str(location["longitude"])
            for location in DELHI_LOCATIONS
        ),

        "current": (
            "pm2_5,"
            "pm10,"
            "nitrogen_dioxide,"
            "sulphur_dioxide,"
            "carbon_monoxide,"
            "ozone"
        ),

        "hourly": (
            "pm2_5,"
            "pm10,"
            "nitrogen_dioxide,"
            "sulphur_dioxide,"
            "carbon_monoxide,"
            "ozone"
        ),

        "past_days": 2
    }


    response = requests.get(
        OPEN_METEO_URL,
        params=params,
        timeout=30
    )

    response.raise_for_status()

    api_data = response.json()


    if not isinstance(api_data, list):
        api_data = [api_data]


    location_results = []


    # =====================================================
    # PROCESS EACH DELHI LOCATION
    # =====================================================

    for index, location in enumerate(DELHI_LOCATIONS):

        data = api_data[index]

        current = data.get("current", {})

        hourly = data.get("hourly", {})


        # -------------------------------------------------
        # Calculate pollutant averages
        # -------------------------------------------------

        avg_pm25 = latest_average(
            hourly.get("pm2_5", []),
            24
        )

        avg_pm10 = latest_average(
            hourly.get("pm10", []),
            24
        )

        avg_no2 = latest_average(
            hourly.get("nitrogen_dioxide", []),
            24
        )

        avg_so2 = latest_average(
            hourly.get("sulphur_dioxide", []),
            24
        )

        avg_co = latest_average(
            hourly.get("carbon_monoxide", []),
            8
        )

        avg_o3 = latest_average(
            hourly.get("ozone", []),
            8
        )


        pollutants = {

            "PM2.5": round(
                avg_pm25 if avg_pm25 is not None else 0,
                1
            ),

            "PM10": round(
                avg_pm10 if avg_pm10 is not None else 0,
                1
            ),

            "NO2": round(
                avg_no2 if avg_no2 is not None else 0,
                1
            ),

            "SO2": round(
                avg_so2 if avg_so2 is not None else 0,
                1
            ),

            "CO": round(
                avg_co if avg_co is not None else 0,
                1
            ),

            "O3": round(
                avg_o3 if avg_o3 is not None else 0,
                1
            )
        }


        # -------------------------------------------------
        # Calculate AQI
        # -------------------------------------------------

        aqi = calculate_location_aqi(data)


        # -------------------------------------------------
        # Isolation Forest score
        # -------------------------------------------------

        input_data = create_ml_input(pollutants)

        anomaly_score = float(
            model.decision_function(input_data)[0]
        )


        # -------------------------------------------------
        # Store initial location result
        # -------------------------------------------------

        location_results.append({

            "name": location["name"],

            "latitude": location["latitude"],

            "longitude": location["longitude"],

            "aqi": aqi,

            "measurement_timestamp": current.get("time"),

            "pollutants": pollutants,

            "anomaly_score": anomaly_score

        })


    # =====================================================
    # ADAPTIVE ANOMALY CLASSIFICATION
    # =====================================================

    anomaly_scores = [

        location["anomaly_score"]

        for location in location_results

    ]


    anomaly_flags = adaptive_anomaly_detection(
        anomaly_scores
    )


    for location, is_anomaly in zip(
        location_results,
        anomaly_flags
    ):

        location["prediction"] = (
            -1 if is_anomaly else 1
        )

        location["anomaly_status"] = (

            "Anomaly"
            if is_anomaly
            else "Normal"

        )

        location["is_anomaly"] = bool(
            is_anomaly
        )


    # =====================================================
    # CALCULATE AVERAGE AQI
    # =====================================================

    valid_aqi_values = [

        location["aqi"]

        for location in location_results

        if location["aqi"] is not None

    ]


    if valid_aqi_values:

        average_aqi = (

            sum(valid_aqi_values)
            / len(valid_aqi_values)

        )

    else:

        average_aqi = 0


    # =====================================================
    # RANK LOCATIONS
    # =====================================================

    ranked_locations = sorted(

        location_results,

        key=lambda x: (

            x["aqi"]

            if x["aqi"] is not None

            else 0

        ),

        reverse=True

    )


    # =====================================================
    # HOTSPOT DETECTION
    #
    # A relative hotspot is a location whose AQI is
    # at least 20% higher than the average AQI of
    # all monitored Delhi locations.
    # =====================================================

    for rank, location in enumerate(
        ranked_locations,
        start=1
    ):

        location["hotspot_rank"] = rank


        if (
            average_aqi > 0
            and location["aqi"] is not None
        ):

            location["relative_to_average_percent"] = round(

                (

                    (
                        location["aqi"]
                        - average_aqi
                    )

                    / average_aqi

                ) * 100,

                1

            )


            location["hotspot"] = (

                location["aqi"]
                >= average_aqi * 1.20

            )

        else:

            location[
                "relative_to_average_percent"
            ] = 0

            location["hotspot"] = False


    # =====================================================
    # FINAL RESPONSE
    # =====================================================

    return {

        "status": "success",

        "source": "Open-Meteo Air Quality API",

        "average_aqi": round(
            average_aqi,
            1
        ),

        "locations": location_results

    }