import { useState } from "react";
import { Route } from "lucide-react";
import { api } from "../api";
import type { TracerouteHop } from "../types";

export function TracerouteView() {
  const [target, setTarget] = useState("1.1.1.1");
  const [hops, setHops] = useState<TracerouteHop[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  async function run() {
    setLoading(true);
    setRan(true);
    try {
      const res = await api.traceroute(target);
      setHops(res.hops);
    } catch {
      setHops([]);
    } finally {
      setLoading(false);
    }
  }

  const maxRtt = Math.max(...hops.map((h) => h.rttMs ?? 0), 1);

  return (
    <div className="card">
      <h3 className="card-title">Route Trace</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="form-input" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1.1.1.1" style={{ flex: 1 }} />
        <button className="btn" onClick={run} disabled={loading}>
          <Route size={14} />
          {loading ? "Tracing…" : "Trace"}
        </button>
      </div>

      {!ran && <div className="empty-state">Trace the route to see per-hop latency along the path.</div>}
      {ran && !loading && hops.length === 0 && <div className="empty-state">No hops returned - the target may be blocking traceroute probes.</div>}

      {hops.map((h) => (
        <div key={h.hop} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5 }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", width: 20 }}>{h.hop}</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", width: 120, flexShrink: 0 }}>{h.address ?? "* * *"}</span>
          <div style={{ flex: 1, height: 4, background: "var(--surface-raised)", borderRadius: 2, overflow: "hidden" }}>
            {h.rttMs !== null && (
              <div style={{ width: `${Math.min(100, (h.rttMs / maxRtt) * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
            )}
          </div>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", width: 56, textAlign: "right" }}>
            {h.rttMs !== null ? `${h.rttMs.toFixed(0)}ms` : "timeout"}
          </span>
        </div>
      ))}
    </div>
  );
}
