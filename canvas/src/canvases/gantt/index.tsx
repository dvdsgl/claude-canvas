// Gantt Chart Canvas - Project timeline visualization

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Project, Task, Milestone } from '../../shared/types';
import { useTerminalSize } from '../../shared/hooks';
import { formatDate, addDays, startOfWeek, truncate, COLORS } from '../../shared/utils';

export interface GanttConfig {
  project: Project;
  startDate?: string;
  endDate?: string;
  view?: 'day' | 'week' | 'month';
  showMilestones?: boolean;
  showDependencies?: boolean;
}

export interface GanttResult {
  action: 'select-task' | 'move-task' | 'resize-task' | 'add-task' | 'view-details';
  taskId?: string;
  task?: Task;
  newStartDate?: string;
  newEndDate?: string;
}

export interface GanttProps {
  config: GanttConfig;
  onResult?: (result: GanttResult) => void;
}

const STATUS_COLORS: Record<string, string> = {
  'todo': 'gray',
  'in-progress': 'cyan',
  'review': 'yellow',
  'done': 'green',
  'blocked': 'red',
};

const PRIORITY_MARKERS: Record<string, string> = {
  urgent: '!!!',
  high: '!!',
  medium: '!',
  low: '',
};

export function GanttCanvas({ config, onResult }: GanttProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const {
    project,
    view = 'week',
    showMilestones = true,
    showDependencies = true,
  } = config;

  const [selectedTask, setSelectedTask] = useState(0);
  const [selectedDate, setSelectedDate] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Calculate date range
  const dateRange = useMemo(() => {
    const projectStart = new Date(project.startDate);
    const projectEnd = project.endDate ? new Date(project.endDate) : addDays(projectStart, 90);

    // Calculate visible columns based on view
    const columnCount = view === 'day' ? 14 : view === 'week' ? 12 : 6;
    const columnWidth = view === 'day' ? 1 : view === 'week' ? 7 : 30;

    const dates: Date[] = [];
    let current = startOfWeek(projectStart);
    for (let i = 0; i < columnCount; i++) {
      dates.push(current);
      current = addDays(current, columnWidth);
    }

    return { start: projectStart, end: projectEnd, dates, columnWidth };
  }, [project, view]);

  const tasks = project.tasks;
  const currentTask = tasks[selectedTask];

  // Calculate task bar positions
  const getTaskPosition = (task: Task) => {
    if (!task.dueDate) return null;

    const taskStart = new Date(task.dueDate);
    // Estimate task as ending based on estimate or 7 days
    const taskDuration = task.estimate || 8; // hours
    const taskDays = Math.ceil(taskDuration / 8);
    const taskEnd = addDays(taskStart, taskDays);

    const firstDate = dateRange.dates[0];
    const lastDate = dateRange.dates[dateRange.dates.length - 1];
    if (!firstDate || !lastDate) return { startCol: 0, duration: 1 };
    const chartStart = firstDate.getTime();
    const chartEnd = lastDate.getTime();
    const totalDays = (chartEnd - chartStart) / (1000 * 60 * 60 * 24);

    const startOffset = Math.max(0, (taskStart.getTime() - chartStart) / (1000 * 60 * 60 * 24));
    const endOffset = Math.min(totalDays, (taskEnd.getTime() - chartStart) / (1000 * 60 * 60 * 24));

    const startCol = Math.floor((startOffset / totalDays) * dateRange.dates.length);
    const duration = Math.max(1, Math.ceil(((endOffset - startOffset) / totalDays) * dateRange.dates.length));

    return { startCol, duration };
  };

  // Navigation
  useInput((input, key) => {
    if (key.escape) {
      if (isEditing) {
        setIsEditing(false);
      } else {
        exit();
      }
      return;
    }

    // Task navigation
    if (key.upArrow) {
      setSelectedTask(t => Math.max(0, t - 1));
    }
    if (key.downArrow) {
      setSelectedTask(t => Math.min(tasks.length - 1, t + 1));
    }

    // Date navigation
    if (key.leftArrow) {
      setSelectedDate(d => Math.max(0, d - 1));
    }
    if (key.rightArrow) {
      setSelectedDate(d => Math.min(dateRange.dates.length - 1, d + 1));
    }

    // Actions
    if (key.return && currentTask) {
      onResult?.({
        action: 'view-details',
        taskId: currentTask.id,
        task: currentTask,
      });
    }

    if (input === 'e') {
      setIsEditing(true);
    }

    if (input === 'a') {
      onResult?.({ action: 'add-task' });
    }
  });

  // Calculate label column width
  const labelWidth = Math.min(30, Math.max(20, Math.max(...tasks.map(t => t.title.length)) + 5));
  const chartWidth = width - labelWidth - 4;
  const columnWidth = Math.floor(chartWidth / dateRange.dates.length);

  // Render date header
  const renderDateHeader = () => (
    <Box>
      <Box width={labelWidth}><Text bold>Task</Text></Box>
      {dateRange.dates.map((date, index) => {
        const isSelected = index === selectedDate;
        const label = view === 'day'
          ? date.getDate().toString()
          : view === 'week'
          ? `W${Math.ceil(date.getDate() / 7)}`
          : date.toLocaleDateString('en-US', { month: 'short' });

        return (
          <Box key={index} width={columnWidth} justifyContent="center">
            <Text
              inverse={isSelected}
              bold={isSelected}
              dimColor={!isSelected}
            >
              {truncate(label, columnWidth - 1)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );

  // Render month/week header
  const renderPeriodHeader = () => {
    if (view === 'day') {
      return (
        <Box>
          <Box width={labelWidth}></Box>
          {dateRange.dates.map((date, index) => (
            <Box key={index} width={columnWidth} justifyContent="center">
              <Text dimColor>
                {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
              </Text>
            </Box>
          ))}
        </Box>
      );
    }
    return null;
  };

  // Render task row
  const renderTaskRow = (task: Task, index: number, isSelected: boolean) => {
    const position = getTaskPosition(task);
    const statusColor = STATUS_COLORS[task.status] || 'gray';
    const progress = task.logged && task.estimate
      ? Math.min(100, Math.round((task.logged / task.estimate) * 100))
      : task.status === 'done' ? 100 : 0;

    return (
      <Box key={task.id}>
        {/* Task label */}
        <Box width={labelWidth}>
          <Text
            inverse={isSelected}
            color={isSelected ? 'cyan' : undefined}
          >
            {PRIORITY_MARKERS[task.priority]}
            {truncate(task.title, labelWidth - 4)}
          </Text>
        </Box>

        {/* Gantt bar */}
        {dateRange.dates.map((_, colIndex) => {
          const isInBar = position &&
            colIndex >= position.startCol &&
            colIndex < position.startCol + position.duration;

          const isBarStart = position && colIndex === position.startCol;
          const isBarEnd = position && colIndex === position.startCol + position.duration - 1;

          if (isInBar) {
            const progressWidth = Math.round((progress / 100) * (position.duration * columnWidth));
            const isProgressHere = (colIndex - position.startCol) * columnWidth < progressWidth;

            return (
              <Box key={colIndex} width={columnWidth}>
                <Text
                  backgroundColor={statusColor as never}
                  color="white"
                >
                  {isBarStart ? '├' : isBarEnd ? '┤' : '─'}
                  {'─'.repeat(Math.max(0, columnWidth - 2))}
                  {!isBarEnd && !isBarStart ? '' : ''}
                </Text>
              </Box>
            );
          }

          // Check for milestone
          const currentDate = dateRange.dates[colIndex];
          const nextDate = dateRange.dates[colIndex + 1];
          const milestone = showMilestones && currentDate && project.milestones?.find(m => {
            const mDate = new Date(m.dueDate);
            return mDate >= currentDate &&
              (colIndex === dateRange.dates.length - 1 ||
                (nextDate && mDate < nextDate)) &&
              m.tasks?.includes(task.id);
          });

          return (
            <Box key={colIndex} width={columnWidth} justifyContent="center">
              {milestone ? (
                <Text color="yellow">◆</Text>
              ) : (
                <Text dimColor>│</Text>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Render milestones
  const renderMilestones = () => {
    if (!showMilestones || !project.milestones?.length) return null;

    return (
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>Milestones:</Text>
        {project.milestones.map(milestone => (
          <Box key={milestone.id} gap={2}>
            <Text color={milestone.completed ? 'green' : 'yellow'}>
              {milestone.completed ? '✓' : '◆'}
            </Text>
            <Text>{milestone.name}</Text>
            <Text dimColor>{formatDate(milestone.dueDate, 'short')}</Text>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">{project.name}</Text>
          <Text dimColor>
            {formatDate(project.startDate)} - {project.endDate ? formatDate(project.endDate) : 'Ongoing'}
          </Text>
        </Box>
        <Box gap={2}>
          <Text>Tasks: {tasks.length}</Text>
          <Text color="green">Done: {tasks.filter(t => t.status === 'done').length}</Text>
          <Text color="cyan">In Progress: {tasks.filter(t => t.status === 'in-progress').length}</Text>
        </Box>
      </Box>

      {/* Legend */}
      <Box gap={2} marginBottom={1}>
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <Box key={status}>
            <Text backgroundColor={color as never}> </Text>
            <Text dimColor> {status}</Text>
          </Box>
        ))}
        {showMilestones && <Text color="yellow">◆ milestone</Text>}
      </Box>

      {/* Chart */}
      <Box flexDirection="column" borderStyle="single">
        {renderPeriodHeader()}
        {renderDateHeader()}
        <Text dimColor>{'─'.repeat(width - 4)}</Text>

        {tasks.length === 0 ? (
          <Box paddingX={1}><Text dimColor italic>No tasks</Text></Box>
        ) : (
          tasks.map((task, index) =>
            renderTaskRow(task, index, index === selectedTask)
          )
        )}
      </Box>

      {/* Task details */}
      {currentTask && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>{currentTask.title}</Text>
          <Box gap={2}>
            <Text color={STATUS_COLORS[currentTask.status] as never}>{currentTask.status}</Text>
            {currentTask.assignee && <Text dimColor>@{currentTask.assignee.name}</Text>}
            {currentTask.dueDate && <Text dimColor>Due: {formatDate(currentTask.dueDate, 'short')}</Text>}
            {currentTask.estimate && <Text dimColor>Est: {currentTask.estimate}h</Text>}
          </Box>
        </Box>
      )}

      {/* Milestones */}
      {renderMilestones()}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>↑↓</Text> tasks</Text>
        <Text dimColor><Text bold>←→</Text> dates</Text>
        <Text dimColor><Text bold>Enter</Text> details</Text>
        <Text dimColor><Text bold>e</Text> edit</Text>
        <Text dimColor><Text bold>a</Text> add task</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default GanttCanvas;
