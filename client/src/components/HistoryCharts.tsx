import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { SpeedTestResult, PingSummary } from "../types";

interface HistoryChartsProps {
  speedTests: SpeedTestResult[];
  pingLogs: PingSummary[];
  range: "24h" | "7d" | "30d";
  onRangeChange: (range: "24h" | "7d" | "30d") => void;
}

function formatTime(ts: number, range: string) {
  const d = new Date(ts);
  if (range === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 12 }}>
      <div style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed(1)} {unit}
        </div>
      ))}
    </div>
  );
}

export function HistoryCharts({ speedTests, pingLogs, range, onRangeChange }: HistoryChartsProps) {
  const speedData = speedTests.map((t) => ({
    time: formatTime(t.timestamp, range),
    download: t.downloadMbps,
    upload: t.uploadMbps,
  }));

  const latencyByTarget = new Map<string, PingSummary[]>();
  for (const log of pingLogs) {
    if (!latencyByTarget.has(log.label)) latencyByTarget.set(log.label, []);
    latencyByTarget.get(log.label)!.push(log);
  }
  const primaryTarget = [...latencyByTarget.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const latencyData = (primaryTarget?.[1] ?? []).map((l) => ({
    time: formatTime(l.timestamp, range),
    latency: l.avgMs,
  }));

  return (
    <div className="card">
      <h3 className="card-title">
        History
        <div className="toggle-group">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button key={r} className={`toggle-btn ${range === r ? "active" : ""}`} onClick={() => onRangeChange(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </h3>

      <div style={{ marginBottom: 8, fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>SPEED (MBPS)</div>
      {speedData.length === 0 ? (
        <div className="empty-state">No speed tests in this range yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={speedData}>
            <defs>
              <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-cool)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-cool)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid-line)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<CustomTooltip unit="Mbps" />} />
            <Area type="monotone" dataKey="download" name="Download" stroke="var(--accent)" fill="url(#downGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="upload" name="Upload" stroke="var(--accent-cool)" fill="url(#upGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      <div style={{ margin: "20px 0 8px", fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
        LATENCY - {primaryTarget?.[0]?.toUpperCase() ?? "N/A"} (MS)
      </div>
      {latencyData.length === 0 ? (
        <div className="empty-state">No monitoring data in this range yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={latencyData}>
            <defs>
              <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--grid-line)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip content={<CustomTooltip unit="ms" />} />
            <Area type="monotone" dataKey="latency" name="Latency" stroke="var(--accent)" fill="url(#latGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
