import {
  X,
  MapPin,
  AlertTriangle,
  Flame,
  Activity,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { getAQIClassification } from "../services/api";

export default function LocationDetailDrawer({
  location,
  cityAverageAqi,
  onClose,
}) {
  if (!location) return null;

  const aqiClass = getAQIClassification(location.aqi);
  const isAnomaly = location.is_anomaly === true || location.prediction === -1;
  const isHotspot = location.hotspot === true;
  const pollutants = location.pollutants || {};

  return (
    <div className="location-drawer-backdrop" onClick={onClose}>
      <div
        className="location-drawer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-header-left">
            <div className="drawer-pin-icon" style={{ borderColor: aqiClass.color }}>
              <MapPin className="w-5 h-5" style={{ color: aqiClass.color }} />
            </div>
            <div>
              <h3 className="drawer-title">{location.name}</h3>
              <p className="drawer-coords font-mono text-xs text-slate-400">
                LAT {Number(location.latitude).toFixed(4)}° N • LON {Number(location.longitude).toFixed(4)}° E
              </p>
            </div>
          </div>
          <button
            className="drawer-close-btn"
            onClick={onClose}
            title="Close Drawer (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Status Badges Row */}
          <div className="drawer-badges-row">
            {isAnomaly && (
              <div className="status-badge-chip chip-critical font-mono">
                <AlertTriangle className="w-4 h-4" />
                <span>AI ANOMALY CONFIRMED</span>
              </div>
            )}
            {isHotspot && (
              <div className="status-badge-chip chip-warning font-mono">
                <Flame className="w-4 h-4" />
                <span>HOTSPOT RANK #{location.hotspot_rank || 1}</span>
              </div>
            )}
            {!isAnomaly && !isHotspot && (
              <div className="status-badge-chip chip-success font-mono">
                <ShieldCheck className="w-4 h-4" />
                <span>NOMINAL AIR QUALITY</span>
              </div>
            )}
          </div>

          {/* AQI Overview Card */}
          <div className="drawer-aqi-box" style={{ borderColor: `${aqiClass.color}40` }}>
            <div className="drawer-aqi-left">
              <span className="drawer-aqi-label">LOCAL SECTOR AQI</span>
              <div className="drawer-aqi-num font-mono" style={{ color: aqiClass.color }}>
                {location.aqi ?? "N/A"}
              </div>
              <span
                className="drawer-aqi-category font-mono"
                style={{ backgroundColor: `${aqiClass.color}20`, color: aqiClass.color }}
              >
                {aqiClass.category.toUpperCase()}
              </span>
            </div>

            <div className="drawer-aqi-right font-mono">
              <div className="drawer-stat-row">
                <span className="text-slate-400">City Average:</span>
                <b>{Math.round(cityAverageAqi)} AQI</b>
              </div>
              <div className="drawer-stat-row">
                <span className="text-slate-400">Variance:</span>
                <b className={location.relative_to_average_percent >= 0 ? "text-amber-400" : "text-emerald-400"}>
                  {location.relative_to_average_percent >= 0 ? "+" : ""}
                  {location.relative_to_average_percent ?? 0}%
                </b>
              </div>
              <div className="drawer-stat-row">
                <span className="text-slate-400">ML Score:</span>
                <b>{typeof location.anomaly_score === "number" ? location.anomaly_score.toFixed(4) : "N/A"}</b>
              </div>
            </div>
          </div>

          {/* Pollutant Breakdown for this Location */}
          <div className="drawer-section">
            <h4 className="drawer-section-title">
              <Activity className="w-4 h-4 text-cyan-400" />
              Sensor Readings ({location.name})
            </h4>

            <div className="drawer-pollutants-list">
              {[
                { key: "PM2.5", label: "Fine PM2.5", unit: "µg/m³", max: 200, std: 60 },
                { key: "PM10", label: "Coarse PM10", unit: "µg/m³", max: 300, std: 100 },
                { key: "NO2", label: "Nitrogen Dioxide", unit: "µg/m³", max: 120, std: 80 },
                { key: "SO2", label: "Sulphur Dioxide", unit: "µg/m³", max: 80, std: 80 },
                { key: "CO", label: "Carbon Monoxide", unit: "mg/m³", max: 5.0, std: 2.0 },
                { key: "O3", label: "Ground Ozone", unit: "µg/m³", max: 150, std: 100 },
              ].map((item) => {
                let val = Number(pollutants[item.key] ?? 0);
                if (item.key === "CO" && val > 15) {
                  val = Number((val / 1000).toFixed(2));
                }
                const percent = Math.min((val / item.max) * 100, 100);
                const isOver = val > item.std;

                return (
                  <div key={item.key} className="drawer-pollutant-row">
                    <div className="drawer-pollutant-header">
                      <span className="drawer-pollutant-name font-mono">{item.key}</span>
                      <span className="drawer-pollutant-val font-mono">
                        <b>{val}</b> <small className="text-slate-400">{item.unit}</small>
                      </span>
                    </div>

                    <div className="drawer-pollutant-bar-bg">
                      <div
                        className="drawer-pollutant-bar-fill"
                        style={{
                          width: `${Math.max(percent, 4)}%`,
                          backgroundColor: isOver ? "var(--color-critical)" : "var(--accent-primary)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Machine Learning Decision Breakdown */}
          <div className="drawer-section">
            <h4 className="drawer-section-title">
              <Compass className="w-4 h-4 text-blue-400" />
              Digital Twin AI Anomaly Diagnostic
            </h4>
            <div className="drawer-diagnostic-card font-mono text-xs">
              <p className="text-slate-300">
                The <b>Isolation Forest</b> algorithm computes high-dimensional partitioning trees over
                PM2.5, PM10, NO2, SO2, CO, and O3 to flag unusual atmospheric events.
              </p>
              <div className="mt-3 flex justify-between border-t border-slate-700/60 pt-2">
                <span className="text-slate-400">Classification:</span>
                <span className={isAnomaly ? "text-red-400 font-bold" : "text-emerald-400 font-bold"}>
                  {location.anomaly_status || (isAnomaly ? "Anomaly" : "Normal")}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-slate-400">Hotspot Index:</span>
                <span className={isHotspot ? "text-amber-400 font-bold" : "text-slate-300"}>
                  {isHotspot ? `YES (Rank #${location.hotspot_rank})` : "NO"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
