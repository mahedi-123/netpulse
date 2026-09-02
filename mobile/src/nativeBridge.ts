// Bridge to the native Android layer.
//
// When this web app runs inside the NetPulse APK, MainActivity injects a
// `AndroidNet` object into the page via @JavascriptInterface. That gives access
// to things no browser can reach: WiFi signal strength (RSSI), the negotiated
// link speed, the frequency band, and the SSID.
//
// When running as a normal PWA in a browser, `window.AndroidNet` is simply
// absent and every function here degrades to null / false. Nothing else in the
// app needs to know which environment it's in.

export interface NativeWifiInfo {
  connected: boolean;
  /** Received signal strength in dBm. Closer to 0 is stronger; -50 great, -80 poor. */
  rssi: number | null;
  /** Android's own 0-4 bucketing of signal strength. */
  signalLevel: number | null;
  /** Negotiated link speed in Mbps - the WiFi radio rate, NOT your internet speed. */
  linkSpeedMbps: number | null;
  frequencyMhz: number | null;
  /** null unless the user granted location permission (an Android requirement for SSID). */
  ssid: string | null;
  /** "wifi" | "cellular" | "ethernet" | "none" | "other" */
  networkType: string | null;
  /** True when Android reports the network is metered (e.g. a hotspot or mobile data). */
  metered: boolean | null;
}

interface AndroidNetBridge {
  getWifiInfo: () => string;
  requestLocationPermission?: () => void;
  hasLocationPermission?: () => boolean;
  getAppVersion?: () => string;
}

function bridge(): AndroidNetBridge | null {
  const w = window as unknown as { AndroidNet?: AndroidNetBridge };
  return w.AndroidNet ?? null;
}

/** True when running inside the Android app rather than a browser. */
export function isNativeApp(): boolean {
  return bridge() !== null;
}

export function getNativeWifiInfo(): NativeWifiInfo | null {
  const b = bridge();
  if (!b) return null;
  try {
    const parsed = JSON.parse(b.getWifiInfo());
    return {
      connected: !!parsed.connected,
      rssi: typeof parsed.rssi === "number" ? parsed.rssi : null,
      signalLevel: typeof parsed.signalLevel === "number" ? parsed.signalLevel : null,
      linkSpeedMbps: typeof parsed.linkSpeedMbps === "number" && parsed.linkSpeedMbps > 0 ? parsed.linkSpeedMbps : null,
      frequencyMhz: typeof parsed.frequencyMhz === "number" && parsed.frequencyMhz > 0 ? parsed.frequencyMhz : null,
      ssid: parsed.ssid && parsed.ssid !== "<unknown ssid>" ? parsed.ssid : null,
      networkType: parsed.networkType ?? null,
      metered: typeof parsed.metered === "boolean" ? parsed.metered : null,
    };
  } catch {
    return null;
  }
}

export function hasLocationPermission(): boolean {
  try {
    return bridge()?.hasLocationPermission?.() ?? false;
  } catch {
    return false;
  }
}

/** Triggers the Android runtime permission prompt (needed only to read the SSID). */
export function requestLocationPermission(): void {
  try {
    bridge()?.requestLocationPermission?.();
  } catch {
    // no-op in browsers
  }
}

/** Human-readable band from the WiFi frequency. */
export function describeBand(frequencyMhz: number | null): string | null {
  if (frequencyMhz === null) return null;
  if (frequencyMhz >= 2400 && frequencyMhz < 2500) return "2.4 GHz";
  if (frequencyMhz >= 4900 && frequencyMhz < 5900) return "5 GHz";
  if (frequencyMhz >= 5900 && frequencyMhz < 7200) return "6 GHz";
  return `${(frequencyMhz / 1000).toFixed(1)} GHz`;
}

/**
 * Plain-language reading of RSSI. These bands are the widely used rule of thumb
 * for 2.4/5 GHz WiFi: about -50 dBm or better is excellent, -70 is where things
 * start to degrade, and below -80 is usually unusable.
 */
export function describeSignal(rssi: number | null): { label: string; tone: "good" | "warn" | "bad" } | null {
  if (rssi === null) return null;
  if (rssi >= -55) return { label: "Excellent", tone: "good" };
  if (rssi >= -67) return { label: "Good", tone: "good" };
  if (rssi >= -75) return { label: "Fair", tone: "warn" };
  return { label: "Weak", tone: "bad" };
}
