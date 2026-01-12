// Itinerary Canvas - Trip planning and day-by-day itinerary

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Itinerary, ItineraryDay, ItineraryActivity, Money } from '../../shared/types';
import { useTerminalSize } from '../../shared/hooks';
import { formatMoney, formatDate, formatDuration, formatTime, truncate, generateId } from '../../shared/utils';

export interface ItineraryConfig {
  itinerary: Itinerary;
  editable?: boolean;
}

export interface ItineraryResult {
  action: 'select-day' | 'select-activity' | 'add-activity' | 'remove-activity' | 'reorder' | 'update';
  dayIndex?: number;
  activityId?: string;
  activity?: ItineraryActivity;
  itinerary: Itinerary;
}

export interface ItineraryProps {
  config: ItineraryConfig;
  onResult?: (result: ItineraryResult) => void;
}

const ACTIVITY_ICONS: Record<string, string> = {
  transport: '✈️',
  accommodation: '🏨',
  food: '🍽️',
  activity: '🎯',
  sightseeing: '📸',
  other: '📍',
};

export function ItineraryCanvas({ config, onResult }: ItineraryProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { itinerary: initialItinerary, editable = false } = config;

  const [itinerary, setItinerary] = useState<Itinerary>(initialItinerary);
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedActivity, setSelectedActivity] = useState(0);
  const [view, setView] = useState<'overview' | 'day'>('overview');
  const [isDragging, setIsDragging] = useState(false);

  const currentDay = itinerary.days[selectedDay];
  const currentActivity = currentDay?.activities[selectedActivity];

  // Calculate trip stats
  const totalCost = itinerary.days.reduce(
    (sum, day) => sum + day.activities.reduce(
      (s, a) => s + (a.cost?.amount || 0), 0
    ), 0
  );
  const totalActivities = itinerary.days.reduce((sum, day) => sum + day.activities.length, 0);

  useInput((input, key) => {
    if (key.escape) {
      if (isDragging) {
        setIsDragging(false);
      } else if (view === 'day') {
        setView('overview');
      } else {
        exit();
      }
      return;
    }

    if (view === 'overview') {
      // Day navigation
      if (key.leftArrow) {
        setSelectedDay(d => Math.max(0, d - 1));
      }
      if (key.rightArrow) {
        setSelectedDay(d => Math.min(itinerary.days.length - 1, d + 1));
      }
      if (key.return) {
        setView('day');
        setSelectedActivity(0);
      }
    } else {
      // Activity navigation
      if (key.upArrow) {
        if (isDragging && selectedActivity > 0) {
          // Reorder activity
          const newDays = [...itinerary.days];
          const dayData = newDays[selectedDay];
          if (dayData) {
            const activities = [...dayData.activities];
            const actA = activities[selectedActivity - 1];
            const actB = activities[selectedActivity];
            if (actA && actB) {
              activities[selectedActivity - 1] = actB;
              activities[selectedActivity] = actA;
              newDays[selectedDay] = { ...dayData, activities };
              setItinerary({ ...itinerary, days: newDays });
              setSelectedActivity(selectedActivity - 1);
            }
          }
        } else {
          setSelectedActivity(a => Math.max(0, a - 1));
        }
      }
      if (key.downArrow) {
        if (isDragging && selectedActivity < (currentDay?.activities.length || 0) - 1) {
          // Reorder activity
          const newDays = [...itinerary.days];
          const dayData = newDays[selectedDay];
          if (dayData) {
            const activities = [...dayData.activities];
            const actA = activities[selectedActivity];
            const actB = activities[selectedActivity + 1];
            if (actA && actB) {
              activities[selectedActivity] = actB;
              activities[selectedActivity + 1] = actA;
              newDays[selectedDay] = { ...dayData, activities };
              setItinerary({ ...itinerary, days: newDays });
              setSelectedActivity(selectedActivity + 1);
            }
          }
        } else {
          setSelectedActivity(a => Math.min((currentDay?.activities.length || 1) - 1, a + 1));
        }
      }
      if (key.leftArrow && selectedDay > 0) {
        setSelectedDay(d => d - 1);
        setSelectedActivity(0);
      }
      if (key.rightArrow && selectedDay < itinerary.days.length - 1) {
        setSelectedDay(d => d + 1);
        setSelectedActivity(0);
      }
    }

    // Actions
    if (input === ' ' && editable && view === 'day') {
      if (isDragging) {
        setIsDragging(false);
        onResult?.({
          action: 'reorder',
          dayIndex: selectedDay,
          itinerary,
        });
      } else {
        setIsDragging(true);
      }
    }

    if (key.return && view === 'day' && currentActivity) {
      onResult?.({
        action: 'select-activity',
        dayIndex: selectedDay,
        activityId: currentActivity.id,
        activity: currentActivity,
        itinerary,
      });
    }

    if (input === 'a' && editable) {
      onResult?.({
        action: 'add-activity',
        dayIndex: selectedDay,
        itinerary,
      });
    }

    if (input === 'd' && editable && currentActivity) {
      const newDays = [...itinerary.days];
      const dayData = newDays[selectedDay];
      if (dayData) {
        newDays[selectedDay] = {
          ...dayData,
          activities: dayData.activities.filter(a => a.id !== currentActivity.id),
        };
        const newItinerary = { ...itinerary, days: newDays };
        setItinerary(newItinerary);
        setSelectedActivity(Math.max(0, selectedActivity - 1));
        onResult?.({
          action: 'remove-activity',
          dayIndex: selectedDay,
          activityId: currentActivity.id,
          itinerary: newItinerary,
        });
      }
    }
  });

  // Render day card in overview
  const renderDayCard = (day: ItineraryDay, index: number, isSelected: boolean) => {
    const dayDate = new Date(day.date);
    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
    const dayCost = day.activities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);

    return (
      <Box
        key={day.date}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isSelected ? 'cyan' : 'gray'}
        width={Math.floor((width - 4) / Math.min(itinerary.days.length, 5)) - 1}
        paddingX={1}
      >
        <Text bold color={isSelected ? 'cyan' : undefined}>
          Day {index + 1}
        </Text>
        <Text>{dayName} {formatDate(day.date, 'short')}</Text>

        <Box flexDirection="column" marginTop={1}>
          {day.activities.slice(0, 4).map(activity => (
            <Text key={activity.id} dimColor>
              {ACTIVITY_ICONS[activity.type]} {truncate(activity.title, 12)}
            </Text>
          ))}
          {day.activities.length > 4 && (
            <Text dimColor>+{day.activities.length - 4} more</Text>
          )}
        </Box>

        {day.accommodation && (
          <Box marginTop={1}><Text dimColor>🏨 {truncate(day.accommodation, 15)}</Text></Box>
        )}

        {dayCost > 0 && (
          <Box marginTop={1}>
            <Text color="green">{formatMoney({ amount: dayCost, currency: 'USD' })}</Text>
          </Box>
        )}
      </Box>
    );
  };

  // Render activity in day view
  const renderActivity = (activity: ItineraryActivity, index: number, isSelected: boolean) => {
    return (
      <Box
        key={activity.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isDragging && isSelected ? 'yellow' : isSelected ? 'cyan' : 'gray'}
        paddingX={1}
        marginBottom={1}
      >
        <Box justifyContent="space-between">
          <Box>
            <Text color="cyan">{activity.time}</Text>
            <Text> {ACTIVITY_ICONS[activity.type]} </Text>
            <Text bold={isSelected}>{activity.title}</Text>
          </Box>
          {activity.booked && <Text color="green">✓ Booked</Text>}
        </Box>

        {activity.location && (
          <Text dimColor>📍 {activity.location}</Text>
        )}

        {activity.duration && (
          <Text dimColor>⏱️ {formatDuration(activity.duration)}</Text>
        )}

        {activity.cost && (
          <Text color="green">{formatMoney(activity.cost)}</Text>
        )}

        {activity.confirmationNumber && (
          <Text dimColor>Conf: {activity.confirmationNumber}</Text>
        )}

        {activity.notes && (
          <Text dimColor italic>{truncate(activity.notes, 50)}</Text>
        )}
      </Box>
    );
  };

  // Render overview
  const renderOverview = () => (
    <Box flexDirection="column">
      {/* Trip header */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
        justifyContent="space-around"
      >
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Destination</Text>
          <Text bold color="cyan">{itinerary.destination}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Dates</Text>
          <Text>{formatDate(itinerary.startDate, 'short')} - {formatDate(itinerary.endDate, 'short')}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Duration</Text>
          <Text>{itinerary.days.length} days</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Travelers</Text>
          <Text>{itinerary.travelers.length}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Est. Cost</Text>
          <Text color="green">{formatMoney({ amount: totalCost, currency: 'USD' })}</Text>
        </Box>
      </Box>

      {/* Days grid */}
      <Box gap={1}>
        {itinerary.days.map((day, index) =>
          renderDayCard(day, index, index === selectedDay)
        )}
      </Box>

      {/* Travelers */}
      <Box marginTop={1}>
        <Text dimColor>Travelers: </Text>
        {itinerary.travelers.map((t, i) => (
          <Text key={t.id}>
            {t.name}{i < itinerary.travelers.length - 1 ? ', ' : ''}
          </Text>
        ))}
      </Box>
    </Box>
  );

  // Render day detail
  const renderDayDetail = () => {
    if (!currentDay) return null;

    const dayDate = new Date(currentDay.date);
    const dayCost = currentDay.activities.reduce((sum, a) => sum + (a.cost?.amount || 0), 0);

    return (
      <Box flexDirection="column">
        {/* Day header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Box flexDirection="column">
            <Text bold color="cyan">
              Day {selectedDay + 1} - {dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            {currentDay.accommodation && (
              <Text dimColor>🏨 Staying at: {currentDay.accommodation}</Text>
            )}
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            <Text>{currentDay.activities.length} activities</Text>
            <Text color="green">{formatMoney({ amount: dayCost, currency: 'USD' })}</Text>
          </Box>
        </Box>

        {/* Activities timeline */}
        <Box flexDirection="column">
          {currentDay.activities.length === 0 ? (
            <Text dimColor italic>No activities planned. Press 'a' to add.</Text>
          ) : (
            currentDay.activities.map((activity, index) =>
              renderActivity(activity, index, index === selectedActivity)
            )
          )}
        </Box>

        {/* Day notes */}
        {currentDay.notes && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Notes:</Text>
            <Text dimColor>{currentDay.notes}</Text>
          </Box>
        )}

        {/* Day navigation */}
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>
            {selectedDay > 0 && '← Previous day'}
          </Text>
          <Text dimColor>
            {selectedDay < itinerary.days.length - 1 && 'Next day →'}
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">{itinerary.name}</Text>
        <Box gap={2}>
          <Text inverse={view === 'overview'}> Overview </Text>
          <Text inverse={view === 'day'}> Day View </Text>
        </Box>
      </Box>

      {/* Content */}
      {view === 'overview' && renderOverview()}
      {view === 'day' && renderDayDetail()}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        {view === 'overview' ? (
          <>
            <Text dimColor><Text bold>←→</Text> days</Text>
            <Text dimColor><Text bold>Enter</Text> view day</Text>
          </>
        ) : (
          <>
            <Text dimColor><Text bold>↑↓</Text> activities</Text>
            <Text dimColor><Text bold>←→</Text> days</Text>
            {editable && <Text dimColor><Text bold>Space</Text> {isDragging ? 'drop' : 'drag'}</Text>}
            {editable && <Text dimColor><Text bold>a</Text> add</Text>}
            {editable && <Text dimColor><Text bold>d</Text> delete</Text>}
            <Text dimColor><Text bold>Enter</Text> select</Text>
          </>
        )}
        <Text dimColor><Text bold>ESC</Text> {view === 'day' ? 'back' : 'exit'}</Text>
      </Box>
    </Box>
  );
}

export default ItineraryCanvas;
