// Git Diff Canvas - Side-by-side diff viewer

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useTerminalSize } from '../../shared/hooks';
import { truncate } from '../../shared/utils';

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface FileDiff {
  path: string;
  oldPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  binary?: boolean;
}

export interface GitDiffConfig {
  files: FileDiff[];
  title?: string;
  showStats?: boolean;
  unifiedView?: boolean;
}

export interface GitDiffResult {
  action: 'select-file' | 'stage' | 'unstage' | 'discard' | 'view-file';
  filePath: string;
  hunkIndex?: number;
}

export interface GitDiffProps {
  config: GitDiffConfig;
  onResult?: (result: GitDiffResult) => void;
}

const STATUS_COLORS: Record<string, string> = {
  added: 'green',
  modified: 'yellow',
  deleted: 'red',
  renamed: 'cyan',
  copied: 'blue',
};

const STATUS_ICONS: Record<string, string> = {
  added: '+',
  modified: '~',
  deleted: '-',
  renamed: 'R',
  copied: 'C',
};

export function GitDiffCanvas({ config, onResult }: GitDiffProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { files, title = 'Git Diff', showStats = true, unifiedView: initialUnified = false } = config;

  const [selectedFile, setSelectedFile] = useState(0);
  const [selectedLine, setSelectedLine] = useState(0);
  const [view, setView] = useState<'files' | 'diff'>('files');
  const [unifiedView, setUnifiedView] = useState(initialUnified);

  const currentFile = files[selectedFile];

  // Flatten all diff lines for navigation
  const allLines = useMemo(() => {
    if (!currentFile) return [];
    return currentFile.hunks.flatMap(hunk => hunk.lines);
  }, [currentFile]);

  // Calculate stats
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  const maxVisibleLines = height - 10;
  const scrollOffset = Math.max(0, Math.min(selectedLine - Math.floor(maxVisibleLines / 2), allLines.length - maxVisibleLines));
  const visibleLines = allLines.slice(scrollOffset, scrollOffset + maxVisibleLines);

  useInput((input, key) => {
    if (key.escape) {
      if (view === 'diff') {
        setView('files');
        setSelectedLine(0);
      } else {
        exit();
      }
      return;
    }

    if (view === 'files') {
      // File navigation
      if (key.upArrow) {
        setSelectedFile(f => Math.max(0, f - 1));
      }
      if (key.downArrow) {
        setSelectedFile(f => Math.min(files.length - 1, f + 1));
      }
      if (key.return && currentFile) {
        setView('diff');
        setSelectedLine(0);
      }
    } else {
      // Diff navigation
      if (key.upArrow) {
        setSelectedLine(l => Math.max(0, l - 1));
      }
      if (key.downArrow) {
        setSelectedLine(l => Math.min(allLines.length - 1, l + 1));
      }
      if (key.pageUp) {
        setSelectedLine(l => Math.max(0, l - maxVisibleLines));
      }
      if (key.pageDown) {
        setSelectedLine(l => Math.min(allLines.length - 1, l + maxVisibleLines));
      }
      // Next/prev file
      if (key.leftArrow && selectedFile > 0) {
        setSelectedFile(f => f - 1);
        setSelectedLine(0);
      }
      if (key.rightArrow && selectedFile < files.length - 1) {
        setSelectedFile(f => f + 1);
        setSelectedLine(0);
      }
    }

    // Toggle unified/split view
    if (input === 'u') {
      setUnifiedView(v => !v);
    }

    // Actions
    if (input === 's' && currentFile) {
      onResult?.({
        action: 'stage',
        filePath: currentFile.path,
      });
    }

    if (input === 'r' && currentFile) {
      onResult?.({
        action: 'unstage',
        filePath: currentFile.path,
      });
    }

    if (input === 'd' && currentFile) {
      onResult?.({
        action: 'discard',
        filePath: currentFile.path,
      });
    }

    if (input === 'o' && currentFile) {
      onResult?.({
        action: 'view-file',
        filePath: currentFile.path,
      });
    }
  });

  // Render file list
  const renderFileList = () => (
    <Box flexDirection="column">
      {files.map((file, index) => {
        const isSelected = index === selectedFile;
        const statusColor = STATUS_COLORS[file.status];
        const statusIcon = STATUS_ICONS[file.status];

        return (
          <Box
            key={file.path}
            backgroundColor={isSelected ? 'gray' : undefined}
          >
            <Text color={statusColor as never}>{statusIcon} </Text>
            <Text bold={isSelected}>{truncate(file.path, width - 25)}</Text>
            <Text color="green"> +{file.additions}</Text>
            <Text color="red"> -{file.deletions}</Text>
            {file.oldPath && file.oldPath !== file.path && (
              <Text dimColor> (from {truncate(file.oldPath, 20)})</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );

  // Render unified diff
  const renderUnifiedDiff = () => {
    if (!currentFile) return null;

    return (
      <Box flexDirection="column">
        {/* File header */}
        <Box marginBottom={1}>
          <Text color={STATUS_COLORS[currentFile.status] as never}>
            {STATUS_ICONS[currentFile.status]}
          </Text>
          <Text bold> {currentFile.path}</Text>
          <Text color="green"> +{currentFile.additions}</Text>
          <Text color="red"> -{currentFile.deletions}</Text>
        </Box>

        {/* Diff content */}
        {currentFile.binary ? (
          <Text dimColor italic>Binary file</Text>
        ) : (
          <Box flexDirection="column" borderStyle="single">
            {visibleLines.map((line, visibleIndex) => {
              const actualIndex = scrollOffset + visibleIndex;
              const isSelected = actualIndex === selectedLine;

              const bgColor = isSelected ? 'gray' :
                line.type === 'add' ? '#1a2e1a' :
                line.type === 'remove' ? '#2e1a1a' : undefined;

              const textColor = line.type === 'add' ? 'green' :
                line.type === 'remove' ? 'red' :
                line.type === 'header' ? 'cyan' : undefined;

              return (
                <Box key={actualIndex} backgroundColor={bgColor as never}>
                  {/* Line numbers */}
                  <Text dimColor>
                    {(line.oldLineNo?.toString() || '').padStart(4)}
                  </Text>
                  <Text dimColor>
                    {(line.newLineNo?.toString() || '').padStart(4)}
                  </Text>
                  <Text dimColor> </Text>

                  {/* Change indicator */}
                  <Text color={textColor as never}>
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : line.type === 'header' ? '@' : ' '}
                  </Text>

                  {/* Content */}
                  <Text color={textColor as never}>
                    {truncate(line.content, width - 15)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Scroll indicator */}
        {allLines.length > maxVisibleLines && (
          <Box justifyContent="center" marginTop={1}>
            <Text dimColor>
              {selectedLine + 1}/{allLines.length}
            </Text>
          </Box>
        )}
      </Box>
    );
  };

  // Render split diff
  const renderSplitDiff = () => {
    if (!currentFile) return null;

    const halfWidth = Math.floor((width - 6) / 2);

    return (
      <Box flexDirection="column">
        {/* File header */}
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="red">{currentFile.oldPath || currentFile.path} (old)</Text>
          <Text bold color="green">{currentFile.path} (new)</Text>
        </Box>

        {/* Split content */}
        {currentFile.binary ? (
          <Text dimColor italic>Binary file</Text>
        ) : (
          <Box>
            {/* Old side */}
            <Box flexDirection="column" width={halfWidth} borderStyle="single">
              {visibleLines.map((line, visibleIndex) => {
                const actualIndex = scrollOffset + visibleIndex;
                const isSelected = actualIndex === selectedLine;

                if (line.type === 'add') {
                  return (
                    <Box key={actualIndex} backgroundColor={isSelected ? 'gray' : undefined}>
                      <Text dimColor>{' '.repeat(halfWidth - 2)}</Text>
                    </Box>
                  );
                }

                return (
                  <Box
                    key={actualIndex}
                    backgroundColor={isSelected ? 'gray' : line.type === 'remove' ? '#2e1a1a' as never : undefined}
                  >
                    <Text dimColor>{(line.oldLineNo?.toString() || '').padStart(4)} </Text>
                    <Text color={line.type === 'remove' ? 'red' : undefined}>
                      {truncate(line.content, halfWidth - 7)}
                    </Text>
                  </Box>
                );
              })}
            </Box>

            {/* New side */}
            <Box flexDirection="column" width={halfWidth} borderStyle="single">
              {visibleLines.map((line, visibleIndex) => {
                const actualIndex = scrollOffset + visibleIndex;
                const isSelected = actualIndex === selectedLine;

                if (line.type === 'remove') {
                  return (
                    <Box key={actualIndex} backgroundColor={isSelected ? 'gray' : undefined}>
                      <Text dimColor>{' '.repeat(halfWidth - 2)}</Text>
                    </Box>
                  );
                }

                return (
                  <Box
                    key={actualIndex}
                    backgroundColor={isSelected ? 'gray' : line.type === 'add' ? '#1a2e1a' as never : undefined}
                  >
                    <Text dimColor>{(line.newLineNo?.toString() || '').padStart(4)} </Text>
                    <Text color={line.type === 'add' ? 'green' : undefined}>
                      {truncate(line.content, halfWidth - 7)}
                    </Text>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">{title}</Text>
        {showStats && (
          <Box gap={2}>
            <Text>{files.length} files</Text>
            <Text color="green">+{totalAdditions}</Text>
            <Text color="red">-{totalDeletions}</Text>
          </Box>
        )}
      </Box>

      {/* View indicator */}
      <Box gap={2} marginBottom={1}>
        <Text inverse={view === 'files'}> Files </Text>
        <Text inverse={view === 'diff'}> Diff </Text>
        {view === 'diff' && (
          <>
            <Text dimColor>|</Text>
            <Text inverse={unifiedView}> Unified </Text>
            <Text inverse={!unifiedView}> Split </Text>
          </>
        )}
      </Box>

      {/* Content */}
      {view === 'files' && renderFileList()}
      {view === 'diff' && (unifiedView ? renderUnifiedDiff() : renderSplitDiff())}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>↑↓</Text> navigate</Text>
        {view === 'files' && <Text dimColor><Text bold>Enter</Text> view diff</Text>}
        {view === 'diff' && <Text dimColor><Text bold>←→</Text> files</Text>}
        <Text dimColor><Text bold>u</Text> toggle view</Text>
        <Text dimColor><Text bold>s</Text> stage</Text>
        <Text dimColor><Text bold>r</Text> unstage</Text>
        <Text dimColor><Text bold>d</Text> discard</Text>
        <Text dimColor><Text bold>o</Text> open</Text>
        <Text dimColor><Text bold>ESC</Text> {view === 'diff' ? 'back' : 'exit'}</Text>
      </Box>
    </Box>
  );
}

export default GitDiffCanvas;
