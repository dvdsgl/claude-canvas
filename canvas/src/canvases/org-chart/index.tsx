// Org Chart Canvas - Organization hierarchy visualization

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Person } from '../../shared/types';
import { useTerminalSize } from '../../shared/hooks';
import { truncate } from '../../shared/utils';

export interface OrgNode {
  id: string;
  person: Person;
  title: string;
  department?: string;
  children: OrgNode[];
  expanded?: boolean;
  metadata?: Record<string, unknown>;
}

export interface OrgChartConfig {
  root: OrgNode;
  title?: string;
  showDepartments?: boolean;
  showEmail?: boolean;
  collapsible?: boolean;
}

export interface OrgChartResult {
  action: 'select' | 'expand' | 'collapse' | 'view-profile' | 'add-report';
  nodeId: string;
  person?: Person;
}

export interface OrgChartProps {
  config: OrgChartConfig;
  onResult?: (result: OrgChartResult) => void;
}

export function OrgChartCanvas({ config, onResult }: OrgChartProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const {
    root,
    title = 'Organization Chart',
    showDepartments = true,
    showEmail = false,
    collapsible = true,
  } = config;

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set([root.id]));
  const [selectedId, setSelectedId] = useState(root.id);

  // Flatten tree for navigation
  const flattenedNodes = useMemo(() => {
    const result: { node: OrgNode; depth: number; isLast: boolean; parentPath: boolean[] }[] = [];

    const traverse = (node: OrgNode, depth: number, parentPath: boolean[]) => {
      result.push({ node, depth, isLast: false, parentPath });

      if (expandedIds.has(node.id) && node.children.length > 0) {
        node.children.forEach((child, index) => {
          const isLast = index === node.children.length - 1;
          traverse(child, depth + 1, [...parentPath, !isLast]);
        });
      }
    };

    traverse(root, 0, []);

    // Mark last siblings
    for (let i = result.length - 1; i >= 0; i--) {
      const current = result[i];
      if (!current) continue;
      let foundSibling = false;
      for (let j = i + 1; j < result.length; j++) {
        const item = result[j];
        if (!item) continue;
        if (item.depth === current.depth) {
          foundSibling = true;
          break;
        }
        if (item.depth < current.depth) break;
      }
      current.isLast = !foundSibling;
    }

    return result;
  }, [root, expandedIds]);

  const selectedIndex = flattenedNodes.findIndex(n => n.node.id === selectedId);
  const selectedNode = flattenedNodes[selectedIndex]?.node;

  const maxVisible = height - 8;
  const scrollOffset = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), flattenedNodes.length - maxVisible));
  const visibleNodes = flattenedNodes.slice(scrollOffset, scrollOffset + maxVisible);

  useInput((input, key) => {
    if (key.escape) {
      exit();
      return;
    }

    // Navigation
    if (key.upArrow) {
      const newIndex = Math.max(0, selectedIndex - 1);
      const newNode = flattenedNodes[newIndex];
      if (newNode) setSelectedId(newNode.node.id);
    }
    if (key.downArrow) {
      const newIndex = Math.min(flattenedNodes.length - 1, selectedIndex + 1);
      const newNode = flattenedNodes[newIndex];
      if (newNode) setSelectedId(newNode.node.id);
    }

    // Expand/collapse
    if ((key.rightArrow || key.return) && selectedNode) {
      if (selectedNode.children.length > 0 && !expandedIds.has(selectedId)) {
        setExpandedIds(new Set([...expandedIds, selectedId]));
        onResult?.({
          action: 'expand',
          nodeId: selectedId,
          person: selectedNode.person,
        });
      } else if (key.return) {
        onResult?.({
          action: 'select',
          nodeId: selectedId,
          person: selectedNode.person,
        });
      }
    }

    if (key.leftArrow && selectedNode) {
      if (expandedIds.has(selectedId) && selectedNode.children.length > 0) {
        const newExpanded = new Set(expandedIds);
        newExpanded.delete(selectedId);
        setExpandedIds(newExpanded);
        onResult?.({
          action: 'collapse',
          nodeId: selectedId,
          person: selectedNode.person,
        });
      } else {
        // Go to parent
        const currentNode = flattenedNodes[selectedIndex];
        if (currentNode) {
          const parentIndex = flattenedNodes.findIndex((n, i) =>
            i < selectedIndex && n.depth < currentNode.depth
          );
          const parentNode = flattenedNodes[parentIndex];
          if (parentIndex >= 0 && parentNode) {
            setSelectedId(parentNode.node.id);
          }
        }
      }
    }

    // Toggle expand/collapse
    if (input === ' ' && selectedNode && selectedNode.children.length > 0 && collapsible) {
      const newExpanded = new Set(expandedIds);
      if (expandedIds.has(selectedId)) {
        newExpanded.delete(selectedId);
      } else {
        newExpanded.add(selectedId);
      }
      setExpandedIds(newExpanded);
    }

    // View profile
    if (input === 'p' && selectedNode) {
      onResult?.({
        action: 'view-profile',
        nodeId: selectedId,
        person: selectedNode.person,
      });
    }

    // Expand all
    if (input === 'e') {
      const allIds = new Set<string>();
      const collectIds = (node: OrgNode) => {
        allIds.add(node.id);
        node.children.forEach(collectIds);
      };
      collectIds(root);
      setExpandedIds(allIds);
    }

    // Collapse all
    if (input === 'c') {
      setExpandedIds(new Set([root.id]));
    }
  });

  // Render org node
  const renderNode = (
    node: OrgNode,
    depth: number,
    isLast: boolean,
    parentPath: boolean[],
    isSelected: boolean
  ) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const cardWidth = Math.min(40, width - depth * 4 - 6);

    // Build tree lines
    let prefix = '';
    for (let i = 0; i < depth; i++) {
      if (i === depth - 1) {
        prefix += isLast ? '└── ' : '├── ';
      } else {
        prefix += parentPath[i] ? '│   ' : '    ';
      }
    }

    return (
      <Box key={node.id}>
        <Text dimColor>{prefix}</Text>
        <Box
          flexDirection="column"
          borderStyle={isSelected ? 'bold' : 'single'}
          borderColor={isSelected ? 'cyan' : 'gray'}
          paddingX={1}
          width={cardWidth}
        >
          {/* Expand indicator */}
          {hasChildren && collapsible && (
            <Text color={isSelected ? 'cyan' : 'gray'}>
              {isExpanded ? '▼' : '▶'} {node.children.length}
            </Text>
          )}

          {/* Person info */}
          <Text bold={isSelected}>{node.person.name}</Text>
          <Text color={isSelected ? 'cyan' : 'gray'}>{node.title}</Text>

          {showDepartments && node.department && (
            <Text dimColor>{node.department}</Text>
          )}

          {showEmail && node.person.email && (
            <Text dimColor>{node.person.email}</Text>
          )}
        </Box>
      </Box>
    );
  };

  // Count total employees
  const countNodes = (node: OrgNode): number => {
    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
  };
  const totalCount = countNodes(root);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">{title}</Text>
        <Text dimColor>{totalCount} people</Text>
      </Box>

      {/* Tree view */}
      <Box flexDirection="column">
        {visibleNodes.map(({ node, depth, isLast, parentPath }) => {
          const isSelected = node.id === selectedId;
          return renderNode(node, depth, isLast, parentPath, isSelected);
        })}
      </Box>

      {/* Scroll indicator */}
      {flattenedNodes.length > maxVisible && (
        <Box justifyContent="center" marginTop={1}>
          <Text dimColor>
            {selectedIndex + 1}/{flattenedNodes.length}
          </Text>
        </Box>
      )}

      {/* Selected person details */}
      {selectedNode && (
        <Box marginTop={1} borderStyle="round" borderColor="cyan" padding={1}>
          <Box flexDirection="column">
            <Text bold>{selectedNode.person.name}</Text>
            <Text>{selectedNode.title}</Text>
            {selectedNode.department && <Text dimColor>{selectedNode.department}</Text>}
            {selectedNode.person.email && <Text dimColor>{selectedNode.person.email}</Text>}
            <Text dimColor>
              {selectedNode.children.length} direct report{selectedNode.children.length !== 1 ? 's' : ''}
            </Text>
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>↑↓</Text> navigate</Text>
        <Text dimColor><Text bold>←→</Text> collapse/expand</Text>
        {collapsible && <Text dimColor><Text bold>Space</Text> toggle</Text>}
        <Text dimColor><Text bold>e</Text> expand all</Text>
        <Text dimColor><Text bold>c</Text> collapse all</Text>
        <Text dimColor><Text bold>p</Text> profile</Text>
        <Text dimColor><Text bold>Enter</Text> select</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default OrgChartCanvas;
