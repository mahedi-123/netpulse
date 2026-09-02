import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertTriangle, Settings } from "lucide-react";
import { Card, GradeBadge, Insights, statusClass } from "./Shared";
import { PcSetup } from "./PcSetup";
import {
  api,
  needsPcAddress,
  getPcAddress,
  setPcAddress,
  PcAddressMissingError,
  type SystemInfo,
  type PingSummary,
  type SpeedTestResult,
  type OutageRecord,
} from "../api";

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function formatDuration(sec: number | null): string {
  if (sec === null) return "ongoing";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

export function PcMode() {
  // null = still unknown, false = configured but unreachable
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [unconfigured, setUnconfigured] = useState(() => needsPcAddress());
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [pings, setPings] = useState<PingSummary[]>([]);
  const [latest, setLatest] = useState<SpeedTestResult | null>(null);
  const [outages, setOutages] = useState<OutageRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (needsPcAddress()) {
      setUnconfigured(true);
      return;
    }
    setUnconfigured(false);
    setLoading(true);
    try {
      await api.health();
      setReachable(true);
      // Fetched together; a slow ping sweep shouldn't hold back the rest.
      const [sys, latestTest, outageList] = await Promise.allSettled([api.systemInfo(), api.latestSpeedTest(), api.outages()]);
      if (sys.status === "fulfilled") setSystem(sys.value);
      if (latestTest.status === "fulfilled") setLatest(latestTest.value);
      if (outageList.status === "fulfilled") setOutages(outageList.value.outages);

      api
        .pingQuick()
        .then((r) => setPings(r.results))
        .catch(() => {});
    } catch (err) {
      if (err instanceof PcAddressMissingError) setUnconfigured(true);
      else setReachable(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (unconfigured) return;
    // Light polling keeps the view current without hammering the PC.
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load, unconfigured]);

  if (unconfigured) {
    return (
      <PcSetup
        onConnected={() => {
          setUnconfigured(false);
          setReachable(null);
          load();
        }}
      />
    );
  }

  if (reachable === false) {
    return (
      <Card title="My PC">
        <div className="empty">
          <AlertTriangle size={22} style={{ color: "var(--status-warn)", marginBottom: 10 }} />
          <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>Can't reach NetPulse on your PC.</div>
          <div>
            The PC needs to be on, running <code>npm start</code>, and on the same Wi-Fi network as this phone.
          </div>
        </div>
        <button className="btn btn-full" style={{ marginTop: 12 }} onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Try again
        </button>
        {getPcAddress() && (
          <>
            <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 12 }}>
              {getPcAddress()}
            </div>
            <button
              className="btn btn-full"
              style={{ marginTop: 8 }}
              onClick={() => {
                setPcAddress("");
                setUnconfigured(true);
              }}
            >
              <Settings size={14} />
              Change address
            </button>
          </>
        )}
      </Card>
    );
  }

  if (reachable === null) {
    return (
      <Card title="My PC">
        <div className="empty">Connecting to your PC…</div>
      </Card>
    );
  }

  const ethernet = system?.adapters?.[0];

  return (
    <>
      {latest && (
        <Card title="PC Health Score">
          <div className="grade-row">
            <GradeBadge grade={latest.healthGrade} />
            <div>
              <div className="score-text">
                <strong>{latest.healthScore}</strong> / 100
              </div>
              <div className="score-text" style={{ marginTop: 4 }}>
                Bufferbloat: <strong>{latest.bufferbloatGrade}</strong>
              </div>
              <div className="score-text" style={{ marginTop: 4, color: "var(--text-tertiary)" }}>
                {relTime(latest.timestamp)}
              </div>
            </div>
          </div>
          <Insights items={latest.insights} />
        </Card>
      )}

      {latest && (
        <Card title="Last Speed Test">
          <div className="metric-row">
            <span className="metric-label">Download</span>
            <span className="metric-value" style={{ color: "var(--accent)" }}>
              {latest.downloadMbps !== null ? `${latest.downloadMbps.toFixed(1)} Mbps` : "—"}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Upload</span>
            <span className="metric-value" style={{ color: "var(--accent-cool)" }}>
              {latest.uploadMbps !== null ? `${latest.uploadMbps.toFixed(1)} Mbps` : "—"}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Latency (ICMP)</span>
            <span className={`metric-value ${statusClass(latest.idleLatencyMs, 50, 100)}`}>
              {latest.idleLatencyMs !== null ? `${latest.idleLatencyMs.toFixed(0)}ms` : "—"}
            </span>
          </div>
          <div className="notice">Speed tests are started from the PC dashboard. This is a live view of the most recent result.</div>
        </Card>
      )}

      <Card
        title="Live Latency"
        action={
          <button className="btn" style={{ minHeight: 30, padding: "4px 10px", fontSize: 12 }} onClick={load} disabled={loading}>
            <RefreshCw size={12} className={loading ? "spin" : ""} />
          </button>
        }
      >
        {pings.length === 0 ? (
          <div className="empty">Measuring…</div>
        ) : (
          pings.map((p) => (
            <div className="metric-row" key={p.target}>
              <span className="metric-label">{p.label}</span>
              <span>
                <span className={`metric-value ${statusClass(p.avgMs, 50, 100)}`}>
                  {p.avgMs !== null ? `${p.avgMs.toFixed(0)}ms` : "—"}
                </span>
                {p.lossPct > 0 && (
                  <span className="metric-value bad" style={{ marginLeft: 8, fontSize: 11.5 }}>
                    {p.lossPct.toFixed(0)}% loss
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </Card>

      <Card title="PC Network">
        {ethernet && (
          <div className="info-row">
            <span className="info-label">{ethernet.name}</span>
            <span className="info-value">{ethernet.linkSpeed ?? "unknown"}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Hostname</span>
          <span className="info-value">{system?.hostname ?? "—"}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Local IP</span>
          <span className="info-value">{system?.interfaces?.[0]?.address ?? "—"}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Gateway</span>
          <span className="info-value">{system?.gateway ?? "—"}</span>
        </div>
      </Card>

      <Card title="Outage Log">
        {outages.length === 0 ? (
          <div className="empty">No outages recorded.</div>
        ) : (
          outages.slice(0, 6).map((o) => (
            <div className="metric-row" key={o.id}>
              <span className="metric-label">
                {new Date(o.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className={`badge ${o.endTime ? "warn" : "bad"}`}>{formatDuration(o.durationSec)}</span>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
