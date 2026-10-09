import {
  RotateCw,
  Code2,
  Radio,
  Search,
  Wifi,
  WifiOff,
  Clock,
  Sparkles,
} from "lucide-react";

export default function Header({
  lastUpdated,
  lastSyncedAt,
  loading,
  isFallback,
  onRefresh,
  onOpenSimulator,
  onOpenRawData,
  searchQuery,
  onSearchChange,
}) {
  const formattedObsTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "Syncing...";

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <header className="header-nav">
      {/* Brand Identity */}
      <div className="header-brand-group">
        <div className="brand-logo-hex">
          <Radio className="brand-icon" />
          <span className="brand-glow" />
        </div>
        <div className="brand-titles">
          <div className="brand-main-title">
            <span>DELHI DIGITAL TWIN</span>
            <span className="brand-tag">v2.0 COMMAND</span>
          </div>
          <p className="brand-subtitle">
            Autonomous Urban Air Quality Telemetry & Geospatial ML Detection
          </p>
        </div>
      </div>

      {/* Middle: Zone Search Bar */}
      <div className="header-search-container">
        <Search className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search Delhi zones (e.g., North, Central, East)..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button
            className="search-clear-btn"
            onClick={() => onSearchChange("")}
            title="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Right Controls */}
      <div className="header-controls">
        {/* Connection status badge */}
        <div className={`status-pill ${isFallback ? "status-fallback" : "status-live"}`}>
          <span className="status-ping" />
          {isFallback ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>CACHED BASELINE</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>LIVE TELEMETRY</span>
            </>
          )}
        </div>

        {/* Timestamp */}
        <div
          className="telemetry-time-badge font-mono"
          title={`Observation window: ${formattedObsTime} IST | Connected to backend: ${formattedSyncTime || "Active"}`}
        >
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-white font-medium">{formattedObsTime}</span>
          {formattedSyncTime && (
            <span className="text-xs text-emerald-400 font-sans tracking-normal font-medium ml-1">
              • LIVE SYNC {formattedSyncTime}
            </span>
          )}
        </div>

        {/* Action: Refresh Data */}
        <button
          className="btn-header btn-primary"
          onClick={onRefresh}
          disabled={loading}
          title="Fetch latest satellite and sensor readings"
        >
          <RotateCw className={`btn-icon ${loading ? "animate-spin" : ""}`} />
          <span className="btn-label">{loading ? "Syncing..." : "Sync"}</span>
        </button>

        {/* Action: Open Scenario Simulator */}
        <button
          className="btn-header btn-simulator"
          onClick={onOpenSimulator}
          title="Run What-If ML prediction on Isolation Forest"
        >
          <Sparkles className="btn-icon text-cyan-400" />
          <span className="btn-label">What-If Simulator</span>
        </button>

        {/* Action: View Raw API Feed */}
        <button
          className="btn-header btn-ghost"
          onClick={onOpenRawData}
          title="Inspect raw JSON API feed"
        >
          <Code2 className="btn-icon" />
          <span className="btn-label">JSON Telemetry</span>
        </button>
      </div>
    </header>
  );
}
