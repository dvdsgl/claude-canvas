// Sales Pipeline Canvas - CRM deal management

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Deal, PipelineStage, Money } from '../../shared/types';
import { useTerminalSize } from '../../shared/hooks';
import { formatMoney, formatDate, formatPercent, truncate, formatRelativeTime } from '../../shared/utils';

export interface PipelineConfig {
  title?: string;
  stages: PipelineStage[];
  currency?: string;
  showProbability?: boolean;
  showValue?: boolean;
  showOwner?: boolean;
  showExpectedClose?: boolean;
}

export interface PipelineResult {
  action: 'select' | 'move' | 'update' | 'create';
  dealId?: string;
  deal?: Deal;
  fromStage?: string;
  toStage?: string;
  newProbability?: number;
}

export interface PipelineProps {
  config: PipelineConfig;
  onResult?: (result: PipelineResult) => void;
}

export function Pipeline({ config, onResult }: PipelineProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const {
    title,
    stages,
    currency = 'USD',
    showProbability = true,
    showValue = true,
    showOwner = true,
    showExpectedClose = true,
  } = config;

  const [currentStages, setCurrentStages] = useState<PipelineStage[]>(stages);
  const [selectedStage, setSelectedStage] = useState(0);
  const [selectedDeal, setSelectedDeal] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<{ deal: Deal; fromStage: number } | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const stageCount = currentStages.length;
  const columnWidth = Math.floor((width - 4) / stageCount);
  const maxVisibleDeals = Math.max(1, height - 12);

  const currentStage = currentStages[selectedStage];
  const currentDeal = currentStage?.deals[selectedDeal];

  // Calculate totals
  const totalValue = currentStages.reduce(
    (sum, stage) => sum + stage.deals.reduce((s, d) => s + d.value.amount, 0),
    0
  );
  const weightedValue = currentStages.reduce(
    (sum, stage) => sum + stage.deals.reduce((s, d) => s + (d.value.amount * d.probability) / 100, 0),
    0
  );

  useInput((input, key) => {
    if (key.escape) {
      if (isDragging) {
        setIsDragging(false);
        setDraggedDeal(null);
      } else if (showDetails) {
        setShowDetails(false);
      } else {
        exit();
      }
      return;
    }

    // Navigation
    if (key.leftArrow && !isDragging) {
      setSelectedStage(s => Math.max(0, s - 1));
      setSelectedDeal(0);
    }
    if (key.rightArrow && !isDragging) {
      setSelectedStage(s => Math.min(stageCount - 1, s + 1));
      setSelectedDeal(0);
    }
    if (key.upArrow) {
      setSelectedDeal(d => Math.max(0, d - 1));
    }
    if (key.downArrow) {
      const maxDeal = (currentStage?.deals?.length ?? 1) - 1;
      setSelectedDeal(d => Math.min(maxDeal, d + 1));
    }

    // Actions
    if (input === ' ' && currentDeal) {
      if (isDragging && draggedDeal) {
        // Drop deal
        const newStages = [...currentStages];
        const targetStage = newStages[selectedStage];
        const sourceStage = newStages[draggedDeal.fromStage];

        if (targetStage) {
          // Update probability based on stage
          const updatedDeal = {
            ...draggedDeal.deal,
            probability: targetStage.probability,
            stage: targetStage.id,
          };

          // Add to target
          targetStage.deals.splice(selectedDeal, 0, updatedDeal);

          // Remove from source
          if (draggedDeal.fromStage !== selectedStage && sourceStage) {
            sourceStage.deals = sourceStage.deals.filter(d => d.id !== draggedDeal.deal.id);
          }

          const fromStage = currentStages[draggedDeal.fromStage];
          setCurrentStages(newStages);
          onResult?.({
            action: 'move',
            dealId: draggedDeal.deal.id,
            deal: updatedDeal,
            fromStage: fromStage?.id ?? '',
            toStage: targetStage.id,
            newProbability: targetStage.probability,
          });
        }

        setIsDragging(false);
        setDraggedDeal(null);
      } else {
        setIsDragging(true);
        setDraggedDeal({ deal: currentDeal, fromStage: selectedStage });
      }
    }

    if (key.return && currentDeal) {
      if (showDetails) {
        onResult?.({
          action: 'select',
          dealId: currentDeal.id,
          deal: currentDeal,
        });
      } else {
        setShowDetails(true);
      }
    }

    // Quick move to adjacent stage
    if (isDragging && draggedDeal) {
      if (input === 'h' && selectedStage > 0) {
        setSelectedStage(s => s - 1);
      }
      if (input === 'l' && selectedStage < stageCount - 1) {
        setSelectedStage(s => s + 1);
      }
    }

    // New deal
    if (input === 'n') {
      onResult?.({
        action: 'create',
        toStage: currentStage?.id,
      });
    }
  });

  // Render deal card
  const renderDeal = (deal: Deal, isSelected: boolean, isDragSource: boolean) => {
    const cardW = columnWidth - 4;

    return (
      <Box
        key={deal.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : 'single'}
        borderColor={isDragSource ? 'yellow' : isSelected ? 'cyan' : 'gray'}
        width={cardW}
        paddingX={1}
      >
        {/* Company/Deal name */}
        <Text bold wrap="truncate-end">
          {truncate(deal.name, cardW - 2)}
        </Text>
        <Text dimColor wrap="truncate-end">
          {truncate(deal.company, cardW - 2)}
        </Text>

        {/* Value */}
        {showValue && (
          <Text color="green">
            {formatMoney(deal.value)}
          </Text>
        )}

        {/* Probability */}
        {showProbability && (
          <Box>
            <Text dimColor>Prob: </Text>
            <Text color={deal.probability >= 75 ? 'green' : deal.probability >= 50 ? 'yellow' : 'gray'}>
              {deal.probability}%
            </Text>
          </Box>
        )}

        {/* Expected close */}
        {showExpectedClose && deal.expectedCloseDate && (
          <Text dimColor>
            Close: {formatDate(deal.expectedCloseDate, 'short')}
          </Text>
        )}

        {/* Owner */}
        {showOwner && deal.owner && (
          <Text dimColor>
            @{truncate(deal.owner.name, cardW - 4)}
          </Text>
        )}

        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <Box gap={1}>
            {deal.tags.slice(0, 2).map(tag => (
              <Text key={tag} dimColor>[{tag}]</Text>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  // Render stage column
  const renderStage = (stage: PipelineStage, stageIndex: number) => {
    const isSelectedStage = stageIndex === selectedStage;
    const dealCount = stage.deals.length;
    const stageValue = stage.deals.reduce((sum, d) => sum + d.value.amount, 0);

    const scrollOffset = isSelectedStage
      ? Math.max(0, Math.min(selectedDeal - Math.floor(maxVisibleDeals / 2), dealCount - maxVisibleDeals))
      : 0;
    const visibleDeals = stage.deals.slice(scrollOffset, scrollOffset + maxVisibleDeals);

    return (
      <Box
        key={stage.id}
        flexDirection="column"
        width={columnWidth}
        borderStyle={isSelectedStage ? 'bold' : 'single'}
        borderColor={isSelectedStage ? 'cyan' : stage.color as never || 'gray'}
      >
        {/* Stage header */}
        <Box flexDirection="column" paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold color={stage.color as never}>
              {truncate(stage.name, columnWidth - 10)}
            </Text>
            <Text dimColor>{dealCount}</Text>
          </Box>
          <Text dimColor>
            {formatMoney({ amount: stageValue, currency })} | {stage.probability}%
          </Text>
        </Box>

        {/* Deals */}
        <Box flexDirection="column" paddingX={1} gap={1}>
          {visibleDeals.length === 0 ? (
            <Text dimColor italic>No deals</Text>
          ) : (
            visibleDeals.map((deal, visibleIndex) => {
              const actualIndex = scrollOffset + visibleIndex;
              const isSelected = isSelectedStage && actualIndex === selectedDeal;
              const isDragSource = draggedDeal?.deal.id === deal.id;
              return renderDeal(deal, isSelected, isDragSource);
            })
          )}

          {/* Drop zone when dragging */}
          {isDragging && isSelectedStage && (
            <Box
              borderStyle="single"
              borderColor="yellow"
              width={columnWidth - 4}
              justifyContent="center"
            >
              <Text color="yellow">Drop → {stage.probability}%</Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // Render deal details panel
  const renderDetails = () => {
    if (!showDetails || !currentDeal) return null;

    return (
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor="cyan"
        padding={1}
        position="absolute"
        marginLeft={Math.floor(width / 4)}
        width={Math.floor(width / 2)}
      >
        <Text bold color="cyan">{currentDeal.name}</Text>
        <Text>{currentDeal.company}</Text>

        <Box marginTop={1} flexDirection="column">
          <Text>Value: <Text color="green">{formatMoney(currentDeal.value)}</Text></Text>
          <Text>Probability: {currentDeal.probability}%</Text>
          <Text>Weighted: <Text color="green">{formatMoney({ amount: Math.round(currentDeal.value.amount * currentDeal.probability / 100), currency })}</Text></Text>
          <Text>Expected Close: {formatDate(currentDeal.expectedCloseDate)}</Text>
          <Text>Owner: {currentDeal.owner.name}</Text>
          <Text>Contact: {currentDeal.contact.name} ({currentDeal.contact.email})</Text>
        </Box>

        {currentDeal.notes && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Notes:</Text>
            <Text dimColor>{currentDeal.notes}</Text>
          </Box>
        )}

        {currentDeal.activities && currentDeal.activities.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Recent Activity:</Text>
            {currentDeal.activities.slice(0, 3).map(activity => (
              <Text key={activity.id} dimColor>
                {activity.type}: {activity.subject} ({formatRelativeTime(activity.date)})
              </Text>
            ))}
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Press Enter to select | ESC to close</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">{title || 'Sales Pipeline'}</Text>
        <Box gap={3}>
          <Text>
            Total: <Text color="green">{formatMoney({ amount: totalValue, currency })}</Text>
          </Text>
          <Text>
            Weighted: <Text color="yellow">{formatMoney({ amount: Math.round(weightedValue), currency })}</Text>
          </Text>
          <Text dimColor>
            {currentStages.reduce((sum, s) => sum + s.deals.length, 0)} deals
          </Text>
        </Box>
      </Box>

      {/* Funnel visualization */}
      <Box marginBottom={1}>
        {currentStages.map((stage, i) => {
          const percent = totalValue > 0 ? (stage.deals.reduce((s, d) => s + d.value.amount, 0) / totalValue) * 100 : 0;
          const barWidth = Math.round((percent / 100) * (width - 20));
          return (
            <Text key={stage.id} color={stage.color as never}>
              {'█'.repeat(Math.max(1, barWidth))}
            </Text>
          );
        })}
      </Box>

      {/* Stages */}
      <Box>
        {currentStages.map((stage, index) => renderStage(stage, index))}
      </Box>

      {/* Details overlay */}
      {renderDetails()}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>←→</Text> stages</Text>
        <Text dimColor><Text bold>↑↓</Text> deals</Text>
        <Text dimColor><Text bold>Space</Text> drag</Text>
        <Text dimColor><Text bold>Enter</Text> details</Text>
        <Text dimColor><Text bold>n</Text> new</Text>
        <Text dimColor><Text bold>ESC</Text> {isDragging ? 'cancel' : showDetails ? 'close' : 'exit'}</Text>
      </Box>
    </Box>
  );
}

export default Pipeline;
