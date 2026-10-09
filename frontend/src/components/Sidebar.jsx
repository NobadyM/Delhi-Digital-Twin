import {
  LayoutDashboard,
  BarChart3,
  AlertTriangle,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { getAQIClassification } from "../services/api";

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  activeSection,
  onSelectSection,
  locations = [],
  selectedLocation,
  onSelectLocation,
  onOpenSimulator,
}) {
  return (
    <aside className={`sidebar-nav ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Collapse Toggle Button */}
      <button
        className="sidebar-toggle-btn"
        onClick={onToggleCollapse}
        title={collapsed ? "Expand Command Sidebar" : "Collapse Sidebar"}
        aria-label="Toggle Sidebar"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      {/* Main Navigation Modules */}
      <div className="sidebar-group">
        <span className="sidebar-group-title">
          {collapsed ? "NAV" : "OPERATIONS COMMAND"}
        </span>
        <nav className="sidebar-menu">
          <button
            className={`sidebar-link ${activeSection === "overview" ? "active" : ""}`}
            onClick={() => onSelectSection("overview")}
            title="Overview & Digital Twin"
          >
            <LayoutDashboard className="sidebar-link-icon" />
            {!collapsed && <span className="sidebar-link-text">Overview Dashboard</span>}
          </button>

          <button
            className={`sidebar-link ${activeSection === "map" ? "active" : ""}`}
            onClick={() => onSelectSection("map")}
            title="Geospatial Twin Map"
          >
            <Layers className="sidebar-link-icon" />
            {!collapsed && <span className="sidebar-link-text">Geospatial Explorer</span>}
          </button>

          <button
            className={`sidebar-link ${activeSection === "analytics" ? "active" : ""}`}
            onClick={() => onSelectSection("analytics")}
            title="Pollutant Analytics"
          >
            <BarChart3 className="sidebar-link-icon" />
            {!collapsed && <span className="sidebar-link-text">Pollutant Analytics</span>}
          </button>

          <button
            className={`sidebar-link ${activeSection === "anomalies" ? "active" : ""}`}
            onClick={() => onSelectSection("anomalies")}
            title="Anomalies & Hotspots"
          >
            <AlertTriangle className="sidebar-link-icon text-amber-400" />
            {!collapsed && (
              <span className="sidebar-link-text flex items-center justify-between w-full">
                <span>Anomalies & Hotspots</span>
                <span className="sidebar-badge-count">
                  {locations.filter((l) => l.is_anomaly || l.hotspot).length}
                </span>
              </span>
            )}
          </button>

          <button
            className="sidebar-link"
            onClick={onOpenSimulator}
            title="Launch What-If ML Simulator"
          >
            <Sliders className="sidebar-link-icon text-cyan-400" />
            {!collapsed && <span className="sidebar-link-text">What-If Simulator</span>}
          </button>
        </nav>
      </div>

      {/* Monitored Delhi Zones Explorer */}
      <div className="sidebar-group sidebar-zones-group">
        <div className="sidebar-group-header">
          <span className="sidebar-group-title">
            {collapsed ? "ZONES" : `MONITORED ZONES (${locations.length})`}
          </span>
        </div>

        <div className="sidebar-zones-list">
          {locations.map((loc) => {
            const isSelected = selectedLocation?.name === loc.name;
            const aqiClass = getAQIClassification(loc.aqi);
            const isAnomaly = loc.is_anomaly || loc.prediction === -1;
            const isHotspot = loc.hotspot;

            return (
              <button
                key={loc.name}
                className={`sidebar-zone-item ${isSelected ? "selected" : ""} ${
                  isAnomaly ? "is-anomaly" : isHotspot ? "is-hotspot" : ""
                }`}
                onClick={() => onSelectLocation(loc)}
                title={`${loc.name} — AQI: ${loc.aqi ?? "N/A"}`}
              >
                <div className="zone-indicator-dot" style={{ backgroundColor: aqiClass.color }} />
                {!collapsed && (
                  <>
                    <span className="zone-name">{loc.name}</span>
                    <div className="zone-meta">
                      {isAnomaly ? (
                        <span className="zone-chip anomaly">ANOMALY</span>
                      ) : isHotspot ? (
                        <span className="zone-chip hotspot">
                          <Flame className="w-2.5 h-2.5" /> HOTSPOT
                        </span>
                      ) : null}
                      <span className="zone-aqi font-mono">{loc.aqi ?? "--"}</span>
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Diagnostics / System Integrity */}
      {!collapsed && (
        <div className="sidebar-footer-card">
          <div className="footer-card-header">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Telemetry Health: Nominal</span>
          </div>
          <div className="footer-card-specs font-mono">
            <div>Model: Isolation Forest</div>
            <div>Sensors: 9 Nodes Active</div>
            <div>Sync: Auto (60s)</div>
          </div>
        </div>
      )}
    </aside>
  );
}
