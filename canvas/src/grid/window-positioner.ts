// Window Positioner - Move/resize windows using Win32 API

import { spawn } from "child_process";
import type { PixelRect, PositionOptions } from "./types";

/**
 * Execute a PowerShell command
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
 * Set window position and size using Win32 SetWindowPos API
 */
export async function setWindowPosition(
  windowHandle: number,
  rect: PixelRect,
  options: PositionOptions = {}
): Promise<void> {
  const { noActivate = false, showWindow = true, topMost = false } = options;

  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public class WindowPositioner {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int X, int Y, int cx, int cy,
        uint uFlags
    );

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsZoomed(IntPtr hWnd);

    public static readonly IntPtr HWND_TOP = IntPtr.Zero;
    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOZORDER = 0x0004;
    public const uint SWP_NOACTIVATE = 0x0010;
    public const uint SWP_FRAMECHANGED = 0x0020;
    public const uint SWP_SHOWWINDOW = 0x0040;
    public const uint SWP_HIDEWINDOW = 0x0080;

    public const int SW_RESTORE = 9;
    public const int SW_SHOW = 5;
    public const int SW_SHOWNOACTIVATE = 4;
}
'@

    $handle = [IntPtr]${windowHandle}

    # Restore window first if minimized or maximized
    if ([WindowPositioner]::IsIconic($handle) -or [WindowPositioner]::IsZoomed($handle)) {
      [WindowPositioner]::ShowWindow($handle, [WindowPositioner]::SW_RESTORE) | Out-Null
      Start-Sleep -Milliseconds 50
    }

    # Build flags
    $flags = [uint32]0
    ${noActivate ? "$flags = $flags -bor [WindowPositioner]::SWP_NOACTIVATE" : ""}
    ${showWindow ? "$flags = $flags -bor [WindowPositioner]::SWP_SHOWWINDOW" : ""}

    # Determine z-order
    $insertAfter = [WindowPositioner]::HWND_TOP
    ${topMost ? "$insertAfter = [WindowPositioner]::HWND_TOPMOST" : ""}

    # Set position
    $result = [WindowPositioner]::SetWindowPos(
      $handle,
      $insertAfter,
      ${rect.x}, ${rect.y}, ${rect.width}, ${rect.height},
      $flags
    )

    if (-not $result) {
      $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "SetWindowPos failed with error code: $errorCode"
    }

    Write-Output "OK"
  `;

  const result = await runPowerShell(script);
  if (!result.includes("OK")) {
    throw new Error(`Failed to set window position: ${result}`);
  }
}

/**
 * Get current window position and size
 */
export async function getWindowPosition(windowHandle: number): Promise<PixelRect> {
  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
'@

    $handle = [IntPtr]${windowHandle}
    $rect = New-Object RECT

    $result = [WindowHelper]::GetWindowRect($handle, [ref]$rect)

    if (-not $result) {
      throw "GetWindowRect failed"
    }

    @{
      x = $rect.Left
      y = $rect.Top
      width = $rect.Right - $rect.Left
      height = $rect.Bottom - $rect.Top
    } | ConvertTo-Json -Compress
  `;

  const result = await runPowerShell(script);
  return JSON.parse(result) as PixelRect;
}

/**
 * Check if a window exists and is valid
 */
export async function isWindowValid(windowHandle: number): Promise<boolean> {
  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public class WindowValidator {
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
}
'@

    $handle = [IntPtr]${windowHandle}
    $isValid = [WindowValidator]::IsWindow($handle)
    Write-Output $isValid.ToString().ToLower()
  `;

  const result = await runPowerShell(script);
  return result === "true";
}

/**
 * Bring window to foreground
 */
export async function bringToForeground(windowHandle: number): Promise<void> {
  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public class WindowFocus {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    public const int SW_RESTORE = 9;
}
'@

    $handle = [IntPtr]${windowHandle}

    # Restore if minimized
    if ([WindowFocus]::IsIconic($handle)) {
      [WindowFocus]::ShowWindow($handle, [WindowFocus]::SW_RESTORE) | Out-Null
    }

    [WindowFocus]::SetForegroundWindow($handle) | Out-Null
    Write-Output "OK"
  `;

  await runPowerShell(script);
}

/**
 * Minimize a window
 */
export async function minimizeWindow(windowHandle: number): Promise<void> {
  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public class WindowMin {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const int SW_MINIMIZE = 6;
}
'@

    $handle = [IntPtr]${windowHandle}
    [WindowMin]::ShowWindow($handle, [WindowMin]::SW_MINIMIZE) | Out-Null
    Write-Output "OK"
  `;

  await runPowerShell(script);
}

/**
 * Restore a window (un-minimize or un-maximize)
 */
export async function restoreWindow(windowHandle: number): Promise<void> {
  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

public class WindowRestore {
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const int SW_RESTORE = 9;
}
'@

    $handle = [IntPtr]${windowHandle}
    [WindowRestore]::ShowWindow($handle, [WindowRestore]::SW_RESTORE) | Out-Null
    Write-Output "OK"
  `;

  await runPowerShell(script);
}

/**
 * Get window frame/border dimensions
 * Useful for adjusting window positioning to account for borders
 */
export async function getWindowFrameSize(windowHandle: number): Promise<{
  borderWidth: number;
  titleBarHeight: number;
}> {
  const script = `
    Add-Type @'
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

[StructLayout(LayoutKind.Sequential)]
public struct WINDOWINFO {
    public uint cbSize;
    public RECT rcWindow;
    public RECT rcClient;
    public uint dwStyle;
    public uint dwExStyle;
    public uint dwWindowStatus;
    public uint cxWindowBorders;
    public uint cyWindowBorders;
    public ushort atomWindowType;
    public ushort wCreatorVersion;
}

public class WindowFrame {
    [DllImport("user32.dll")]
    public static extern bool GetWindowInfo(IntPtr hWnd, ref WINDOWINFO pwi);
}
'@

    $handle = [IntPtr]${windowHandle}
    $info = New-Object WINDOWINFO
    $info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($info)

    $result = [WindowFrame]::GetWindowInfo($handle, [ref]$info)

    if (-not $result) {
      throw "GetWindowInfo failed"
    }

    # Calculate border width and title bar height
    $borderWidth = $info.cxWindowBorders
    $titleBarHeight = ($info.rcClient.Top - $info.rcWindow.Top)

    @{
      borderWidth = $borderWidth
      titleBarHeight = $titleBarHeight
    } | ConvertTo-Json -Compress
  `;

  const result = await runPowerShell(script);
  return JSON.parse(result) as { borderWidth: number; titleBarHeight: number };
}
