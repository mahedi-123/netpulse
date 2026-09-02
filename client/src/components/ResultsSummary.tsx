import type { SpeedTestResult } from "../types";

interface ResultsSummaryProps {
  result: SpeedTestResult | null;
}

function gradeClass(grade: string) {
  return `grade-${grade === "N/A" ? "NA" : grade}`;
}

export function ResultsSummary({ result }: ResultsSummaryProps) {
  if (!result) {
    return (
      <div className="card">
        <h3 className="card-title">Health Score</h3>
        <div className="empty-state">Run a diagnostic to see your connection's health score and insights.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title">Health Score</h3>
      <div className="grade-hero">
        <div className={`grade-letter ${gradeClass(result.healthGrade)}`}>{result.healthGrade}</div>
        <div>
          <div className="score-number">
            <strong>{result.healthScore}</strong> / 100
          </div>
          <div className="score-number" style={{ marginTop: 4 }}>
            Bufferbloat: <strong>{result.bufferbloatGrade}</strong>
          </div>
        </div>
      </div>

      {result.breakdown && result.breakdown.length > 0 && (
        <div style={{ marginTop: 20 }}>
          {result.breakdown.map((b) => {
            const pct = b.maxPoints > 0 ? (b.pointsLost / b.maxPoints) * 100 : 0;
            const color = pct === 0 ? "var(--status-good)" : pct < 50 ? "var(--status-warn)" : "var(--status-bad)";
            return (
              <div className="breakdown-row" key={b.label}>
                <div className="breakdown-labels">
                  <span>{b.label}</span>
                  <span>
                    -{b.pointsLost} / {b.maxPoints}
                  </span>
                </div>
                <div className="breakdown-bar-track">
                  <div className="breakdown-bar-fill" style={{ width: `${100 - pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ul className="insights-list">
        {result.insights.map((insight, i) => (
          <li key={i}>{insight}</li>
        ))}
      </ul>
    </div>
  );
}
