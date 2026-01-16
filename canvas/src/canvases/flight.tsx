// Flight Booking Canvas - Cyberpunk-themed flight comparison and seat selection

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import { useSafeInput } from "../utils/use-safe-input";
import { useIPC } from "./calendar/hooks/use-ipc";
import {
  type FlightConfig,
  type FlightResult,
  type Flight,
  type FocusMode,
  CYBER_COLORS,
  formatPrice,
  formatDuration,
  formatTime,
  buildSeat,
} from "./flight/types";

// Import subcomponents
import { CyberpunkHeader } from "./flight/components/cyberpunk-header";
import { FlightList } from "./flight/components/flight-list";
import { RouteDisplay } from "./flight/components/route-display";
import { FlightInfo } from "./flight/components/flight-info";
import { SeatmapPanel } from "./flight/components/seatmap-panel";
import { StatusBar } from "./flight/components/status-bar";

interface Props {
  id: string;
  config?: FlightConfig;
  socketPath?: string;
  scenario?: string;
}

export function FlightCanvas({
  id,
  config: initialConfig,
  socketPath,
  scenario = "booking",
}: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Terminal dimensions
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || 120,
    height: stdout?.rows || 40,
  });

  // Config (can be updated via IPC)
  const [config, setConfig] = useState<FlightConfig | undefined>(initialConfig);

  // Selection state
  const [selectedFlightIndex, setSelectedFlightIndex] = useState(0);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<FocusMode>("flights");

  // Seatmap cursor position
  const [seatCursorRow, setSeatCursorRow] = useState(1);
  const [seatCursorCol, setSeatCursorCol] = useState(0);

  // Countdown state for confirmation
  const [countdown, setCountdown] = useState<number | null>(null);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const spinnerChars = ["|", "/", "-", "\\"];

  // IPC connection
  const ipc = useIPC({
    socketPath,
    scenario,
    onClose: () => exit(),
    onUpdate: (newConfig) => {
      setConfig(newConfig as FlightConfig);
    },
  });

  // Get current flights
  const flights = config?.flights || [];
  const selectedFlight = flights[selectedFlightIndex];
  const seatmap = selectedFlight?.seatmap;

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

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === -1) {
      exit();
      return;
    }

    if (countdown === 0) {
      const timer = setTimeout(() => {
        setCountdown(-1);
      }, 1000);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, exit]);

  // Spinner animation
  useEffect(() => {
    if (countdown === null) return;
    const interval = setInterval(() => {
      setSpinnerFrame((f) => (f + 1) % spinnerChars.length);
    }, 100);
    return () => clearInterval(interval);
  }, [countdown, spinnerChars.length]);

  // Check if a seat is available
  const isSeatAvailable = useCallback(
    (row: number, letter: string): boolean => {
      if (!seatmap) return false;
      const seat = buildSeat(row, letter);
      if (seatmap.unavailable.includes(seat)) return false;
      if (seatmap.occupied.includes(seat)) return false;
      return true;
    },
    [seatmap]
  );

  // Handle final selection
  const handleConfirm = useCallback(
    (skipCountdown: boolean = false) => {
      if (!selectedFlight) return;

      const result: FlightResult = {
        selectedFlight,
        selectedSeat: selectedSeat || undefined,
      };

      ipc.sendSelected(result);

      if (skipCountdown) {
        setCountdown(0);
      } else {
        setCountdown(3);
      }
    },
    [selectedFlight, selectedSeat, ipc]
  );

  // Keyboard controls
  useSafeInput((input, key) => {
    // Cancel/quit
    if (input === "q" || key.escape) {
      if (countdown !== null) {
        setCountdown(null);
      } else {
        ipc.sendCancelled("User cancelled");
        exit();
      }
      return;
    }

    // During countdown, only allow cancel
    if (countdown !== null) return;

    // Tab to switch focus
    if (key.tab) {
      if (seatmap) {
        setFocusMode((mode) => (mode === "flights" ? "seatmap" : "flights"));
      }
      return;
    }

    // Enter to confirm
    if (key.return) {
      if (focusMode === "flights" && selectedFlight) {
        if (seatmap && !selectedSeat) {
          // Switch to seatmap to select seat
          setFocusMode("seatmap");
        } else {
          // Confirm selection
          handleConfirm(key.shift);
        }
      } else if (focusMode === "seatmap" && seatmap) {
        const letter = seatmap.seatsPerRow[seatCursorCol];
        if (letter && isSeatAvailable(seatCursorRow, letter)) {
          const seat = buildSeat(seatCursorRow, letter);
          setSelectedSeat(seat);
          // Auto-confirm after seat selection
          handleConfirm(key.shift);
        }
      }
      return;
    }

    // Space to select seat without confirming
    if (input === " " && focusMode === "seatmap" && seatmap) {
      const letter = seatmap.seatsPerRow[seatCursorCol];
      if (letter && isSeatAvailable(seatCursorRow, letter)) {
        const seat = buildSeat(seatCursorRow, letter);
        setSelectedSeat((prev) => (prev === seat ? null : seat));
      }
      return;
    }

    // Navigation
    if (focusMode === "flights") {
      if (key.upArrow) {
        setSelectedFlightIndex((i) => Math.max(0, i - 1));
        setSelectedSeat(null); // Reset seat when changing flight
      } else if (key.downArrow) {
        setSelectedFlightIndex((i) => Math.min(flights.length - 1, i + 1));
        setSelectedSeat(null);
      }
    } else if (focusMode === "seatmap" && seatmap) {
      // Horizontal plane layout: rows go left-right, seat letters go up-down
      if (key.leftArrow) {
        setSeatCursorRow((r) => Math.max(1, r - 1)); // Move toward front of plane
      } else if (key.rightArrow) {
        setSeatCursorRow((r) => Math.min(seatmap.rows, r + 1)); // Move toward back
      } else if (key.upArrow) {
        setSeatCursorCol((c) => Math.max(0, c - 1)); // Move toward window (A)
      } else if (key.downArrow) {
        setSeatCursorCol((c) => Math.min(seatmap.seatsPerRow.length - 1, c + 1)); // Move toward other window (F)
      }
    }
  });

  // Layout calculations
  const termWidth = dimensions.width;
  const termHeight = dimensions.height;
  const headerHeight = 3;
  const statusBarHeight = 2;
  const contentHeight = termHeight - headerHeight - statusBarHeight;

  // Left panel (flight list) takes ~30% width
  const leftPanelWidth = Math.max(24, Math.floor(termWidth * 0.3));
  // Right panel takes the rest
  const rightPanelWidth = termWidth - leftPanelWidth - 4;

  // Seatmap height (bottom section) - needs space for 6 seat rows + aisle + header + legend
  const seatmapHeight = seatmap ? Math.min(14, Math.max(12, Math.floor(contentHeight * 0.45))) : 0;
  const detailHeight = contentHeight - seatmapHeight;

  return (
    <Box
      flexDirection="column"
      width={termWidth}
      height={termHeight}
    >
      {/* Cyberpunk Header */}
      <CyberpunkHeader
        title={config?.title || "// FLIGHT_BOOKING_TERMINAL //"}
        width={termWidth}
      />

      {/* Main content area */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Left panel - Flight List */}
        <Box
          flexDirection="column"
          width={leftPanelWidth}
          borderStyle="single"
          borderColor={focusMode === "flights" ? CYBER_COLORS.neonCyan : CYBER_COLORS.dim}
          paddingX={1}
        >
          <Box marginBottom={1}>
            <Text color={CYBER_COLORS.neonMagenta} bold>
              {"[ FLIGHTS ]"}
            </Text>
          </Box>
          <FlightList
            flights={flights}
            selectedIndex={selectedFlightIndex}
            focused={focusMode === "flights"}
            maxHeight={contentHeight - 4}
          />
        </Box>

        {/* Right panel - Details */}
        <Box flexDirection="column" width={rightPanelWidth} paddingLeft={1}>
          {/* Route Display */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={CYBER_COLORS.dim}
            paddingX={1}
            height={Math.floor(detailHeight * 0.4)}
          >
            <Box marginBottom={1}>
              <Text color={CYBER_COLORS.neonMagenta} bold>
                {"[ ROUTE ]"}
              </Text>
            </Box>
            {selectedFlight && (
              <RouteDisplay
                origin={selectedFlight.origin}
                destination={selectedFlight.destination}
                width={rightPanelWidth - 4}
              />
            )}
          </Box>

          {/* Flight Info */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={CYBER_COLORS.dim}
            paddingX={1}
            marginTop={0}
            height={Math.floor(detailHeight * 0.6)}
          >
            <Box marginBottom={1}>
              <Text color={CYBER_COLORS.neonMagenta} bold>
                {"[ FLIGHT INFO ]"}
              </Text>
            </Box>
            {selectedFlight && <FlightInfo flight={selectedFlight} />}
          </Box>

          {/* Seatmap (if available) */}
          {seatmap && (
            <Box
              flexDirection="column"
              borderStyle="single"
              borderColor={focusMode === "seatmap" ? CYBER_COLORS.neonCyan : CYBER_COLORS.dim}
              paddingX={1}
              height={seatmapHeight}
            >
              <Box marginBottom={1}>
                <Text color={CYBER_COLORS.neonMagenta} bold>
                  {"[ SEATMAP ]"}
                </Text>
                {selectedSeat && (
                  <Text color={CYBER_COLORS.neonGreen}> Seat: {selectedSeat}</Text>
                )}
              </Box>
              <SeatmapPanel
                seatmap={seatmap}
                selectedSeat={selectedSeat}
                cursorRow={seatCursorRow}
                cursorCol={seatCursorCol}
                focused={focusMode === "seatmap"}
                maxHeight={seatmapHeight - 3}
                maxWidth={rightPanelWidth - 4}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Status Bar */}
      <StatusBar
        focusMode={focusMode}
        hasSeatmap={!!seatmap}
        selectedSeat={selectedSeat}
        countdown={countdown}
        spinnerFrame={spinnerFrame}
        spinnerChars={spinnerChars}
        width={termWidth}
      />
    </Box>
  );
}
