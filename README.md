# NetPulse

A local diagnostic system for your ethernet/broadband connection, with a companion mobile app: real speed testing, ICMP latency and jitter, packet loss, bufferbloat detection, DNS resolver health, route tracing, NIC link-speed detection, and continuous background monitoring with outage logging — all running on your own machine, with results stored locally.

It's not a wrapper around a single "run speedtest.net" call. It's built to answer the question **"why does my connection feel bad?"**, not just "how many Mbps do I have?"

---

## Why it's built the way it is

A few things (ICMP ping, traceroute, DNS-resolver selection, network adapter link speed) simply cannot be done from inside a browser sandbox — they need real OS-level access. So NetPulse is a small full-stack app:

- **Backend** (Node.js/TypeScript, `server/`) — does everything that needs the OS: spawns `ping`/`tracert`, queries `Get-NetAdapter`/`Get-NetRoute` via PowerShell on Windows for real NIC link speed and gateway/DNS info, resolves DNS against specific resolvers, stores history in SQLite, runs a background monitor, and computes the health score.
- **Frontend** (React/TypeScript/Vite, `client/`) — runs the actual speed test **in your browser**, because that's the most accurate way to measure what your applications actually experience: browser → ethernet → ISP → internet. It uses Cloudflare's public speed-test infrastructure (the same endpoints speed.cloudflare.com itself uses), with parallel connections and a time-boxed measurement window, the same general approach commercial speed tests use.
- The two coordinate over a small REST API and a WebSocket: while your browser is pushing data through the download/upload test, the backend is simultaneously firing ICMP pings every 200ms at your router to catch **bufferbloat** — the latency spike that happens when your connection is saturated. That comparison (idle latency vs. latency-under-load) is something almost no basic speed test shows you, and it's often the actual cause of "my internet feels laggy during downloads."

## Features

