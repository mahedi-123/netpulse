import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { setupWebSocket } from "./ws/wsServer.js";
import router from "./routes/index.js";
import { startMonitor } from "./services/monitorService.js";
import { getSetting } from "./db/index.js";
import { getLocalInterfaces } from "./services/systemInfoService.js";
import { CONFIG } from "./config.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", router);
app.get("/api/ping", (_req, res) => res.json({ ok: true, service: "netpulse-server" }));

// ---------------------------------------------------------------------------
// Mobile PWA
//
// The built mobile app is served from this same server at /m, which means the
// phone gets the UI and the API from one origin - no CORS, and no PC IP for the
// user to type into the app. If it can load, the API is reachable by definition.
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = path.resolve(__dirname, "../public/m");
const mobileBuilt = fs.existsSync(path.join(MOBILE_DIR, "index.html"));

if (mobileBuilt) {
  app.use("/m", express.static(MOBILE_DIR));
  // Serve index.html for any /m/* path so a deep link or refresh still works.
  app.get("/m/*", (_req, res) => res.sendFile(path.join(MOBILE_DIR, "index.html")));
} else {
  app.get("/m*", (_req, res) =>
    res
      .status(503)
      .type("html")
      .send(
        `<body style="font-family:system-ui;background:#0f0d0a;color:#f5efe4;padding:32px;line-height:1.6">
           <h2 style="color:#f2a63a">Mobile app not built yet</h2>
           <p>Run this on your PC, then reload:</p>
           <pre style="background:#18140f;padding:14px;border-radius:8px">npm run build:mobile</pre>
         </body>`
      )
  );
}

const httpServer = createServer(app);
setupWebSocket(httpServer);

// Binding 0.0.0.0 (rather than the default) is what lets the phone reach this
// server over the LAN instead of only localhost.
httpServer.listen(CONFIG.PORT, "0.0.0.0", () => {
  console.log(`\n  NetPulse server running → http://localhost:${CONFIG.PORT}`);

  const lanIp = getLocalInterfaces()[0]?.address;
  if (lanIp) {
    console.log(`  On your phone (same Wi-Fi) → http://${lanIp}:${CONFIG.PORT}/m`);
    if (!mobileBuilt) console.log(`    (run "npm run build:mobile" first)`);
  }
  console.log("");

  const savedInterval = getSetting("monitorIntervalMinutes");
  const intervalMinutes = savedInterval ? parseInt(savedInterval, 10) : CONFIG.DEFAULT_MONITOR_INTERVAL_MINUTES;

  startMonitor(intervalMinutes)
    .then(() => console.log(`  Background ping monitor active (every ${intervalMinutes} min)\n`))
    .catch((err) => console.error("  Failed to start monitor:", err));
});

process.on("SIGINT", () => {
  console.log("\n  Shutting down NetPulse server...");
  httpServer.close(() => process.exit(0));
});
