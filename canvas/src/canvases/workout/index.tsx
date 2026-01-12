// Workout Canvas - Exercise planning and tracking

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Workout, Exercise, ExerciseSet } from '../../shared/types';
import { useTerminalSize, useInterval } from '../../shared/hooks';
import { ProgressBar } from '../../shared/components/Chart';
import { formatDuration, truncate, generateId } from '../../shared/utils';

export interface WorkoutConfig {
  workout?: Workout;
  exercises?: Exercise[];
  mode?: 'plan' | 'active' | 'review';
}

export interface WorkoutResult {
  action: 'start' | 'complete' | 'log-set' | 'skip' | 'add-exercise' | 'save';
  workout: Workout;
  exerciseId?: string;
  setIndex?: number;
}

export interface WorkoutProps {
  config: WorkoutConfig;
  onResult?: (result: WorkoutResult) => void;
}

const EXERCISE_ICONS: Record<string, string> = {
  strength: '💪',
  cardio: '🏃',
  flexibility: '🧘',
  sports: '⚽',
  other: '🏋️',
};

export function WorkoutCanvas({ config, onResult }: WorkoutProps): React.ReactElement {
  const { width } = useTerminalSize();
  const { exit } = useApp();
  const { mode = 'plan' } = config;

  const defaultWorkout: Workout = config.workout || {
    id: generateId('workout'),
    name: 'New Workout',
    date: new Date().toISOString(),
    duration: 0,
    type: 'strength',
    exercises: config.exercises || [],
  };

  const [workout, setWorkout] = useState<Workout>(defaultWorkout);
  const [currentExercise, setCurrentExercise] = useState(0);
  const [currentSet, setCurrentSet] = useState(0);
  const [isActive, setIsActive] = useState(mode === 'active');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTimer, setRestTimer] = useState<number | null>(null);

  // Timer for active workout
  useInterval(() => {
    if (isActive) {
      setElapsedSeconds(s => s + 1);
    }
    if (restTimer !== null && restTimer > 0) {
      setRestTimer(t => (t || 0) - 1);
    }
  }, 1000);

  const exercise = workout.exercises[currentExercise];
  const totalSets = workout.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 0), 0);
  const completedSets = workout.exercises.slice(0, currentExercise).reduce(
    (sum, ex) => sum + (ex.sets?.length || 0), 0
  ) + currentSet;

  useInput((input, key) => {
    if (key.escape) {
      if (restTimer !== null) {
        setRestTimer(null);
      } else {
        exit();
      }
      return;
    }

    // Exercise navigation
    if (key.upArrow) {
      setCurrentExercise(e => Math.max(0, e - 1));
      setCurrentSet(0);
    }
    if (key.downArrow) {
      setCurrentExercise(e => Math.min(workout.exercises.length - 1, e + 1));
      setCurrentSet(0);
    }

    // Set navigation
    if (key.leftArrow && exercise?.sets) {
      setCurrentSet(s => Math.max(0, s - 1));
    }
    if (key.rightArrow && exercise?.sets) {
      setCurrentSet(s => Math.min((exercise.sets?.length || 1) - 1, s + 1));
    }

    // Actions
    if (input === 's' && !isActive) {
      // Start workout
      setIsActive(true);
      setElapsedSeconds(0);
      onResult?.({ action: 'start', workout });
    }

    if (input === ' ' && isActive && exercise) {
      // Complete set
      const newExercises = [...workout.exercises];
      // Move to next set or exercise
      if (exercise.sets && currentSet < exercise.sets.length - 1) {
        setCurrentSet(s => s + 1);
        setRestTimer(exercise.sets[currentSet]?.restAfter || 60);
      } else if (currentExercise < workout.exercises.length - 1) {
        setCurrentExercise(e => e + 1);
        setCurrentSet(0);
        setRestTimer(90);
      }

      onResult?.({
        action: 'log-set',
        workout: { ...workout, exercises: newExercises },
        exerciseId: exercise.id,
        setIndex: currentSet,
      });
    }

    if (input === 'n') {
      // Skip current exercise
      if (currentExercise < workout.exercises.length - 1) {
        setCurrentExercise(e => e + 1);
        setCurrentSet(0);
      }
      onResult?.({ action: 'skip', workout, exerciseId: exercise?.id });
    }

    if (input === 'f' && isActive) {
      // Finish workout
      const finalWorkout = {
        ...workout,
        duration: elapsedSeconds,
      };
      setWorkout(finalWorkout);
      setIsActive(false);
      onResult?.({ action: 'complete', workout: finalWorkout });
    }

    if (input === 'r' && restTimer === null) {
      // Start rest timer manually
      setRestTimer(60);
    }
  });

  // Render exercise card
  const renderExercise = (ex: Exercise, index: number, isSelected: boolean) => {
    const icon = EXERCISE_ICONS[workout.type] || '🏋️';

    return (
      <Box
        key={ex.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isSelected ? 'cyan' : 'gray'}
        paddingX={1}
        marginBottom={1}
      >
        <Box justifyContent="space-between">
          <Text bold={isSelected}>{icon} {ex.name}</Text>
          {ex.sets && <Text dimColor>{ex.sets.length} sets</Text>}
        </Box>

        {ex.sets && ex.sets.length > 0 && (
          <Box gap={1} marginTop={1}>
            {ex.sets.map((set, setIdx) => {
              const isCurrentSet = isSelected && setIdx === currentSet;
              const isPast = isSelected && setIdx < currentSet;

              return (
                <Box
                  key={setIdx}
                  borderStyle={isCurrentSet ? 'bold' : 'single'}
                  borderColor={isPast ? 'green' : isCurrentSet ? 'yellow' : 'gray'}
                  paddingX={1}
                >
                  <Text color={isPast ? 'green' : isCurrentSet ? 'yellow' : undefined}>
                    {set.reps && `${set.reps}x`}
                    {set.weight && ` ${set.weight}lb`}
                    {set.duration && ` ${set.duration}s`}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        {ex.duration && !ex.sets && (
          <Text dimColor>Duration: {formatDuration(ex.duration)}</Text>
        )}

        {ex.notes && (
          <Text dimColor italic>{truncate(ex.notes, 40)}</Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">{workout.name}</Text>
          <Text dimColor>{workout.type} workout</Text>
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          {isActive ? (
            <>
              <Text color="green">● ACTIVE</Text>
              <Text bold>{formatDuration(Math.floor(elapsedSeconds / 60))}</Text>
            </>
          ) : (
            <Text dimColor>Not started</Text>
          )}
        </Box>
      </Box>

      {/* Progress */}
      {isActive && totalSets > 0 && (
        <Box marginBottom={1}>
          <ProgressBar
            value={completedSets}
            max={totalSets}
            width={40}
            label="Progress"
            color="cyan"
          />
        </Box>
      )}

      {/* Rest timer */}
      {restTimer !== null && restTimer > 0 && (
        <Box
          borderStyle="double"
          borderColor="yellow"
          padding={1}
          marginBottom={1}
          justifyContent="center"
        >
          <Text bold color="yellow">REST: {restTimer}s</Text>
        </Box>
      )}

      {/* Exercises */}
      <Box flexDirection="column">
        {workout.exercises.length === 0 ? (
          <Text dimColor italic>No exercises. Add some to start.</Text>
        ) : (
          workout.exercises.map((ex, index) =>
            renderExercise(ex, index, index === currentExercise)
          )
        )}
      </Box>

      {/* Current exercise detail */}
      {exercise && isActive && (
        <Box
          borderStyle="round"
          borderColor="cyan"
          padding={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text bold>Current: {exercise.name}</Text>
          {exercise.sets && exercise.sets[currentSet] && (
            <Box gap={2}>
              <Text>Set {currentSet + 1}/{exercise.sets.length}</Text>
              {exercise.sets[currentSet].reps && (
                <Text bold color="cyan">{exercise.sets[currentSet].reps} reps</Text>
              )}
              {exercise.sets[currentSet].weight && (
                <Text bold color="green">{exercise.sets[currentSet].weight} lb</Text>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Stats */}
      {workout.calories && (
        <Box marginTop={1}>
          <Text dimColor>Estimated: {workout.calories} calories</Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>↑↓</Text> exercises</Text>
        {exercise?.sets && <Text dimColor><Text bold>←→</Text> sets</Text>}
        {!isActive && <Text dimColor><Text bold>s</Text> start</Text>}
        {isActive && <Text dimColor><Text bold>Space</Text> complete set</Text>}
        {isActive && <Text dimColor><Text bold>n</Text> skip</Text>}
        {isActive && <Text dimColor><Text bold>f</Text> finish</Text>}
        <Text dimColor><Text bold>r</Text> rest timer</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default WorkoutCanvas;