- **Full diagnostic run** (~20s): parallel-stream download/upload speed test, idle latency/jitter/packet loss, and loaded latency during both download and upload to grade bufferbloat A–F
- **Composite health score** (0–100, A–F) with a transparent per-category breakdown and specific, plain-English insights — not just a number
- **DNS resolver comparison**: your system default vs. Cloudflare (1.1.1.1) vs. Google (8.8.8.8), so you can see if switching resolvers would help
- **Route tracing** with per-hop latency
- **Network adapter info**: real NIC link speed (e.g. catches a cable/port negotiating at 100 Mbps instead of Gigabit — a wired-specific issue no cloud-based speed test can see), gateway, DNS servers, public IP/ASN
- **Continuous background monitoring**: pings your gateway + public DNS every few minutes (configurable) even when the dashboard is closed, logs history, and detects outages automatically
- **History charts** (24h / 7d / 30d) for speed and latency trends, plus a JSON export
- **Local storage only** — SQLite database on your machine, nothing sent anywhere except the diagnostic traffic itself (to Cloudflare's speed-test endpoints, same as visiting speed.cloudflare.com)


## Mobile app (Android)

NetPulse includes an installable mobile app that does two things:

- **This Phone** — tests your phone's own Wi-Fi or cellular connection: download/upload speed (same NDT7 engine as the desktop app), round-trip latency, jitter, bufferbloat, and connection type, with its own health score.
- **My PC** — a live view of your PC's ethernet dashboard: current latency, last speed test, adapter link speed, and outage log.

### How to install it on your phone

1. Start NetPulse on your PC as usual (`npm start`). The terminal prints a second URL, something like:
   ```
   On your phone (same Wi-Fi) → http://192.168.1.42:4001/m
   ```
2. Make sure your phone is on **the same Wi-Fi network** as the PC, then open that URL in Chrome.
3. Tap the **⋮ menu → "Add to Home screen"** (or "Install app"). It then launches fullscreen with its own icon, like a normal app.

Once installed, "This Phone" works anywhere — including on cellular, away from home. "My PC" only works when you're on the same network as your PC and it's running.

### Two ways to install

**As a PWA (no build needed):** open the URL above in Chrome and use "Add to Home screen". It installs in two taps, updates automatically whenever you rebuild on the PC, and needs no Android tooling at all. Good if you just want it working now.

**As a real APK:** gives you a genuine installed app plus native Wi-Fi diagnostics a browser can't reach (see below). Takes one extra build step.

### Getting an actual APK

The Android project lives in `android/`. There are two ways to turn it into an installable APK — **neither needs you to write any code**.

#### Option A — let GitHub build it (no Android Studio, ~5 minutes)

This is the easier path. GitHub's build machines already have the Android SDK installed, so they do the work.

1. Push this project to a GitHub repository (it can be private).
2. Open the repo's **Actions** tab. A workflow called **"Build Android APK"** runs automatically on push — or click **Run workflow** to start it manually.
3. When it finishes (a green tick, roughly 3–6 minutes), click into the run and download the **`netpulse-apk`** artifact from the Artifacts section at the bottom.
4. Unzip it, transfer `netpulse.apk` to your phone, and open it. Android will ask you to allow installing from unknown sources — that's expected for any app not from the Play Store.

The workflow is at `.github/workflows/build-android.yml`. It builds the web assets, verifies they landed, then runs Gradle.

#### Option B — build locally with Android Studio

1. Install [Android Studio](https://developer.android.com/studio).
2. In the `mobile/` folder, run `npm install && npm run build:app` — this compiles the web app into `android/app/src/main/assets/www`, which the APK bundles. **The Android build will fail without this step.**
3. Open the `android/` folder in Android Studio (open the folder itself, not the project root). Let it sync Gradle — first sync downloads dependencies and takes a few minutes.
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**, then click "locate" to find `app/build/outputs/apk/debug/app-debug.apk`.

Or from a terminal with the Android SDK configured: `cd android && gradle assembleDebug`.

### What the APK does that the PWA can't

Wrapping the web app in a native shell isn't just packaging — the app gets a JavaScript bridge to Android's networking APIs, so **"This Phone" gains a Wi-Fi Signal card** showing:

- **Signal strength** in dBm, with a plain-language rating (about -55 or better is excellent; below -75 is weak)
- **Negotiated link speed** — the Wi-Fi radio rate, which is separate from your internet speed and reveals when your phone has fallen back to a slow rate
- **Frequency band** (2.4 / 5 / 6 GHz), including a nudge to switch to 5 GHz when you're on the slower, more congested 2.4 GHz band
- **Network name (SSID)** — optional, and only if you grant location permission, because Android requires it for SSID access specifically. Everything else works without it.

These are genuinely unavailable to any browser, which is the main reason the native build is worth the extra step.

### APK vs. PWA: what changes

In the APK, the app's files are bundled inside the app rather than served by your PC, so "My PC" mode can no longer assume they're on the same machine. The first time you open that tab it asks for your PC's address (the IP from the terminal — port 4001 is assumed). It's stored on the phone; you can change it later from the same screen if it can't connect.

### What the phone can't measure (and why)

Browsers cannot send ICMP echo requests — there's no API for it at any permission level. So where the desktop app reports true `ping` times, the mobile app measures **HTTP round-trip time** instead: the full time to complete a tiny HTTPS request. That includes TLS session handling and browser scheduling, so it reads **higher** than an ICMP ping to the same host, typically by a few ms to a few tens of ms.

This means the two numbers aren't interchangeable, and the app labels them differently so they're never silently compared. HTTP RTT is still genuinely useful for jitter (variance is meaningful regardless of the floor), for bufferbloat (idle vs. under-load comparison), and for tracking your phone's connection over time.

Packet loss is not reported on mobile for the same reason — a browser can't observe it directly, and a made-up proxy would be guesswork presented as a measurement. Failed requests are surfaced as a "Stability" score instead.

## Requirements

- **Windows 10/11** (primary target — uses PowerShell for adapter/route/DNS info; also works on macOS/Linux with reduced adapter detail)
- **Node.js 18.18+** — check with `node -v`. Get it from [nodejs.org](https://nodejs.org) if needed.

## Setup

Unzip the project, open a terminal (PowerShell or cmd) in the `netpulse` folder, then:

```
npm run setup
npm start
```

That's it. `npm start` runs the backend (port 4001) and frontend (port 5173) together. Open **http://localhost:5173** in your browser.

The first time you start it, **Windows Firewall may prompt you to allow Node.js to accept network connections** — click Allow (this is just the local backend server binding to a port; nothing leaves your machine except the actual diagnostic traffic).

Press `Ctrl+C` in the terminal to stop both processes.

### If something goes wrong during setup

- **`better-sqlite3` fails to install**: this package ships prebuilt binaries for Windows, so `npm install` normally just downloads one — no compiler needed. If it still fails, it's usually a flaky network blip; re-run `npm run setup`. As a last resort, installing the current Node.js LTS from nodejs.org (rather than a very new/pre-release version) resolves most prebuild-availability issues.
- **Port already in use**: something else is using 4001 or 5173. Change the backend port by setting `PORT` in `server/package.json`'s `start` script (e.g. `set PORT=4002 && tsx src/index.ts` on Windows), and update `client/vite.config.ts`'s proxy target to match.
- **PowerShell-related errors in Network Info**: NetPulse calls `Get-NetAdapter`, `Get-NetRoute`, and `Get-DnsClientServerAddress` via PowerShell. These are read-only, standard Windows cmdlets and shouldn't need elevated permissions — but if your system has a restrictive PowerShell execution policy, adapter/gateway detection will silently fall back to "unknown" rather than crashing the app. You can sanity-check any of these by running them yourself in PowerShell.
- **Phone can't load the app**: confirm the phone is on the same Wi-Fi (not cellular), and that you used the LAN IP the server printed, not `localhost`. Windows Firewall may also need to allow Node.js on **Private networks** specifically — if the desktop app works but the phone can't connect, that's the usual cause.
- **"Add to Home screen" doesn't appear**: use Chrome (not a lightweight/in-app browser), and give the page a moment to register its service worker. The app still works fine as a normal browser tab if you skip installing.
- **Download/upload test fails**: open DevTools (F12) → Network tab, re-run the diagnostic, and look for a WebSocket connection to a `measurementlab.net` (or similarly named) host. If it shows as failed/red, check the Console tab for the exact error — a corporate firewall, VPN, or strict router-level filtering that blocks outbound WebSocket to unfamiliar hosts is the most likely cause in that case, and would need an allowance on that network rather than a code fix.

## How the health score works

Score starts at 100 and loses points across five weighted categories:

| Category | Max points | Based on |
|---|---|---|
| Latency | 25 | Idle ping to your gateway/public DNS |
| Jitter | 20 | Variation between consecutive ping samples |
| Packet loss | 25 | % of pings that got no reply |
| Bufferbloat | 20 | How much latency increases while downloading/uploading |
| Speed vs. plan | 10 | Only scored if you set your plan speed in Settings |

The breakdown is shown in the app so it's never a black box — you can see exactly which category is dragging the score down. Insight text is specific to what's actually wrong (e.g. it'll tell you to try a different ethernet cable for packet loss, or suggest enabling QoS/SQM for bufferbloat) rather than generic advice.

**Bufferbloat grading** (increase in latency under load): A < 5ms, B < 30ms, C < 60ms, D < 200ms, F ≥ 200ms — in the same spirit as tools like Waveform's bufferbloat test, though the exact thresholds are NetPulse's own and not an official standard.

## Project structure

```
netpulse/
├── server/                  Backend — OS-level diagnostics, also serves the mobile app
│   ├── src/
│   │   ├── services/        ping, DNS, traceroute, system info, bufferbloat, health score, monitor
│   │   ├── db/              SQLite schema + queries
│   │   ├── routes/          REST API
│   │   └── ws/              WebSocket for live data
│   └── public/m/            Built mobile app (generated by `npm run build:mobile`)
├── client/                  Desktop dashboard
│   └── src/
│       ├── speedTest.ts     NDT7 speed measurement
│       ├── components/      Dashboard cards, charts, traceroute view, settings
│       └── App.tsx          Test orchestration + layout
├── mobile/                  Mobile app source (shared by the PWA and the APK)
│   ├── public/              Manifest, service worker, icons, NDT7 workers
│   └── src/
│       ├── phoneDiagnostics.ts  HTTP latency/jitter, connection type, bufferbloat probe
│       ├── nativeBridge.ts      Talks to Android's Wi-Fi APIs when running as an APK
│       ├── healthScore.ts       Phone-specific scoring (different thresholds than PC)
│       └── components/          PhoneMode + PcMode + Wi-Fi card + PC setup
├── android/                 Native Android project (WebView shell + Wi-Fi bridge)
│   └── app/src/main/
│       ├── java/.../MainActivity.java   WebView host + JavaScript bridge
│       ├── assets/www/                  Web assets (generated by `npm run build:app`)
│       └── res/                         Icons, theme, network security config
├── .github/workflows/       CI that builds the APK for you
└── package.json             Root scripts (setup / start / build:mobile)
```

## Notes on methodology

- **Ping** shells out to the OS's native `ping` binary rather than opening a raw ICMP socket, because raw sockets need admin rights on Windows — this way it works for any user, identically to running `ping` yourself in a terminal.
- **Jitter** is computed as the mean absolute difference between consecutive successful RTT samples.
- **Speed test** uses [NDT7](https://www.measurementlab.net/blog/ndt7-introduction/), the open measurement protocol from Measurement Lab (M-Lab) — the same non-profit infrastructure behind Google's built-in "internet speed test" search widget. It runs over WebSocket for both directions, using M-Lab's official `@m-lab/ndt7` client library. An earlier version of NetPulse used Cloudflare's `speed.cloudflare.com` `__down`/`__up` endpoints directly; those are undocumented internals of Cloudflare's own product rather than a published API, and turned out to have inconsistent CORS behavior for third-party origins (confirmed via Cloudflare's own issue tracker) that broke the upload measurement specifically. NDT7 doesn't have that failure mode, since WebSocket handshakes aren't subject to the same CORS preflight/response-header restrictions as `fetch`/XHR.
  - **Worth knowing:** M-Lab publishes test results — including client IP, ASN, and performance metrics — as open data for network research. That's a different tradeoff than Cloudflare's private commercial infrastructure. See [measurementlab.net/data-policy](https://www.measurementlab.net/data-policy/) for what that covers.
- **Default gateway / adapter / DNS server detection** uses the same PowerShell cmdlets (`Get-NetRoute`, `Get-NetAdapter`, `Get-DnsClientServerAddress`) you could run yourself — no third-party network-info dependency, so behavior stays predictable and debuggable.
- **Public IP/ASN/location** still comes from Cloudflare's `/meta` endpoint — a plain GET with no custom headers, structurally the same kind of request that always worked fine, and unrelated to the upload issue above.

## Possible future additions

Not built in this version, but natural next steps: desktop notifications on outage, a printable/PDF report export, IPv6 diagnostics, and multi-adapter comparison (ethernet vs. Wi-Fi side by side).
