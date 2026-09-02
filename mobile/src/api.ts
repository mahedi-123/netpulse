// API client for "My PC" mode.
//
// Two deployment shapes, handled by getApiBase() below:
//
//  1. PWA served BY the PC (http://<pc-ip>:4001/m) - requests are same-origin
//     and relative, so there is nothing to configure and no CORS involved.
//  2. Installed APK - the app's assets are bundled inside the app, so there is
//     no PC origin to inherit. The user enters the PC's address once and it is
//     stored locally. The backend already sends permissive CORS headers, so
//     cross-origin requests from the app work.

import { isNativeApp } from "./nativeBridge";

const PC_ADDRESS_KEY = "netpulse-pc-address";

/** Normalizes input like "192.168.1.42" into "http://192.168.1.42:4001". */
export function normalizePcAddress(input: string): string {
  let value = input.trim().replace(/\/+$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  // Default to the backend's port when the user omits one.
  const withoutScheme = value.replace(/^https?:\/\//i, "");
  if (!/:\d+$/.test(withoutScheme)) value = `${value}:4001`;
  return value;
}

export function getPcAddress(): string | null {
  try {
    return localStorage.getItem(PC_ADDRESS_KEY);
  } catch {
    return null;
  }
}

export function setPcAddress(address: string): void {
  try {
    const normalized = normalizePcAddress(address);
    if (normalized) localStorage.setItem(PC_ADDRESS_KEY, normalized);
    else localStorage.removeItem(PC_ADDRESS_KEY);
  } catch {
    // storage can be unavailable in some privacy modes; PC mode simply stays unconfigured
  }
}

/**
 * Empty string means "same origin" (relative URLs). Returns null when running
 * as an APK with no PC address configured yet - the UI treats that as
 * "ask the user for an address", not as an error.
 */
export function getApiBase(): string | null {
  const stored = getPcAddress();
  if (stored) return stored;
  if (isNativeApp()) return null;
  return "";
}

/** True when the user still needs to supply a PC address before PC mode works. */
export function needsPcAddress(): boolean {
  return getApiBase() === null;
}

export interface PingSummary {
  target: string;
  label: string;
  sent: number;
  received: number;
  lossPct: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  jitterMs: number | null;
  timestamp: number;
}

export interface AdapterInfo {
  name: string;
  description: string;
  linkSpeed: string | null;
  macAddress: string | null;
  status: string;
}

export interface SystemInfo {
  interfaces: { name: string; address: string }[];
  adapters: AdapterInfo[];
  gateway: string | null;
  dnsServers: string[];
  platform: string;
  hostname: string;
}

export interface SpeedTestResult {
  id?: number;
  timestamp: number;
  downloadMbps: number | null;
  uploadMbps: number | null;
  idleLatencyMs: number | null;
  idleJitterMs: number | null;
  idlePacketLossPct: number | null;
  downloadLoadedLatencyMs: number | null;
  uploadLoadedLatencyMs: number | null;
  bufferbloatIncreaseMs: number | null;
  bufferbloatGrade: string;
  healthScore: number;
  healthGrade: string;
  insights: string[];
  serverLocation: string | null;
  clientIp: string | null;
}

export interface OutageRecord {
  id: number;
  startTime: number;
  endTime: number | null;
  durationSec: number | null;
  reason: string | null;
}

/** Thrown when PC mode is used before an address has been configured. */
export class PcAddressMissingError extends Error {
  constructor() {
    super("No PC address configured");
    this.name = "PcAddressMissingError";
  }
}

async function jsonFetch<T>(path: string, timeoutMs = 8000): Promise<T> {
  const base = getApiBase();
  if (base === null) throw new PcAddressMissingError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => jsonFetch<{ ok: boolean }>("/api/ping", 4000),
  systemInfo: () => jsonFetch<SystemInfo>("/api/system/info"),
  pingQuick: () => jsonFetch<{ results: PingSummary[] }>("/api/ping/quick", 15000),
  latestSpeedTest: () => jsonFetch<SpeedTestResult | null>("/api/speedtest/latest"),
  outages: () => jsonFetch<{ outages: OutageRecord[] }>("/api/outages"),
  history: (range: "24h" | "7d" | "30d") =>
    jsonFetch<{ speedTests: SpeedTestResult[]; pingLogs: PingSummary[] }>(`/api/history?range=${range}`),
};

/** Probes a candidate address without persisting it - used by the setup screen. */
export async function testPcAddress(address: string): Promise<boolean> {
  const base = normalizePcAddress(address);
  if (!base) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/api/ping`, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
