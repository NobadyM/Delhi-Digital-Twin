import { useState } from "react";
import { X, Copy, Check, Code2, Download } from "lucide-react";

export default function RawDataViewerModal({
  isOpen,
  onClose,
  liveData,
  mapData,
}) {
  const [activeTab, setActiveTab] = useState("live");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentPayload = activeTab === "live" ? liveData : mapData;
  const jsonString = JSON.stringify(currentPayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delhi-digital-twin-${activeTab}-telemetry.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog modal-dialog-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2.5">
            <div className="modal-icon-badge">
              <Code2 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="modal-title">Live API JSON Telemetry Feed</h3>
              <p className="modal-subtitle">
                Raw REST payloads synchronized from Open-Meteo & FastAPI Isolation Forest service
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close Modal">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          {/* Subheader with tabs and action buttons */}
          <div className="json-toolbar">
            <div className="json-tabs">
              <button
                className={`tab-btn ${activeTab === "live" ? "active" : ""}`}
                onClick={() => setActiveTab("live")}
              >
                /api/live (Central Delhi)
              </button>
              <button
                className={`tab-btn ${activeTab === "map" ? "active" : ""}`}
                onClick={() => setActiveTab("map")}
              >
                /api/map-data (9 Geospatial Zones)
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-header btn-ghost font-mono text-xs" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button className="btn-header btn-ghost font-mono text-xs" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy JSON"}
              </button>
            </div>
          </div>

          <div className="json-code-container">
            <pre className="json-code-pre font-mono">{jsonString}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
