// Smart Home Canvas - IoT device dashboard and control

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Device, DeviceState, DeviceType, Automation } from '../../shared/types';
import { useTerminalSize, useInterval } from '../../shared/hooks';
import { Gauge, ProgressBar, Sparkline } from '../../shared/components/Chart';
import { formatRelativeTime, truncate } from '../../shared/utils';

export interface SmartHomeConfig {
  devices: Device[];
  rooms: string[];
  automations?: Automation[];
  showAutomations?: boolean;
  refreshInterval?: number;
}

export interface SmartHomeResult {
  action: 'toggle' | 'set-value' | 'run-automation' | 'select-device' | 'add-device';
  deviceId?: string;
  device?: Device;
  newState?: Partial<DeviceState>;
  automationId?: string;
}

export interface SmartHomeProps {
  config: SmartHomeConfig;
  onResult?: (result: SmartHomeResult) => void;
}

const DEVICE_ICONS: Record<DeviceType, string> = {
  light: '💡',
  switch: '🔌',
  thermostat: '🌡️',
  lock: '🔒',
  camera: '📷',
  sensor: '📡',
  speaker: '🔊',
  tv: '📺',
  blind: '🪟',
  fan: '🌀',
  vacuum: '🤖',
  doorbell: '🔔',
};

const STATUS_COLORS: Record<string, string> = {
  online: 'green',
  offline: 'gray',
  error: 'red',
};

