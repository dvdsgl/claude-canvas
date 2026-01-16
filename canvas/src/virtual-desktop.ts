/**
 * Virtual Desktop Integration for Windows
 *
 * Wraps the PSVirtualDesktop PowerShell module for virtual desktop management.
 * See: https://github.com/MScholtes/PSVirtualDesktop
 */

import { spawn, spawnSync } from "child_process";

/**
 * Sanitize a string for safe use in PowerShell double-quoted strings
 * Escapes characters that could allow command injection
 */
function sanitizeForPowerShell(input: string): string {
  if (!input) return "";
  // Escape PowerShell special characters within double-quoted strings:
  // - Backtick (`) is the escape character
  // - Dollar sign ($) starts variable expansion
  // - Double quote (") ends the string
  // - Backtick itself needs escaping
  return input
    .replace(/`/g, "``")      // Escape backticks first
    .replace(/\$/g, "`$")     // Escape dollar signs
    .replace(/"/g, '`"');     // Escape double quotes
}

export interface DesktopInfo {
  index: number;
  name: string;
  isVisible: boolean;
}

export interface WindowInfo {
  handle: number;
  title: string;
  processName: string;
  desktopIndex: number;
}

/**
 * Execute a PowerShell command using the VirtualDesktop module
 */
async function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Import the VirtualDesktop module and run the command
    // Add OneDrive module path for cases where modules are synced there
    const fullScript = `
      $ErrorActionPreference = 'Stop'

      # Add OneDrive module path if it exists (common on synced Windows setups)
      $oneDriveModules = "$env:USERPROFILE\\OneDrive\\Documents\\WindowsPowerShell\\Modules"
      if (Test-Path $oneDriveModules) {
        $env:PSModulePath = "$oneDriveModules;" + $env:PSModulePath
      }

      try {
        Import-Module VirtualDesktop -ErrorAction Stop -WarningAction SilentlyContinue
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
 * Check if the VirtualDesktop module is installed
 */
export async function isModuleInstalled(): Promise<boolean> {
  try {
    const result = await runPowerShell("Get-Module -ListAvailable VirtualDesktop | Select-Object -First 1");
    return result.length > 0;
  } catch (err) {
    // PowerShell or module query failed - assume not installed
    return false;
  }
}

/**
 * Install the VirtualDesktop module from PowerShell Gallery
 */
export async function installModule(): Promise<void> {
  await runPowerShell(`
    Install-Module VirtualDesktop -Scope CurrentUser -Force -AllowClobber
  `);
}

/**
 * Get the current virtual desktop index
 */
export async function getCurrentDesktopIndex(): Promise<number> {
  const result = await runPowerShell(`
    $current = Get-CurrentDesktop
    $index = Get-DesktopIndex -Desktop $current
    Write-Output $index
  `);
  return parseInt(result, 10);
}

/**
 * Get the count of virtual desktops
 */
export async function getDesktopCount(): Promise<number> {
  const result = await runPowerShell(`
    $count = Get-DesktopCount
    Write-Output $count
  `);
  return parseInt(result, 10);
}

/**
 * Get the name of a desktop at a given index
 */
export async function getDesktopName(index: number): Promise<string> {
  const result = await runPowerShell(`
    $desktop = Get-Desktop -Index ${index}
    $name = Get-DesktopName -Desktop $desktop
    Write-Output $name
  `);
  return result || `Desktop ${index + 1}`;
}

/**
 * Create a new virtual desktop
 */
export async function createDesktop(name?: string): Promise<number> {
  const safeName = name ? sanitizeForPowerShell(name) : "";
  const result = await runPowerShell(`
    $desktop = New-Desktop
    ${safeName ? `Set-DesktopName -Desktop $desktop -Name "${safeName}"` : ""}
    # Get all desktops and find the index of the new one
    $count = Get-DesktopCount
    $index = $count - 1
    Write-Output $index
  `);
  const index = parseInt(result.trim(), 10);
  if (isNaN(index)) {
    throw new Error(`Failed to parse desktop index from: "${result}"`);
  }
  return index;
}

/**
 * Set the name of a desktop
 */
export async function setDesktopName(index: number, name: string): Promise<void> {
  const safeName = sanitizeForPowerShell(name);
  await runPowerShell(`
    $desktop = Get-Desktop -Index ${index}
    Set-DesktopName -Desktop $desktop -Name "${safeName}"
  `);
}

/**
 * Switch to a virtual desktop by index
 */
export async function switchToDesktop(index: number): Promise<void> {
  await runPowerShell(`
    $desktop = Get-Desktop -Index ${index}
    Switch-Desktop -Desktop $desktop
  `);
}

/**
 * Remove a virtual desktop by index
 */
export async function removeDesktop(index: number): Promise<void> {
  await runPowerShell(`
    $desktop = Get-Desktop -Index ${index}
    Remove-Desktop -Desktop $desktop
  `);
}

/**
 * Find a window handle by title (partial match)
 */
export async function findWindowByTitle(titlePattern: string): Promise<number | null> {
  try {
    const safePattern = sanitizeForPowerShell(titlePattern);
    const result = await runPowerShell(`
      $handle = Find-WindowHandle -Title "*${safePattern}*"
      if ($handle) {
        Write-Output $handle
      } else {
        Write-Output ""
      }
    `);
    if (result && result.length > 0) {
      return parseInt(result, 10);
    }
    return null;
  } catch (err) {
    // Window not found or PowerShell command failed - expected behavior for non-existent windows
    return null;
  }
}

/**
 * Move a window to a specific desktop
 */
export async function moveWindowToDesktop(windowHandle: number, desktopIndex: number): Promise<void> {
  await runPowerShell(`
    $desktop = Get-Desktop -Index ${desktopIndex}
    Move-Window -Desktop $desktop -Hwnd ${windowHandle}
  `);
}

/**
 * Get the desktop index that a window belongs to
 */
export async function getWindowDesktop(windowHandle: number): Promise<number> {
  const result = await runPowerShell(`
    $desktop = Get-DesktopFromWindow -Hwnd ${windowHandle}
    $index = Get-DesktopIndex -Desktop $desktop
    Write-Output $index
  `);
  return parseInt(result, 10);
}

/**
 * Pin a window to all desktops
 */
export async function pinWindow(windowHandle: number): Promise<void> {
  await runPowerShell(`
    Pin-Window -Hwnd ${windowHandle}
  `);
}

/**
 * Unpin a window from all desktops
 */
export async function unpinWindow(windowHandle: number): Promise<void> {
  await runPowerShell(`
    Unpin-Window -Hwnd ${windowHandle}
  `);
}

/**
 * Check if a window is pinned
 */
export async function isWindowPinned(windowHandle: number): Promise<boolean> {
  const result = await runPowerShell(`
    $pinned = Test-WindowPinned -Hwnd ${windowHandle}
    Write-Output $pinned
  `);
  return result.toLowerCase() === "true";
}

/**
 * Get list of all desktops with their info
 */
export async function listDesktops(): Promise<DesktopInfo[]> {
  const result = await runPowerShell(`
    $count = Get-DesktopCount
    $current = Get-CurrentDesktop
    $currentIndex = Get-DesktopIndex -Desktop $current

    $desktops = @()
    for ($i = 0; $i -lt $count; $i++) {
      $d = Get-Desktop -Index $i
      $name = Get-DesktopName -Desktop $d
      $isVisible = $i -eq $currentIndex
      $desktops += @{
        index = $i
        name = if ($name) { $name } else { "Desktop $($i + 1)" }
        isVisible = $isVisible
      }
    }

    $desktops | ConvertTo-Json -Compress
  `);

  try {
    const parsed = JSON.parse(result);
    // Handle single item (not array)
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    // JSON parsing failed - likely malformed output from PowerShell
    console.error(`Failed to parse desktop list: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Find desktop by name
 */
export async function findDesktopByName(name: string): Promise<number | null> {
  const desktops = await listDesktops();
  const found = desktops.find(d => d.name === name);
  return found ? found.index : null;
}

/**
 * Focus a window by handle
 */
export async function focusWindow(windowHandle: number): Promise<void> {
  // Use Windows API via PowerShell to focus the window
  await runPowerShell(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      }
"@
    [Win32]::ShowWindow([IntPtr]${windowHandle}, 9) # SW_RESTORE
    [Win32]::SetForegroundWindow([IntPtr]${windowHandle})
  `);
}

/**
 * Close a window by handle
 */
export async function closeWindow(windowHandle: number): Promise<void> {
  await runPowerShell(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        public const int WM_CLOSE = 0x0010;

        [DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int Msg, IntPtr wParam, IntPtr lParam);
      }
"@
    [Win32]::SendMessage([IntPtr]${windowHandle}, [Win32]::WM_CLOSE, [IntPtr]::Zero, [IntPtr]::Zero)
  `);
}

/**
 * Get all visible windows with their titles
 */
export async function listWindows(): Promise<WindowInfo[]> {
  const result = await runPowerShell(`
    Add-Type @"
      using System;
      using System.Collections.Generic;
      using System.Runtime.InteropServices;
      using System.Text;

      public class WindowHelper {
        [DllImport("user32.dll")]
        static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

        [DllImport("user32.dll")]
        static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

        [DllImport("user32.dll")]
        static extern bool IsWindowVisible(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        public static List<object[]> GetWindows() {
          var windows = new List<object[]>();
          EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
              var sb = new StringBuilder(256);
              GetWindowText(hWnd, sb, 256);
              var title = sb.ToString();
              if (!string.IsNullOrEmpty(title)) {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                windows.Add(new object[] { (long)hWnd, title, (int)pid });
              }
            }
            return true;
          }, IntPtr.Zero);
          return windows;
        }
      }
"@

    $windows = [WindowHelper]::GetWindows()
    $result = @()
    foreach ($w in $windows) {
      $proc = Get-Process -Id $w[2] -ErrorAction SilentlyContinue
      $result += @{
        handle = $w[0]
        title = $w[1]
        processName = if ($proc) { $proc.Name } else { "" }
        desktopIndex = -1  # Would need additional call to get this
      }
    }
    $result | ConvertTo-Json -Compress
  `);

  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    // JSON parsing failed - likely malformed output from PowerShell
    console.error(`Failed to parse window list: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

// ============================================
// Grid-related window positioning functions
// ============================================

export interface MonitorBounds {
  index: number;
  name: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

/**
 * Get all monitors information
 */
export async function getMonitors(): Promise<MonitorBounds[]> {
  const result = await runPowerShell(`
    Add-Type -AssemblyName System.Windows.Forms

    $screens = [System.Windows.Forms.Screen]::AllScreens
    $result = @()
    $index = 0

    foreach ($screen in $screens) {
      $result += @{
        index = $index
        name = $screen.DeviceName
        bounds = @{
          x = $screen.Bounds.X
          y = $screen.Bounds.Y
          width = $screen.Bounds.Width
          height = $screen.Bounds.Height
        }
        workArea = @{
          x = $screen.WorkingArea.X
          y = $screen.WorkingArea.Y
          width = $screen.WorkingArea.Width
          height = $screen.WorkingArea.Height
        }
        isPrimary = $screen.Primary
      }
      $index++
    }

    $result | ConvertTo-Json -Depth 3 -Compress
  `);

  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    // JSON parsing failed - likely malformed output from PowerShell
    console.error(`Failed to parse monitor list: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Set window position and size
 */
export async function setWindowRect(
  windowHandle: number,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  await runPowerShell(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class WindowPos {
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetWindowPos(
          IntPtr hWnd, IntPtr hWndInsertAfter,
          int X, int Y, int cx, int cy, uint uFlags
        );

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        public static extern bool IsIconic(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool IsZoomed(IntPtr hWnd);
      }
"@

    $handle = [IntPtr]${windowHandle}

    # Restore window if minimized or maximized
    if ([WindowPos]::IsIconic($handle) -or [WindowPos]::IsZoomed($handle)) {
      [WindowPos]::ShowWindow($handle, 9) | Out-Null
      Start-Sleep -Milliseconds 50
    }

    # Set position (SWP_SHOWWINDOW = 0x0040)
    $result = [WindowPos]::SetWindowPos($handle, [IntPtr]::Zero, ${x}, ${y}, ${width}, ${height}, 0x0040)

    if (-not $result) {
      throw "SetWindowPos failed"
    }
  `);
}

/**
 * Get current window position and size
 */
export async function getWindowRect(
  windowHandle: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  const result = await runPowerShell(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;

      [StructLayout(LayoutKind.Sequential)]
      public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
      }

      public class WindowRect {
        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
      }
"@

    $handle = [IntPtr]${windowHandle}
    $rect = New-Object RECT

    $success = [WindowRect]::GetWindowRect($handle, [ref]$rect)

    if (-not $success) {
      throw "GetWindowRect failed"
    }

    @{
      x = $rect.Left
      y = $rect.Top
      width = $rect.Right - $rect.Left
      height = $rect.Bottom - $rect.Top
    } | ConvertTo-Json -Compress
  `);

  return JSON.parse(result);
}
