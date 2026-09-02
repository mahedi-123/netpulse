import { spawn } from "node:child_process";
import { isWindows } from "../utils/platform.js";
import type { PingSample, PingSummary } from "../types.js";

// Matches "time=14ms" and "time<1ms" (Windows) as well as "time=14.2 ms" (Unix/macOS).
// Deliberately does NOT depend on any other text in the line, since ping's surrounding
// labels are localized on non-English Windows installs but this token is not.
const TIME_REGEX = /time[=<]\s*([\d.]+)\s*ms/i;

/**
 * Sends a single ICMP echo request via the OS ping binary and extracts the round-trip time.
 * Shelling out to the native ping utility (rather than opening a raw socket) is deliberate:
 * raw ICMP sockets require administrator privileges on Windows, while the bundled ping.exe
 * already has what it needs and works identically for any user.
 */
export function pingOnce(target: string, timeoutMs = 1500): Promise<PingSample> {
  return new Promise((resolve) => {
    const args = isWindows
      ? ["-n", "1", "-w", String(timeoutMs), target]
      : ["-c", "1", "-W", String(Math.max(1, Math.round(timeoutMs / 1000))), target];

    let settled = false;
    const proc = spawn("ping", args, { windowsHide: true });
    let output = "";

    const finish = (sample: PingSample) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(sample);
    };

    const timer = setTimeout(() => {
      proc.kill();
      finish({ success: false, rttMs: null });
    }, timeoutMs + 1000);

    proc.stdout.on("data", (chunk) => (output += chunk.toString()));
    proc.on("close", () => {
      const match = output.match(TIME_REGEX);
      if (match) {
        finish({ success: true, rttMs: parseFloat(match[1]) });
      } else {
        finish({ success: false, rttMs: null });
      }
    });
    proc.on("error", () => finish({ success: false, rttMs: null }));
  });
}

/**
 * Sends `count` sequential pings and computes min/avg/max/jitter/loss.
 * Jitter is the mean absolute difference between consecutive successful RTT samples -
 * a practical, widely-used approximation (similar in spirit to RFC 3550's interarrival
 * jitter) that is far more informative for real-time-traffic diagnosis than max-min.
 */
export async function pingSummary(target: string, label: string, count = 5): Promise<PingSummary> {
  const samples: PingSample[] = [];
  for (let i = 0; i < count; i++) {
    samples.push(await pingOnce(target));
    if (i < count - 1) await new Promise((r) => setTimeout(r, 120));
  }

  const rtts = samples.filter((s): s is { success: true; rttMs: number } => s.success && s.rttMs !== null).map((s) => s.rttMs);
  const received = rtts.length;
  const lossPct = ((count - received) / count) * 100;

  let jitterMs: number | null = null;
  if (rtts.length > 1) {
    const diffs: number[] = [];
    for (let i = 1; i < rtts.length; i++) diffs.push(Math.abs(rtts[i] - rtts[i - 1]));
    jitterMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }

  return {
    target,
    label,
    sent: count,
    received,
    lossPct,
    minMs: rtts.length ? Math.min(...rtts) : null,
    avgMs: rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null,
    maxMs: rtts.length ? Math.max(...rtts) : null,
    jitterMs,
    timestamp: Date.now(),
  };
}
