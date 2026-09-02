import { useEffect, useRef, useState, useCallback } from "react";
import { Header } from "./components/Header";
import { SpeedTestPanel } from "./components/SpeedTestPanel";
import { ResultsSummary } from "./components/ResultsSummary";
import { LatencyCard, DnsCard, BufferbloatCard } from "./components/MetricCards";
import { NetworkInfoPanel } from "./components/NetworkInfoPanel";
import { HistoryCharts } from "./components/HistoryCharts";
import { OutageLog } from "./components/OutageLog";
import { TracerouteView } from "./components/TracerouteView";
import { SettingsModal } from "./components/SettingsModal";
import { api } from "./api";
import { measureDownload, measureUpload, fetchPublicMeta, resetSpeedTestServer, getLastTestServerLabel } from "./speedTest";
import { useWebSocket } from "./useWebSocket";
import type { SpeedTestResult, SystemInfo, PublicMeta, PingSummary, DnsResolverSummary, OutageRecord, TestPhase } from "./types";

function relativeTime(ts: number): string {
  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 60) return "Last tested just now";
  if (diffSec < 3600) return `Last tested ${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `Last tested ${Math.round(diffSec / 3600)}h ago`;
  return `Last tested ${Math.round(diffSec / 86400)}d ago`;
}

export default function App() {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [downloadMbps, setDownloadMbps] = useState(0);
  const [uploadMbps, setUploadMbps] = useState(0);
  const [loadTrace, setLoadTrace] = useState<number[]>([]);
  const [idleTrace, setIdleTrace] = useState<number[]>([]);

  const [lastResult, setLastResult] = useState<SpeedTestResult | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [publicMeta, setPublicMeta] = useState<PublicMeta | null>(null);
  const [pingResults, setPingResults] = useState<PingSummary[]>([]);
  const [pingLoading, setPingLoading] = useState(false);
  const [dnsSummary, setDnsSummary] = useState<DnsResolverSummary[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);
  const [outages, setOutages] = useState<OutageRecord[]>([]);
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [speedTests, setSpeedTests] = useState<SpeedTestResult[]>([]);
  const [pingLogs, setPingLogs] = useState<PingSummary[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({ monitorIntervalMinutes: 5, expectedDownloadMbps: null as number | null, expectedUploadMbps: null as number | null });
  const [testError, setTestError] = useState<string | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const handleWsMessage = useCallback((msg: any) => {
    if (msg.type === "loaded-ping-sample") {
      if (phaseRef.current === "download" || phaseRef.current === "upload") {
        setLoadTrace((prev) => [...prev.slice(-59), msg.rttMs]);
      }
    } else if (msg.type === "monitor-tick") {
      const primary = msg.results?.[0];
      if (primary?.avgMs != null && (phaseRef.current === "idle" || phaseRef.current === "done")) {
        setIdleTrace((prev) => [...prev.slice(-59), primary.avgMs]);
      }
      if (phaseRef.current === "idle" || phaseRef.current === "done") {
        setPingResults(msg.results);
      }
    } else if (msg.type === "outage-start" || msg.type === "outage-end") {
      loadOutages();
    }
  }, []);

  const { connected } = useWebSocket(handleWsMessage);

  const loadOutages = useCallback(() => {
    api.outages().then((r) => setOutages(r.outages)).catch(() => {});
  }, []);

  const loadHistory = useCallback((r: "24h" | "7d" | "30d") => {
    api.history(r).then((res) => {
      setSpeedTests(res.speedTests);
      setPingLogs(res.pingLogs);
    }).catch(() => {});
  }, []);

  const refreshPing = useCallback(() => {
    setPingLoading(true);
    api.pingQuick().then((r) => setPingResults(r.results)).finally(() => setPingLoading(false));
  }, []);

  const refreshDns = useCallback(() => {
    setDnsLoading(true);
    api.dnsHealth().then((r) => setDnsSummary(r.summary)).finally(() => setDnsLoading(false));
  }, []);

  useEffect(() => {
    api.systemInfo().then(setSystemInfo).catch(() => {});
    fetchPublicMeta().then(setPublicMeta).catch(() => {});
    api.latestSpeedTest().then((r) => r && setLastResult(r)).catch(() => {});
    refreshPing();
    refreshDns();
    loadOutages();
    api.getSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory(range);
  }, [range, loadHistory]);

  async function runDiagnostic() {
    setTestError(null);
    resetSpeedTestServer();
    try {
      setPhase("baseline");
      setLoadTrace([]);
      setDownloadMbps(0);
      setUploadMbps(0);

      const idle = await api.pingQuick();
      const primary = idle.results[0] ?? null;
      setPingResults(idle.results);
      const idleLatencyMs = primary?.avgMs ?? null;
      const idleJitterMs = primary?.jitterMs ?? null;
      const idlePacketLossPct = primary?.lossPct ?? null;

      // Download phase, with concurrent loaded-latency probing for bufferbloat
      setPhase("download");
      const downSession = await api.startLoadedPing("download");
      const downloadMbpsResult = await measureDownload({ onProgress: setDownloadMbps });
      setDownloadMbps(downloadMbpsResult);
      const downloadLoaded = await api.stopLoadedPing(downSession.id);

      // Upload phase
      setPhase("upload");
      const upSession = await api.startLoadedPing("upload");
      const uploadMbpsResult = await measureUpload({ onProgress: setUploadMbps });
      setUploadMbps(uploadMbpsResult);
      const uploadLoaded = await api.stopLoadedPing(upSession.id);

      setPhase("saving");
      const meta = await fetchPublicMeta();
      setPublicMeta(meta);

      const saved = await api.saveSpeedTest({
        downloadMbps: downloadMbpsResult,
        uploadMbps: uploadMbpsResult,
        idleLatencyMs,
        idleJitterMs,
        idlePacketLossPct,
        downloadLoadedLatencyMs: downloadLoaded.avgMs,
        uploadLoadedLatencyMs: uploadLoaded.avgMs,
        serverLocation: getLastTestServerLabel() ?? meta.colo,
        clientIp: meta.ip,
      });

      setLastResult(saved);
      setPhase("done");
      loadHistory(range);
    } catch (err) {
      console.error("Diagnostic failed:", err);
      setTestError(err instanceof Error ? err.message : "The diagnostic couldn't complete - check the browser console for details.");
      setPhase("idle");
    }
  }

  function handleExport() {
    api.history("30d").then((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `netpulse-history-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleSaveSettings(values: { monitorIntervalMinutes: number; expectedDownloadMbps: number | null; expectedUploadMbps: number | null }) {
    setSettings(values);
    api.saveSettings(values).catch(() => {});
  }

  const displayTrace = phase === "download" || phase === "upload" ? loadTrace : idleTrace;

  return (
    <div className="app-shell">
      <Header wsConnected={connected} onOpenSettings={() => setSettingsOpen(true)} onExport={handleExport} />

      <SpeedTestPanel
        phase={phase}
        downloadMbps={downloadMbps}
        uploadMbps={uploadMbps}
        pingTrace={displayTrace}
        lastTestedLabel={lastResult ? relativeTime(lastResult.timestamp) : null}
        error={testError}
        onRun={runDiagnostic}
      />

      <div className="section-spacer" />

      <div className="grid grid-3">
        <ResultsSummary result={lastResult} />
        <LatencyCard results={pingResults} loading={pingLoading} onRefresh={refreshPing} />
        <BufferbloatCard
          grade={lastResult?.bufferbloatGrade ?? null}
          increaseMs={lastResult?.bufferbloatIncreaseMs ?? null}
          idleMs={lastResult?.idleLatencyMs ?? null}
          loadedDownMs={lastResult?.downloadLoadedLatencyMs ?? null}
          loadedUpMs={lastResult?.uploadLoadedLatencyMs ?? null}
        />
      </div>

      <div className="section-spacer" />

      <div className="grid grid-2">
        <DnsCard summary={dnsSummary} loading={dnsLoading} onRefresh={refreshDns} />
        <NetworkInfoPanel info={systemInfo} meta={publicMeta} />
      </div>

      <div className="section-spacer" />

      <HistoryCharts speedTests={speedTests} pingLogs={pingLogs} range={range} onRangeChange={setRange} />

      <div className="section-spacer" />

      <div className="grid grid-2">
        <TracerouteView />
        <OutageLog outages={outages} />
      </div>

      <div className="footer-note">
        NetPulse runs entirely on your machine. Download/upload speed uses NDT7, the open measurement protocol from
        Measurement Lab (M-Lab) — the same infrastructure behind Google's built-in speed test. M-Lab publishes test
        results as open data for network research; see measurementlab.net/data-policy for details. Latency, DNS, and
        route diagnostics run locally against your OS network stack.
      </div>

      {settingsOpen && (
        <SettingsModal
          initialInterval={settings.monitorIntervalMinutes}
          initialExpectedDown={settings.expectedDownloadMbps}
          initialExpectedUp={settings.expectedUploadMbps}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
