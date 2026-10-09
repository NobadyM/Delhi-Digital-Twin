import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart2, Layers, Activity } from "lucide-react";
import { getAQIClassification } from "../services/api";

// Custom Cyber Tooltip for Recharts
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="recharts-cyber-tooltip">
        <div className="tooltip-title">{label || data.name || data.pollutant}</div>
        <div className="tooltip-row font-mono">
          <span className="tooltip-label">Value:</span>
          <span className="tooltip-val font-bold text-cyan-300">
            {payload[0].value} {data.unit || ""}
          </span>
        </div>
        {data.limit && (
          <div className="tooltip-row font-mono text-xs text-slate-400">
            <span>Std Limit:</span>
            <span>{data.limit} {data.unit}</span>
          </div>
        )}
        {data.anomaly && (
          <div className="tooltip-row text-xs text-red-400 font-mono mt-1 font-semibold">
            ⚠️ AI Anomaly Flagged
          </div>
        )}
        {data.hotspot && (
          <div className="tooltip-row text-xs text-amber-400 font-mono mt-1 font-semibold">
            🔥 Spatial Hotspot
          </div>
        )}
      </div>
    );
  }
  return null;
}

export default function PollutantAnalytics({ pollutants = {}, locations = [] }) {
  const [activeTab, setActiveTab] = useState("pollutants"); // "pollutants" | "zones"

  // Data for Pollutant Spectrum
  const pollutantChartData = [
    {
      pollutant: "PM2.5",
      value: Number(pollutants["PM2.5"] ?? 0),
      limit: 60,
      unit: "µg/m³",
      fill: "#00C8FF",
    },
    {
      pollutant: "PM10",
      value: Number(pollutants.PM10 ?? 0),
      limit: 100,
      unit: "µg/m³",
      fill: "#477BFF",
    },
    {
      pollutant: "NO2",
      value: Number(pollutants.NO2 ?? 0),
      limit: 80,
      unit: "µg/m³",
      fill: "#A855F7",
    },
    {
      pollutant: "SO2",
      value: Number(pollutants.SO2 ?? 0),
      limit: 80,
      unit: "µg/m³",
      fill: "#38BDF8",
    },
    {
      pollutant: "CO",
      value: Number(pollutants.CO ?? 0) > 15 
        ? Number(((pollutants.CO / 1000) * 20).toFixed(1))
        : Number(pollutants.CO ?? 0) * 20,
      originalValue: Number(pollutants.CO ?? 0) > 15
        ? Number((pollutants.CO / 1000).toFixed(2))
        : Number(pollutants.CO ?? 0),
      limit: 2,
      unit: "mg/m³ (x20 visual)",
      fill: "#FFB547",
    },
    {
      pollutant: "O3",
      value: Number(pollutants.O3 ?? 0),
      limit: 100,
      unit: "µg/m³",
      fill: "#32D583",
    },
  ];

  // Data for Zone Comparison
  const zoneChartData = [...locations]
    .sort((a, b) => (b.aqi || 0) - (a.aqi || 0))
    .map((loc) => {
      const aqiClass = getAQIClassification(loc.aqi);
      const isAnomaly = loc.is_anomaly === true || loc.prediction === -1;
      const isHotspot = loc.hotspot === true;

      let color = aqiClass.color;
      if (isAnomaly) color = "#FF5263";
      else if (isHotspot) color = "#FFB547";

      return {
        name: loc.name.replace(" Delhi", ""),
        fullName: loc.name,
        aqi: loc.aqi || 0,
        anomaly: isAnomaly,
        hotspot: isHotspot,
        color: color,
        unit: "AQI",
      };
    });

  return (
    <section className="analytics-section">
      <div className="section-header-compact">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="section-title">Telemetry Analytics & Spatial Distribution</h3>
            <p className="section-subtitle">
              Comparative analysis of airborne pollutants and cross-zone air quality indices
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="analytics-tabs">
          <button
            className={`tab-btn ${activeTab === "pollutants" ? "active" : ""}`}
            onClick={() => setActiveTab("pollutants")}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Pollutant Spectrum
          </button>
          <button
            className={`tab-btn ${activeTab === "zones" ? "active" : ""}`}
            onClick={() => setActiveTab("zones")}
          >
            <Layers className="w-3.5 h-3.5" />
            9-Zone AQI Comparison
          </button>
        </div>
      </div>

      <div className="chart-panel-card">
        {activeTab === "pollutants" ? (
          <div className="chart-wrapper">
            <div className="chart-meta-header">
              <span className="font-mono text-xs text-slate-400">
                Atmospheric Concentrations relative to Safe Threshold Limits
              </span>
              <span className="font-mono text-xs text-cyan-400">
                Source: Central Delhi Open-Meteo Sensor Stream
              </span>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={pollutantChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 123, 255, 0.12)" />
                <XAxis
                  dataKey="pollutant"
                  stroke="#94A3B8"
                  tick={{ fill: "#94A3B8", fontSize: 12, fontFamily: "var(--font-mono)" }}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-mono)" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {pollutantChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="chart-wrapper">
            <div className="chart-meta-header">
              <span className="font-mono text-xs text-slate-400">
                Delhi Zones Ranked by Air Quality Index (Highest to Lowest)
              </span>
              <span className="font-mono text-xs text-amber-400">
                Color Keys: 🔴 Anomaly • 🟠 Hotspot • 🟢 Nominal
              </span>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={zoneChartData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 123, 255, 0.12)" />
                <XAxis
                  dataKey="name"
                  stroke="#94A3B8"
                  tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <YAxis
                  stroke="#94A3B8"
                  tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-mono)" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="aqi" radius={[6, 6, 0, 0]}>
                  {zoneChartData.map((entry, index) => (
                    <Cell key={`zone-cell-${index}`} fill={entry.color} fillOpacity={0.88} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
