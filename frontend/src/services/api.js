/**
 * Delhi Urban Air Quality Digital Twin - API Client
 * Centralized service for fetching telemetry, spatial data, and invoking ML predictions.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8001";

// Fallback baseline data in case backend server is starting or unreachable
export const FALLBACK_DELHI_DATA = {
  live: {
    status: "success",
    source: "Open-Meteo Air Quality API (Cached Baseline)",
    location: {
      name: "Central Delhi",
      latitude: 28.6139,
      longitude: 77.2090,
    },
    aqi: 242,
    aqi_status: "Poor",
    anomaly: "Normal",
    prediction: 1,
    is_anomaly: false,
    anomaly_score: 0.084,
    pollutants: {
      "PM2.5": 92.4,
      "PM10": 178.6,
      "NO2": 44.2,
      "SO2": 12.8,
      "CO": 1.4,
      "O3": 28.5,
    },
    measurement_timestamp: new Date().toISOString(),
  },
  mapData: {
    status: "success",
    source: "Open-Meteo Air Quality API (Cached Baseline)",
    average_aqi: 254.8,
    locations: [
      {
        name: "Central Delhi",
        latitude: 28.6139,
        longitude: 77.2090,
        aqi: 242,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 92.4, "PM10": 178.6, "NO2": 44.2, "SO2": 12.8, "CO": 1.4, "O3": 28.5 },
        anomaly_score: 0.084,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 5,
        relative_to_average_percent: -5.0,
        hotspot: false,
      },
      {
        name: "North Delhi",
        latitude: 28.7041,
        longitude: 77.1025,
        aqi: 318,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 142.1, "PM10": 265.4, "NO2": 62.1, "SO2": 18.2, "CO": 2.1, "O3": 35.0 },
        anomaly_score: -0.124,
        prediction: -1,
        anomaly_status: "Anomaly",
        is_anomaly: true,
        hotspot_rank: 1,
        relative_to_average_percent: 24.8,
        hotspot: true,
      },
      {
        name: "South Delhi",
        latitude: 28.5244,
        longitude: 77.1855,
        aqi: 198,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 68.3, "PM10": 134.0, "NO2": 32.5, "SO2": 9.4, "CO": 1.0, "O3": 24.1 },
        anomaly_score: 0.112,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 9,
        relative_to_average_percent: -22.3,
        hotspot: false,
      },
      {
        name: "East Delhi",
        latitude: 28.6280,
        longitude: 77.2770,
        aqi: 312,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 138.6, "PM10": 248.0, "NO2": 58.4, "SO2": 16.7, "CO": 1.9, "O3": 31.8 },
        anomaly_score: -0.098,
        prediction: -1,
        anomaly_status: "Anomaly",
        is_anomaly: true,
        hotspot_rank: 2,
        relative_to_average_percent: 22.5,
        hotspot: true,
      },
      {
        name: "West Delhi",
        latitude: 28.6517,
        longitude: 77.0855,
        aqi: 265,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 104.2, "PM10": 195.0, "NO2": 48.0, "SO2": 13.5, "CO": 1.5, "O3": 29.0 },
        anomaly_score: 0.042,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 4,
        relative_to_average_percent: 4.0,
        hotspot: false,
      },
      {
        name: "North-East Delhi",
        latitude: 28.6800,
        longitude: 77.2800,
        aqi: 284,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 118.0, "PM10": 218.4, "NO2": 52.1, "SO2": 15.0, "CO": 1.7, "O3": 30.2 },
        anomaly_score: 0.015,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 3,
        relative_to_average_percent: 11.5,
        hotspot: false,
      },
      {
        name: "North-West Delhi",
        latitude: 28.7200,
        longitude: 77.0500,
        aqi: 250,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 96.5, "PM10": 182.0, "NO2": 43.0, "SO2": 11.8, "CO": 1.3, "O3": 27.4 },
        anomaly_score: 0.061,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 6,
        relative_to_average_percent: -1.9,
        hotspot: false,
      },
      {
        name: "South-East Delhi",
        latitude: 28.5600,
        longitude: 77.3000,
        aqi: 228,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 84.1, "PM10": 162.5, "NO2": 39.0, "SO2": 10.5, "CO": 1.2, "O3": 26.0 },
        anomaly_score: 0.092,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 7,
        relative_to_average_percent: -10.5,
        hotspot: false,
      },
      {
        name: "South-West Delhi",
        latitude: 28.5700,
        longitude: 77.0500,
        aqi: 215,
        measurement_timestamp: new Date().toISOString(),
        pollutants: { "PM2.5": 78.0, "PM10": 151.0, "NO2": 36.2, "SO2": 9.8, "CO": 1.1, "O3": 25.0 },
        anomaly_score: 0.105,
        prediction: 1,
        anomaly_status: "Normal",
        is_anomaly: false,
        hotspot_rank: 8,
        relative_to_average_percent: -15.6,
        hotspot: false,
      },
    ],
  },
};

/**
 * Fetches both live Central Delhi data and multi-location map telemetry in parallel.
 */
export async function fetchDigitalTwinTelemetry() {
  try {
    const [liveRes, mapRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/live`, { signal: AbortSignal.timeout(30000) }),
      fetch(`${API_BASE_URL}/api/map-data`, { signal: AbortSignal.timeout(30000) }),
    ]);

    if (!liveRes.ok || !mapRes.ok) {
      throw new Error(`API error: ${liveRes.status}/${mapRes.status}`);
    }

    const liveData = await liveRes.json();
    const mapData = await mapRes.json();

    return {
      liveData,
      mapData,
      isFallback: false,
      error: null,
    };
  } catch (err) {
    console.warn("Backend unavailable or timed out; utilizing baseline dataset:", err.message);
    return {
      liveData: FALLBACK_DELHI_DATA.live,
      mapData: FALLBACK_DELHI_DATA.mapData,
      isFallback: true,
      error: err.message || "Failed to reach live backend",
    };
  }
}

/**
 * Calls the Isolation Forest prediction endpoint on the backend.
 */
export async function predictAnomaly(payload) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Predict endpoint error: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn("Prediction fallback applied:", err?.message || err);
    // Client-side heuristic fallback if backend offline
    const pm25 = Number(payload.PM2_5 || 0);
    const pm10 = Number(payload.PM10 || 0);
    const isAnomaly = pm25 > 130 || pm10 > 240;

    return {
      status: isAnomaly ? "Anomaly" : "Normal",
      prediction: isAnomaly ? -1 : 1,
      pollutants: payload,
      isFallback: true,
    };
  }
}

/**
 * Standard Indian AQI classification helper
 */
export function getAQIClassification(aqi) {
  const num = Number(aqi) || 0;
  if (num <= 50) return { category: "Good", color: "#32D583", classKey: "good" };
  if (num <= 100) return { category: "Satisfactory", color: "#66C275", classKey: "satisfactory" };
  if (num <= 200) return { category: "Moderate", color: "#FFB547", classKey: "moderate" };
  if (num <= 300) return { category: "Poor", color: "#FF8C42", classKey: "poor" };
  if (num <= 400) return { category: "Very Poor", color: "#FF5263", classKey: "very-poor" };
  return { category: "Severe", color: "#E02E49", classKey: "severe" };
}
