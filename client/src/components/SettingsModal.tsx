import { useState } from "react";
import { X } from "lucide-react";

interface SettingsModalProps {
  initialInterval: number;
  initialExpectedDown: number | null;
  initialExpectedUp: number | null;
  onSave: (values: { monitorIntervalMinutes: number; expectedDownloadMbps: number | null; expectedUploadMbps: number | null }) => void;
  onClose: () => void;
}

export function SettingsModal({ initialInterval, initialExpectedDown, initialExpectedUp, onSave, onClose }: SettingsModalProps) {
  const [interval, setInterval_] = useState(String(initialInterval));
  const [expectedDown, setExpectedDown] = useState(initialExpectedDown !== null ? String(initialExpectedDown) : "");
  const [expectedUp, setExpectedUp] = useState(initialExpectedUp !== null ? String(initialExpectedUp) : "");

  function handleSave() {
    onSave({
      monitorIntervalMinutes: Math.max(1, parseInt(interval, 10) || 5),
      expectedDownloadMbps: expectedDown ? parseFloat(expectedDown) : null,
      expectedUploadMbps: expectedUp ? parseFloat(expectedUp) : null,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Settings</span>
          <button className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Background monitor interval (minutes)</label>
          <input className="form-input" type="number" min={1} value={interval} onChange={(e) => setInterval_(e.target.value)} />
          <div className="form-hint">How often NetPulse pings your gateway and public DNS in the background to track uptime and catch outages.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Your plan's download speed (Mbps, optional)</label>
          <input className="form-input" type="number" value={expectedDown} onChange={(e) => setExpectedDown(e.target.value)} placeholder="e.g. 100" />
          <div className="form-hint">If set, the health score checks measured speed against this instead of ignoring speed entirely.</div>
        </div>

        <div className="form-group">
          <label className="form-label">Your plan's upload speed (Mbps, optional)</label>
          <input className="form-input" type="number" value={expectedUp} onChange={(e) => setExpectedUp(e.target.value)} placeholder="e.g. 20" />
        </div>

        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 6 }} onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
