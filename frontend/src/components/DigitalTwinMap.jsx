import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import {
  Layers,
  Maximize2,
  Minimize2,
  LocateFixed,
  Eye,
  Flame,
  AlertTriangle,
  Compass,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import { getAQIClassification } from "../services/api";

// Auto-adjust bounds to fit all locations or target location
function MapBoundsController({ locations, targetLocation }) {
  const map = useMap();

  useEffect(() => {
    if (targetLocation && targetLocation.latitude && targetLocation.longitude) {
      map.flyTo([targetLocation.latitude, targetLocation.longitude], 12, {
        duration: 1.2,
      });
      return;
    }

    if (locations && locations.length > 0) {
      const bounds = locations.map((loc) => [loc.latitude, loc.longitude]);
      map.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: 11,
      });
    }
  }, [locations, targetLocation, map]);

  return null;
}

export default function DigitalTwinMap({
  locations = [],
  selectedLocation,
  onSelectLocation,
  filterType,
  onFilterChange,
}) {
  const [tileMode, setTileMode] = useState("dark"); // "dark" | "osm"
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  // Filter locations according to layer filter
  const filteredLocations = locations.filter((loc) => {
    const isAnomaly = loc.is_anomaly === true || loc.prediction === -1;
    const isHotspot = loc.hotspot === true;

    if (filterType === "anomalies") return isAnomaly;
    if (filterType === "hotspots") return isHotspot;
    if (filterType === "normal") return !isAnomaly && !isHotspot;
    return true; // "all"
  });

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request error:", err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const centerCoords = [28.6139, 77.2090]; // Central Delhi

  return (
    <div
      ref={containerRef}
      className={`digital-twin-map-wrapper ${isFullscreen ? "map-fullscreen-active" : ""}`}
    >
      {/* Top Map Toolbar */}
      <div className="map-toolbar-overlay">
        <div className="map-toolbar-left">
          <div className="map-title-chip">
            <Compass className="w-4 h-4 text-cyan-400 animate-spin-slow" />
            <span className="font-semibold text-white">DELHI GEOSPATIAL AIR TWIN</span>
            <span className="map-counter font-mono">{filteredLocations.length} Nodes</span>
          </div>

          {/* Layer Filter Buttons */}
          <div className="map-layer-filters">
            <button
              className={`filter-btn ${filterType === "all" ? "active" : ""}`}
              onClick={() => onFilterChange("all")}
            >
              All Zones ({locations.length})
            </button>
            <button
              className={`filter-btn filter-anomaly ${filterType === "anomalies" ? "active" : ""}`}
              onClick={() => onFilterChange("anomalies")}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Anomalies ({locations.filter((l) => l.is_anomaly || l.prediction === -1).length})
            </button>
            <button
              className={`filter-btn filter-hotspot ${filterType === "hotspots" ? "active" : ""}`}
              onClick={() => onFilterChange("hotspots")}
            >
              <Flame className="w-3.5 h-3.5" />
              Hotspots ({locations.filter((l) => l.hotspot).length})
            </button>
            <button
              className={`filter-btn ${filterType === "normal" ? "active" : ""}`}
              onClick={() => onFilterChange("normal")}
            >
              Nominal ({locations.filter((l) => !l.is_anomaly && !l.hotspot).length})
            </button>
          </div>
        </div>

        <div className="map-toolbar-right">
          {/* Tile Layer Selector */}
          <button
            className="map-action-icon-btn"
            onClick={() => {
              if (tileMode === "dark") setTileMode("satellite");
              else if (tileMode === "satellite") setTileMode("street");
              else setTileMode("dark");
            }}
            title={`Current: ${tileMode.toUpperCase()} Mode. Click to switch (Dark -> Satellite -> Street)`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-xs uppercase">{tileMode}</span>
          </button>

          {/* Reset View Button */}
          <button
            className="map-action-icon-btn"
            onClick={() => onSelectLocation(null)}
            title="Reset City View Bounds"
          >
            <LocateFixed className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            className="map-action-icon-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "View Fullscreen Map"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Actual React-Leaflet Map */}
      <div className="map-leaflet-container">
        <MapContainer
          center={centerCoords}
          zoom={11}
          scrollWheelZoom={true}
          style={{ width: "100%", height: "100%" }}
        >
          {tileMode === "dark" && (
            <>
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
              />
              <TileLayer
                attribution=""
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                maxZoom={16}
                opacity={0.8}
              />
            </>
          )}

          {tileMode === "satellite" && (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={18}
            />
          )}

          {tileMode === "street" && (
            <TileLayer
              attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          )}

          <MapBoundsController
            locations={filteredLocations}
            targetLocation={selectedLocation}
          />

          {filteredLocations.map((loc) => {
            const isAnomaly = loc.is_anomaly === true || loc.prediction === -1;
            const isHotspot = loc.hotspot === true;
            const isSelected = selectedLocation?.name === loc.name;
            const aqiClass = getAQIClassification(loc.aqi);

            let markerColor = "#00C8FF"; // cyan
            if (isAnomaly) {
              markerColor = "#FF5263"; // red
            } else if (isHotspot) {
              markerColor = "#FFB547"; // amber
            } else if (loc.aqi <= 100) {
              markerColor = "#32D583"; // green
            }

            const markerRadius = isSelected ? 16 : isAnomaly ? 13 : isHotspot ? 11 : 9;

            return (
              <CircleMarker
                key={loc.name}
                center={[loc.latitude, loc.longitude]}
                radius={markerRadius}
                pathOptions={{
                  color: isSelected ? "#FFFFFF" : markerColor,
                  fillColor: markerColor,
                  fillOpacity: isSelected ? 0.95 : 0.75,
                  weight: isSelected ? 3.5 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectLocation(loc),
                }}
              >
                <Popup className="digital-twin-popup">
                  <div className="popup-box">
                    <div className="popup-header">
                      <strong className="popup-title">{loc.name}</strong>
                      <span
                        className="popup-aqi-chip font-mono"
                        style={{
                          backgroundColor: `${aqiClass.color}25`,
                          color: aqiClass.color,
                        }}
                      >
                        AQI {loc.aqi ?? "N/A"}
                      </span>
                    </div>

                    <div className="popup-status-badge">
                      {isAnomaly ? (
                        <span className="text-critical font-mono">⚠️ AI ANOMALY DETECTED</span>
                      ) : isHotspot ? (
                        <span className="text-warning font-mono">🔥 HOTSPOT (+{loc.relative_to_average_percent}%)</span>
                      ) : (
                        <span className="text-success font-mono">✓ NOMINAL DISTRIBUTION</span>
                      )}
                    </div>

                    <div className="popup-grid font-mono">
                      <div><span>PM2.5:</span> <b>{loc.pollutants?.["PM2.5"] ?? "--"}</b></div>
                      <div><span>PM10:</span> <b>{loc.pollutants?.PM10 ?? "--"}</b></div>
                      <div><span>NO2:</span> <b>{loc.pollutants?.NO2 ?? "--"}</b></div>
                      <div><span>SO2:</span> <b>{loc.pollutants?.SO2 ?? "--"}</b></div>
                    </div>

                    <button
                      className="popup-inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectLocation(loc);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Open Zone Inspection Panel
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      {/* Bottom Floating Map Legend & Telemetry Bar */}
      <div className="map-legend-overlay">
        <div className="legend-items">
          <div className="legend-pill">
            <span className="legend-indicator bg-critical animate-ping-subtle" />
            <span>AI Anomaly (Deviant &gt;1σ)</span>
          </div>
          <div className="legend-pill">
            <span className="legend-indicator bg-warning" />
            <span>Spatial Hotspot (&gt;120% City Avg)</span>
          </div>
          <div className="legend-pill">
            <span className="legend-indicator bg-accent" />
            <span>Nominal Monitoring Station</span>
          </div>
        </div>

        <div className="map-quick-hint font-mono text-xs">
          Click any station node to open high-resolution telemetry drawer
        </div>
      </div>
    </div>
  );
}
