import { useState } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
} from "lucide-react";
import { predictAnomaly } from "../services/api";

const PRESETS = [
  {
    name: "Clean Green Corridor",
    values: { PM2_5: 28, PM10: 55, NO2: 18, SO2: 6, CO: 0.6, O3: 22 },
    desc: "Post-monsoon low emission baseline",
  },
  {
    name: "Winter Smog Episode",
    values: { PM2_5: 240, PM10: 380, NO2: 78, SO2: 24, CO: 3.2, O3: 35 },
    desc: "Severe seasonal biomass and thermal inversion",
  },
  {
    name: "Industrial SO2/NOx Surge",
    values: { PM2_5: 95, PM10: 160, NO2: 110, SO2: 85, CO: 2.1, O3: 30 },
    desc: "Heavy industrial and logistics corridor emissions",
  },
];

export default function ScenarioSimulatorModal({ isOpen, onClose }) {
  const [formValues, setFormValues] = useState({
    PM2_5: 92.4,
    PM10: 178.6,
    NO2: 44.2,
    SO2: 12.8,
    CO: 1.4,
    O3: 28.5,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleChange = (field, val) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: parseFloat(val) || 0,
    }));
  };

  const handleApplyPreset = (preset) => {
    setFormValues(preset.values);
    setResult(null);
  };

  const handleSimulate = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await predictAnomaly(formValues);
      setResult(res);
    } catch (err) {
      console.error("Simulation error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2.5">
            <div className="modal-icon-badge">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="modal-title">What-If Emission Scenario Simulator</h3>
              <p className="modal-subtitle">
                Test custom emission profiles against the deployed Isolation Forest ML model
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close Modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {/* Preset Buttons */}
          <div className="presets-row">
            <span className="preset-label font-mono">Quick Scenarios:</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="preset-btn"
                onClick={() => handleApplyPreset(p)}
                title={p.desc}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Form Sliders */}
          <form onSubmit={handleSimulate} className="simulation-form">
            <div className="form-sliders-grid">
              {[
                { key: "PM2_5", label: "PM2.5 (Fine Particulates)", min: 0, max: 400, step: 1, unit: "µg/m³" },
                { key: "PM10", label: "PM10 (Coarse Dust)", min: 0, max: 600, step: 1, unit: "µg/m³" },
                { key: "NO2", label: "NO2 (Nitrogen Dioxide)", min: 0, max: 200, step: 1, unit: "µg/m³" },
                { key: "SO2", label: "SO2 (Sulphur Dioxide)", min: 0, max: 150, step: 1, unit: "µg/m³" },
                { key: "CO", label: "CO (Carbon Monoxide)", min: 0, max: 8.0, step: 0.1, unit: "mg/m³" },
                { key: "O3", label: "O3 (Ground Ozone)", min: 0, max: 250, step: 1, unit: "µg/m³" },
              ].map((field) => (
                <div key={field.key} className="form-slider-box">
                  <div className="slider-label-row font-mono">
                    <span>{field.label}</span>
                    <span className="slider-current-val">
                      <b>{formValues[field.key]}</b> <small>{field.unit}</small>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={formValues[field.key]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="cyber-range-input"
                  />
                </div>
              ))}
            </div>

            <div className="simulation-actions-row">
              <button
                type="button"
                className="btn-header btn-ghost font-mono"
                onClick={() =>
                  setFormValues({ PM2_5: 92.4, PM10: 178.6, NO2: 44.2, SO2: 12.8, CO: 1.4, O3: 28.5 })
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Values
              </button>

              <button
                type="submit"
                className="btn-header btn-simulator font-semibold"
                disabled={loading}
              >
                <Zap className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Evaluating Model..." : "Run ML Simulation"}
              </button>
            </div>
          </form>

          {/* Simulation Output Result Box */}
          {result && (
            <div
              className={`simulation-result-box ${
                result.status === "Anomaly" || result.prediction === -1
                  ? "result-critical"
                  : "result-nominal"
              }`}
            >
              <div className="result-header">
                {result.status === "Anomaly" || result.prediction === -1 ? (
                  <>
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <div>
                      <h4 className="result-title text-red-400">ISOLATION FOREST: ANOMALY DETECTED</h4>
                      <p className="result-desc">
                        This emission profile represents a statistical outlier relative to baseline Delhi air quality training weights.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                    <div>
                      <h4 className="result-title text-emerald-400">ISOLATION FOREST: NOMINAL RANGE</h4>
                      <p className="result-desc">
                        The simulated atmospheric composition falls within standard cluster bounds.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="result-telemetry-grid font-mono text-xs">
                <div>Model Classification: <b>{result.status}</b></div>
                <div>Internal Prediction Code: <b>{result.prediction}</b></div>
                <div>Status: <b>{result.isFallback ? "Client Emulation" : "FastAPI Backend Live"}</b></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
