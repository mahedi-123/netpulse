import { Router } from "express";
import { pingSummary } from "../services/pingService.js";
import { runDnsHealthCheck, summarizeDnsResults } from "../services/dnsService.js";
import { runTraceroute } from "../services/tracerouteService.js";
import { getSystemInfo, getDefaultGateway } from "../services/systemInfoService.js";
import { startLoadedPing, stopLoadedPing } from "../services/loadedLatencyService.js";
import { computeHealthScore } from "../services/healthScore.js";
import { getMonitoredTargets, startMonitor } from "../services/monitorService.js";
import {
  insertSpeedTest,
  getLatestSpeedTest,
  getSpeedTestsSince,
  getPingLogsSince,
  getRecentOutages,
  getSetting,
  setSetting,
  getAllSettings,
} from "../db/index.js";
import { CONFIG } from "../config.js";
import type { SpeedTestResult } from "../types.js";

const router = Router();

// ---------- system ----------
router.get("/system/info", async (_req, res) => {
  const info = await getSystemInfo();
  res.json(info);
});

// ---------- ping ----------
router.get("/ping/quick", async (_req, res) => {
  const gateway = await getDefaultGateway();
  const targets = [...(gateway ? [{ target: gateway, label: "Router (gateway)" }] : []), ...CONFIG.PUBLIC_PING_TARGETS];
  const results = await Promise.all(targets.map(({ target, label }) => pingSummary(target, label, 5)));
  res.json({ results });
});

// ---------- dns ----------
router.get("/dns/health", async (_req, res) => {
  const results = await runDnsHealthCheck();
  const summary = summarizeDnsResults(results);
  res.json({ results, summary });
});

// ---------- traceroute ----------
router.get("/traceroute", async (req, res) => {
  const target = (req.query.target as string) || "1.1.1.1";
  const hops = await runTraceroute(target);
  res.json({ target, hops });
});

// ---------- loaded latency (bufferbloat) ----------
router.post("/loadtest/ping/start", async (req, res) => {
  const phase = (req.body?.phase as string) || "load";
  const gateway = await getDefaultGateway();
  const target = gateway || "1.1.1.1";
  const id = startLoadedPing(target, phase);
  res.json({ id, target });
});

router.post("/loadtest/ping/stop", (req, res) => {
  const { id } = req.body ?? {};
  const result = stopLoadedPing(id);
  if (!result) return res.status(404).json({ error: "Session not found" });
  res.json(result);
});

// ---------- speed test save + scoring ----------
router.post("/speedtest/save", async (req, res) => {
  const body = req.body ?? {};

  const downloadLoaded = body.downloadLoadedLatencyMs ?? null;
  const uploadLoaded = body.uploadLoadedLatencyMs ?? null;
  const loadedSamples = [downloadLoaded, uploadLoaded].filter((v): v is number => typeof v === "number");
  const loadedAvg = loadedSamples.length ? loadedSamples.reduce((a, b) => a + b, 0) / loadedSamples.length : null;
  const bufferbloatIncreaseMs =
    loadedAvg !== null && typeof body.idleLatencyMs === "number" ? Math.max(0, loadedAvg - body.idleLatencyMs) : null;

  const expectedDownloadMbps = getSetting("expectedDownloadMbps");

  const scoreResult = computeHealthScore({
    idleLatencyMs: body.idleLatencyMs ?? null,
    jitterMs: body.idleJitterMs ?? null,
    packetLossPct: body.idlePacketLossPct ?? null,
    bufferbloatIncreaseMs,
    downloadMbps: body.downloadMbps ?? null,
    expectedDownloadMbps: expectedDownloadMbps ? parseFloat(expectedDownloadMbps) : null,
  });

  const result: SpeedTestResult = {
    timestamp: Date.now(),
    downloadMbps: body.downloadMbps ?? null,
    uploadMbps: body.uploadMbps ?? null,
    idleLatencyMs: body.idleLatencyMs ?? null,
    idleJitterMs: body.idleJitterMs ?? null,
    idlePacketLossPct: body.idlePacketLossPct ?? null,
    downloadLoadedLatencyMs: downloadLoaded,
    uploadLoadedLatencyMs: uploadLoaded,
    bufferbloatIncreaseMs,
    bufferbloatGrade: scoreResult.bufferbloatGrade,
    healthScore: scoreResult.score,
    healthGrade: scoreResult.grade,
    insights: scoreResult.insights,
    serverLocation: body.serverLocation ?? null,
    clientIp: body.clientIp ?? null,
  };

  const id = insertSpeedTest(result);
  res.json({ ...result, id, breakdown: scoreResult.breakdown });
});

router.get("/speedtest/latest", (_req, res) => {
  res.json(getLatestSpeedTest());
});

// ---------- history ----------
router.get("/history", (req, res) => {
  const range = (req.query.range as string) || "24h";
  const rangeMs = range === "30d" ? 30 * 86400000 : range === "7d" ? 7 * 86400000 : 86400000;
  const since = Date.now() - rangeMs;
  res.json({
    speedTests: getSpeedTestsSince(since),
    pingLogs: getPingLogsSince(since),
  });
});

// ---------- outages ----------
router.get("/outages", (_req, res) => {
  res.json({ outages: getRecentOutages() });
});

// ---------- monitor ----------
router.get("/monitor/targets", (_req, res) => {
  res.json({ targets: getMonitoredTargets() });
});

// ---------- settings ----------
router.get("/settings", (_req, res) => {
  const settings = getAllSettings();
  res.json({
    monitorIntervalMinutes: parseInt(settings.monitorIntervalMinutes || String(CONFIG.DEFAULT_MONITOR_INTERVAL_MINUTES), 10),
    expectedDownloadMbps: settings.expectedDownloadMbps ? parseFloat(settings.expectedDownloadMbps) : null,
    expectedUploadMbps: settings.expectedUploadMbps ? parseFloat(settings.expectedUploadMbps) : null,
  });
});

router.post("/settings", async (req, res) => {
  const { monitorIntervalMinutes, expectedDownloadMbps, expectedUploadMbps } = req.body ?? {};
  if (monitorIntervalMinutes) setSetting("monitorIntervalMinutes", String(monitorIntervalMinutes));
  if (expectedDownloadMbps !== undefined) setSetting("expectedDownloadMbps", String(expectedDownloadMbps));
  if (expectedUploadMbps !== undefined) setSetting("expectedUploadMbps", String(expectedUploadMbps));

  if (monitorIntervalMinutes) {
    await startMonitor(parseInt(monitorIntervalMinutes, 10));
  }
  res.json({ ok: true });
});

export default router;
