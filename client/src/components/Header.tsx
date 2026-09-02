import { Activity, Settings, Download } from "lucide-react";

interface HeaderProps {
  wsConnected: boolean;
  onOpenSettings: () => void;
  onExport: () => void;
}

export function Header({ wsConnected, onOpenSettings, onExport }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">
          <Activity size={19} strokeWidth={2.25} />
        </div>
        <div>
          <div className="brand-title">NetPulse</div>
          <div className="brand-subtitle">Connection Diagnostics</div>
        </div>
      </div>
      <div className="header-actions">
        <span className="status-pill">
          <span className={`status-dot ${wsConnected ? "live" : ""}`} />
          {wsConnected ? "Monitor live" : "Connecting…"}
        </span>
        <button className="icon-btn" onClick={onExport} title="Export history as JSON">
          <Download size={16} />
        </button>
        <button className="icon-btn" onClick={onOpenSettings} title="Settings">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
