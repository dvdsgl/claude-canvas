// Kanban Board Canvas - Drag and drop task management

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { KanbanColumn, KanbanCard, Label } from '../../shared/types';
import { useTerminalSize, useNavigation, useMouse } from '../../shared/hooks';
import { truncate, formatDate, formatRelativeTime } from '../../shared/utils';

export interface KanbanConfig {
  title?: string;
  columns: KanbanColumn[];
  showLabels?: boolean;
  showAssignees?: boolean;
  showDueDates?: boolean;
  showEstimates?: boolean;
  cardWidth?: number;
}

export interface KanbanResult {
  action: 'move' | 'select' | 'create' | 'delete';
  cardId?: string;
  fromColumn?: string;
  toColumn?: string;
  card?: KanbanCard;
}

export interface KanbanProps {
  config: KanbanConfig;
  onResult?: (result: KanbanResult) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'red',
  high: 'yellow',
  medium: 'blue',
  low: 'gray',
};

const PRIORITY_ICONS: Record<string, string> = {
  urgent: '🔴',
  high: '🟠',
  medium: '🔵',
  low: '⚪',
};

export function Kanban({ config, onResult }: KanbanProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const {
    title,
    columns,
    showLabels = true,
    showAssignees = true,
    showDueDates = true,
    showEstimates = false,
    cardWidth = 28,
  } = config;

  const [currentColumns, setCurrentColumns] = useState<KanbanColumn[]>(columns);
  const [selectedColumn, setSelectedColumn] = useState(0);
  const [selectedCard, setSelectedCard] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedCard, setDraggedCard] = useState<{ card: KanbanCard; fromColumn: number } | null>(null);

  // Calculate layout
  const columnCount = currentColumns.length;
  const availableWidth = width - 4;
  const actualColumnWidth = Math.min(cardWidth + 4, Math.floor(availableWidth / columnCount));
  const maxVisibleCards = Math.max(1, height - 8);

  // Get current column and card
  const currentCol = currentColumns[selectedColumn];
  const currentCard = currentCol?.cards[selectedCard];

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (isDragging) {
        setIsDragging(false);
        setDraggedCard(null);
      } else {
        exit();
      }
      return;
    }

    // Navigation
    if (key.leftArrow && !isDragging) {
      setSelectedColumn(c => Math.max(0, c - 1));
      setSelectedCard(0);
    }
    if (key.rightArrow && !isDragging) {
      setSelectedColumn(c => Math.min(columnCount - 1, c + 1));
      setSelectedCard(0);
    }
    if (key.upArrow) {
      setSelectedCard(c => Math.max(0, c - 1));
    }
    if (key.downArrow) {
      const maxCard = (currentCol?.cards?.length ?? 1) - 1;
      setSelectedCard(c => Math.min(maxCard, c + 1));
    }

    // Actions
    if (input === ' ' || key.return) {
      if (isDragging && draggedCard) {
        // Drop card
        const newColumns = [...currentColumns];
        const targetCol = newColumns[selectedColumn];

        if (targetCol) {
          // Add to target
          targetCol.cards.splice(selectedCard, 0, draggedCard.card);

          // Remove from source (if different column)
          if (draggedCard.fromColumn !== selectedColumn) {
            const sourceCol = newColumns[draggedCard.fromColumn];
            if (sourceCol) {
              sourceCol.cards = sourceCol.cards.filter(c => c.id !== draggedCard.card.id);
            }
          }

          const fromCol = currentColumns[draggedCard.fromColumn];
          setCurrentColumns(newColumns);
          onResult?.({
            action: 'move',
            cardId: draggedCard.card.id,
            fromColumn: fromCol?.id ?? '',
            toColumn: targetCol.id,
          });
        }

        setIsDragging(false);
        setDraggedCard(null);
      } else if (currentCard) {
        // Start dragging or select
        if (input === ' ') {
          setIsDragging(true);
          setDraggedCard({ card: currentCard, fromColumn: selectedColumn });
        } else {
          onResult?.({
            action: 'select',
            cardId: currentCard.id,
            card: currentCard,
          });
        }
      }
    }

    // Quick move with h/l
    if (isDragging && draggedCard) {
      if (input === 'h' && selectedColumn > 0) {
        setSelectedColumn(c => c - 1);
        setSelectedCard(0);
      }
      if (input === 'l' && selectedColumn < columnCount - 1) {
        setSelectedColumn(c => c + 1);
        setSelectedCard(0);
      }
    }

    // Create new card
    if (input === 'n') {
      onResult?.({
        action: 'create',
        toColumn: currentCol?.id,
      });
    }

    // Delete card
    if (input === 'd' && currentCard) {
      onResult?.({
        action: 'delete',
        cardId: currentCard.id,
        card: currentCard,
      });
    }
  });

  // Render a card
  const renderCard = (card: KanbanCard, isSelected: boolean, isDragSource: boolean) => {
    const cardW = actualColumnWidth - 4;

    return (
      <Box
        key={card.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isDragSource ? 'yellow' : isSelected ? 'cyan' : 'gray'}
        width={cardW}
        paddingX={1}
      >
        {/* Priority indicator */}
        {card.priority && (
          <Text color={PRIORITY_COLORS[card.priority] as never}>
            {PRIORITY_ICONS[card.priority]} {card.priority}
          </Text>
        )}

        {/* Title */}
        <Text bold wrap="truncate-end">
          {truncate(card.title, cardW - 2)}
        </Text>

        {/* Description */}
        {card.description && (
          <Text dimColor wrap="truncate-end">
            {truncate(card.description, cardW - 2)}
          </Text>
        )}

        {/* Labels */}
        {showLabels && card.labels && card.labels.length > 0 && (
          <Box gap={1} flexWrap="wrap">
            {card.labels.slice(0, 3).map(label => (
              <Text key={label.id} backgroundColor={label.color as never}>
                {truncate(label.name, 8)}
              </Text>
            ))}
          </Box>
        )}

        {/* Footer info */}
        <Box justifyContent="space-between">
          {/* Assignee */}
          {showAssignees && card.assignee && (
            <Text dimColor>@{truncate(card.assignee.name, 10)}</Text>
          )}

          {/* Due date */}
          {showDueDates && card.dueDate && (
            <Text
              color={new Date(card.dueDate) < new Date() ? 'red' : 'gray'}
            >
              {formatDate(card.dueDate, 'short')}
            </Text>
          )}

          {/* Estimate */}
          {showEstimates && card.estimate && (
            <Text dimColor>{card.estimate}h</Text>
          )}
        </Box>

        {/* Subtasks */}
        {card.subtasks && (
          <Text dimColor>
            ☑ {card.subtasks.completed}/{card.subtasks.total}
          </Text>
        )}

        {/* Comments/Attachments */}
        <Box gap={2}>
          {card.comments !== undefined && card.comments > 0 && (
            <Text dimColor>💬 {card.comments}</Text>
          )}
          {card.attachments !== undefined && card.attachments > 0 && (
            <Text dimColor>📎 {card.attachments}</Text>
          )}
        </Box>
      </Box>
    );
  };

  // Render a column
  const renderColumn = (column: KanbanColumn, colIndex: number) => {
    const isSelectedColumn = colIndex === selectedColumn;
    const cardCount = column.cards.length;
    const limitReached = column.limit && cardCount >= column.limit;

    // Scroll offset for cards
    const scrollOffset = isSelectedColumn
      ? Math.max(0, Math.min(selectedCard - Math.floor(maxVisibleCards / 2), cardCount - maxVisibleCards))
      : 0;
    const visibleCards = column.cards.slice(scrollOffset, scrollOffset + maxVisibleCards);

    return (
      <Box
        key={column.id}
        flexDirection="column"
        width={actualColumnWidth}
        borderStyle={isSelectedColumn ? 'bold' : 'single'}
        borderColor={isSelectedColumn ? 'cyan' : column.color as never || 'gray'}
      >
        {/* Column header */}
        <Box justifyContent="space-between" paddingX={1}>
          <Text bold color={column.color as never}>
            {truncate(column.title, actualColumnWidth - 10)}
          </Text>
          <Text
            color={limitReached ? 'red' : 'gray'}
          >
            {cardCount}{column.limit ? `/${column.limit}` : ''}
          </Text>
        </Box>

        {/* Cards */}
        <Box flexDirection="column" paddingX={1} gap={1}>
          {visibleCards.length === 0 ? (
            <Text dimColor italic>No cards</Text>
          ) : (
            visibleCards.map((card, visibleIndex) => {
              const actualIndex = scrollOffset + visibleIndex;
              const isSelected = isSelectedColumn && actualIndex === selectedCard;
              const isDragSource = draggedCard?.card.id === card.id;

              return renderCard(card, isSelected, isDragSource);
            })
          )}

          {/* Drop zone indicator when dragging */}
          {isDragging && isSelectedColumn && (
            <Box
              borderStyle="single"
              borderColor="yellow"
              width={actualColumnWidth - 4}
              justifyContent="center"
            >
              <Text color="yellow">Drop here</Text>
            </Box>
          )}
        </Box>

        {/* Scroll indicator */}
        {cardCount > maxVisibleCards && (
          <Box alignSelf="center">
            <Text dimColor>
              {scrollOffset > 0 ? '▲' : ' '}
              {scrollOffset + maxVisibleCards < cardCount ? '▼' : ' '}
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">{title || 'Kanban Board'}</Text>
        <Box gap={2}>
          {isDragging && (
            <Text color="yellow">
              Dragging: {truncate(draggedCard?.card.title || '', 20)}
            </Text>
          )}
          <Text dimColor>
            {currentColumns.reduce((sum, col) => sum + col.cards.length, 0)} cards
          </Text>
        </Box>
      </Box>

      {/* Columns */}
      <Box>
        {currentColumns.map((column, index) => renderColumn(column, index))}
      </Box>

      {/* Footer / Help */}
      <Box marginTop={1} gap={2}>
        <Text dimColor>
          <Text bold>←→</Text> columns
        </Text>
        <Text dimColor>
          <Text bold>↑↓</Text> cards
        </Text>
        <Text dimColor>
          <Text bold>Space</Text> drag
        </Text>
        <Text dimColor>
          <Text bold>Enter</Text> select
        </Text>
        <Text dimColor>
          <Text bold>n</Text> new
        </Text>
        <Text dimColor>
          <Text bold>d</Text> delete
        </Text>
        <Text dimColor>
          <Text bold>ESC</Text> {isDragging ? 'cancel' : 'close'}
        </Text>
      </Box>
    </Box>
  );
}

export default Kanban;
