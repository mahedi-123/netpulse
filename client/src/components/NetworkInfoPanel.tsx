import type { SystemInfo, PublicMeta } from "../types";

interface NetworkInfoPanelProps {
  info: SystemInfo | null;
  meta: PublicMeta | null;
}

export function NetworkInfoPanel({ info, meta }: NetworkInfoPanelProps) {
  return (
    <div className="card">
      <h3 className="card-title">Network Info</h3>

      {info?.adapters && info.adapters.length > 0 && (
        <>
          {info.adapters.map((a) => (
            <div className="info-row" key={a.name}>
              <span className="info-label">{a.name}</span>
              <span className="info-value">{a.linkSpeed ?? "unknown"}</span>
            </div>
          ))}
        </>
      )}

      <div className="info-row">
        <span className="info-label">Local IP</span>
        <span className="info-value">{info?.interfaces?.[0]?.address ?? "—"}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Gateway</span>
        <span className="info-value">{info?.gateway ?? "—"}</span>
      </div>
      <div className="info-row">
        <span className="info-label">DNS servers</span>
        <span className="info-value">{info?.dnsServers?.length ? info.dnsServers.join(", ") : "—"}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Public IP</span>
        <span className="info-value">{meta?.ip ?? "—"}</span>
      </div>
      <div className="info-row">
        <span className="info-label">Location</span>
        <span className="info-value">{meta?.city ? `${meta.city}, ${meta.country ?? ""}` : "—"}</span>
      </div>
      <div className="info-row">
        <span className="info-label">ASN</span>
        <span className="info-value">{meta?.asn ?? "—"}</span>
      </div>
    </div>
  );
}
