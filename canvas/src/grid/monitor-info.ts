// Monitor Info - Get screen dimensions via PowerShell

import { spawn } from "child_process";
import type { MonitorInfo } from "./types";

/**
 * Execute a PowerShell command (without VirtualDesktop module)
 */
async function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullScript = `
      $ErrorActionPreference = 'Stop'
      try {
        ${script}
      } catch {
        Write-Error $_.Exception.Message
        exit 1
      }
    `;

    const proc = spawn("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy", "Bypass",
      "-Command", fullScript
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

/**
 * Get information about all monitors
 */
export async function getAllMonitors(): Promise<MonitorInfo[]> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms

    $screens = [System.Windows.Forms.Screen]::AllScreens
    $result = @()
    $index = 0

    foreach ($screen in $screens) {
      $scaleFactor = 1.0

      # Try to get DPI scaling (may require elevated access on some systems)
      try {
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public class DpiHelper {
    [DllImport("gdi32.dll")]
    public static extern int GetDeviceCaps(IntPtr hdc, int nIndex);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    public const int LOGPIXELSX = 88;

    public static int GetDpi() {
        IntPtr hdc = GetDC(IntPtr.Zero);
        int dpi = GetDeviceCaps(hdc, LOGPIXELSX);
        ReleaseDC(IntPtr.Zero, hdc);
        return dpi;
    }
}
'@ -ErrorAction SilentlyContinue
        $dpi = [DpiHelper]::GetDpi()
        if ($dpi -gt 0) {
          $scaleFactor = $dpi / 96.0
        }
      } catch {
        # Ignore DPI detection errors, use default scale factor
      }

      $result += @{
        index = $index
        name = $screen.DeviceName
        width = $screen.Bounds.Width
        height = $screen.Bounds.Height
        workAreaX = $screen.WorkingArea.X
        workAreaY = $screen.WorkingArea.Y
        workAreaWidth = $screen.WorkingArea.Width
        workAreaHeight = $screen.WorkingArea.Height
        scaleFactor = $scaleFactor
        isPrimary = $screen.Primary
      }
      $index++
    }

    $result | ConvertTo-Json -Compress
  `;

  const result = await runPowerShell(script);

  // Handle single monitor (PowerShell returns object, not array)
  const parsed = JSON.parse(result);
  const monitors = Array.isArray(parsed) ? parsed : [parsed];

  return monitors.map((m: Record<string, unknown>) => ({
    index: m.index as number,
    name: m.name as string,
    width: m.width as number,
    height: m.height as number,
    workAreaX: m.workAreaX as number,
    workAreaY: m.workAreaY as number,
    workAreaWidth: m.workAreaWidth as number,
    workAreaHeight: m.workAreaHeight as number,
    scaleFactor: m.scaleFactor as number,
    isPrimary: m.isPrimary as boolean,
  }));
}

/**
 * Get primary monitor info
 */
export async function getPrimaryMonitor(): Promise<MonitorInfo> {
  const monitors = await getAllMonitors();
  const primary = monitors.find(m => m.isPrimary);

  if (!primary) {
    // Fallback to first monitor if no primary found
    if (monitors.length > 0) {
      return monitors[0];
    }
    throw new Error("No monitors detected");
  }

  return primary;
}

/**
 * Get monitor by index
 */
export async function getMonitor(index: number): Promise<MonitorInfo | null> {
  const monitors = await getAllMonitors();
  return monitors.find(m => m.index === index) || null;
}

/**
 * Get monitor count
 */
export async function getMonitorCount(): Promise<number> {
  const monitors = await getAllMonitors();
  return monitors.length;
}

/**
 * Cache for monitor info (refreshed on demand)
 */
let monitorCache: MonitorInfo[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

/**
 * Get cached monitors (avoids repeated PowerShell calls)
 */
export async function getCachedMonitors(forceRefresh = false): Promise<MonitorInfo[]> {
  const now = Date.now();

  if (!forceRefresh && monitorCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return monitorCache;
  }

  monitorCache = await getAllMonitors();
  cacheTimestamp = now;
  return monitorCache;
}

/**
 * Clear monitor cache (call when monitors may have changed)
 */
export function clearMonitorCache(): void {
  monitorCache = null;
  cacheTimestamp = 0;
}
