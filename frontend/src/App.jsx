import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import "leaflet/dist/leaflet.css";
import "./App.css";


/* =========================================================
   MAP AUTO-FIT COMPONENT
   ========================================================= */

function MapBounds({ locations }) {

  const map = useMap();

  useEffect(() => {

    if (!locations || locations.length === 0) {
      return;
    }

    const bounds = locations.map((location) => [
      location.latitude,
      location.longitude,
    ]);

    map.fitBounds(bounds, {
      padding: [30, 30],
    });

  }, [locations, map]);

  return null;
}


/* =========================================================
   MAIN APPLICATION
   ========================================================= */

function App() {

  const [liveData, setLiveData] = useState(null);

  const [mapData, setMapData] = useState(null);

  const [loading, setLoading] = useState(true);

  const [lastUpdated, setLastUpdated] = useState(null);

  const [error, setError] = useState("");


  /* =======================================================
     FETCH LIVE DATA + MAP DATA
     ======================================================= */

  const fetchData = async () => {

    try {

      setLoading(true);
      setError("");


      /* ---------------------------------------------------
         LIVE CENTRAL DELHI DATA
         --------------------------------------------------- */

      const liveResponse = await fetch(
        "http://127.0.0.1:8000/api/live"
      );

      if (!liveResponse.ok) {

        throw new Error(
          "Live API error: " +
          liveResponse.status
        );

      }

      const live = await liveResponse.json();

      console.log(
        "Live API response:",
        live
      );


      /* ---------------------------------------------------
         MULTI-LOCATION MAP DATA
         --------------------------------------------------- */

      const mapResponse = await fetch(
        "http://127.0.0.1:8000/api/map-data"
      );

      if (!mapResponse.ok) {

        throw new Error(
          "Map API error: " +
          mapResponse.status
        );

      }

      const map = await mapResponse.json();

      console.log(
        "Map API response:",
        map
      );


      /* ---------------------------------------------------
         UPDATE STATE
         --------------------------------------------------- */

      setLiveData(live);

      setMapData(map);


      /* ---------------------------------------------------
         UPDATE TIMESTAMP
         --------------------------------------------------- */

      setLastUpdated(
        live.measurement_timestamp
          ? new Date(
              live.measurement_timestamp
            )
          : null
      );


    } catch (err) {

      console.error(
        "Error:",
        err
      );

      setError(
        "Unable to connect to the FastAPI backend."
      );

    } finally {

      setLoading(false);

    }

  };


  /* =======================================================
     INITIAL LOAD + AUTO REFRESH
     ======================================================= */

  useEffect(() => {

    fetchData();

    const interval = setInterval(
      fetchData,
      60000
    );

    return () => {
      clearInterval(interval);
    };

  }, []);


  /* =======================================================
     POLLUTANT VALUES
     ======================================================= */

  const getValue = (name) => {

    if (!liveData) {
      return 0;
    }

    return Number(
      liveData.pollutants?.[name] ?? 0
    );

  };


  const pm25 = getValue("PM2.5");

  const pm10 = getValue("PM10");

  const no2 = getValue("NO2");

  const so2 = getValue("SO2");

  const co = getValue("CO");

  const o3 = getValue("O3");


  /* =======================================================
     AQI
     ======================================================= */

  const displayAQI = Number(mapData?.average_aqi ?? liveData?.aqi ?? 0);


  const getAQIStatus = (aqi) => {

    if (aqi <= 50) {
      return "Good";
    }

    if (aqi <= 100) {
      return "Satisfactory";
    }

    if (aqi <= 200) {
      return "Moderate";
    }

    if (aqi <= 300) {
      return "Poor";
    }

    if (aqi <= 400) {
      return "Very Poor";
    }

    return "Severe";

  };


  const aqiStatus =
    getAQIStatus(displayAQI);


  const aqiStatusClass =
    aqiStatus
      .toLowerCase()
      .replace(" ", "-");


  /* =======================================================
     ANOMALY
     ======================================================= */

  const isAnomaly =
    liveData?.is_anomaly === true ||
    liveData?.prediction === -1 ||
    liveData?.anomaly === "Anomaly";


  /* =======================================================
     CHART DATA
     ======================================================= */

  const chartData = [

    {
      pollutant: "PM2.5",
      value: pm25,
    },

    {
      pollutant: "PM10",
      value: pm10,
    },

    {
      pollutant: "NO2",
      value: no2,
    },

    {
      pollutant: "SO2",
      value: so2,
    },

    {
      pollutant: "CO",
      value: co,
    },

    {
      pollutant: "O3",
      value: o3,
    },

  ];


  /* =======================================================
     RENDER
     ======================================================= */

  return (

    <div className="app">


      {/* =================================================
         HEADER
         ================================================= */}

<header className="header">

<div className="header-title">

  <h1>
    DELHI URBAN AIR QUALITY DIGITAL TWIN
  </h1>

  <p>
    Real-Time Monitoring • Spatial Analysis • Anomaly Detection
  </p>

</div>

<div className="header-actions">

  <div className="live-indicator">
    <span className="live-dot"></span>
    LIVE DATA
  </div>

  <button
    className="refresh-button"
    onClick={fetchData}
    disabled={loading}
  >
    {loading
      ? "Refreshing..."
      : "Refresh Data"}
  </button>

</div>

</header>


      {/* =================================================
         ERROR
         ================================================= */}

      {error && (

        <div className="error-box">
          {error}
        </div>

      )}


      {/* =================================================
         LOADING
         ================================================= */}

      {loading && !liveData && (

        <div className="loading-box">
          Loading Delhi air quality data...
        </div>

      )}


      {liveData && (

        <>


          {/* =============================================
             SUMMARY
             ============================================= */}

          <section className="summary-grid">

  <div className={`summary-card aqi-card ${aqiStatusClass}`}>

    <div className="card-label">
      DELHI AIR QUALITY INDEX
    </div>

    <div className="aqi-main-value">
      {displayAQI}
    </div>

    <div className={`aqi-status ${aqiStatusClass}`}>
      {aqiStatus.toUpperCase()}
    </div>

    <p className="card-description">
      City-wide average across {mapData?.locations?.length ?? 0} monitored locations
    </p>

  </div>


  <div
    className={
      `summary-card ${
        isAnomaly ? "anomaly-card" : "normal-card"
      }`
    }
  >

    <div className="card-label">
      ANOMALY DETECTION
    </div>

    <div className="status">
      {isAnomaly
        ? "Anomaly Detected"
        : "Normal"}
    </div>

    <p className="card-description">
      Machine learning model: Isolation Forest
    </p>

  </div>


  <div className="summary-card">

    <div className="card-label">
      DATA SOURCE
    </div>

    <div className="source-text">
      Open-Meteo
    </div>

    <p className="card-description">
      Air Quality API
    </p>

  </div>

</section>

        <section className="kpi-grid">

  <div className="kpi-card">
    <div className="kpi-label">MONITORED LOCATIONS</div>
    <div className="kpi-value">
      {mapData?.locations?.length ?? 0}
    </div>
    <div className="kpi-description">
      Delhi monitoring points
    </div>
  </div>

  <div className="kpi-card">
    <div className="kpi-label">AVERAGE AQI</div>
    <div className="kpi-value">
      {displayAQI}
    </div>
    <div className="kpi-description">
      City-wide average
    </div>
  </div>

  <div className="kpi-card">
    <div className="kpi-label">ANOMALIES DETECTED</div>
    <div className="kpi-value">
      {mapData?.locations?.filter(
        (location) =>
          location.is_anomaly === true ||
          location.prediction === -1 ||
          location.anomaly === "Anomaly"
      ).length ?? 0}
    </div>
    <div className="kpi-description">
      Isolation Forest detection
    </div>
  </div>

  <div className="kpi-card">
    <div className="kpi-label">DATA SOURCE</div>
    <div className="kpi-value source-kpi">
      Open-Meteo
    </div>
    <div className="kpi-description">
      Live Air Quality API
    </div>
  </div>

</section>

          {/* =============================================
             LAST UPDATED
             ============================================= */}

          <section className="dashboard-section">

            <div className="last-updated">

              <strong>
                Last Updated:
              </strong>{" "}

              {lastUpdated
                ? lastUpdated.toLocaleString(
                    "en-IN",
                    {
                      dateStyle: "medium",
                      timeStyle: "medium",
                    }
                  )
                : "Not available"}

            </div>

          </section>


          {/* =============================================
             POLLUTANTS
             ============================================= */}

          <section>

            <h2>
              Current Pollutant Levels
            </h2>


            <div className="pollutant-grid">


              <div className="pollutant-card">

                <h3>PM2.5</h3>

                <div className="pollutant-value">
                  {pm25}
                </div>

                <span>
                  ug/m3
                </span>

              </div>


              <div className="pollutant-card">

                <h3>PM10</h3>

                <div className="pollutant-value">
                  {pm10}
                </div>

                <span>
                  ug/m3
                </span>

              </div>


              <div className="pollutant-card">

                <h3>NO2</h3>

                <div className="pollutant-value">
                  {no2}
                </div>

                <span>
                  ug/m3
                </span>

              </div>


              <div className="pollutant-card">

                <h3>SO2</h3>

                <div className="pollutant-value">
                  {so2}
                </div>

                <span>
                  ug/m3
                </span>

              </div>


              <div className="pollutant-card">

                <h3>CO</h3>

                <div className="pollutant-value">
                  {co}
                </div>

                <span>
                  ug/m3
                </span>

              </div>


              <div className="pollutant-card">

                <h3>O3</h3>

                <div className="pollutant-value">
                  {o3}
                </div>

                <span>
                  ug/m3
                </span>

              </div>


            </div>

          </section>


          {/* =============================================
             DIGITAL TWIN MAP
             ============================================= */}

          <section className="dashboard-section">

          <div className="section-heading">

            <div>
              <h2>Delhi Urban Air Quality Map</h2>
              <p>Real-time spatial distribution of air quality      across monitored locations</p>
            </div>
          </div>

          <div className="map-summary-bar">

  <div className="map-stat">
    <span className="map-stat-label">AVERAGE AQI</span>
    <strong>{displayAQI}</strong>
  </div>

  <div className="map-stat">
    <span className="map-stat-label">MONITORED</span>
    <strong>{mapData?.locations?.length ?? 0}</strong>
  </div>

  <div className="map-stat">
    <span className="map-stat-label">HOTSPOTS</span>
    <strong>
      {mapData?.locations?.filter(
        location => location.hotspot === true
      ).length ?? 0}
    </strong>
  </div>

  <div className="map-stat">
    <span className="map-stat-label">ANOMALIES</span>
    <strong>
      {mapData?.locations?.filter(
      location => location.is_anomaly === true
    ).length ?? 0}
    </strong>
  </div>

</div>


            <div className="map-status">

              <span
                className={
                  isAnomaly
                    ? "map-status-dot anomaly"
                    : "map-status-dot normal"
                }
              ></span>


              {isAnomaly
                ? "Anomaly Detected"
                : "Normal Air Quality"}

            </div>


            <div className="map-container">


              <MapContainer

                center={[
                  28.6139,
                  77.2090
                ]}

                zoom={10}

                scrollWheelZoom={true}

                style={{
                  height: "100%",
                  width: "100%",
                }}

              >


                <TileLayer

                  attribution={
                    "&copy; OpenStreetMap contributors"
                  }

                  url={
                    "https://{s}.tile.openstreetmap.org/" +
                    "{z}/{x}/{y}.png"
                  }

                />


                {/* =======================================
                   AUTOMATICALLY FIT ALL LOCATIONS
                   ======================================= */}

                <MapBounds
                  locations={
                    mapData?.locations ?? []
                  }
                />


                {/* =======================================
                   RENDER ALL DELHI LOCATIONS
                   ======================================= */}

                {mapData?.locations?.map(
                  (location) => {

                    const locationIsAnomaly =
                      location.is_anomaly === true ||
                      location.prediction === -1;


                    const locationIsHotspot =
                      location.hotspot === true;


                    let markerColor =
                      "green";


                    if (locationIsAnomaly) {
                      markerColor = "red";
                    }
                    else if (locationIsHotspot) {
                      markerColor = "orange";
                    }


                    return (

                      <CircleMarker

                        key={
                          location.name
                        }

                        center={[
                          location.latitude,
                          location.longitude
                        ]}

                        radius={
                          locationIsAnomaly
                            ? 12
                            : 9
                        }

                        pathOptions={{

                          color:
                            markerColor,

                          fillColor:
                            markerColor,

                          fillOpacity: 0.7,

                          weight: 2,

                        }}

                      >


                        <Popup>

                          <strong>
                            {location.name}
                          </strong>

                          <br />
                          <br />

                          <strong>
                            AQI:
                          </strong>{" "}

                          {location.aqi ?? "N/A"}

                          <br />

                          <strong>
                            PM2.5:
                          </strong>{" "}

                          {location.pollutants?.["PM2.5"] ?? "N/A"}

                          <br />

                          <strong>
                            PM10:
                          </strong>{" "}

                          {location.pollutants?.PM10 ?? "N/A"}

                          <br />

                          <strong>
                            NO2:
                          </strong>{" "}

                          {location.pollutants?.NO2 ?? "N/A"}

                          <br />

                          <strong>
                            SO2:
                          </strong>{" "}

                          {location.pollutants?.SO2 ?? "N/A"}

                          <br />

                          <strong>
                            CO:
                          </strong>{" "}

                          {location.pollutants?.CO ?? "N/A"}

                          <br />

                          <strong>
                            O3:
                          </strong>{" "}

                          {location.pollutants?.O3 ?? "N/A"}

                          <br />
                          <br />

                          <strong>
                            Status:
                          </strong>{" "}

                          {locationIsAnomaly
                            ? "Anomaly Detected"
                            : "Normal"}

                          <br />

                          <strong>
                            Hotspot:
                          </strong>{" "}

                          {locationIsHotspot
                            ? "Yes"
                            : "No"}

                          <br />

                          <strong>
                            Rank:
                          </strong>{" "}

                          {location.hotspot_rank ?? "N/A"}

                          <br />

                          <strong>
                            Relative to Average:
                          </strong>{" "}

                          {location.relative_to_average_percent ?? 0}
                          %

                        </Popup>


                      </CircleMarker>

                    );

                  }
                )}


              </MapContainer>


            </div>


            {/* =========================================
               MAP LEGEND
               ========================================= */}

            <div className="map-legend">

              <span>
                🔴 Anomaly
              </span>

              <span>
                🟠 Hotspot
              </span>

              <span>
                🟢 Normal
              </span>

            </div>


            {mapData?.locations && (

              <p>

                Monitoring{" "}
                <strong>
                  {mapData.locations.length}
                </strong>{" "}
                Delhi locations

                {" | "}

                Average AQI:{" "}

                <strong>
                  {mapData.average_aqi}
                </strong>

              </p>

            )}


          </section>


          {/* =============================================
             CHART
             ============================================= */}

          <section className="dashboard-section">

            <h2>
              Pollutant Distribution
            </h2>


            <div className="chart-container">

              <ResponsiveContainer
                width="100%"
                height={350}
              >

                <LineChart
                  data={chartData}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="pollutant"
                  />

                  <YAxis />

                  <Tooltip />

                  <Legend />

                  <Line

                    type="monotone"

                    dataKey="value"

                    stroke="#2563eb"

                    strokeWidth={3}

                    activeDot={{
                      r: 7,
                    }}

                  />

                </LineChart>

              </ResponsiveContainer>

            </div>

          </section>


          {/* =============================================
             API RESPONSE
             ============================================= */}

          <section
            className="dashboard-section api-section"
          >

            <h2>
              Live API Response
            </h2>

            <pre>

              {JSON.stringify(
                liveData,
                null,
                2
              )}

            </pre>

          </section>


        </>

      )}


      {/* ===============================================
         FOOTER
         =============================================== */}

      <footer>

        <p>
          Delhi Digital Twin | FastAPI + React +
          Isolation Forest
        </p>

      </footer>


    </div>

  );

}


export default App;