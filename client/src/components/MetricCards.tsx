import { useState } from "react";
import { RefreshCw } from "lucide-react";
import type { PingSummary, DnsResolverSummary } from "../types";

function statusClass(value: number | null, warnAt: number, badAt: number, lowerIsBetter = true) {
  if (value === null) return "";
  const bad = lowerIsBetter ? value >= badAt : value <= badAt;
  const warn = lowerIsBetter ? value >= warnAt : value <= warnAt;
  if (bad) return "bad";
  if (warn) return "warn";
  return "good";
}

interface LatencyCardProps {
  results: PingSummary[];
  loading: boolean;
  onRefresh: () => void;
}

export function LatencyCard({ results, loading, onRefresh }: LatencyCardProps) {
  return (
    <div className="card">
      <h3 className="card-title">
        Latency &amp; Jitter
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onRefresh} title="Re-check">
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </h3>
      {results.length === 0 ? (
        <div className="empty-state">No ping data yet</div>
      ) : (
        results.map((r) => (
          <div className="metric-row" key={r.target}>
            <span className="metric-label">{r.label}</span>
            <span>
              <span className={`metric-value ${statusClass(r.avgMs, 50, 100)}`}>{r.avgMs !== null ? `${r.avgMs.toFixed(0)}ms` : "—"}</span>
              {r.lossPct > 0 && (
                <span className="metric-value bad" style={{ marginLeft: 8, fontSize: 12 }}>
                  {r.lossPct.toFixed(0)}% loss
                </span>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

interface DnsCardProps {
  summary: DnsResolverSummary[];
  loading: boolean;
  onRefresh: () => void;
}

export function DnsCard({ summary, loading, onRefresh }: DnsCardProps) {
  return (
    <div className="card">
      <h3 className="card-title">
        DNS Resolver Health
        <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={onRefresh} title="Re-check">
          <RefreshCw size={13} className={loading ? "spin" : ""} />
        </button>
      </h3>
      {summary.length === 0 ? (
        <div className="empty-state">No DNS data yet</div>
      ) : (
        summary.map((r) => (
          <div className="metric-row" key={r.resolver}>
            <span className="metric-label">{r.resolver}</span>
            <span className={`metric-value ${statusClass(r.avgMs, 40, 100)}`}>{r.avgMs !== null ? `${r.avgMs.toFixed(0)}ms` : "timeout"}</span>
          </div>
        ))
      )}
    </div>
  );
}

interface BufferbloatCardProps {
  grade: string | null;
  increaseMs: number | null;
  idleMs: number | null;
  loadedDownMs: number | null;
  loadedUpMs: number | null;
}

const GRADE_COPY: Record<string, string> = {
  A: "Excellent - the connection barely reacts to load.",
  B: "Good - a small delay increase under load, unlikely to be noticeable.",
  C: "Fair - noticeable delay increase during heavy transfers.",
  D: "Poor - calls and browsing will likely lag during large transfers.",
  F: "Severe - the connection queues heavily under load.",
  "N/A": "Run a diagnostic to measure bufferbloat.",
};

export function BufferbloatCard({ grade, increaseMs, idleMs, loadedDownMs, loadedUpMs }: BufferbloatCardProps) {
  const g = grade ?? "N/A";
  return (
    <div className="card">
      <h3 className="card-title">Bufferbloat</h3>
      <div className="grade-hero">
        <div className={`grade-letter grade-${g === "N/A" ? "NA" : g}`} style={{ width: 64, height: 64, fontSize: 32 }}>
          {g}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{GRADE_COPY[g]}</div>
      </div>
      {increaseMs !== null && (
        <div style={{ marginTop: 16 }}>
          <div className="metric-row">
            <span className="metric-label">Idle latency</span>
            <span className="metric-value">{idleMs?.toFixed(0)}ms</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Loaded (download)</span>
            <span className="metric-value">{loadedDownMs !== null ? `${loadedDownMs.toFixed(0)}ms` : "—"}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Loaded (upload)</span>
            <span className="metric-value">{loadedUpMs !== null ? `${loadedUpMs.toFixed(0)}ms` : "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}
