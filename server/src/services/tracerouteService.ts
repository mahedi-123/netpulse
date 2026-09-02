import { spawn } from "node:child_process";
import { isWindows } from "../utils/platform.js";
import type { TracerouteHop } from "../types.js";

function parseTraceroute(output: string): TracerouteHop[] {
  const hops: TracerouteHop[] = [];
  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();
    const hopMatch = line.match(/^(\d+)/);
    if (!hopMatch) continue;

    const hop = parseInt(hopMatch[1], 10);
    const times = [...line.matchAll(/([\d.]+)\s*ms/gi)].map((m) => parseFloat(m[1]));
    const addrMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    const timedOut = times.length === 0;

    hops.push({
      hop,
      address: addrMatch ? addrMatch[1] : null,
      rttMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      timedOut,
    });
  }
  return hops;
}

export function runTraceroute(target: string, maxHops = 20): Promise<TracerouteHop[]> {
  return new Promise((resolve) => {
    const cmd = isWindows ? "tracert" : "traceroute";
    const args = isWindows ? ["-h", String(maxHops), "-w", "1000", target] : ["-m", String(maxHops), "-w", "1", target];

    let output = "";
    let settled = false;
    const proc = spawn(cmd, args, { windowsHide: true });

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(parseTraceroute(output));
    };

    const timer = setTimeout(() => {
      proc.kill();
      finish();
    }, 30000);

    proc.stdout.on("data", (chunk) => (output += chunk.toString()));
    proc.on("close", finish);
    proc.on("error", () => {
      settled = true;
      clearTimeout(timer);
      resolve([]);
    });
  });
}
