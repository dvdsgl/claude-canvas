// Agent Dashboard Canvas - Monitor and manage AI agents

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Agent, AgentLog, AgentMetrics, ConversationContext, Memory } from '../../shared/types';
import { useTerminalSize, useInterval } from '../../shared/hooks';
import { Gauge, ProgressBar, Sparkline } from '../../shared/components/Chart';
import { formatMoney, formatDuration, formatRelativeTime, truncate } from '../../shared/utils';

export interface AgentDashboardConfig {
  agents: Agent[];
  context?: ConversationContext;
  showLogs?: boolean;
  showMetrics?: boolean;
  refreshInterval?: number;
}

export interface AgentDashboardResult {
  action: 'select' | 'start' | 'stop' | 'cancel' | 'view-logs' | 'view-context';
  agentId?: string;
  agent?: Agent;
}

export interface AgentDashboardProps {
  config: AgentDashboardConfig;
  onResult?: (result: AgentDashboardResult) => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'gray',
  running: 'cyan',
  completed: 'green',
  failed: 'red',
  cancelled: 'yellow',
};

const STATUS_ICONS: Record<string, string> = {
  idle: '○',
  running: '◉',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
};

export function AgentDashboard({ config, onResult }: AgentDashboardProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { agents, context, showLogs = true, showMetrics = true, refreshInterval = 1000 } = config;

  const [selectedAgent, setSelectedAgent] = useState(0);
  const [view, setView] = useState<'overview' | 'logs' | 'context'>('overview');
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const currentAgent = agents[selectedAgent];

  // Calculate totals
  const stats = useMemo(() => {
    const running = agents.filter(a => a.status === 'running').length;
    const completed = agents.filter(a => a.status === 'completed').length;
    const failed = agents.filter(a => a.status === 'failed').length;
    const totalTokens = agents.reduce((sum, a) => sum + (a.metrics?.tokensUsed || 0), 0);
    const totalCost = agents.reduce((sum, a) => sum + (a.metrics?.cost?.amount || 0), 0);
    return { running, completed, failed, totalTokens, totalCost };
  }, [agents]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!currentAgent) return [];
    return currentAgent.logs.filter(log =>
      logFilter === 'all' || log.level === logFilter
    ).slice(-20);
  }, [currentAgent, logFilter]);

  useInput((input, key) => {
    if (key.escape) {
      if (view !== 'overview') {
        setView('overview');
      } else {
        exit();
      }
      return;
    }

    // View switching
    if (input === '1') setView('overview');
    if (input === '2' && showLogs) setView('logs');
    if (input === '3' && context) setView('context');

    // Agent navigation
    if (key.upArrow) {
      setSelectedAgent(a => Math.max(0, a - 1));
    }
    if (key.downArrow) {
      setSelectedAgent(a => Math.min(agents.length - 1, a + 1));
    }

    // Agent actions
    if (key.return && currentAgent) {
      onResult?.({
        action: 'select',
        agentId: currentAgent.id,
        agent: currentAgent,
      });
    }

    if (input === 's' && currentAgent && currentAgent.status === 'idle') {
      onResult?.({
        action: 'start',
        agentId: currentAgent.id,
        agent: currentAgent,
      });
    }

    if (input === 'x' && currentAgent && currentAgent.status === 'running') {
      onResult?.({
        action: 'cancel',
        agentId: currentAgent.id,
        agent: currentAgent,
      });
    }

    // Log filter
    if (view === 'logs') {
      if (input === 'a') setLogFilter('all');
      if (input === 'i') setLogFilter('info');
      if (input === 'w') setLogFilter('warn');
      if (input === 'e') setLogFilter('error');
    }
  });

  // Render agent card
  const renderAgent = (agent: Agent, index: number, isSelected: boolean) => {
    const statusColor = STATUS_COLORS[agent.status];
    const statusIcon = STATUS_ICONS[agent.status];

    return (
      <Box
        key={agent.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isSelected ? 'cyan' : statusColor as never}
        paddingX={1}
        width={width - 4}
        marginBottom={1}
      >
        <Box justifyContent="space-between">
          <Box>
            <Text color={statusColor as never}>{statusIcon} </Text>
            <Text bold={isSelected}>{agent.name}</Text>
            <Text dimColor> ({agent.type})</Text>
          </Box>
          <Text color={statusColor as never}>{agent.status.toUpperCase()}</Text>
        </Box>

        {agent.currentTask && (
          <Text dimColor>Task: {truncate(agent.currentTask, 50)}</Text>
        )}

        {agent.progress !== undefined && agent.status === 'running' && (
          <ProgressBar value={agent.progress} max={100} width={40} color="cyan" />
        )}

        <Box justifyContent="space-between" marginTop={1}>
          <Box gap={2}>
            {agent.metrics && (
              <>
                <Text dimColor>Tokens: {agent.metrics.tokensUsed.toLocaleString()}</Text>
                <Text dimColor>Tools: {agent.metrics.toolCalls}</Text>
                {agent.metrics.duration > 0 && (
                  <Text dimColor>Time: {formatDuration(Math.floor(agent.metrics.duration / 60000))}</Text>
                )}
              </>
            )}
          </Box>
          {agent.startedAt && (
            <Text dimColor>Started: {formatRelativeTime(agent.startedAt)}</Text>
          )}
        </Box>
      </Box>
    );
  };

  // Render overview
  const renderOverview = () => (
    <Box flexDirection="column">
      {/* Stats bar */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
        justifyContent="space-around"
      >
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Total</Text>
          <Text bold>{agents.length}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Running</Text>
          <Text bold color="cyan">{stats.running}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Completed</Text>
          <Text bold color="green">{stats.completed}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Failed</Text>
          <Text bold color="red">{stats.failed}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Tokens</Text>
          <Text bold>{stats.totalTokens.toLocaleString()}</Text>
        </Box>
        {stats.totalCost > 0 && (
          <Box flexDirection="column" alignItems="center">
            <Text dimColor>Cost</Text>
            <Text bold color="yellow">{formatMoney({ amount: stats.totalCost, currency: 'USD' })}</Text>
          </Box>
        )}
      </Box>

      {/* Agent list */}
      {agents.length === 0 ? (
        <Text dimColor italic>No agents running</Text>
      ) : (
        agents.map((agent, index) =>
          renderAgent(agent, index, index === selectedAgent)
        )
      )}
    </Box>
  );

  // Render logs view
  const renderLogsView = () => {
    if (!currentAgent) return <Text dimColor>Select an agent</Text>;

    return (
      <Box flexDirection="column">
        {/* Log header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="cyan">{currentAgent.name} - Logs</Text>
          <Box gap={1}>
            <Text inverse={logFilter === 'all'}> a:All </Text>
            <Text inverse={logFilter === 'info'} color="blue"> i:Info </Text>
            <Text inverse={logFilter === 'warn'} color="yellow"> w:Warn </Text>
            <Text inverse={logFilter === 'error'} color="red"> e:Error </Text>
          </Box>
        </Box>

        {/* Log entries */}
        <Box flexDirection="column" borderStyle="single" padding={1}>
          {filteredLogs.length === 0 ? (
            <Text dimColor italic>No logs</Text>
          ) : (
            filteredLogs.map((log, index) => {
              const levelColor = log.level === 'error' ? 'red'
                : log.level === 'warn' ? 'yellow'
                : log.level === 'debug' ? 'gray'
                : 'blue';

              return (
                <Box key={index}>
                  <Text dimColor>{new Date(log.timestamp).toLocaleTimeString()} </Text>
                  <Text color={levelColor as never}>[{log.level.toUpperCase().padEnd(5)}] </Text>
                  <Text>{truncate(log.message, width - 35)}</Text>
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    );
  };

  // Render context view
  const renderContextView = () => {
    if (!context) return <Text dimColor>No context available</Text>;

    const tokenPercent = (context.tokensUsed / context.maxTokens) * 100;

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}><Text bold color="cyan">Conversation Context</Text></Box>

        {/* Token usage */}
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold>Token Usage</Text>
          <Gauge
            value={context.tokensUsed}
            max={context.maxTokens}
            width={40}
            thresholds={[
              { value: 50, color: 'green' },
              { value: 75, color: 'yellow' },
              { value: 100, color: 'red' },
            ]}
          />
          <Text dimColor>
            {context.tokensUsed.toLocaleString()} / {context.maxTokens.toLocaleString()} tokens
            ({tokenPercent.toFixed(1)}%)
          </Text>
          <Text dimColor>{context.messages} messages in context</Text>
        </Box>

        {/* Memories */}
        {context.memories.length > 0 && (
          <Box flexDirection="column" borderStyle="single" padding={1}>
            <Text bold>Stored Memories ({context.memories.length})</Text>
            {context.memories.slice(0, 10).map((memory, index) => (
              <Box key={memory.id} marginTop={1}>
                <Text color={
                  memory.type === 'fact' ? 'cyan' :
                  memory.type === 'preference' ? 'yellow' : 'gray'
                }>
                  [{memory.type}]
                </Text>
                <Text> {truncate(memory.content, width - 25)}</Text>
                <Text dimColor> ({(memory.confidence * 100).toFixed(0)}%)</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">Agent Dashboard</Text>
        <Box gap={2}>
          <Text inverse={view === 'overview'}> 1 Overview </Text>
          {showLogs && <Text inverse={view === 'logs'}> 2 Logs </Text>}
          {context && <Text inverse={view === 'context'}> 3 Context </Text>}
        </Box>
      </Box>

      {/* Content */}
      {view === 'overview' && renderOverview()}
      {view === 'logs' && renderLogsView()}
      {view === 'context' && renderContextView()}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>1-3</Text> views</Text>
        <Text dimColor><Text bold>↑↓</Text> agents</Text>
        <Text dimColor><Text bold>s</Text> start</Text>
        <Text dimColor><Text bold>x</Text> cancel</Text>
        <Text dimColor><Text bold>Enter</Text> details</Text>
        <Text dimColor><Text bold>ESC</Text> {view !== 'overview' ? 'back' : 'exit'}</Text>
      </Box>
    </Box>
  );
}

export default AgentDashboard;
