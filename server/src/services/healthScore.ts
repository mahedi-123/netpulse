import { CONFIG } from "../config.js";
import type { ScoreBreakdownItem } from "../types.js";

export interface ScoreInput {
  idleLatencyMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  bufferbloatIncreaseMs: number | null;
  downloadMbps: number | null;
  expectedDownloadMbps?: number | null;
}

export interface ScoreResult {
  score: number;
  grade: string;
  bufferbloatGrade: string;
  insights: string[];
  breakdown: ScoreBreakdownItem[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function computeBufferbloatGrade(increaseMs: number | null): string {
  if (increaseMs === null) return "N/A";
  const t = CONFIG.BUFFERBLOAT_THRESHOLDS_MS;
  if (increaseMs < t.A) return "A";
  if (increaseMs < t.B) return "B";
  if (increaseMs < t.C) return "C";
  if (increaseMs < t.D) return "D";
  return "F";
}

export function computeHealthScore(input: ScoreInput): ScoreResult {
  const insights: string[] = [];
  const breakdown: ScoreBreakdownItem[] = [];

  // --- Latency: 25 pts ---
  let latencyLoss = 0;
  if (input.idleLatencyMs !== null) {
    latencyLoss = clamp((input.idleLatencyMs - 20) / 4, 0, 25);
    if (input.idleLatencyMs > 100) {
      insights.push(
        `High baseline latency (${input.idleLatencyMs.toFixed(0)} ms) will make browsing, gaming, and calls feel less responsive. On a wired connection this is usually about distance/routing to your ISP rather than your local setup.`
      );
    } else if (input.idleLatencyMs > 50) {
      insights.push(
        `Latency is moderate (${input.idleLatencyMs.toFixed(0)} ms) - fine for browsing and streaming, but competitive gaming or video calls may feel slightly delayed.`
      );
    }
  }
  breakdown.push({ label: "Latency", pointsLost: Math.round(latencyLoss), maxPoints: 25 });

  // --- Jitter: 20 pts ---
  let jitterLoss = 0;
  if (input.jitterMs !== null) {
    jitterLoss = clamp((input.jitterMs - 5) / 1.25, 0, 20);
    if (input.jitterMs > 15) {
      insights.push(
        `Jitter is elevated (${input.jitterMs.toFixed(1)} ms) - packet timing is inconsistent, a common cause of choppy calls even when average speed looks fine.`
      );
    }
  }
  breakdown.push({ label: "Jitter", pointsLost: Math.round(jitterLoss), maxPoints: 20 });

  // --- Packet loss: 25 pts ---
  let lossLoss = 0;
  if (input.packetLossPct !== null) {
    lossLoss = clamp(input.packetLossPct * 8, 0, 25);
    if (input.packetLossPct > 1) {
      insights.push(
        `Packet loss of ${input.packetLossPct.toFixed(1)}% detected - on a wired connection this often points to a damaged cable, a failing port, or an upstream ISP issue. Try a different cable or switch port first.`
      );
    }
  }
  breakdown.push({ label: "Packet loss", pointsLost: Math.round(lossLoss), maxPoints: 25 });

  // --- Bufferbloat: 20 pts ---
  const bbGrade = computeBufferbloatGrade(input.bufferbloatIncreaseMs);
  const bbPenaltyMap: Record<string, number> = { A: 0, B: 4, C: 9, D: 16, F: 20, "N/A": 0 };
  const bbLoss = bbPenaltyMap[bbGrade] ?? 0;
  if (bbGrade === "D" || bbGrade === "F") {
    insights.push(
      `Significant bufferbloat: latency jumps by ${input.bufferbloatIncreaseMs?.toFixed(0)} ms when the connection is under load. Large downloads or uploads can make calls and browsing feel laggy elsewhere on your network. Enabling Smart Queue Management (SQM) or QoS on your router, if it supports it, usually fixes this.`
    );
  } else if (bbGrade === "C") {
    insights.push(`Some bufferbloat under load (+${input.bufferbloatIncreaseMs?.toFixed(0)} ms) - noticeable but not severe.`);
  }
  breakdown.push({ label: "Bufferbloat", pointsLost: bbLoss, maxPoints: 20 });

  // --- Speed consistency: 10 pts (only scored if a plan speed is configured) ---
  let speedLoss = 0;
  if (input.expectedDownloadMbps && input.downloadMbps !== null) {
    const ratio = input.downloadMbps / input.expectedDownloadMbps;
    if (ratio < 0.5) {
      speedLoss = 10;
      insights.push(
        `Measured download (${input.downloadMbps.toFixed(0)} Mbps) is well below your configured plan speed (${input.expectedDownloadMbps} Mbps). Worth re-testing at a different time of day; if it persists, contact your ISP.`
      );
    } else if (ratio < 0.8) {
      speedLoss = 5;
      insights.push(
        `Download speed is somewhat below your configured plan speed (${input.downloadMbps.toFixed(0)} of ${input.expectedDownloadMbps} Mbps).`
      );
    }
  }
  breakdown.push({ label: "Speed vs plan", pointsLost: speedLoss, maxPoints: 10 });

  // Sum the ROUNDED per-category losses (the same numbers shown in the
  // breakdown bars) rather than the raw floats, so the bars always add up
  // exactly to the score.
  const totalLoss = breakdown.reduce((sum, item) => sum + item.pointsLost, 0);
  const score = clamp(100 - totalLoss, 0, 100);

  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 65) grade = "C";
  else if (score >= 50) grade = "D";

  if (insights.length === 0) {
    insights.push("No significant issues detected - latency, jitter, packet loss, and bufferbloat all look healthy.");
  }

  return { score, grade, bufferbloatGrade: bbGrade, insights, breakdown };
}
