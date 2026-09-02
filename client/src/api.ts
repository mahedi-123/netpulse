import type { SpeedTestResult, SystemInfo, PingSummary, DnsResult, DnsResolverSummary, TracerouteHop, OutageRecord } from "./types";

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Request to ${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  systemInfo: () => jsonFetch<SystemInfo>("/api/system/info"),

  pingQuick: () => jsonFetch<{ results: PingSummary[] }>("/api/ping/quick"),

  dnsHealth: () => jsonFetch<{ results: DnsResult[]; summary: DnsResolverSummary[] }>("/api/dns/health"),

  traceroute: (target: string) => jsonFetch<{ target: string; hops: TracerouteHop[] }>(`/api/traceroute?target=${encodeURIComponent(target)}`),

  startLoadedPing: (phase: string) => jsonFetch<{ id: string; target: string }>("/api/loadtest/ping/start", { method: "POST", body: JSON.stringify({ phase }) }),

  stopLoadedPing: (id: string) => jsonFetch<{ avgMs: number | null; sampleCount: number }>("/api/loadtest/ping/stop", { method: "POST", body: JSON.stringify({ id }) }),

  saveSpeedTest: (payload: Partial<SpeedTestResult>) => jsonFetch<SpeedTestResult>("/api/speedtest/save", { method: "POST", body: JSON.stringify(payload) }),

  latestSpeedTest: () => jsonFetch<SpeedTestResult | null>("/api/speedtest/latest"),

  history: (range: "24h" | "7d" | "30d") => jsonFetch<{ speedTests: SpeedTestResult[]; pingLogs: PingSummary[] }>(`/api/history?range=${range}`),

  outages: () => jsonFetch<{ outages: OutageRecord[] }>("/api/outages"),

  monitorTargets: () => jsonFetch<{ targets: { target: string; label: string }[] }>("/api/monitor/targets"),

  getSettings: () => jsonFetch<{ monitorIntervalMinutes: number; expectedDownloadMbps: number | null; expectedUploadMbps: number | null }>("/api/settings"),

  saveSettings: (payload: { monitorIntervalMinutes?: number; expectedDownloadMbps?: number | null; expectedUploadMbps?: number | null }) =>
    jsonFetch<{ ok: true }>("/api/settings", { method: "POST", body: JSON.stringify(payload) }),
};
