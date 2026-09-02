import { pingSummary } from "./pingService.js";
import { getDefaultGateway } from "./systemInfoService.js";
import { insertPingLog, getOpenOutage, startOutage, endOutage } from "../db/index.js";
import { broadcast } from "../ws/wsServer.js";
import { CONFIG } from "../config.js";

let intervalHandle: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;
let currentTargets: { target: string; label: string }[] = [];

async function resolveTargets(): Promise<{ target: string; label: string }[]> {
  const gateway = await getDefaultGateway();
  const targets = [...CONFIG.PUBLIC_PING_TARGETS];
  if (gateway) targets.unshift({ target: gateway, label: "Router (gateway)" });
  return targets;
}

async function tick(): Promise<void> {
  if (currentTargets.length === 0) {
    currentTargets = await resolveTargets();
  }

  const results = [];
  for (const { target, label } of currentTargets) {
    const summary = await pingSummary(target, label, CONFIG.MONITOR_PING_COUNT);
    insertPingLog(summary);
    results.push(summary);
  }

  const allFailed = results.length > 0 && results.every((r) => r.received === 0);
  const openOutage = getOpenOutage();

  if (allFailed) {
    consecutiveFailures++;
    if (consecutiveFailures >= CONFIG.OUTAGE_FAILURE_THRESHOLD && !openOutage) {
      const outage = startOutage("All monitored targets unreachable");
      broadcast({ type: "outage-start", outage });
    }
  } else {
    if (openOutage) {
      const outage = endOutage(openOutage.id);
      broadcast({ type: "outage-end", outage });
    }
    consecutiveFailures = 0;
  }

  broadcast({ type: "monitor-tick", results, timestamp: Date.now() });
}

export async function startMonitor(intervalMinutes: number): Promise<void> {
  stopMonitor();
  currentTargets = await resolveTargets();
  await tick();
  intervalHandle = setInterval(() => void tick(), Math.max(1, intervalMinutes) * 60 * 1000);
}

export function stopMonitor(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

export function getMonitoredTargets(): { target: string; label: string }[] {
  return currentTargets;
}
