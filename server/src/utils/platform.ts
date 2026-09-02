import { exec } from "node:child_process";
import { promisify } from "node:util";

export const execAsync = promisify(exec);

export const isWindows = process.platform === "win32";
export const isMac = process.platform === "darwin";
export const isLinux = process.platform === "linux";

/**
 * Runs a PowerShell command and returns trimmed stdout.
 * Used for adapter/DNS/route info on Windows, which is far more reliable
 * to parse from structured PowerShell (ConvertTo-Json) than from ipconfig text.
 */
export async function runPowerShell(command: string, timeoutMs = 8000): Promise<string> {
  const { stdout } = await execAsync(`powershell -NoProfile -NonInteractive -Command "${command}"`, {
    timeout: timeoutMs,
    windowsHide: true,
  });
  return stdout.trim();
}
