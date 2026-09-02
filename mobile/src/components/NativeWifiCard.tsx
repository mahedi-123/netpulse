import { useEffect, useState } from "react";
import { Wifi, MapPin } from "lucide-react";
import { Card } from "./Shared";
import {
  isNativeApp,
  getNativeWifiInfo,
  hasLocationPermission,
  requestLocationPermission,
  describeBand,
  describeSignal,
  type NativeWifiInfo,
} from "../nativeBridge";

/**
 * Renders nothing outside the Android app - a browser has no way to read any of
 * this, so in PWA mode the card simply doesn't exist rather than showing blanks.
 */
export function NativeWifiCard() {
  const [info, setInfo] = useState<NativeWifiInfo | null>(() => getNativeWifiInfo());
  const [canReadSsid, setCanReadSsid] = useState(() => hasLocationPermission());

  useEffect(() => {
    if (!isNativeApp()) return;
    const refresh = () => {
      setInfo(getNativeWifiInfo());
      setCanReadSsid(hasLocationPermission());
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!isNativeApp() || !info) return null;

  if (!info.connected || info.networkType !== "wifi") {
    return (
      <Card title="Wi-Fi Signal">
        <div className="empty">
          Not connected to Wi-Fi{info.networkType === "cellular" ? " — currently on mobile data." : "."}
        </div>
      </Card>
    );
  }

  const signal = describeSignal(info.rssi);
  const band = describeBand(info.frequencyMhz);

  return (
    <Card title="Wi-Fi Signal">
      {signal && (
        <div className="metric-row">
          <span className="metric-label">
            Signal strength
            {info.rssi !== null && <div className="metric-sub">{info.rssi} dBm</div>}
          </span>
          <span className={`metric-value ${signal.tone}`}>{signal.label}</span>
        </div>
      )}

      {info.linkSpeedMbps !== null && (
        <div className="metric-row">
          <span className="metric-label">
            Link speed
            <div className="metric-sub">radio rate, not internet speed</div>
          </span>
          <span className="metric-value">{info.linkSpeedMbps} Mbps</span>
        </div>
      )}

      {band && (
        <div className="metric-row">
          <span className="metric-label">Band</span>
          <span className="metric-value">{band}</span>
        </div>
      )}

      {info.ssid ? (
        <div className="metric-row">
          <span className="metric-label">Network</span>
          <span className="metric-value" style={{ fontSize: 13 }}>
            {info.ssid}
          </span>
        </div>
      ) : (
        !canReadSsid && (
          <>
            <div className="notice">
              Android only reveals the Wi-Fi network name to apps with location permission. Everything above works without
              it — this is optional.
            </div>
            <button className="btn btn-full" style={{ marginTop: 10 }} onClick={requestLocationPermission}>
              <MapPin size={14} />
              Allow, to show network name
            </button>
          </>
        )
      )}

      {info.metered && (
        <div className="metric-row">
          <span className="metric-label">Metered network</span>
          <span className="metric-value warn">Yes</span>
        </div>
      )}

      {info.linkSpeedMbps !== null && band === "2.4 GHz" && (
        <div className="notice">
          You're on the 2.4 GHz band. It reaches further but is slower and more congested — if your router also broadcasts
          5 GHz, switching to it usually improves speed and latency noticeably.
        </div>
      )}
    </Card>
  );
}
