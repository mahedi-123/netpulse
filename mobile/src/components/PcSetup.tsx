import { useState } from "react";
import { Monitor, Check, X } from "lucide-react";
import { Card } from "./Shared";
import { setPcAddress, testPcAddress, getPcAddress } from "../api";

interface Props {
  onConnected: () => void;
}

export function PcSetup({ onConnected }: Props) {
  const [address, setAddress] = useState(() => getPcAddress() ?? "");
  const [testing, setTesting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function connect() {
    setTesting(true);
    setFailed(false);
    const ok = await testPcAddress(address);
    setTesting(false);
    if (ok) {
      setPcAddress(address);
      onConnected();
    } else {
      setFailed(true);
    }
  }

  return (
    <Card title="Connect to your PC">
      <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
        <Monitor size={26} style={{ color: "var(--accent)" }} />
      </div>

      <div style={{ fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
        Start NetPulse on your PC. It prints an address in the terminal — enter the IP part here.
      </div>

      <input
        className="form-input"
        value={address}
        onChange={(e) => {
          setAddress(e.target.value);
          setFailed(false);
        }}
        placeholder="192.168.1.42"
        inputMode="decimal"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onKeyDown={(e) => e.key === "Enter" && connect()}
      />
      <div className="form-hint">Port 4001 is assumed unless you add one.</div>

      {failed && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          <strong>Couldn't reach it.</strong> Check that the PC is running <code>npm start</code>, that this phone is on the
          same Wi-Fi (not mobile data), and that Windows Firewall allows Node.js on private networks.
        </div>
      )}

      <button className="btn btn-full" style={{ marginTop: 14 }} onClick={connect} disabled={testing || !address.trim()}>
        {testing ? (
          "Checking…"
        ) : failed ? (
          <>
            <X size={15} /> Try again
          </>
        ) : (
          <>
            <Check size={15} /> Connect
          </>
        )}
      </button>
    </Card>
  );
}
