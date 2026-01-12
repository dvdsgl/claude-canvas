import React from "react";
import { render } from "ink";
import { Calendar, type CalendarConfig } from "./calendar";
import { Document } from "./document";
import type { DocumentConfig } from "./document/types";
import { FlightCanvas } from "./flight";
import type { FlightConfig } from "./flight/types";
import { TripleVertical, type TripleVerticalConfig } from "./triple-vertical";
import { Panel, type PanelConfig } from "./panel";

// Clear screen and hide cursor
function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H\x1b[?25l");
}

// Show cursor on exit
function showCursor() {
  process.stdout.write("\x1b[?25h");
}

export interface RenderOptions {
  socketPath?: string;
  scenario?: string;
}

export async function renderCanvas(
  kind: string,
  id: string,
  config?: unknown,
  options?: RenderOptions
): Promise<void> {
  // Clear screen before rendering
  clearScreen();

  // Ensure cursor is shown on exit
  process.on("exit", showCursor);
  process.on("SIGINT", () => {
    showCursor();
    process.exit();
  });

  switch (kind) {
    case "calendar":
      return renderCalendar(
        id,
        config as CalendarConfig | undefined,
        options
      );
    case "document":
      return renderDocument(
        id,
        config as DocumentConfig | undefined,
        options
      );
    case "flight":
      return renderFlight(
        id,
        config as FlightConfig | undefined,
        options
      );
    case "triple-vertical":
      return renderTripleVertical(
        id,
        config as TripleVerticalConfig | undefined,
        options
      );
    case "panel":
      return renderPanel(
        id,
        config as PanelConfig | undefined,
        options
      );
    default:
      console.error(`Unknown canvas kind: ${kind}`);
      process.exit(1);
  }
}

async function renderCalendar(
  id: string,
  config?: CalendarConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Calendar
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderDocument(
  id: string,
  config?: DocumentConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Document
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderFlight(
  id: string,
  config?: FlightConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <FlightCanvas
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "booking"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderTripleVertical(
  id: string,
  config?: TripleVerticalConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <TripleVertical
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}

async function renderPanel(
  id: string,
  config?: PanelConfig,
  options?: RenderOptions
): Promise<void> {
  const { waitUntilExit } = render(
    <Panel
      id={id}
      config={config}
      socketPath={options?.socketPath}
      scenario={options?.scenario || "display"}
    />,
    {
      exitOnCtrlC: true,
    }
  );
  await waitUntilExit();
}
