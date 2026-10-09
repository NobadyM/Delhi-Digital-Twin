import { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";

// Services
import { fetchDigitalTwinTelemetry } from "./services/api";

// Core Components
import LoadingScreen from "./components/LoadingScreen";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import AlertNotificationBanner from "./components/AlertNotificationBanner";
import KpiMetrics from "./components/KpiMetrics";
import DigitalTwinMap from "./components/DigitalTwinMap";
import LocationDetailDrawer from "./components/LocationDetailDrawer";
import PollutantGrid from "./components/PollutantGrid";
import PollutantAnalytics from "./components/PollutantAnalytics";
import ScenarioSimulatorModal from "./components/ScenarioSimulatorModal";
import RawDataViewerModal from "./components/RawDataViewerModal";

export default function App() {
  // Telemetry state
  const [liveData, setLiveData] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapFilterType, setMapFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isRawDataOpen, setIsRawDataOpen] = useState(false);

  // Data fetching logic
  const loadTelemetry = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    
    try {
      const res = await fetchDigitalTwinTelemetry();
      setLiveData(res.liveData);
      setMapData(res.mapData);
      setIsFallback(res.isFallback);
      setApiError(res.error);
      setLastUpdated(res.liveData?.measurement_timestamp || new Date().toISOString());
    } catch (err) {
      console.error("Telemetry load exception:", err);
      setApiError("Unexpected telemetry failure");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Synchronize on mount and set 60-second polling cadence
  useEffect(() => {
    let isMounted = true;

    const executeInitialFetch = async () => {
      await loadTelemetry(false);
    };

    executeInitialFetch();

    const interval = setInterval(() => {
      if (isMounted) {
        loadTelemetry(false);
      }
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [loadTelemetry]);

  // Locations derived from mapData
  const allLocations = useMemo(() => {
    return mapData?.locations || [];
  }, [mapData]);

  // Filtered locations based on search query
  const searchedLocations = useMemo(() => {
    if (!searchQuery.trim()) return allLocations;
    const q = searchQuery.toLowerCase();
    return allLocations.filter((loc) => loc.name.toLowerCase().includes(q));
  }, [allLocations, searchQuery]);

  // City-wide average AQI
  const cityAverageAqi = Number(mapData?.average_aqi ?? liveData?.aqi ?? 0);

  // Pollutants object
  const currentPollutants = liveData?.pollutants || {};

  // Handlers
  const handleSelectSection = (sectionKey) => {
    setActiveSection(sectionKey);
    if (sectionKey === "map") {
      document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth" });
    } else if (sectionKey === "analytics") {
      document.getElementById("analytics-section")?.scrollIntoView({ behavior: "smooth" });
    } else if (sectionKey === "anomalies") {
      setMapFilterType("anomalies");
      document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSelectLocation = (loc) => {
    setSelectedLocation(loc);
    if (loc) {
      document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Keyboard shortcut listener (Escape closes drawers & modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedLocation(null);
        setIsSimulatorOpen(false);
        setIsRawDataOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (initialLoading) {
    return <LoadingScreen message="Connecting to Delhi Digital Twin Stream & Spatial Nodes..." />;
  }

  return (
    <div className="app-container">
      {/* Top Application Navigation */}
      <Header
        lastUpdated={lastUpdated}
        loading={refreshing}
        isFallback={isFallback}
        onRefresh={() => loadTelemetry(true)}
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        onOpenRawData={() => setIsRawDataOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="app-layout">
        {/* Command Sidebar Navigation */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          locations={searchedLocations}
          selectedLocation={selectedLocation}
          onSelectLocation={handleSelectLocation}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
        />

        {/* Primary Dashboard Content */}
        <main className="main-content">
          {/* Critical Anomaly Advisory Banner */}
          <AlertNotificationBanner
            locations={allLocations}
            apiError={apiError}
            onInspectZone={(loc) => handleSelectLocation(loc)}
            onFilterAnomalies={() => {
              setMapFilterType("anomalies");
              document.getElementById("map-section")?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* Key Performance Indicators Grid */}
          <KpiMetrics
            averageAqi={cityAverageAqi}
            locations={allLocations}
            liveData={liveData}
          />

          {/* Primary Geospatial Digital Twin Map */}
          <div id="map-section">
            <DigitalTwinMap
              locations={searchedLocations}
              selectedLocation={selectedLocation}
              onSelectLocation={handleSelectLocation}
              filterType={mapFilterType}
              onFilterChange={setMapFilterType}
            />
          </div>

          {/* Current Pollutant Levels with Regulatory Benchmarks */}
          <div id="pollutants-section">
            <PollutantGrid pollutants={currentPollutants} />
          </div>

          {/* Analytical Charts and Distribution */}
          <div id="analytics-section">
            <PollutantAnalytics
              pollutants={currentPollutants}
              locations={allLocations}
            />
          </div>
        </main>
      </div>

      {/* Slide-in Detail Drawer for Selected Zone */}
      {selectedLocation && (
        <LocationDetailDrawer
          location={selectedLocation}
          cityAverageAqi={cityAverageAqi}
          onClose={() => setSelectedLocation(null)}
        />
      )}

      {/* What-If ML Scenario Simulator Modal */}
      <ScenarioSimulatorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
      />

      {/* Raw JSON Telemetry Viewer Modal */}
      <RawDataViewerModal
        isOpen={isRawDataOpen}
        onClose={() => setIsRawDataOpen(false)}
        liveData={liveData}
        mapData={mapData}
      />
    </div>
  );
}