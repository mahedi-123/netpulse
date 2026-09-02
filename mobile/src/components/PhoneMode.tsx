import { useEffect, useState, useRef } from "react";
import { Wifi, Signal, RefreshCw } from "lucide-react";
import { PulseTrace } from "./PulseTrace";
import { Card, GradeBadge, ScoreBreakdown, Insights, statusClass } from "./Shared";
import { NativeWifiCard } from "./NativeWifiCard";
import { measureDownload, measureUpload, resetSpeedTestServer, getLastTestServerLabel } from "../speedTest";
import {
  measureIdleRtt,
  startLoadedRttProbe,
  getConnectionInfo,
  onConnectionChange,
  type ConnectionInfo,
  type RttStats,
} from "../phoneDiagnostics";
import { computePhoneHealthScore, type PhoneScoreResult } from "../healthScore";

type Phase = "idle" | "baseline" | "download" | "upload" | "scoring" | "done";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "",
  baseline: "Measuring baseline…",
  download: "Testing download…",
  upload: "Testing upload…",
  scoring: "Scoring results…",
  done: "",
};

function connLabel(info: ConnectionInfo): string {
  if (!info.online) return "Offline";
  if (info.type === "wifi") return "Wi-Fi";
  if (info.type === "cellular") return info.effectiveType ? `Cellular · ${info.effectiveType.toUpperCase()}` : "Cellular";
  if (info.type === "ethernet") return "Ethernet";
  if (info.effectiveType) return info.effectiveType.toUpperCase();
  return "Connected";
}

