import type { OutageRecord } from "../types";

interface OutageLogProps {
  outages: OutageRecord[];
}

function formatDuration(sec: number | null) {
  if (sec === null) return "ongoing";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
}

export function OutageLog({ outages }: OutageLogProps) {
  return (
    <div className="card">
      <h3 className="card-title">Outage Log</h3>
      {outages.length === 0 ? (
        <div className="empty-state">No outages detected - the background monitor checks every few minutes.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Duration</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {outages.map((o) => (
              <tr key={o.id}>
                <td>{new Date(o.startTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td>
                  <span className={`badge ${o.endTime ? "warn" : "bad"}`}>{formatDuration(o.durationSec)}</span>
                </td>
                <td>{o.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
