// Budget Canvas - Personal/Business budget tracker

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Budget, BudgetCategory, Transaction, Money } from '../../shared/types';
import { useTerminalSize } from '../../shared/hooks';
import { BarChart, ProgressBar, PieChart } from '../../shared/components/Chart';
import { formatMoney, formatDate, formatPercent, truncate, CHART_COLORS } from '../../shared/utils';

export interface BudgetConfig {
  budget: Budget;
  transactions?: Transaction[];
  showChart?: boolean;
  showTransactions?: boolean;
  period?: 'weekly' | 'monthly' | 'yearly';
}

export interface BudgetResult {
  action: 'select-category' | 'add-transaction' | 'update-budget' | 'view-transactions';
  categoryId?: string;
  transaction?: Transaction;
}

export interface BudgetProps {
  config: BudgetConfig;
  onResult?: (result: BudgetResult) => void;
}

export function BudgetCanvas({ config, onResult }: BudgetProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const {
    budget,
    transactions = [],
    showChart = true,
    showTransactions = true,
    period = 'monthly',
  } = config;

  const [selectedCategory, setSelectedCategory] = useState(0);
  const [view, setView] = useState<'overview' | 'chart' | 'transactions'>('overview');

  // Calculate totals
  const totals = useMemo(() => {
    const totalBudgeted = budget.categories.reduce((sum, cat) => sum + cat.budgeted.amount, 0);
    const totalSpent = budget.categories.reduce((sum, cat) => sum + cat.spent.amount, 0);
    const remaining = totalBudgeted - totalSpent;
    const percentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
    return { totalBudgeted, totalSpent, remaining, percentUsed };
  }, [budget]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return budget.categories.map((cat, i) => ({
      label: cat.name,
      value: cat.spent.amount / 100,
      color: cat.color || CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [budget]);

  const currentCategory = budget.categories[selectedCategory];

  // Filter transactions for selected category
  const categoryTransactions = useMemo(() => {
    if (!currentCategory) return [];
    return transactions.filter(t => t.category === currentCategory.name).slice(0, 10);
  }, [transactions, currentCategory]);

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    // View switching
    if (input === '1') setView('overview');
    if (input === '2' && showChart) setView('chart');
    if (input === '3' && showTransactions) setView('transactions');

    // Category navigation
    if (key.upArrow) {
      setSelectedCategory(c => Math.max(0, c - 1));
    }
    if (key.downArrow) {
      setSelectedCategory(c => Math.min(budget.categories.length - 1, c + 1));
    }

    // Actions
    if (key.return && currentCategory) {
      onResult?.({
        action: 'select-category',
        categoryId: currentCategory.id,
      });
    }

    if (input === 'a') {
      onResult?.({
        action: 'add-transaction',
        categoryId: currentCategory?.id,
      });
    }

    if (input === 't') {
      onResult?.({
        action: 'view-transactions',
        categoryId: currentCategory?.id,
      });
    }

    if (input === 'e') {
      onResult?.({
        action: 'update-budget',
        categoryId: currentCategory?.id,
      });
    }
  });

  // Render category row
  const renderCategory = (category: BudgetCategory, index: number, isSelected: boolean) => {
    const percent = category.budgeted.amount > 0
      ? (category.spent.amount / category.budgeted.amount) * 100
      : 0;
    const remaining = category.budgeted.amount - category.spent.amount;
    const isOverBudget = remaining < 0;
    const barWidth = Math.min(width - 60, 30);

    return (
      <Box
        key={category.id}
        flexDirection="column"
        borderStyle={isSelected ? 'bold' : undefined}
        borderColor={isSelected ? 'cyan' : undefined}
        paddingX={isSelected ? 1 : 0}
      >
        <Box justifyContent="space-between">
          <Box>
            <Text color={category.color as never}>●</Text>
            <Text bold={isSelected}> {truncate(category.name, 20).padEnd(20)}</Text>
          </Box>
          <Text>
            <Text color={isOverBudget ? 'red' : 'green'}>
              {formatMoney(category.spent)}
            </Text>
            <Text dimColor> / {formatMoney(category.budgeted)}</Text>
          </Text>
        </Box>
        <Box>
          <Text dimColor>{'  '}</Text>
          <Text color={percent > 100 ? 'red' : percent > 80 ? 'yellow' : 'green'}>
            {'█'.repeat(Math.min(Math.round(percent / 100 * barWidth), barWidth))}
          </Text>
          <Text dimColor>
            {'░'.repeat(Math.max(0, barWidth - Math.round(percent / 100 * barWidth)))}
          </Text>
          <Text dimColor> {formatPercent(percent, 0)}</Text>
          <Text color={isOverBudget ? 'red' : 'green'}>
            {' '}{isOverBudget ? 'Over' : 'Left'}: {formatMoney({ amount: Math.abs(remaining), currency: category.spent.currency })}
          </Text>
        </Box>
      </Box>
    );
  };

  // Render overview view
  const renderOverview = () => (
    <Box flexDirection="column">
      {/* Summary */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
        justifyContent="space-around"
      >
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Budgeted</Text>
          <Text bold>{formatMoney({ amount: totals.totalBudgeted, currency: budget.categories[0]?.budgeted.currency || 'USD' })}</Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Spent</Text>
          <Text bold color={totals.percentUsed > 100 ? 'red' : 'green'}>
            {formatMoney({ amount: totals.totalSpent, currency: budget.categories[0]?.spent.currency || 'USD' })}
          </Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Remaining</Text>
          <Text bold color={totals.remaining < 0 ? 'red' : 'green'}>
            {formatMoney({ amount: Math.abs(totals.remaining), currency: budget.categories[0]?.budgeted.currency || 'USD' })}
            {totals.remaining < 0 ? ' over' : ''}
          </Text>
        </Box>
        <Box flexDirection="column" alignItems="center">
          <Text dimColor>Used</Text>
          <Text bold color={totals.percentUsed > 100 ? 'red' : totals.percentUsed > 80 ? 'yellow' : 'green'}>
            {formatPercent(totals.percentUsed, 0)}
          </Text>
        </Box>
      </Box>

      {/* Categories */}
      <Box flexDirection="column" gap={1}>
        {budget.categories.map((cat, index) =>
          renderCategory(cat, index, index === selectedCategory)
        )}
      </Box>
    </Box>
  );

  // Render chart view
  const renderChartView = () => (
    <Box flexDirection="column" gap={1}>
      <Text bold>Spending by Category</Text>
      <PieChart data={chartData} showLegend showPercent />

      <Box marginTop={1}><Text bold>Budget vs Spent</Text></Box>
      <BarChart
        data={budget.categories.map((cat, i) => ({
          label: truncate(cat.name, 12),
          value: cat.spent.amount / 100,
          color: cat.color || CHART_COLORS[i % CHART_COLORS.length],
        }))}
        maxValue={Math.max(...budget.categories.map(c => c.budgeted.amount)) / 100}
        showValues
      />
    </Box>
  );

  // Render transactions view
  const renderTransactionsView = () => (
    <Box flexDirection="column">
      <Text bold>
        Recent Transactions
        {currentCategory && ` - ${currentCategory.name}`}
      </Text>

      {/* Transaction list */}
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text bold>{'Date'.padEnd(12)}</Text>
          <Text bold>{'Description'.padEnd(25)}</Text>
          <Text bold>{'Category'.padEnd(15)}</Text>
          <Text bold>{'Amount'.padStart(12)}</Text>
        </Box>

        {categoryTransactions.length === 0 ? (
          <Text dimColor italic>No transactions</Text>
        ) : (
          categoryTransactions.map(tx => (
            <Box key={tx.id}>
              <Text dimColor>{formatDate(tx.date, 'short').padEnd(12)}</Text>
              <Text>{truncate(tx.description, 24).padEnd(25)}</Text>
              <Text dimColor>{truncate(tx.category, 14).padEnd(15)}</Text>
              <Text color={tx.type === 'expense' ? 'red' : 'green'}>
                {tx.type === 'expense' ? '-' : '+'}
                {formatMoney(tx.amount).padStart(11)}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">{budget.name}</Text>
          <Text dimColor>
            {formatDate(budget.startDate, 'short')} - {formatDate(budget.endDate, 'short')}
            {' | '}{budget.period}
          </Text>
        </Box>
        <Box gap={2}>
          <Text inverse={view === 'overview'}> 1 Overview </Text>
          {showChart && <Text inverse={view === 'chart'}> 2 Charts </Text>}
          {showTransactions && <Text inverse={view === 'transactions'}> 3 Transactions </Text>}
        </Box>
      </Box>

      {/* Content */}
      {view === 'overview' && renderOverview()}
      {view === 'chart' && renderChartView()}
      {view === 'transactions' && renderTransactionsView()}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>1-3</Text> views</Text>
        <Text dimColor><Text bold>↑↓</Text> categories</Text>
        <Text dimColor><Text bold>a</Text> add transaction</Text>
        <Text dimColor><Text bold>t</Text> view transactions</Text>
        <Text dimColor><Text bold>e</Text> edit budget</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default BudgetCanvas;
