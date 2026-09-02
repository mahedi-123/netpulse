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

export interface DnsResult {
  resolver: string;
  domain: string;
  ms: number | null;
  success: boolean;
}

export interface DnsResolverSummary {
  resolver: string;
  avgMs: number | null;
  successCount: number;
  totalCount: number;
}

export interface TracerouteHop {
  hop: number;
  address: string | null;
  rttMs: number | null;
  timedOut: boolean;
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

export interface OutageRecord {
  id: number;
  startTime: number;
  endTime: number | null;
  durationSec: number | null;
  reason: string | null;
}

export interface ScoreBreakdownItem {
  label: string;
  pointsLost: number;
  maxPoints: number;
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
  breakdown?: ScoreBreakdownItem[];
}

export interface PublicMeta {
  ip: string | null;
  city: string | null;
  country: string | null;
  asn: string | null;
  colo: string | null;
}

export type TestPhase = "idle" | "baseline" | "download" | "upload" | "saving" | "done";

export interface LiveSpeedSample {
  mbps: number;
  totalBytes: number;
  elapsedSec: number;
}
