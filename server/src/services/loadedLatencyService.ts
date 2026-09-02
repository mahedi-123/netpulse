import { randomUUID } from "node:crypto";
import { pingOnce } from "./pingService.js";
import { CONFIG } from "../config.js";
import { broadcast } from "../ws/wsServer.js";

interface LoadedSession {
  target: string;
  phase: string;
  samples: number[];
  active: boolean;
}

const sessions = new Map<string, LoadedSession>();

/**
 * Starts a rapid-fire ping loop (every ~200ms) against `target`, intended to run
 * concurrently with a browser-driven download/upload transfer. Comparing the average
 * RTT collected here against an idle baseline reveals bufferbloat: queuing delay that
 * builds up in the router/modem when the link is saturated.
 */
export function startLoadedPing(target: string, phase: string): string {
  const id = randomUUID();
  const session: LoadedSession = { target, phase, samples: [], active: true };
  sessions.set(id, session);
  void loop(id);
  return id;
}

async function loop(id: string) {
  const session = sessions.get(id);
  if (!session || !session.active) return;
  const result = await pingOnce(session.target, 1000);
  if (session.active) {
    if (result.success && result.rttMs !== null) {
      session.samples.push(result.rttMs);
      broadcast({ type: "loaded-ping-sample", phase: session.phase, rttMs: result.rttMs, timestamp: Date.now() });
    }
    setTimeout(() => loop(id), CONFIG.LOADED_PING_INTERVAL_MS);
  }
}

export function stopLoadedPing(id: string): { avgMs: number | null; sampleCount: number } | null {
  const session = sessions.get(id);
  if (!session) return null;
  session.active = false;
  sessions.delete(id);
  const { samples } = session;
  return {
    avgMs: samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : null,
    sampleCount: samples.length,
  };
}
