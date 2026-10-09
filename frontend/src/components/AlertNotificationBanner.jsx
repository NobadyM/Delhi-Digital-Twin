import { useState } from "react";
import { AlertTriangle, X, ArrowRight, Flame, ShieldAlert } from "lucide-react";

export default function AlertNotificationBanner({
  locations = [],
  apiError = null,
  onInspectZone,
  onFilterAnomalies,
}) {
  const [dismissed, setDismissed] = useState(false);

  const anomalyLocations = locations.filter((l) => l.is_anomaly || l.prediction === -1);
  const hotspotLocations = locations.filter((l) => l.hotspot);

  if (dismissed) {
    return null;
  }

  // If there's an API error
  if (apiError) {
    return (
      <div className="alert-banner-container" style={{ borderColor: "rgba(255, 181, 71, 0.4)" }}>
        <div className="alert-banner-content">
          <div className="alert-banner-icon-pulse" style={{ background: "rgba(255, 181, 71, 0.25)" }}>
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div className="alert-banner-text">
            <strong className="text-white">TELEMETRY STREAM NOTICE:</strong>{" "}
            <span>Backend link timed out ({apiError}). Synchronized with calibrated Delhi NCR baseline cache.</span>
          </div>
          <div className="alert-banner-actions">
            <button
              className="alert-dismiss-btn"
              onClick={() => setDismissed(true)}
              title="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (anomalyLocations.length === 0 && hotspotLocations.length === 0) {
    return null;
  }

  const primaryAnomaly = anomalyLocations[0];
  const primaryHotspot = hotspotLocations[0];

  return (
    <div className="alert-banner-container">
      <div className="alert-banner-content">
        <div className="alert-banner-icon-pulse">
          {anomalyLocations.length > 0 ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : (
            <Flame className="w-5 h-5 text-amber-400" />
          )}
        </div>

        <div className="alert-banner-text">
          <strong className="text-white">
            {anomalyLocations.length > 0 ? "URBAN ANOMALY ADVISORY:" : "HOTSPOT ALERT:"}
          </strong>{" "}
          <span>
            {anomalyLocations.length > 0
              ? `Isolation Forest detected anomalous particulate concentrations in ${anomalyLocations
                  .map((l) => l.name)
                  .join(", ")}.`
              : `Spatial hotspots detected exceeding +20% urban baseline in ${hotspotLocations
                  .map((l) => l.name)
                  .join(", ")}.`}
          </span>
        </div>

        <div className="alert-banner-actions">
          {primaryAnomaly ? (
            <button
              className="alert-action-btn"
              onClick={() => onInspectZone(primaryAnomaly)}
            >
              Inspect {primaryAnomaly.name} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : primaryHotspot ? (
            <button
              className="alert-action-btn"
              style={{ backgroundColor: "var(--color-warning)", color: "#080D18" }}
              onClick={() => onInspectZone(primaryHotspot)}
            >
              Inspect {primaryHotspot.name} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}

          {anomalyLocations.length > 0 && onFilterAnomalies && (
            <button
              className="btn-header btn-ghost font-mono text-xs"
              onClick={onFilterAnomalies}
            >
              Filter Map
            </button>
          )}

          <button
            className="alert-dismiss-btn"
            onClick={() => setDismissed(true)}
            title="Dismiss advisory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
