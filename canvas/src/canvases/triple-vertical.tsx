import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import { useIPCServer } from "./calendar/hooks/use-ipc-server";

export interface TripleVerticalConfig {
  title?: string;
  topPanelTitle?: string;
  topPanelContent?: string;
  middlePanelTitle?: string;
  middlePanelContent?: string;
  bottomPanelTitle?: string;
  bottomPanelContent?: string;
  // Ratio for section heights (top:middle:bottom), defaults to 1:2:1
  sectionRatio?: [number, number, number];
}

interface Props {
  id: string;
  config?: TripleVerticalConfig;
  socketPath?: string;
  scenario?: string;
}

// Demo content generators
function getDemoTopContent(): string[] {
  return [
    "┌─────────────────────────────────────────────┐",
    "│  Terminal Session - System Monitor         │",
    "├─────────────────────────────────────────────┤",
    "│  CPU: ████████░░░░░░░░  52%                │",
    "│  MEM: ██████████████░░  87%                │",
    "│  DSK: ████░░░░░░░░░░░░  28%                │",
    "├─────────────────────────────────────────────┤",
    "│  Active Processes: 127                     │",
    "│  Network: ↑ 2.3 MB/s  ↓ 15.7 MB/s         │",
    "│  Uptime: 14d 7h 23m                        │",
    "└─────────────────────────────────────────────┘",
  ];
}

function getDemoMiddleContent(): string[] {
  return [
    "╔═══════════════════════════════════════════════════════════════════╗",
    "║                        CLAUDE CODE                                ║",
    "╠═══════════════════════════════════════════════════════════════════╣",
    "║                                                                   ║",
    "║   $ claude \"Help me build a new feature\"                         ║",
    "║                                                                   ║",
    "║   > Analyzing your codebase...                                    ║",
    "║   > Found 42 TypeScript files                                     ║",
    "║   > Identified main entry points                                  ║",
    "║                                                                   ║",
    "║   I'll help you implement that feature. Let me first explore     ║",
    "║   the existing architecture to understand the best approach.      ║",
    "║                                                                   ║",
    "║   Reading: src/components/App.tsx                                 ║",
    "║   Reading: src/services/api.ts                                    ║",
    "║   Reading: src/hooks/useData.ts                                   ║",
    "║                                                                   ║",
    "╚═══════════════════════════════════════════════════════════════════╝",
  ];
}

function getDemoBottomContent(): string[] {
  return [
    "┌─────────────────────────────────────────────┐",
    "│  Output Panel - Build Status               │",
    "├─────────────────────────────────────────────┤",
    "│  ✓ TypeScript compiled successfully        │",
    "│  ✓ 47 tests passed                         │",
    "│  ✓ Bundle size: 142kb (gzipped: 48kb)     │",
    "│  ✓ No linting errors                       │",
    "├─────────────────────────────────────────────┤",
    "│  Ready for deployment                      │",
    "└─────────────────────────────────────────────┘",
  ];
}

interface PanelProps {
  title: string;
  content: string[];
  width: number;
  height: number;
  borderColor?: string;
  titleColor?: string;
}

function Panel({ title, content, width, height, borderColor = "cyan", titleColor = "cyan" }: PanelProps) {
  // Calculate content area height (accounting for border)
  const contentHeight = Math.max(1, height - 2);
  const innerWidth = Math.max(1, width - 4);

  // Slice content to fit
  const visibleContent = content.slice(0, contentHeight);

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={borderColor}
    >
      {/* Title */}
      <Box justifyContent="center" width="100%">
        <Text color={titleColor} bold>
          {title.slice(0, innerWidth)}
        </Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleContent.map((line, i) => (
          <Text key={i} color="white">
            {line.slice(0, innerWidth)}
          </Text>
        ))}
        {/* Fill remaining space with empty lines */}
        {Array.from({ length: Math.max(0, contentHeight - visibleContent.length - 1) }).map((_, i) => (
          <Text key={`empty-${i}`}> </Text>
        ))}
      </Box>
    </Box>
  );
}

export function TripleVertical({ id, config: initialConfig, socketPath, scenario = "display" }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Live config state (can be updated via IPC)
  const [liveConfig, setLiveConfig] = useState<TripleVerticalConfig | undefined>(initialConfig);

  // IPC for communicating with Claude
  const ipc = useIPCServer({
    socketPath,
    scenario: scenario || "display",
    onClose: () => exit(),
    onUpdate: (newConfig) => {
      setLiveConfig(newConfig as TripleVerticalConfig);
    },
  });

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Listen for terminal resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: stdout?.columns || 120,
        height: stdout?.rows || 40,
      });
    };

    stdout?.on("resize", updateDimensions);
    updateDimensions();

    return () => {
      stdout?.off("resize", updateDimensions);
    };
  }, [stdout]);

  // Handle keyboard input
  useInput((input, key) => {
    if (input === "q" || key.escape) {
      exit();
    }
  });

  const termWidth = dimensions.width;
  const termHeight = dimensions.height;

  // Calculate section heights based on ratio
  const ratio = liveConfig?.sectionRatio || [1, 2, 1];
  const totalRatio = ratio[0] + ratio[1] + ratio[2];
  const headerHeight = 2; // Title + margin
  const footerHeight = 1; // Help bar
  const availableHeight = Math.max(6, termHeight - headerHeight - footerHeight);

  const topHeight = Math.max(4, Math.floor((availableHeight * ratio[0]) / totalRatio));
  const bottomHeight = Math.max(4, Math.floor((availableHeight * ratio[2]) / totalRatio));
  const middleHeight = Math.max(4, availableHeight - topHeight - bottomHeight);

  // Get content (from config or demo)
  const topContent = liveConfig?.topPanelContent
    ? liveConfig.topPanelContent.split("\n")
    : getDemoTopContent();
  const middleContent = liveConfig?.middlePanelContent
    ? liveConfig.middlePanelContent.split("\n")
    : getDemoMiddleContent();
  const bottomContent = liveConfig?.bottomPanelContent
    ? liveConfig.bottomPanelContent.split("\n")
    : getDemoBottomContent();

  const title = liveConfig?.title || "Claude Code Workspace";
  const topTitle = liveConfig?.topPanelTitle || "Terminal";
  const middleTitle = liveConfig?.middlePanelTitle || "Claude Code";
  const bottomTitle = liveConfig?.bottomPanelTitle || "Output";

  return (
    <Box flexDirection="column" width={termWidth} height={termHeight} paddingX={1}>
      {/* Main title */}
      <Box marginBottom={1} justifyContent="center">
        <Text bold color="magenta">
          {title}
        </Text>
      </Box>

      {/* Top Panel */}
      <Panel
        title={topTitle}
        content={topContent}
        width={termWidth - 2}
        height={topHeight}
        borderColor="green"
        titleColor="green"
      />

      {/* Middle Panel (Claude Code) */}
      <Panel
        title={middleTitle}
        content={middleContent}
        width={termWidth - 2}
        height={middleHeight}
        borderColor="blue"
        titleColor="blue"
      />

      {/* Bottom Panel */}
      <Panel
        title={bottomTitle}
        content={bottomContent}
        width={termWidth - 2}
        height={bottomHeight}
        borderColor="yellow"
        titleColor="yellow"
      />

      {/* Help bar */}
      <Box justifyContent="center">
        <Text color="gray">q quit</Text>
      </Box>
    </Box>
  );
}
