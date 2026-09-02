import dns from "node:dns";
import { performance } from "node:perf_hooks";
import { CONFIG } from "../config.js";
import type { DnsResult, DnsResolverSummary } from "../types.js";

function resolveDomain(domain: string, servers: string[] | null): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val: number | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    const timeout = setTimeout(() => done(null), 3000);
    const start = performance.now();

    try {
      if (servers) {
        const resolver = new dns.Resolver();
        resolver.setServers(servers);
        resolver.resolve4(domain, (err) => {
          clearTimeout(timeout);
          done(err ? null : performance.now() - start);
        });
      } else {
        dns.resolve4(domain, (err) => {
          clearTimeout(timeout);
          done(err ? null : performance.now() - start);
        });
      }
    } catch {
      clearTimeout(timeout);
      done(null);
    }
  });
}

export async function runDnsHealthCheck(): Promise<DnsResult[]> {
  const results: DnsResult[] = [];
  for (const resolver of CONFIG.DNS_RESOLVERS) {
    for (const domain of CONFIG.DNS_TEST_DOMAINS) {
      const ms = await resolveDomain(domain, resolver.servers);
      results.push({ resolver: resolver.name, domain, ms, success: ms !== null });
    }
  }
  return results;
}

export function summarizeDnsResults(results: DnsResult[]): DnsResolverSummary[] {
  const byResolver = new Map<string, number[]>();
  const totals = new Map<string, number>();

  for (const r of results) {
    totals.set(r.resolver, (totals.get(r.resolver) ?? 0) + 1);
    if (r.success && r.ms !== null) {
      if (!byResolver.has(r.resolver)) byResolver.set(r.resolver, []);
      byResolver.get(r.resolver)!.push(r.ms);
    }
  }

  return CONFIG.DNS_RESOLVERS.map(({ name }) => {
    const times = byResolver.get(name) ?? [];
    return {
      resolver: name,
      avgMs: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
      successCount: times.length,
      totalCount: totals.get(name) ?? 0,
    };
  });
}
