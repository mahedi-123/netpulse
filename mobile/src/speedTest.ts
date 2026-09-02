// Browser-based speed test engine, built on NDT7 (Network Diagnostic Tool v7) -
// the open protocol from Measurement Lab (M-Lab), the same non-profit
// measurement infrastructure behind Google's built-in "internet speed test"
// search widget and many ISPs' own speed tests.
//
// This replaces an earlier version built on Cloudflare's speed.cloudflare.com
// __down/__up endpoints. Those are undocumented internals of Cloudflare's own
// product rather than a published API, and have a real, confirmed history of
// inconsistent CORS behavior for third-party origins - which is what broke
// the upload measurement (download happened to keep working because a plain
// GET with no custom headers is CORS-simple in a way a POST often isn't).
//
// NDT7 runs over WebSocket for both directions. WebSocket handshakes aren't
// subject to the CORS preflight/response-header restrictions that XHR/fetch
// are, which removes that entire failure mode, and the protocol is explicitly
// designed and documented for third-party embedding like this.
//
// One real tradeoff worth knowing: M-Lab publishes test results (including
// client IP, ASN, and performance metrics) as open data for network research.
// That's different from Cloudflare's private commercial infrastructure. See
// https://www.measurementlab.net/data-policy/ for what that covers.
import ndt7 from "@m-lab/ndt7";

export interface SpeedTestOptions {
  onProgress?: (mbps: number) => void;
}

// Workers are served from the app's own base path (/m/ in the built app, / in
// dev). Resolving against BASE_URL rather than a bare relative string keeps this
// correct regardless of where the app is mounted.
const WORKER_BASE = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

const NDT7_CONFIG = {
  userAcceptedDataPolicy: true,
  downloadworkerfile: `${WORKER_BASE}ndt7-download-worker.js`,
  uploadworkerfile: `${WORKER_BASE}ndt7-upload-worker.js`,
  metadata: { client_name: "netpulse-mobile", client_version: "1.0.0" },
};

// Both phases of one diagnostic run should land on the same server, and there's
// no need to hit M-Lab's locate service more than once per run.
let cachedUrlPromise: Promise<Record<string, string>> | null = null;
let cachedServerInfo: { city?: string; country?: string; machine?: string } | null = null;

function getServerUrls(): Promise<Record<string, string>> {
  if (!cachedUrlPromise) {
    cachedUrlPromise = ndt7.discoverServerURLs(NDT7_CONFIG, {
      serverChosen: (server) => {
        cachedServerInfo = {
          city: server?.location?.city,
          country: server?.location?.country,
          machine: server?.machine,
        };
      },
    });
  }
  return cachedUrlPromise;
}

/** Call at the start of each fresh diagnostic run so it can pick a new server. */
export function resetSpeedTestServer(): void {
  cachedUrlPromise = null;
  cachedServerInfo = null;
}

export function getLastTestServerLabel(): string | null {
  if (!cachedServerInfo) return null;
  const { city, country, machine } = cachedServerInfo;
  return city ? `${city}${country ? `, ${country}` : ""}` : machine ?? null;
}

async function runPhase(kind: "download" | "upload", onProgress?: (mbps: number) => void): Promise<number> {
  const state: { lastLiveMbps: number; finalMeasurement: { MeanClientMbps?: number } | null; errorMsg: string | null } = {
    lastLiveMbps: 0,
    finalMeasurement: null,
    errorMsg: null,
  };

  const measurementKey = `${kind}Measurement` as const;
  const completeKey = `${kind}Complete` as const;

  const callbacks: Record<string, any> = {
    error: (msg: string) => {
      state.errorMsg = msg;
    },
    [measurementKey]: ({ Source, Data }: { Source: string; Data: any }) => {
      if (Source === "client" && Data && typeof Data.MeanClientMbps === "number") {
        state.lastLiveMbps = Data.MeanClientMbps;
        onProgress?.(state.lastLiveMbps);
      }
    },
    [completeKey]: ({ LastClientMeasurement }: { LastClientMeasurement: any }) => {
      state.finalMeasurement = LastClientMeasurement ?? null;
    },
  };

  const urlPromise = getServerUrls();
  const testFn = kind === "download" ? ndt7.downloadTest : ndt7.uploadTest;
  const code = await testFn(NDT7_CONFIG, callbacks, urlPromise);

  const label = kind === "download" ? "Download" : "Upload";

  if (code !== 0) {
    console.error(`NetPulse: NDT7 ${kind} test failed (code ${code})${state.errorMsg ? ` - ${state.errorMsg}` : ""}`);
    throw new Error(`${label} test failed${state.errorMsg ? `: ${state.errorMsg}` : ""} - open the browser console for details`);
  }

  const mbps = state.finalMeasurement?.MeanClientMbps ?? (state.lastLiveMbps > 0 ? state.lastLiveMbps : null);
  if (mbps === null || !Number.isFinite(mbps)) {
    console.error(`NetPulse: NDT7 ${kind} test completed with no usable measurement`, state.finalMeasurement);
    throw new Error(`${label} test completed but returned no measurement - open the browser console for details`);
  }
  return mbps;
}

export async function measureDownload(opts: SpeedTestOptions = {}): Promise<number> {
  return runPhase("download", opts.onProgress);
}

export async function measureUpload(opts: SpeedTestOptions = {}): Promise<number> {
  return runPhase("upload", opts.onProgress);
}

// Public IP/ASN/location still comes from Cloudflare's meta endpoint - a plain
// GET with no custom headers, same as the download call that always worked
// fine, and unrelated to the upload bug above.
export async function fetchPublicMeta(): Promise<{ ip: string | null; city: string | null; country: string | null; asn: string | null; colo: string | null }> {
  try {
    const res = await fetch("https://speed.cloudflare.com/meta", { cache: "no-store" });
    const data = await res.json();
    return {
      ip: data.clientIp ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      asn: data.asn ? String(data.asn) : null,
      colo: data.colo ?? null,
    };
  } catch {
    return { ip: null, city: null, country: null, asn: null, colo: null };
  }
}
