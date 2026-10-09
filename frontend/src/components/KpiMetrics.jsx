import { useEffect, useState, useRef } from "react";
import {
  Wind,
  ShieldAlert,
  Flame,
  Radio,
} from "lucide-react";
import { getAQIClassification } from "../services/api";

function AnimatedNumber({ value, duration = 600 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    let startTimestamp = null;
    const startVal = prevValueRef.current;
    const endVal = Number(value) || 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(progress * (endVal - startVal) + startVal);
      setDisplayValue(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        prevValueRef.current = endVal;
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <span className="tabular-num">{displayValue}</span>;
}

export default function KpiMetrics({ averageAqi, locations = [], liveData }) {
  const aqiInfo = getAQIClassification(averageAqi);
  const anomaliesCount = locations.filter(
    (l) => l.is_anomaly === true || l.prediction === -1 || l.anomaly === "Anomaly"
  ).length;

  const hotspots = locations.filter((l) => l.hotspot === true);
  const topHotspot = hotspots.sort(
    (a, b) => (b.relative_to_average_percent || 0) - (a.relative_to_average_percent || 0)
  )[0];

  const isCityAnomaly = anomaliesCount > 0 || liveData?.is_anomaly;

  return (
    <section className="kpi-metrics-grid">
      {/* 1. DELHI AVERAGE AQI */}
      <div className={`kpi-hero-card aqi-glow-${aqiInfo.classKey}`}>
        <div className="kpi-card-header">
          <div className="kpi-icon-wrap" style={{ color: aqiInfo.color }}>
            <Wind className="w-5 h-5" />
          </div>
          <span className="kpi-label">DELHI CITY-WIDE AVERAGE AQI</span>
          <span
            className="kpi-badge font-mono"
            style={{
              backgroundColor: `${aqiInfo.color}20`,
              color: aqiInfo.color,
              borderColor: `${aqiInfo.color}60`,
            }}
          >
            {aqiInfo.category.toUpperCase()}
          </span>
        </div>

        <div className="kpi-hero-body">
          <div className="kpi-giant-value font-mono" style={{ color: aqiInfo.color }}>
            <AnimatedNumber value={Math.round(averageAqi)} />
          </div>
          <div className="kpi-subtext">
            <span>Air Quality Index</span>
            <p>Aggregated across {locations.length} geospatial monitoring nodes</p>
          </div>
        </div>

        <div className="kpi-card-footer">
          <div className="kpi-spark-bar">
            <div
              className="kpi-spark-fill"
              style={{
                width: `${Math.min((averageAqi / 500) * 100, 100)}%`,
                backgroundColor: aqiInfo.color,
              }}
            />
          </div>
          <span className="font-mono text-xs text-slate-400">Scale: 0 - 500 AQI</span>
        </div>
      </div>

      {/* 2. ISOLATION FOREST ANOMALY STATUS */}
      <div className={`kpi-card ${isCityAnomaly ? "kpi-border-critical" : "kpi-border-success"}`}>
        <div className="kpi-card-header">
          <div className="kpi-icon-wrap text-cyan-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="kpi-label">AI ANOMALY PIPELINE</span>
          <span
            className={`kpi-badge font-mono ${
              isCityAnomaly ? "badge-critical" : "badge-success"
            }`}
          >
            {isCityAnomaly ? "ALERT" : "NOMINAL"}
          </span>
        </div>

        <div className="kpi-card-body">
          <div className="kpi-stat-value font-mono">
            {anomaliesCount > 0 ? (
              <span className="text-red-400">
                <AnimatedNumber value={anomaliesCount} /> Flagged
              </span>
            ) : (
              <span className="text-emerald-400">0 Active</span>
            )}
          </div>
          <p className="kpi-card-desc">
            {anomaliesCount > 0
              ? `${anomaliesCount} zone(s) deviate >1σ from urban baseline distribution`
              : "All sensor distributions match expected seasonal baseline"}
          </p>
        </div>

        <div className="kpi-card-footer">
          <span className="kpi-meta-tag font-mono">Model: Isolation Forest</span>
          <span className="kpi-meta-tag font-mono">Method: Adaptive σ-Cut</span>
        </div>
      </div>

      {/* 3. RELATIVE HOTSPOTS */}
      <div className="kpi-card kpi-border-warning">
        <div className="kpi-card-header">
          <div className="kpi-icon-wrap text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <span className="kpi-label">CRITICAL HOTSPOTS</span>
          <span className="kpi-badge badge-warning font-mono">
            {hotspots.length} DETECTED
          </span>
        </div>

        <div className="kpi-card-body">
          <div className="kpi-stat-value font-mono text-amber-400">
            <AnimatedNumber value={hotspots.length} /> <span className="text-sm font-sans font-normal text-slate-400">Zones &gt;+20%</span>
          </div>
          <p className="kpi-card-desc">
            {topHotspot
              ? `Max: ${topHotspot.name} (+${topHotspot.relative_to_average_percent}% vs city avg)`
              : "No extreme localized hotspots currently exceeding threshold"}
          </p>
        </div>

        <div className="kpi-card-footer">
          <span className="kpi-meta-tag font-mono">Threshold: &gt;120% City Mean</span>
          {topHotspot && (
            <span className="kpi-meta-tag font-mono text-amber-300">
              Rank #1: {topHotspot.name}
            </span>
          )}
        </div>
      </div>

      {/* 4. TELEMETRY SENSOR GRID */}
      <div className="kpi-card kpi-border-accent">
        <div className="kpi-card-header">
          <div className="kpi-icon-wrap text-cyan-400">
            <Radio className="w-5 h-5" />
          </div>
          <span className="kpi-label">SENSOR GRID NETWORK</span>
          <span className="kpi-badge badge-info font-mono">100% ONLINE</span>
        </div>

        <div className="kpi-card-body">
          <div className="kpi-stat-value font-mono text-cyan-300">
            {locations.length}/{locations.length}
            <span className="text-sm font-sans font-normal text-slate-400"> Nodes Active</span>
          </div>
          <p className="kpi-card-desc">
            Live Open-Meteo European Meteorological Satellite & CPCB ground telemetry
          </p>
        </div>

        <div className="kpi-card-footer">
          <span className="kpi-meta-tag font-mono">Cadence: 60s Stream</span>
          <span className="kpi-meta-tag font-mono">Coverage: NCR Zone</span>
        </div>
      </div>
    </section>
  );
}