export function PhoneMode() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [downMbps, setDownMbps] = useState(0);
  const [upMbps, setUpMbps] = useState(0);
  const [trace, setTrace] = useState<number[]>([]);
  const [idleStats, setIdleStats] = useState<RttStats | null>(null);
  const [loadedRtt, setLoadedRtt] = useState<number | null>(null);
  const [result, setResult] = useState<PhoneScoreResult | null>(null);
  const [serverLabel, setServerLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnectionInfo>(() => getConnectionInfo());
  const [lastRun, setLastRun] = useState<number | null>(null);

  const running = phase !== "idle" && phase !== "done";
  const traceRef = useRef<number[]>([]);

  useEffect(() => onConnectionChange(() => setConn(getConnectionInfo())), []);

  const pushTrace = (ms: number) => {
    traceRef.current = [...traceRef.current.slice(-43), ms];
    setTrace(traceRef.current);
  };

  async function run() {
    setError(null);
    setResult(null);
    setDownMbps(0);
    setUpMbps(0);
    setLoadedRtt(null);
    traceRef.current = [];
    setTrace([]);
    resetSpeedTestServer();

    try {
      // 1. Idle baseline
      setPhase("baseline");
      const idle = await measureIdleRtt(8, pushTrace);
      setIdleStats(idle);

      // 2. Download, with a concurrent RTT probe to expose bufferbloat.
      // The probe is stopped in `finally` so a failed transfer can't leave it
      // looping in the background.
      setPhase("download");
      const downProbe = startLoadedRttProbe(pushTrace);
      let downLoaded: RttStats;
      let downResult = 0;
      try {
        downResult = await measureDownload({ onProgress: setDownMbps });
      } finally {
        downLoaded = downProbe.stop();
      }
      setDownMbps(downResult);

      // 3. Upload, same treatment
      setPhase("upload");
      const upProbe = startLoadedRttProbe(pushTrace);
      let upLoaded: RttStats;
      let upResult = 0;
      try {
        upResult = await measureUpload({ onProgress: setUpMbps });
      } finally {
        upLoaded = upProbe.stop();
      }
      setUpMbps(upResult);

      // 4. Score
      setPhase("scoring");
      const loadedSamples = [downLoaded.avgMs, upLoaded.avgMs].filter((v): v is number => v !== null);
      const loadedAvg = loadedSamples.length ? loadedSamples.reduce((a, b) => a + b, 0) / loadedSamples.length : null;
      setLoadedRtt(loadedAvg);

      const totalProbes =
        idle.samples.length +
        idle.failures +
        downLoaded.samples.length +
        downLoaded.failures +
        upLoaded.samples.length +
        upLoaded.failures;
      const totalFailures = idle.failures + downLoaded.failures + upLoaded.failures;

      const info = getConnectionInfo();
      setConn(info);

      setResult(
        computePhoneHealthScore({
          idleRttMs: idle.avgMs,
          jitterMs: idle.jitterMs,
          loadedRttMs: loadedAvg,
          downloadMbps: downResult,
          uploadMbps: upResult,
          probeFailures: totalFailures,
          probeTotal: totalProbes,
          connectionType: info.type,
          effectiveType: info.effectiveType,
        })
      );
      setServerLabel(getLastTestServerLabel());
      setLastRun(Date.now());
      setPhase("done");
    } catch (err) {
      console.error("Phone diagnostic failed:", err);
      setError(err instanceof Error ? err.message : "The test couldn't complete — check the browser console.");
      setPhase("idle");
    }
  }

  return (
    <>
      <div className="hero">
        <div className="phase">{PHASE_TEXT[phase]}</div>

        <div className="readouts">
          <div className="readout down">
            <div className="readout-value">
              {downMbps > 0 || phase === "download" ? downMbps.toFixed(downMbps >= 100 ? 0 : 1) : "—"}
              <span className="readout-unit">Mbps</span>
            </div>
            <div className="readout-label">Download</div>
          </div>
          <div className="readout up">
            <div className="readout-value">
              {upMbps > 0 || phase === "upload" ? upMbps.toFixed(upMbps >= 100 ? 0 : 1) : "—"}
              <span className="readout-unit">Mbps</span>
            </div>
            <div className="readout-label">Upload</div>
          </div>
        </div>

        <div className="trace-box">
          <PulseTrace values={trace} color={phase === "upload" ? "var(--accent-cool)" : "var(--accent)"} />
        </div>

        <button className="run-btn" onClick={run} disabled={running}>
          {running ? "Testing…" : "Test This Phone"}
        </button>

        {error && (
          <div className="error-banner">
            <strong>Test failed:</strong> {error}
          </div>
        )}

        <div className="hero-meta">
          {lastRun ? `Last run ${new Date(lastRun).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No test run yet"}
          {" · ~30s"}
          {serverLabel ? ` · via ${serverLabel}` : ""}
        </div>
      </div>

      {result && (
        <Card title="Health Score">
          <div className="grade-row">
            <GradeBadge grade={result.grade} />
            <div>
              <div className="score-text">
                <strong>{result.score}</strong> / 100
              </div>
              <div className="score-text" style={{ marginTop: 4 }}>
                Bufferbloat: <strong>{result.bufferbloatGrade}</strong>
              </div>
            </div>
          </div>
          <ScoreBreakdown items={result.breakdown} />
          <Insights items={result.insights} />
        </Card>
      )}

      <Card
        title="Latency"
        action={
          <button
            className="btn"
            style={{ minHeight: 30, padding: "4px 10px", fontSize: 12 }}
            disabled={running}
            onClick={async () => {
              traceRef.current = [];
              setTrace([]);
              setIdleStats(await measureIdleRtt(8, pushTrace));
            }}
          >
            <RefreshCw size={12} className={running ? "spin" : ""} />
          </button>
        }
      >
        {!idleStats ? (
          <div className="empty">Run a test to measure latency and jitter.</div>
        ) : (
          <>
            <div className="metric-row">
              <span className="metric-label">
                Round-trip (idle)
                <div className="metric-sub">HTTP, not ICMP ping</div>
              </span>
              <span className={`metric-value ${statusClass(idleStats.avgMs, 90, 200)}`}>
                {idleStats.avgMs !== null ? `${idleStats.avgMs.toFixed(0)}ms` : "—"}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Jitter</span>
              <span className={`metric-value ${statusClass(idleStats.jitterMs, 25, 50)}`}>
                {idleStats.jitterMs !== null ? `${idleStats.jitterMs.toFixed(0)}ms` : "—"}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Best / worst</span>
              <span className="metric-value">
                {idleStats.minMs !== null ? `${idleStats.minMs.toFixed(0)} / ${idleStats.maxMs?.toFixed(0)}ms` : "—"}
              </span>
            </div>
            {loadedRtt !== null && (
              <div className="metric-row">
                <span className="metric-label">
                  Under load
                  <div className="metric-sub">during download &amp; upload</div>
                </span>
                <span className={`metric-value ${statusClass(loadedRtt, 150, 300)}`}>{loadedRtt.toFixed(0)}ms</span>
              </div>
            )}
            <div className="notice">
              Phones can't send ICMP pings from a browser, so this measures full HTTP round-trip time instead. It reads higher
              than the ping figures on the PC dashboard — compare it against itself over time, not against those.
            </div>
          </>
        )}
      </Card>

      <NativeWifiCard />

      <Card title="Connection">
        <div className="metric-row">
          <span className="metric-label">Status</span>
          <span className="metric-value">
            <span className={`dot ${conn.online ? "good" : "bad"}`} style={{ display: "inline-block", marginRight: 7 }} />
            {connLabel(conn)}
          </span>
        </div>
        {conn.supported ? (
          <>
            {conn.downlinkMbps !== null && (
              <div className="metric-row">
                <span className="metric-label">
                  Browser estimate
                  <div className="metric-sub">rough, not a measurement</div>
                </span>
                <span className="metric-value">{conn.downlinkMbps} Mbps</span>
              </div>
            )}
            {conn.rttMs !== null && (
              <div className="metric-row">
                <span className="metric-label">Browser RTT estimate</span>
                <span className="metric-value">{conn.rttMs}ms</span>
              </div>
            )}
            {conn.saveData && (
              <div className="metric-row">
                <span className="metric-label">Data Saver</span>
                <span className="metric-value warn">On — may cap speeds</span>
              </div>
            )}
          </>
        ) : (
          <div className="notice">
            This browser doesn't expose the Network Information API, so connection type and carrier estimates aren't
            available. The speed and latency tests above still work normally.
          </div>
        )}
      </Card>
    </>
  );
}
