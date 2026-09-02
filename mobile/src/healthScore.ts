// Health scoring for the PHONE's own connection.
//
// This is deliberately a separate scoring model from the desktop app's, not a
// copy, because the inputs mean different things:
//
//  - Latency here is HTTP round-trip, not ICMP, so it sits higher by default.
//    The thresholds are shifted accordingly; reusing the PC's would unfairly
//    mark a perfectly good WiFi link as mediocre.
//  - There's no packet-loss category. A browser can't observe packet loss
//    directly, and inventing a proxy for it would be guesswork dressed up as
//    a measurement. Failed probes are surfaced as an insight instead.
//  - Speed expectations are contextual: 40 Mbps is poor for home fibre but
//    fine on cellular, so the speed category only scores when we know the
//    connection type well enough for the comparison to mean something.

export interface PhoneScoreInput {
  idleRttMs: number | null;
  jitterMs: number | null;
  loadedRttMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  probeFailures: number;
  probeTotal: number;
  connectionType: string | null;
  effectiveType: string | null;
}

export interface ScoreBreakdownItem {
  label: string;
  pointsLost: number;
  maxPoints: number;
}

export interface PhoneScoreResult {
  score: number;
  grade: string;
  bufferbloatGrade: string;
  bufferbloatIncreaseMs: number | null;
  insights: string[];
  breakdown: ScoreBreakdownItem[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const BUFFERBLOAT_THRESHOLDS = { A: 20, B: 60, C: 120, D: 300 };

export function computeBufferbloatGrade(increaseMs: number | null): string {
  if (increaseMs === null) return "N/A";
  if (increaseMs < BUFFERBLOAT_THRESHOLDS.A) return "A";
  if (increaseMs < BUFFERBLOAT_THRESHOLDS.B) return "B";
  if (increaseMs < BUFFERBLOAT_THRESHOLDS.C) return "C";
  if (increaseMs < BUFFERBLOAT_THRESHOLDS.D) return "D";
  return "F";
}

const isCellular = (type: string | null) => type === "cellular";

export function computePhoneHealthScore(input: PhoneScoreInput): PhoneScoreResult {
  const insights: string[] = [];
  const breakdown: ScoreBreakdownItem[] = [];

  // --- Latency: 30 pts. Baseline allowance is higher than the PC's because
  // this is HTTP RTT, and higher again on cellular where ~50-80ms is normal. ---
  let latencyLoss = 0;
  const latencyFloor = isCellular(input.connectionType) ? 80 : 40;
  if (input.idleRttMs !== null) {
    latencyLoss = clamp((input.idleRttMs - latencyFloor) / 6, 0, 30);
    if (input.idleRttMs > latencyFloor + 120) {
      insights.push(
        `Round-trip time is high (${input.idleRttMs.toFixed(0)} ms). On WiFi, moving closer to the router or switching to the 5 GHz band usually helps; on cellular this is often just signal strength or tower load.`
      );
    }
  }
  breakdown.push({ label: "Latency", pointsLost: Math.round(latencyLoss), maxPoints: 30 });

  // --- Jitter: 25 pts. Variance is meaningful even though the absolute
  // latency floor is inflated, so this is weighted heavily. ---
  let jitterLoss = 0;
  if (input.jitterMs !== null) {
    jitterLoss = clamp((input.jitterMs - 10) / 2, 0, 25);
    if (input.jitterMs > 40) {
      insights.push(
        `Timing is inconsistent (${input.jitterMs.toFixed(0)} ms jitter). This is the usual cause of calls breaking up even when speed looks fine — common with a weak WiFi signal or a congested channel.`
      );
    }
  }
  breakdown.push({ label: "Jitter", pointsLost: Math.round(jitterLoss), maxPoints: 25 });

  // --- Bufferbloat: 25 pts ---
  const bufferbloatIncreaseMs =
    input.loadedRttMs !== null && input.idleRttMs !== null ? Math.max(0, input.loadedRttMs - input.idleRttMs) : null;
  const bbGrade = computeBufferbloatGrade(bufferbloatIncreaseMs);
  const bbPenalty: Record<string, number> = { A: 0, B: 5, C: 12, D: 20, F: 25, "N/A": 0 };
  const bbLoss = bbPenalty[bbGrade] ?? 0;
  if (bbGrade === "D" || bbGrade === "F") {
    insights.push(
      `Latency climbs sharply under load (+${bufferbloatIncreaseMs?.toFixed(0)} ms). Downloads or uploads will make everything else on this connection feel sluggish. If you're on home WiFi, enabling Smart Queue Management (SQM) on the router fixes this.`
    );
  }
  breakdown.push({ label: "Bufferbloat", pointsLost: bbLoss, maxPoints: 25 });

  // --- Stability: 20 pts. Probe failures aren't packet loss, but repeated
  // failures do indicate a genuinely unreliable link. ---
  let stabilityLoss = 0;
  if (input.probeTotal > 0 && input.probeFailures > 0) {
    const failRate = input.probeFailures / input.probeTotal;
    stabilityLoss = clamp(failRate * 60, 0, 20);
    insights.push(
      `${input.probeFailures} of ${input.probeTotal} test requests didn't complete. That points to an unstable connection rather than just a slow one.`
    );
  }
  breakdown.push({ label: "Stability", pointsLost: Math.round(stabilityLoss), maxPoints: 20 });

  // Sum the ROUNDED per-category losses (the same numbers shown in the
  // breakdown bars) rather than the raw floats, so the bars always add up
  // exactly to the score. Summing raw values leaves the UI showing e.g.
  // four deductions totalling 12 next to a score of 89.
  const totalLoss = breakdown.reduce((sum, item) => sum + item.pointsLost, 0);
  const score = clamp(100 - totalLoss, 0, 100);

  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 65) grade = "C";
  else if (score >= 50) grade = "D";

  // Speed commentary is informational only - it never affects the score, since
  // "good" depends entirely on the plan and connection type.
  if (input.downloadMbps !== null && input.downloadMbps < 5) {
    insights.push(
      `Download is ${input.downloadMbps.toFixed(1)} Mbps — enough for browsing, but HD video will likely buffer.`
    );
  }
  if (input.effectiveType && input.effectiveType !== "4g" && !isCellular(input.connectionType)) {
    insights.push(`The browser reports this connection as "${input.effectiveType}" class, which suggests a constrained link.`);
  }

  if (insights.length === 0) {
    insights.push("No significant issues found — latency, jitter, and behaviour under load all look healthy.");
  }

  return { score, grade, bufferbloatGrade: bbGrade, bufferbloatIncreaseMs, insights, breakdown };
}
