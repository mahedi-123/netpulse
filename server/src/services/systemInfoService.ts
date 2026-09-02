import os from "node:os";
import fs from "node:fs/promises";
import { execAsync, isWindows, runPowerShell } from "../utils/platform.js";
import type { AdapterInfo, SystemInfo } from "../types.js";

export function getLocalInterfaces(): { name: string; address: string }[] {
  const nets = os.networkInterfaces();
  const result: { name: string; address: string }[] = [];
  for (const [name, addrs] of Object.entries(nets)) {
    for (const addr of addrs ?? []) {
      if (!addr.internal && addr.family === "IPv4") {
        result.push({ name, address: addr.address });
      }
    }
  }
  return result;
}

/**
 * Detects the default gateway via the OS route table. Uses PowerShell's structured
 * Get-NetRoute on Windows and `ip route` on Unix, rather than a third-party package,
 * so behavior stays predictable and Mahedi can run the exact same commands himself
 * to sanity-check the output.
 */
export async function getDefaultGateway(): Promise<string | null> {
  try {
    if (isWindows) {
      const out = await runPowerShell(
        "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object -Property RouteMetric | Select-Object -First 1 -ExpandProperty NextHop)"
      );
      return out && out !== "0.0.0.0" ? out : null;
    }
    const { stdout } = await execAsync("ip route show default");
    const match = stdout.match(/default via ([\d.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function getWindowsAdapters(): Promise<AdapterInfo[]> {
  if (!isWindows) return [];
  try {
    const out = await runPowerShell(
      "Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name,InterfaceDescription,LinkSpeed,MacAddress,Status | ConvertTo-Json -Compress"
    );
    if (!out) return [];
    const parsed = JSON.parse(out);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((a: any) => ({
      name: a.Name ?? "Unknown",
      description: a.InterfaceDescription ?? "",
      linkSpeed: a.LinkSpeed ?? null,
      macAddress: a.MacAddress ?? null,
      status: a.Status ?? "Unknown",
    }));
  } catch {
    return [];
  }
}

export async function getDnsServers(): Promise<string[]> {
  try {
    if (isWindows) {
      const out = await runPowerShell(
        "Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ServerAddresses | ConvertTo-Json -Compress"
      );
      if (!out) return [];
      const parsed = JSON.parse(out);
      const list: string[] = Array.isArray(parsed) ? parsed : [parsed];
      return [...new Set(list.filter(Boolean))];
    }
    const content = await fs.readFile("/etc/resolv.conf", "utf-8");
    return content
      .split("\n")
      .filter((l) => l.trim().startsWith("nameserver"))
      .map((l) => l.trim().split(/\s+/)[1])
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const [interfaces, adapters, gateway, dnsServers] = await Promise.all([
    Promise.resolve(getLocalInterfaces()),
    getWindowsAdapters(),
    getDefaultGateway(),
    getDnsServers(),
  ]);

  return {
    interfaces,
    adapters,
    gateway,
    dnsServers,
    platform: `${os.type()} ${os.release()}`,
    hostname: os.hostname(),
  };
}
