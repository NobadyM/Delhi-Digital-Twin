import { ShieldCheck, Database, Radio } from "lucide-react";

export default function LoadingScreen({ message = "Initializing Delhi Digital Twin Telemetry..." }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center loading-screen-container">
      <div className="loading-grid-overlay" />
      
      <div className="loading-card">
        {/* Radar Ring Animation */}
        <div className="relative flex items-center justify-center radar-container">
          <div className="radar-ping-ring" />
          <div className="radar-sweep-disk" />
          <div className="radar-center-icon">
            <Radio className="w-8 h-8 text-cyan-400 animate-pulse" />
          </div>
        </div>

        <div className="loading-text-group">
          <h2 className="loading-title">DELHI DIGITAL TWIN</h2>
          <p className="loading-subtitle">URBAN AIR QUALITY INTELLIGENCE</p>
          <div className="loading-bar-track">
            <div className="loading-bar-progress" />
          </div>
          <p className="loading-status-message">{message}</p>
        </div>

        <div className="loading-telemetry-steps">
          <div className="step-item active">
            <Radio className="w-3.5 h-3.5" />
            <span>Open-Meteo Sensor Stream</span>
          </div>
          <div className="step-item active">
            <Database className="w-3.5 h-3.5" />
            <span>9 Spatial Monitoring Nodes</span>
          </div>
          <div className="step-item active">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Isolation Forest ML Pipeline</span>
          </div>
        </div>
      </div>
    </div>
  );
}
