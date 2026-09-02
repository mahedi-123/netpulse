// Diagnostics for the phone's OWN connection.
//
// Important honesty note that shapes this whole file: a web app cannot send
// ICMP echo requests. There is no browser API for it at any permission level,
// so the desktop app's `ping` approach simply has no equivalent here.
//
// What we measure instead is HTTP round-trip time: the full time to complete a
// tiny HTTPS request. That includes TCP/TLS session reuse, server handling, and
// the browser's own scheduling, so it reads HIGHER than an ICMP ping to the
// same host - typically by a few ms to a few tens of ms. It is NOT interchangeable
// with the ICMP figures on the PC dashboard, and the UI labels it distinctly
// ("HTTP round-trip", not "ping") so the two are never silently compared.
//
// What it IS good for: relative comparison over time on the same phone, jitter
// (variance is meaningful even when the absolute floor is inflated), and
// detecting bufferbloat by contrasting idle vs. under-load RTT.

const PROBE_URL = "https://speed.cloudflare.com/__down?bytes=10";

export interface RttStats {
  samples: number[];
  avgMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  jitterMs: number | null;
  failures: number;
}

/** One HTTP round-trip, in ms. Returns null on failure. */
export async function probeOnce(timeoutMs = 4000): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    // cache-busting param + no-store so we never time a cache hit instead of the network
    await fetch(`${PROBE_URL}&_=${Date.now()}-${Math.random()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return performance.now() - start;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function summarize(samples: number[], failures: number): RttStats {
  if (samples.length === 0) {
    return { samples, avgMs: null, minMs: null, maxMs: null, jitterMs: null, failures };
  }
  // Jitter as mean absolute difference between consecutive samples - the same
  // definition the desktop app uses, so this one metric IS comparable.
  let jitterMs: number | null = null;
  if (samples.length > 1) {
    const diffs: number[] = [];
    for (let i = 1; i < samples.length; i++) diffs.push(Math.abs(samples[i] - samples[i - 1]));
    jitterMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }
  return {
    samples,
    avgMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
    jitterMs,
    failures,
  };
}

/** Sequential probes for a baseline reading. */
export async function measureIdleRtt(count = 8, onSample?: (ms: number) => void): Promise<RttStats> {
  const samples: number[] = [];
  let failures = 0;
  for (let i = 0; i < count; i++) {
    const ms = await probeOnce();
    if (ms === null) failures++;
    else {
      samples.push(ms);
      onSample?.(ms);
    }
    if (i < count - 1) await new Promise((r) => setTimeout(r, 120));
  }
  return summarize(samples, failures);
}

/**
 * Continuously probes until stopped. Run this DURING a speed test so the
 * resulting average can be compared against the idle baseline to reveal
 * bufferbloat - the same idea as the desktop app's loaded-latency probe,
 * just driven from the browser instead of the backend.
 */
export function startLoadedRttProbe(onSample?: (ms: number) => void): { stop: () => RttStats } {
  const samples: number[] = [];
  let failures = 0;
  let active = true;

  (async () => {
    while (active) {
      const ms = await probeOnce(3000);
      if (!active) break;
      if (ms === null) failures++;
      else {
        samples.push(ms);
        onSample?.(ms);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  })();

  return {
    stop: () => {
      active = false;
      return summarize(samples, failures);
    },
  };
}

// ---------------------------------------------------------------------------
// Connection type
// ---------------------------------------------------------------------------

export interface ConnectionInfo {
  /** "wifi" | "cellular" | "ethernet" | "unknown" etc. Chrome/Android only. */
  type: string | null;
  /** Coarse bucket the browser reports: "4g", "3g", "2g", "slow-2g". */
  effectiveType: string | null;
  /** The browser's OWN rough estimate, not our measurement. */
  downlinkMbps: number | null;
  rttMs: number | null;
  saveData: boolean | null;
  online: boolean;
  supported: boolean;
}

/**
 * Reads the Network Information API. Well supported on Chrome for Android
 * (the main target here); absent on iOS Safari and desktop Firefox, hence
 * the `supported` flag so the UI can hide the card rather than show blanks.
 *
 * Note `type` requires more privilege than `effectiveType` and is often
 * undefined even where the rest works - treated as optional throughout.
 */
export function getConnectionInfo(): ConnectionInfo {
  const nav = navigator as Navigator & {
    connection?: any;
    mozConnection?: any;
    webkitConnection?: any;
  };
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;

  if (!conn) {
    return {
      type: null,
      effectiveType: null,
      downlinkMbps: null,
      rttMs: null,
      saveData: null,
      online: navigator.onLine,
      supported: false,
    };
  }

  return {
    type: conn.type ?? null,
    effectiveType: conn.effectiveType ?? null,
    downlinkMbps: typeof conn.downlink === "number" ? conn.downlink : null,
    rttMs: typeof conn.rtt === "number" ? conn.rtt : null,
    saveData: typeof conn.saveData === "boolean" ? conn.saveData : null,
    online: navigator.onLine,
    supported: true,
  };
}

/** Subscribes to connection changes (e.g. WiFi -> cellular handoff). */
export function onConnectionChange(handler: () => void): () => void {
  const nav = navigator as Navigator & { connection?: any };
  const conn = nav.connection;
  conn?.addEventListener?.("change", handler);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    conn?.removeEventListener?.("change", handler);
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}
