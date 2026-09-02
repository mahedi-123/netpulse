import { PulseTrace } from "./PulseTrace";
import type { TestPhase } from "../types";

interface SpeedTestPanelProps {
  phase: TestPhase;
  downloadMbps: number;
  uploadMbps: number;
  pingTrace: number[];
  lastTestedLabel: string | null;
  error?: string | null;
  onRun: () => void;
}

const PHASE_LABELS: Record<TestPhase, string> = {
  idle: "",
  baseline: "Measuring baseline latency…",
  download: "Testing download…",
  upload: "Testing upload…",
  saving: "Scoring results…",
  done: "",
};

export function SpeedTestPanel({ phase, downloadMbps, uploadMbps, pingTrace, lastTestedLabel, error, onRun }: SpeedTestPanelProps) {
  const isRunning = phase !== "idle" && phase !== "done";

  return (
    <div className="hero-card">
      <div className="phase-label">{PHASE_LABELS[phase]}</div>

      <div className="speed-readouts">
        <div className="speed-readout download">
          <div className="speed-value">
            {downloadMbps > 0 || phase === "download" || phase === "done" ? downloadMbps.toFixed(downloadMbps >= 100 ? 0 : 1) : "—"}
            <span className="speed-unit">Mbps</span>
          </div>
          <div className="speed-label">Download</div>
        </div>
        <div className="speed-readout upload">
          <div className="speed-value">
            {uploadMbps > 0 || phase === "upload" || phase === "done" ? uploadMbps.toFixed(uploadMbps >= 100 ? 0 : 1) : "—"}
            <span className="speed-unit">Mbps</span>
          </div>
          <div className="speed-label">Upload</div>
        </div>
      </div>

      <div className="trace-container">
        <PulseTrace values={pingTrace} height={70} color={phase === "upload" ? "var(--accent-cool)" : "var(--accent)"} />
      </div>

      <div style={{ marginTop: 26 }}>
        <button className={`run-button ${isRunning ? "running" : ""}`} onClick={onRun} disabled={isRunning}>
          {isRunning ? "Running Diagnostic…" : "Run Diagnostic"}
        </button>
      </div>

      {error && (
        <div className="test-error-banner">
          <strong>Test failed:</strong> {error}
        </div>
      )}

      <div className="hero-meta">{lastTestedLabel ?? "No tests run yet"} · ~25s · download, upload, latency, jitter, bufferbloat</div>
    </div>
  );
}
