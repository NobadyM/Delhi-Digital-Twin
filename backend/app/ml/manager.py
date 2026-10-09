import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
import joblib
import pandas as pd
from app.config import settings

logger = logging.getLogger("delhi_twin.ml.manager")


class ModelManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelManager, cls).__new__(cls)
            cls._instance.model = None
            cls._instance.version = settings.MODEL_VERSION
            cls._instance.features = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"]
            cls._instance.last_inference_time = None
            cls._instance.load_model()
        return cls._instance

    def load_model(self):
        try:
            if settings.MODEL_PATH.exists():
                self.model = joblib.load(settings.MODEL_PATH)
                logger.info(f"Loaded machine learning model from {settings.MODEL_PATH}")
            else:
                logger.warning(f"Model file not found at {settings.MODEL_PATH}")
                self.model = None
        except Exception as exc:
            logger.error(f"Failed to load Isolation Forest model: {exc}")
            self.model = None

    def is_loaded(self) -> bool:
        return self.model is not None

    def prepare_features(self, pollutants: Dict[str, Any]) -> pd.DataFrame:
        """
        Formats pollutant dictionary to match the training feature schema.
        Note: The Isolation Forest model was trained with CO in mg/m³.
        If CO is provided in µg/m³ (> 15), convert to mg/m³ (value / 1000).
        """
        raw_co = float(pollutants.get("CO", 0) or 0)
        co_mg = raw_co / 1000.0 if raw_co > 15 else raw_co

        data = {
            "PM2.5": [float(pollutants.get("PM2.5", 0) or 0)],
            "PM10": [float(pollutants.get("PM10", 0) or 0)],
            "NO2": [float(pollutants.get("NO2", 0) or 0)],
            "SO2": [float(pollutants.get("SO2", 0) or 0)],
            "CO": [co_mg],
            "O3": [float(pollutants.get("O3", 0) or 0)],
        }
        return pd.DataFrame(data)[self.features]

    def predict(self, pollutants: Dict[str, Any]) -> Tuple[int, float]:
        """
        Runs inference on the prepared features.
        Returns:
            (prediction, anomaly_score)
            prediction: -1 (Anomaly) or 1 (Normal)
            anomaly_score: float from decision_function
        """
        if not self.is_loaded():
            logger.warning("Predict called but model is not loaded. Using heuristic fallback.")
            pm25 = float(pollutants.get("PM2.5", 0) or 0)
            pm10 = float(pollutants.get("PM10", 0) or 0)
            is_anomaly = pm25 > 150 or pm10 > 250
            return -1 if is_anomaly else 1, -0.05 if is_anomaly else 0.05

        df = self.prepare_features(pollutants)
        prediction = int(self.model.predict(df)[0])
        score = float(self.model.decision_function(df)[0])
        self.last_inference_time = datetime.now(timezone.utc)
        return prediction, score


model_manager = ModelManager()
