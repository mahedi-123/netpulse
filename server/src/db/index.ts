import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { PingSummary, SpeedTestResult, OutageRecord } from "../types.js";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "netpulse.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS speed_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    download_mbps REAL,
    upload_mbps REAL,
    idle_latency_ms REAL,
    idle_jitter_ms REAL,
    idle_packet_loss_pct REAL,
    download_loaded_latency_ms REAL,
    upload_loaded_latency_ms REAL,
    bufferbloat_increase_ms REAL,
    bufferbloat_grade TEXT,
    health_score INTEGER,
    health_grade TEXT,
    insights TEXT,
    server_location TEXT,
    client_ip TEXT
  );

  CREATE TABLE IF NOT EXISTS ping_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    target TEXT NOT NULL,
    label TEXT,
    sent INTEGER,
    received INTEGER,
    loss_pct REAL,
    avg_ms REAL,
    jitter_ms REAL
  );

  CREATE TABLE IF NOT EXISTS outages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_sec INTEGER,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_speed_tests_ts ON speed_tests(timestamp);
  CREATE INDEX IF NOT EXISTS idx_ping_logs_ts ON ping_logs(timestamp);
`);

// ---------- settings ----------
export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ---------- speed tests ----------
const insertSpeedTestStmt = db.prepare(`
  INSERT INTO speed_tests (
    timestamp, download_mbps, upload_mbps, idle_latency_ms, idle_jitter_ms, idle_packet_loss_pct,
    download_loaded_latency_ms, upload_loaded_latency_ms, bufferbloat_increase_ms, bufferbloat_grade,
    health_score, health_grade, insights, server_location, client_ip
  ) VALUES (@timestamp, @downloadMbps, @uploadMbps, @idleLatencyMs, @idleJitterMs, @idlePacketLossPct,
    @downloadLoadedLatencyMs, @uploadLoadedLatencyMs, @bufferbloatIncreaseMs, @bufferbloatGrade,
    @healthScore, @healthGrade, @insights, @serverLocation, @clientIp)
`);

export function insertSpeedTest(result: SpeedTestResult): number {
  const info = insertSpeedTestStmt.run({
    timestamp: result.timestamp,
    downloadMbps: result.downloadMbps,
    uploadMbps: result.uploadMbps,
    idleLatencyMs: result.idleLatencyMs,
    idleJitterMs: result.idleJitterMs,
    idlePacketLossPct: result.idlePacketLossPct,
    downloadLoadedLatencyMs: result.downloadLoadedLatencyMs,
    uploadLoadedLatencyMs: result.uploadLoadedLatencyMs,
    bufferbloatIncreaseMs: result.bufferbloatIncreaseMs,
    bufferbloatGrade: result.bufferbloatGrade,
    healthScore: result.healthScore,
    healthGrade: result.healthGrade,
    insights: JSON.stringify(result.insights),
    serverLocation: result.serverLocation,
    clientIp: result.clientIp,
  });
  return info.lastInsertRowid as number;
}

function rowToSpeedTest(row: any): SpeedTestResult {
  return {
    id: row.id,
    timestamp: row.timestamp,
    downloadMbps: row.download_mbps,
    uploadMbps: row.upload_mbps,
    idleLatencyMs: row.idle_latency_ms,
    idleJitterMs: row.idle_jitter_ms,
    idlePacketLossPct: row.idle_packet_loss_pct,
    downloadLoadedLatencyMs: row.download_loaded_latency_ms,
    uploadLoadedLatencyMs: row.upload_loaded_latency_ms,
    bufferbloatIncreaseMs: row.bufferbloat_increase_ms,
    bufferbloatGrade: row.bufferbloat_grade,
    healthScore: row.health_score,
    healthGrade: row.health_grade,
    insights: row.insights ? JSON.parse(row.insights) : [],
    serverLocation: row.server_location,
    clientIp: row.client_ip,
  };
}

export function getLatestSpeedTest(): SpeedTestResult | null {
  const row = db.prepare("SELECT * FROM speed_tests ORDER BY timestamp DESC LIMIT 1").get();
  return row ? rowToSpeedTest(row) : null;
}

export function getSpeedTestsSince(sinceTs: number): SpeedTestResult[] {
  const rows = db.prepare("SELECT * FROM speed_tests WHERE timestamp >= ? ORDER BY timestamp ASC").all(sinceTs);
  return rows.map(rowToSpeedTest);
}

// ---------- ping logs ----------
const insertPingLogStmt = db.prepare(`
  INSERT INTO ping_logs (timestamp, target, label, sent, received, loss_pct, avg_ms, jitter_ms)
  VALUES (@timestamp, @target, @label, @sent, @received, @lossPct, @avgMs, @jitterMs)
`);

export function insertPingLog(summary: PingSummary): void {
  insertPingLogStmt.run(summary);
}

export function getPingLogsSince(sinceTs: number): PingSummary[] {
  const rows = db.prepare("SELECT * FROM ping_logs WHERE timestamp >= ? ORDER BY timestamp ASC").all(sinceTs) as any[];
  return rows.map((r) => ({
    target: r.target,
    label: r.label,
    sent: r.sent,
    received: r.received,
    lossPct: r.loss_pct,
    minMs: null,
    avgMs: r.avg_ms,
    maxMs: null,
    jitterMs: r.jitter_ms,
    timestamp: r.timestamp,
  }));
}

// ---------- outages ----------
export function getOpenOutage(): OutageRecord | null {
  const row = db.prepare("SELECT * FROM outages WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1").get() as any;
  if (!row) return null;
  return { id: row.id, startTime: row.start_time, endTime: row.end_time, durationSec: row.duration_sec, reason: row.reason };
}

export function startOutage(reason: string): OutageRecord {
  const startTime = Date.now();
  const info = db.prepare("INSERT INTO outages (start_time, reason) VALUES (?, ?)").run(startTime, reason);
  return { id: info.lastInsertRowid as number, startTime, endTime: null, durationSec: null, reason };
}

export function endOutage(id: number): OutageRecord {
  const endTime = Date.now();
  const outage = db.prepare("SELECT * FROM outages WHERE id = ?").get(id) as any;
  const durationSec = Math.round((endTime - outage.start_time) / 1000);
  db.prepare("UPDATE outages SET end_time = ?, duration_sec = ? WHERE id = ?").run(endTime, durationSec, id);
  return { id, startTime: outage.start_time, endTime, durationSec, reason: outage.reason };
}

export function getRecentOutages(limit = 50): OutageRecord[] {
  const rows = db.prepare("SELECT * FROM outages ORDER BY start_time DESC LIMIT ?").all(limit) as any[];
  return rows.map((r) => ({ id: r.id, startTime: r.start_time, endTime: r.end_time, durationSec: r.duration_sec, reason: r.reason }));
}
