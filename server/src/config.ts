interface PingTarget {
  target: string;
  label: string;
}

interface DnsResolverConfig {
  name: string;
  servers: string[] | null;
}

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4001,

  // Targets pinged for latency/jitter/packet-loss and background monitoring.
  // Gateway is resolved dynamically at startup and prepended to this list.
  PUBLIC_PING_TARGETS: [
    { target: "1.1.1.1", label: "Cloudflare DNS" },
    { target: "8.8.8.8", label: "Google DNS" },
  ] as PingTarget[],

  DNS_TEST_DOMAINS: ["google.com", "cloudflare.com", "github.com", "wikipedia.org"],
  DNS_RESOLVERS: [
    { name: "System Default", servers: null },
    { name: "Cloudflare (1.1.1.1)", servers: ["1.1.1.1"] },
    { name: "Google (8.8.8.8)", servers: ["8.8.8.8"] },
  ] as DnsResolverConfig[],

  DEFAULT_MONITOR_INTERVAL_MINUTES: 5,
  MONITOR_PING_COUNT: 3,
  OUTAGE_FAILURE_THRESHOLD: 2, // consecutive failed monitor ticks before declaring an outage

  LOADED_PING_INTERVAL_MS: 200,

  BUFFERBLOAT_THRESHOLDS_MS: { A: 5, B: 30, C: 60, D: 200 },
};
