// Standard regulatory benchmarks (CPCB / WHO 24h thresholds)
const POLLUTANT_CONFIG = {
  "PM2.5": {
    name: "Fine Particulate Matter",
    unit: "µg/m³",
    standardLimit: 60,
    maxScale: 250,
    dangerThreshold: 120,
    desc: "Inhalable particles ≤ 2.5 µm that penetrate deep into pulmonary tissue.",
  },
  "PM10": {
    name: "Coarse Particulate Matter",
    unit: "µg/m³",
    standardLimit: 100,
    maxScale: 350,
    dangerThreshold: 250,
    desc: "Inhalable dust, pollen, and road dust particles ≤ 10 µm.",
  },
  "NO2": {
    name: "Nitrogen Dioxide",
    unit: "µg/m³",
    standardLimit: 80,
    maxScale: 150,
    dangerThreshold: 80,
    desc: "Toxic gas emitted by high-temperature combustion and vehicle exhausts.",
  },
  "SO2": {
    name: "Sulphur Dioxide",
    unit: "µg/m³",
    standardLimit: 80,
    maxScale: 100,
    dangerThreshold: 80,
    desc: "Acid rain precursor produced by industrial power stations and brick kilns.",
  },
  "CO": {
    name: "Carbon Monoxide",
    unit: "mg/m³",
    standardLimit: 2.0,
    maxScale: 5.0,
    dangerThreshold: 4.0,
    desc: "Colorless, odorless gas resulting from incomplete fuel combustion.",
  },
  "O3": {
    name: "Ground-Level Ozone",
    unit: "µg/m³",
    standardLimit: 100,
    maxScale: 200,
    dangerThreshold: 100,
    desc: "Secondary photochemical pollutant formed by solar reaction with NOx & VOCs.",
  },
};

export default function PollutantGrid({ pollutants = {} }) {
  const pollutantKeys = ["PM2.5", "PM10", "NO2", "SO2", "CO", "O3"];

  return (
    <section className="pollutants-section">
      <div className="section-header-compact">
        <div>
          <h3 className="section-title">Current Atmospheric Pollutant Concentrations</h3>
          <p className="section-subtitle">
            Ground-level gas & particulate telemetry with CPCB/WHO regulatory benchmark comparison
          </p>
        </div>
        <div className="section-legend">
          <span className="legend-item"><span className="legend-dot dot-safe" /> Safe</span>
          <span className="legend-item"><span className="legend-dot dot-warn" /> Elevated</span>
          <span className="legend-item"><span className="legend-dot dot-danger" /> Critical</span>
        </div>
      </div>

      <div className="pollutant-cards-grid">
        {pollutantKeys.map((key) => {
          const cfg = POLLUTANT_CONFIG[key] || {
            name: key,
            unit: "µg/m³",
            standardLimit: 100,
            maxScale: 200,
            dangerThreshold: 100,
            desc: "",
          };

          const rawVal = pollutants[key] ?? 0;
          let val = Number(rawVal) || 0;
          if (key === "CO" && val > 15) {
            val = Number((val / 1000).toFixed(2));
          }
          const ratio = (val / cfg.standardLimit) * 100;
          const progressPercent = Math.min((val / cfg.maxScale) * 100, 100);

          let statusColor = "var(--color-success)";
          let statusLabel = "Within Limits";
          if (val > cfg.dangerThreshold) {
            statusColor = "var(--color-critical)";
            statusLabel = "Critical Surge";
          } else if (val > cfg.standardLimit) {
            statusColor = "var(--color-warning)";
            statusLabel = "Exceeds Benchmark";
          }

          return (
            <div key={key} className="pollutant-card">
              <div className="pollutant-card-top">
                <span className="pollutant-symbol">{key}</span>
                <span
                  className="pollutant-status-pill font-mono"
                  style={{ color: statusColor, borderColor: `${statusColor}40` }}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="pollutant-value-row">
                <span className="pollutant-large-number font-mono">{val}</span>
                <span className="pollutant-unit font-mono">{cfg.unit}</span>
              </div>

              <div className="pollutant-meter-track">
                <div
                  className="pollutant-meter-fill"
                  style={{
                    width: `${Math.max(progressPercent, 4)}%`,
                    backgroundColor: statusColor,
                  }}
                />
                {/* Standard marker threshold line */}
                <div
                  className="pollutant-limit-marker"
                  style={{
                    left: `${Math.min((cfg.standardLimit / cfg.maxScale) * 100, 100)}%`,
                  }}
                  title={`Safe standard limit: ${cfg.standardLimit} ${cfg.unit}`}
                />
              </div>

              <div className="pollutant-meta-row font-mono">
                <span>Std Limit: {cfg.standardLimit} {cfg.unit}</span>
                <span style={{ color: statusColor }}>
                  {ratio >= 100 ? `+${(ratio - 100).toFixed(0)}%` : `${ratio.toFixed(0)}% of limit`}
                </span>
              </div>

              <p className="pollutant-desc">{cfg.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
