import { useState, useEffect } from "react";
import { Activity, Smartphone, Monitor } from "lucide-react";
import { PhoneMode } from "./components/PhoneMode";
import { PcMode } from "./components/PcMode";
import { getConnectionInfo, onConnectionChange } from "./phoneDiagnostics";

type Tab = "phone" | "pc";

const TAB_KEY = "netpulse-mobile-tab";

export default function App() {
  // Remembering the tab makes the PWA feel app-like across launches.
  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem(TAB_KEY) as Tab) || "phone");
  const [online, setOnline] = useState(() => getConnectionInfo().online);

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab);
  }, [tab]);

  useEffect(() => onConnectionChange(() => setOnline(getConnectionInfo().online)), []);

  return (
    <>
      <div className="app">
        <div className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Activity size={17} strokeWidth={2.25} />
            </div>
            <div>
              <div className="brand-title">NetPulse</div>
              <div className="brand-sub">{tab === "phone" ? "This Phone" : "My PC"}</div>
            </div>
          </div>
          <span className="conn-chip">
            <span className={`dot ${online ? "live" : "bad"}`} />
            {online ? "Online" : "Offline"}
          </span>
        </div>

        {tab === "phone" ? <PhoneMode /> : <PcMode />}

        <div className="footer-note">
          {tab === "phone"
            ? "Speed measured via NDT7 from Measurement Lab, which publishes results as open data for network research (measurementlab.net/data-policy)."
            : "Live view of the NetPulse dashboard running on your PC over your local network."}
        </div>
      </div>

      <nav className="tabbar">
        <button className={`tab ${tab === "phone" ? "active" : ""}`} onClick={() => setTab("phone")}>
          <Smartphone size={19} />
          This Phone
        </button>
        <button className={`tab ${tab === "pc" ? "active" : ""}`} onClick={() => setTab("pc")}>
          <Monitor size={19} />
          My PC
        </button>
      </nav>
    </>
  );
}