export function SmartHomeCanvas({ config, onResult }: SmartHomeProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { devices, rooms, automations = [], showAutomations = true, refreshInterval = 5000 } = config;

  const [selectedRoom, setSelectedRoom] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState(0);
  const [view, setView] = useState<'rooms' | 'all' | 'automations'>('rooms');
  const [deviceStates, setDeviceStates] = useState<Record<string, DeviceState>>(
    Object.fromEntries(devices.map(d => [d.id, d.state]))
  );

  // Group devices by room
  const devicesByRoom = useMemo(() => {
    const grouped: Record<string, Device[]> = {};
    rooms.forEach(room => {
      grouped[room] = devices.filter(d => d.room === room);
    });
    return grouped;
  }, [devices, rooms]);

  const currentRoomName = rooms[selectedRoom] ?? '';
  const currentRoomDevices = view === 'rooms'
    ? devicesByRoom[currentRoomName] || []
    : devices;
  const currentDevice = currentRoomDevices[selectedDevice];

  // Stats
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const activeCount = devices.filter(d => deviceStates[d.id]?.on).length;

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    // View switching
    if (input === '1') setView('rooms');
    if (input === '2') setView('all');
    if (input === '3' && showAutomations) setView('automations');

    // Room navigation (in rooms view)
    if (view === 'rooms' && key.tab) {
      setSelectedRoom(r => key.shift
        ? (r - 1 + rooms.length) % rooms.length
        : (r + 1) % rooms.length
      );
      setSelectedDevice(0);
    }

    // Device navigation
    if (key.upArrow) {
      setSelectedDevice(d => Math.max(0, d - 1));
    }
    if (key.downArrow) {
      setSelectedDevice(d => Math.min(currentRoomDevices.length - 1, d + 1));
    }

    // Device actions
    if (key.return && currentDevice) {
      onResult?.({
        action: 'select-device',
        deviceId: currentDevice.id,
        device: currentDevice,
      });
    }

    if (input === ' ' && currentDevice) {
      // Toggle on/off
      const newState = { ...deviceStates[currentDevice.id], on: !deviceStates[currentDevice.id]?.on };
      setDeviceStates({ ...deviceStates, [currentDevice.id]: newState });
      onResult?.({
        action: 'toggle',
        deviceId: currentDevice.id,
        device: currentDevice,
        newState,
      });
    }

    // Adjust brightness/level
    if (currentDevice && (currentDevice.type === 'light' || currentDevice.type === 'blind' || currentDevice.type === 'fan')) {
      const state = deviceStates[currentDevice.id];
      const currentLevel = state?.brightness || state?.level || 0;

      if (input === '+' || input === '=') {
        const newLevel = Math.min(100, currentLevel + 10);
        const newState = { ...state, brightness: newLevel, level: newLevel };
        setDeviceStates({ ...deviceStates, [currentDevice.id]: newState });
        onResult?.({
          action: 'set-value',
          deviceId: currentDevice.id,
          newState,
        });
      }
      if (input === '-') {
        const newLevel = Math.max(0, currentLevel - 10);
        const newState = { ...state, brightness: newLevel, level: newLevel };
        setDeviceStates({ ...deviceStates, [currentDevice.id]: newState });
        onResult?.({
          action: 'set-value',
          deviceId: currentDevice.id,
          newState,
        });
      }
    }

    // Thermostat temperature
    if (currentDevice && currentDevice.type === 'thermostat') {
      const state = deviceStates[currentDevice.id];
      if (input === '+' || input === '=') {
        const newTemp = (state?.targetTemperature || 70) + 1;
        const newState = { ...state, targetTemperature: newTemp };
        setDeviceStates({ ...deviceStates, [currentDevice.id]: newState });
        onResult?.({
          action: 'set-value',
          deviceId: currentDevice.id,
          newState,
        });
      }
      if (input === '-') {
        const newTemp = (state?.targetTemperature || 70) - 1;
        const newState = { ...state, targetTemperature: newTemp };
        setDeviceStates({ ...deviceStates, [currentDevice.id]: newState });
        onResult?.({
          action: 'set-value',
          deviceId: currentDevice.id,
          newState,
        });
      }
    }

    // Lock/unlock
    if (currentDevice && currentDevice.type === 'lock') {
      if (input === 'l') {
        const newState = { ...deviceStates[currentDevice.id], locked: !deviceStates[currentDevice.id]?.locked };
        setDeviceStates({ ...deviceStates, [currentDevice.id]: newState });
        onResult?.({
          action: 'toggle',
          deviceId: currentDevice.id,
          newState,
        });
      }
    }
  });

  // Render device card
  const renderDevice = (device: Device, index: number, isSelected: boolean) => {
    const state = deviceStates[device.id] || device.state;
    const icon = DEVICE_ICONS[device.type];
    const isOn = state?.on;
    const statusColor = STATUS_COLORS[device.status];

    const renderDeviceDetails = () => {
      switch (device.type) {
        case 'light':
          return (
            <Box flexDirection="column">
              <Text color={isOn ? 'yellow' : 'gray'}>{isOn ? 'ON' : 'OFF'}</Text>
              {state?.brightness !== undefined && (
                <ProgressBar value={state.brightness} max={100} width={15} color="yellow" />
              )}
              {state?.color && <Text>Color: {state.color}</Text>}
            </Box>
          );

        case 'thermostat':
          return (
            <Box flexDirection="column">
              <Text>Current: <Text bold color="cyan">{state?.temperature || '--'}°F</Text></Text>
              <Text>Target: <Text bold color="green">{state?.targetTemperature || '--'}°F</Text></Text>
              {state?.humidity !== undefined && <Text dimColor>Humidity: {state.humidity}%</Text>}
            </Box>
          );

        case 'lock':
          return (
            <Text color={state?.locked ? 'green' : 'red'}>
              {state?.locked ? '🔒 Locked' : '🔓 Unlocked'}
            </Text>
          );

        case 'sensor':
          return (
            <Box flexDirection="column">
              {state?.temperature !== undefined && <Text>Temp: {state.temperature}°F</Text>}
              {state?.humidity !== undefined && <Text>Humidity: {state.humidity}%</Text>}
              {state?.motion !== undefined && (
                <Text color={state.motion ? 'yellow' : 'gray'}>
                  Motion: {state.motion ? 'Detected' : 'Clear'}
                </Text>
              )}
              {state?.battery !== undefined && (
                <ProgressBar value={state.battery} max={100} width={10} color={state.battery < 20 ? 'red' : 'green'} />
              )}
            </Box>
          );

        case 'speaker':
        case 'tv':
          return (
            <Box flexDirection="column">
              <Text color={isOn ? 'cyan' : 'gray'}>{isOn ? 'Playing' : 'OFF'}</Text>
              {state?.volume !== undefined && (
                <Box>
                  <Text>Vol: </Text>
                  <ProgressBar value={state.volume} max={100} width={10} />
                </Box>
              )}
            </Box>
          );

        case 'blind':
        case 'fan':
          return (
            <Box flexDirection="column">
              <Text color={isOn ? 'cyan' : 'gray'}>{isOn ? 'ON' : 'OFF'}</Text>
              {state?.level !== undefined && (
                <ProgressBar value={state.level} max={100} width={15} />
              )}
            </Box>
          );

        case 'camera':
          return (
            <Text color={device.status === 'online' ? 'green' : 'gray'}>
              {device.status === 'online' ? '● Recording' : '○ Offline'}
            </Text>
          );

        case 'vacuum':
          return (
            <Box flexDirection="column">
              <Text>{state?.mode || 'Idle'}</Text>
              {state?.battery !== undefined && (
                <Box>
                  <Text>🔋 </Text>
                  <ProgressBar value={state.battery} max={100} width={10} color={state.battery < 20 ? 'red' : 'green'} />
                </Box>
              )}
            </Box>
          );

        default:
          return <Text color={isOn ? 'green' : 'gray'}>{isOn ? 'ON' : 'OFF'}</Text>;
      }
    };

    return (
      <Box
        key={device.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isSelected ? 'cyan' : statusColor as never}
        paddingX={1}
        width={Math.floor((width - 6) / 2)}
        marginBottom={1}
      >
        <Box justifyContent="space-between">
          <Text bold={isSelected}>
            {icon} {truncate(device.name, 20)}
          </Text>
          <Text color={statusColor as never}>●</Text>
        </Box>

        {renderDeviceDetails()}

        {device.lastSeen && (
          <Text dimColor>Last: {formatRelativeTime(device.lastSeen)}</Text>
        )}
      </Box>
    );
  };

  // Render room view
  const renderRoomsView = () => {
    const currentRoom = rooms[selectedRoom] ?? '';
    const roomDevices = devicesByRoom[currentRoom] || [];

    return (
      <Box flexDirection="column">
        {/* Room tabs */}
        <Box gap={1} marginBottom={1}>
          {rooms.map((room, index) => (
            <Text
              key={room}
              inverse={index === selectedRoom}
              color={index === selectedRoom ? 'cyan' : undefined}
            >
              {' '}{room} ({devicesByRoom[room]?.length || 0}){' '}
            </Text>
          ))}
        </Box>

        {/* Devices grid */}
        <Box flexWrap="wrap" gap={1}>
          {roomDevices.length === 0 ? (
            <Text dimColor italic>No devices in this room</Text>
          ) : (
            roomDevices.map((device: Device, index: number) =>
              renderDevice(device, index, index === selectedDevice)
            )
          )}
        </Box>
      </Box>
    );
  };

  // Render all devices view
  const renderAllView = () => (
    <Box flexDirection="column">
      <Box flexWrap="wrap" gap={1}>
        {devices.map((device, index) =>
          renderDevice(device, index, index === selectedDevice)
        )}
      </Box>
    </Box>
  );

  // Render automations view
  const renderAutomationsView = () => (
    <Box flexDirection="column">
      {automations.length === 0 ? (
        <Text dimColor italic>No automations configured</Text>
      ) : (
        automations.map((automation, index) => (
          <Box
            key={automation.id}
            flexDirection="column"
            borderStyle={index === selectedDevice ? 'bold' : 'single'}
            borderColor={index === selectedDevice ? 'cyan' : automation.enabled ? 'green' : 'gray'}
            padding={1}
            marginBottom={1}
          >
            <Box justifyContent="space-between">
              <Text bold>{automation.name}</Text>
              <Text color={automation.enabled ? 'green' : 'gray'}>
                {automation.enabled ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </Box>
            <Text dimColor>
              Trigger: {automation.trigger.type}
              {automation.trigger.type === 'time' && ` at ${automation.trigger.config.time}`}
              {automation.trigger.type === 'device' && ` when ${automation.trigger.config.deviceId}`}
            </Text>
            <Text dimColor>
              Actions: {automation.actions.length} action(s)
            </Text>
          </Box>
        ))
      )}
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">Smart Home</Text>
          <Text dimColor>
            {onlineCount}/{devices.length} online | {activeCount} active
          </Text>
        </Box>
        <Box gap={2}>
          <Text inverse={view === 'rooms'}> 1 Rooms </Text>
          <Text inverse={view === 'all'}> 2 All </Text>
          {showAutomations && <Text inverse={view === 'automations'}> 3 Auto </Text>}
        </Box>
      </Box>

      {/* Content */}
      {view === 'rooms' && renderRoomsView()}
      {view === 'all' && renderAllView()}
      {view === 'automations' && renderAutomationsView()}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>1-3</Text> views</Text>
        {view === 'rooms' && <Text dimColor><Text bold>Tab</Text> rooms</Text>}
        <Text dimColor><Text bold>↑↓</Text> select</Text>
        <Text dimColor><Text bold>Space</Text> toggle</Text>
        <Text dimColor><Text bold>+/-</Text> adjust</Text>
        <Text dimColor><Text bold>Enter</Text> details</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default SmartHomeCanvas;
