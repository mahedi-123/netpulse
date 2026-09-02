import type { ReactNode } from "react";

export interface BreakdownItem {
  label: string;
  pointsLost: number;
  maxPoints: number;
}

export function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <h3 className="card-title">
        {title}
        {action}
      </h3>
      {children}
    </div>
  );
}

export function GradeBadge({ grade, size = 64 }: { grade: string; size?: number }) {
  const cls = grade === "N/A" ? "grade-NA" : `grade-${grade}`;
  return (
    <div className={`grade-badge ${cls}`} style={{ width: size, height: size, fontSize: grade === "N/A" ? 17 : size * 0.62 }}>
      {grade}
    </div>
  );
}

export function ScoreBreakdown({ items }: { items: BreakdownItem[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      {items.map((b) => {
        const pct = b.maxPoints > 0 ? (b.pointsLost / b.maxPoints) * 100 : 0;
        const color = pct === 0 ? "var(--status-good)" : pct < 50 ? "var(--status-warn)" : "var(--status-bad)";
        return (
          <div className="bd-row" key={b.label}>
            <div className="bd-labels">
              <span>{b.label}</span>
              <span>
                -{b.pointsLost} / {b.maxPoints}
              </span>
            </div>
            <div className="bd-track">
              <div className="bd-fill" style={{ width: `${100 - pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Insights({ items }: { items: string[] }) {
  return (
    <ul className="insights">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

export function statusClass(value: number | null, warnAt: number, badAt: number): string {
  if (value === null) return "";
  if (value >= badAt) return "bad";
  if (value >= warnAt) return "warn";
  return "good";
}
