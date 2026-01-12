// Layout - Container and layout components

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { TabConfig } from '../types';
import { useTerminalSize, useNavigation } from '../hooks';
import { truncate } from '../utils';

// ============================================
// PANEL
// ============================================

export interface PanelProps {
  title?: string;
  children: React.ReactNode;
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
  borderColor?: string;
  width?: number | string;
  height?: number;
  padding?: number;
  focused?: boolean;
}

export function Panel({
  title,
  children,
  borderStyle = 'round',
  borderColor = 'gray',
  width,
  height,
  padding = 1,
  focused = false,
}: PanelProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={(focused ? 'cyan' : borderColor) as never}
      width={width as number}
      height={height}
      paddingX={padding}
    >
      {title && (
        <Box marginTop={-1} marginLeft={1}>
          <Text bold color={focused ? 'cyan' : undefined}> {title} </Text>
        </Box>
      )}
      {children}
    </Box>
  );
}

// ============================================
// TABS
// ============================================

export interface TabsProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
  focused?: boolean;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  focused = true,
}: TabsProps): React.ReactElement {
  const activeIndex = tabs.findIndex(t => t.id === activeTab);

  useInput((_, key) => {
    if (!focused) return;

    if (key.leftArrow) {
      const newIndex = (activeIndex - 1 + tabs.length) % tabs.length;
      if (!tabs[newIndex].disabled) {
        onTabChange(tabs[newIndex].id);
      }
    }
    if (key.rightArrow) {
      const newIndex = (activeIndex + 1) % tabs.length;
      if (!tabs[newIndex].disabled) {
        onTabChange(tabs[newIndex].id);
      }
    }
  });

  return (
    <Box flexDirection="column">
      {/* Tab bar */}
      <Box>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <Box key={tab.id} marginRight={1}>
              <Text
                inverse={isActive}
                dimColor={tab.disabled}
                color={isActive && focused ? 'cyan' : undefined}
              >
                {tab.icon && `${tab.icon} `}
                {` ${tab.label} `}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Tab content */}
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

// ============================================
// SPLIT PANE
// ============================================

export interface SplitPaneProps {
  direction?: 'horizontal' | 'vertical';
  sizes?: [number, number]; // Percentages
  minSize?: number;
  children: [React.ReactNode, React.ReactNode];
  showDivider?: boolean;
}

export function SplitPane({
  direction = 'horizontal',
  sizes = [50, 50],
  children,
  showDivider = true,
}: SplitPaneProps): React.ReactElement {
  const { width, height } = useTerminalSize();

  const [size1, size2] = sizes;
  const total = size1 + size2;

  if (direction === 'horizontal') {
    const width1 = Math.floor((width * size1) / total);
    const width2 = width - width1 - (showDivider ? 1 : 0);

    return (
      <Box>
        <Box width={width1} flexDirection="column">
          {children[0]}
        </Box>
        {showDivider && (
          <Box flexDirection="column">
            {Array.from({ length: height - 2 }).map((_, i) => (
              <Text key={i} dimColor>│</Text>
            ))}
          </Box>
        )}
        <Box width={width2} flexDirection="column">
          {children[1]}
        </Box>
      </Box>
    );
  }

  const height1 = Math.floor((height * size1) / total);
  const height2 = height - height1 - (showDivider ? 1 : 0);

  return (
    <Box flexDirection="column">
      <Box height={height1}>{children[0]}</Box>
      {showDivider && <Text dimColor>{'─'.repeat(width)}</Text>}
      <Box height={height2}>{children[1]}</Box>
    </Box>
  );
}

// ============================================
// GRID
// ============================================

export interface GridProps {
  columns?: number;
  gap?: number;
  children: React.ReactNode;
}

export function Grid({
  columns = 2,
  gap = 1,
  children,
}: GridProps): React.ReactElement {
  const { width } = useTerminalSize();
  const childArray = React.Children.toArray(children);
  const columnWidth = Math.floor((width - (columns - 1) * gap) / columns);

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < childArray.length; i += columns) {
    rows.push(childArray.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column" gap={gap}>
      {rows.map((row, rowIndex) => (
        <Box key={rowIndex} gap={gap}>
          {row.map((child, colIndex) => (
            <Box key={colIndex} width={columnWidth}>
              {child}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ============================================
// ACCORDION
// ============================================

export interface AccordionSection {
  id: string;
  title: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  sections: AccordionSection[];
  expandedIds?: string[];
  onToggle?: (id: string) => void;
  allowMultiple?: boolean;
  focused?: boolean;
}

export function Accordion({
  sections,
  expandedIds = [],
  onToggle,
  allowMultiple = false,
  focused = true,
}: AccordionProps): React.ReactElement {
  const [internalExpanded, setInternalExpanded] = useState<string[]>(expandedIds);
  const expanded = onToggle ? expandedIds : internalExpanded;

  const { selectedIndex } = useNavigation({
    itemCount: sections.length,
    onActivate: (index) => {
      const section = sections[index];
      if (section.disabled) return;

      if (onToggle) {
        onToggle(section.id);
      } else {
        setInternalExpanded(prev => {
          if (prev.includes(section.id)) {
            return prev.filter(id => id !== section.id);
          }
          return allowMultiple ? [...prev, section.id] : [section.id];
        });
      }
    },
  });

  return (
    <Box flexDirection="column">
      {sections.map((section, index) => {
        const isExpanded = expanded.includes(section.id);
        const isSelected = selectedIndex === index;

        return (
          <Box key={section.id} flexDirection="column">
            <Box>
              <Text
                inverse={isSelected && focused}
                dimColor={section.disabled}
                bold
              >
                {isExpanded ? '▼' : '▶'} {section.title}
              </Text>
            </Box>
            {isExpanded && (
              <Box marginLeft={2} flexDirection="column">
                {section.content}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ============================================
// MODAL / DIALOG
// ============================================

export interface ModalProps {
  title?: string;
  children: React.ReactNode;
  width?: number;
  onClose?: () => void;
  actions?: { label: string; action: () => void; primary?: boolean }[];
  focused?: boolean;
}

export function Modal({
  title,
  children,
  width = 50,
  onClose,
  actions = [],
  focused = true,
}: ModalProps): React.ReactElement {
  const { width: termWidth, height: termHeight } = useTerminalSize();
  const [actionIndex, setActionIndex] = useState(0);

  useInput((_, key) => {
    if (!focused) return;

    if (key.escape && onClose) {
      onClose();
    }

    if (actions.length > 0) {
      if (key.leftArrow) {
        setActionIndex(i => Math.max(0, i - 1));
      }
      if (key.rightArrow) {
        setActionIndex(i => Math.min(actions.length - 1, i + 1));
      }
      if (key.return) {
        actions[actionIndex].action();
      }
    }
  });

  const left = Math.floor((termWidth - width) / 2);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      width={width}
      marginLeft={left}
    >
      {title && (
        <Box justifyContent="space-between" paddingX={1}>
          <Text bold color="cyan">{title}</Text>
          {onClose && <Text dimColor>[ESC] Close</Text>}
        </Box>
      )}

      <Box paddingX={1} flexDirection="column">
        {children}
      </Box>

      {actions.length > 0 && (
        <Box justifyContent="flex-end" paddingX={1} gap={1}>
          {actions.map((action, index) => (
            <Text
              key={action.label}
              inverse={actionIndex === index}
              color={action.primary ? 'cyan' : undefined}
            >
              [{action.label}]
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ============================================
// DRAWER
// ============================================

export interface DrawerProps {
  title?: string;
  children: React.ReactNode;
  width?: number;
  position?: 'left' | 'right';
  isOpen: boolean;
  onClose?: () => void;
}

export function Drawer({
  title,
  children,
  width = 40,
  position = 'right',
  isOpen,
  onClose,
}: DrawerProps): React.ReactElement {
  const { width: termWidth } = useTerminalSize();

  useInput((_, key) => {
    if (key.escape && onClose) {
      onClose();
    }
  });

  if (!isOpen) return <></>;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      width={width}
      height="100%"
      position="absolute"
      marginLeft={position === 'right' ? termWidth - width : 0}
    >
      {title && (
        <Box justifyContent="space-between" paddingX={1} borderBottom>
          <Text bold color="cyan">{title}</Text>
          {onClose && <Text dimColor>ESC</Text>}
        </Box>
      )}
      <Box paddingX={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

// ============================================
// BREADCRUMBS
// ============================================

export interface BreadcrumbItem {
  id: string;
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: string;
}

export function Breadcrumbs({
  items,
  separator = ' > ',
}: BreadcrumbsProps): React.ReactElement {
  return (
    <Box>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && <Text dimColor>{separator}</Text>}
          <Text
            dimColor={index < items.length - 1}
            bold={index === items.length - 1}
          >
            {item.label}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

// ============================================
// STATUS BAR
// ============================================

export interface StatusBarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  backgroundColor?: string;
}

export function StatusBar({
  left,
  center,
  right,
  backgroundColor = 'gray',
}: StatusBarProps): React.ReactElement {
  const { width } = useTerminalSize();

  return (
    <Box backgroundColor={backgroundColor as never} width={width}>
      <Box width="33%" justifyContent="flex-start">
        {left}
      </Box>
      <Box width="34%" justifyContent="center">
        {center}
      </Box>
      <Box width="33%" justifyContent="flex-end">
        {right}
      </Box>
    </Box>
  );
}

// ============================================
// HEADER
// ============================================

export interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: { label: string; shortcut?: string }[];
}

export function Header({
  title,
  subtitle,
  actions = [],
}: HeaderProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box justifyContent="space-between">
        <Text bold color="cyan">{title}</Text>
        <Box gap={2}>
          {actions.map(action => (
            <Text key={action.label} dimColor>
              {action.shortcut && `[${action.shortcut}] `}{action.label}
            </Text>
          ))}
        </Box>
      </Box>
      {subtitle && <Text dimColor>{subtitle}</Text>}
      <Text dimColor>{'─'.repeat(80)}</Text>
    </Box>
  );
}

// ============================================
// FOOTER
// ============================================

export interface FooterProps {
  children?: React.ReactNode;
  keyHints?: { key: string; label: string }[];
}

export function Footer({
  children,
  keyHints = [],
}: FooterProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text dimColor>{'─'.repeat(80)}</Text>
      {children || (
        <Box gap={2}>
          {keyHints.map(hint => (
            <Text key={hint.key} dimColor>
              <Text bold>{hint.key}</Text> {hint.label}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ============================================
// LIST
// ============================================

export interface ListItemData {
  id: string;
  primary: string;
  secondary?: string;
  icon?: string;
  badge?: string | number;
  disabled?: boolean;
}

export interface ListProps {
  items: ListItemData[];
  onSelect?: (item: ListItemData, index: number) => void;
  onActivate?: (item: ListItemData, index: number) => void;
  maxHeight?: number;
  showDividers?: boolean;
  focused?: boolean;
}

export function List({
  items,
  onSelect,
  onActivate,
  maxHeight,
  showDividers = false,
  focused = true,
}: ListProps): React.ReactElement {
  const { selectedIndex } = useNavigation({
    itemCount: items.length,
    onSelect: (index) => onSelect?.(items[index], index),
    onActivate: (index) => onActivate?.(items[index], index),
  });

  const visibleCount = maxHeight || items.length;
  const scrollOffset = Math.max(0, Math.min(selectedIndex - Math.floor(visibleCount / 2), items.length - visibleCount));
  const visibleItems = items.slice(scrollOffset, scrollOffset + visibleCount);

  return (
    <Box flexDirection="column">
      {visibleItems.map((item, visibleIndex) => {
        const actualIndex = scrollOffset + visibleIndex;
        const isSelected = actualIndex === selectedIndex;

        return (
          <React.Fragment key={item.id}>
            {showDividers && actualIndex > 0 && <Text dimColor>{'─'.repeat(40)}</Text>}
            <Box>
              <Text
                inverse={isSelected && focused}
                dimColor={item.disabled}
              >
                {item.icon && `${item.icon} `}
                {item.primary}
                {item.badge !== undefined && ` (${item.badge})`}
              </Text>
            </Box>
            {item.secondary && (
              <Box marginLeft={2}>
                <Text dimColor>{item.secondary}</Text>
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

// ============================================
// TREE
// ============================================

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  expanded?: boolean;
  icon?: string;
}

export interface TreeProps {
  nodes: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  onToggle?: (node: TreeNode) => void;
  expandedIds?: string[];
  selectedId?: string;
}

export function Tree({
  nodes,
  onSelect,
  onToggle,
  expandedIds = [],
  selectedId,
}: TreeProps): React.ReactElement {
  const renderNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.includes(node.id);
    const isSelected = selectedId === node.id;

    return (
      <Box key={node.id} flexDirection="column">
        <Box>
          <Text>{'  '.repeat(depth)}</Text>
          <Text
            inverse={isSelected}
            color={isSelected ? 'cyan' : undefined}
          >
            {hasChildren ? (isExpanded ? '▼ ' : '▶ ') : '  '}
            {node.icon && `${node.icon} `}
            {node.label}
          </Text>
        </Box>
        {hasChildren && isExpanded && (
          <Box flexDirection="column">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {nodes.map(node => renderNode(node))}
    </Box>
  );
}

// ============================================
// EMPTY STATE
// ============================================

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
  action?: { label: string; onAction: () => void };
}

export function EmptyState({
  title,
  description,
  icon = '📭',
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" paddingY={2}>
      <Text>{icon}</Text>
      <Text bold>{title}</Text>
      {description && <Text dimColor>{description}</Text>}
      {action && (
        <Box marginTop={1}>
          <Text color="cyan">[{action.label}]</Text>
        </Box>
      )}
    </Box>
  );
}

// ============================================
// LOADING
// ============================================

export interface LoadingProps {
  message?: string;
}

export function Loading({
  message = 'Loading...',
}: LoadingProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      <Text color="cyan">{frames[frame]}</Text>
      <Text> {message}</Text>
    </Box>
  );
}

// ============================================
// NOTIFICATION / TOAST
// ============================================

export interface NotificationProps {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  onDismiss?: () => void;
}

export function Notification({
  type,
  title,
  message,
  onDismiss,
}: NotificationProps): React.ReactElement {
  const icons = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
  };

  const colors = {
    info: 'blue',
    success: 'green',
    warning: 'yellow',
    error: 'red',
  };

  useInput((_, key) => {
    if (key.escape && onDismiss) {
      onDismiss();
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={colors[type] as never}
      paddingX={1}
      flexDirection="column"
    >
      <Box>
        <Text color={colors[type] as never}>{icons[type]} </Text>
        <Text bold>{title}</Text>
      </Box>
      {message && <Text>{message}</Text>}
    </Box>
  );
}

export default {
  Panel,
  Tabs,
  SplitPane,
  Grid,
  Accordion,
  Modal,
  Drawer,
  Breadcrumbs,
  StatusBar,
  Header,
  Footer,
  List,
  Tree,
  EmptyState,
  Loading,
  Notification,
};
