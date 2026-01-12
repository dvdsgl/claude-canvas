// Playlist Canvas - Music playlist builder and viewer

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Playlist, PlaylistItem } from '../../shared/types';
import { useTerminalSize } from '../../shared/hooks';
import { formatDuration, truncate, generateId } from '../../shared/utils';

export interface PlaylistConfig {
  playlist: Playlist;
  editable?: boolean;
  showDuration?: boolean;
  nowPlaying?: string; // item id
}

export interface PlaylistResult {
  action: 'play' | 'pause' | 'next' | 'prev' | 'shuffle' | 'reorder' | 'remove' | 'add' | 'select';
  playlist: Playlist;
  itemId?: string;
  item?: PlaylistItem;
}

export interface PlaylistProps {
  config: PlaylistConfig;
  onResult?: (result: PlaylistResult) => void;
}

export function PlaylistCanvas({ config, onResult }: PlaylistProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { playlist: initialPlaylist, editable = true, showDuration = true, nowPlaying } = config;

  const [playlist, setPlaylist] = useState<Playlist>(initialPlaylist);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(!!nowPlaying);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | undefined>(nowPlaying);

  const maxVisible = height - 10;
  const scrollOffset = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), playlist.items.length - maxVisible));
  const visibleItems = playlist.items.slice(scrollOffset, scrollOffset + maxVisible);

  const selectedItem = playlist.items[selectedIndex];

  useInput((input, key) => {
    if (key.escape) {
      if (isDragging) {
        setIsDragging(false);
      } else {
        exit();
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      if (isDragging && selectedIndex > 0) {
        // Reorder
        const newItems = [...playlist.items];
        const itemA = newItems[selectedIndex - 1];
        const itemB = newItems[selectedIndex];
        if (itemA && itemB) {
          newItems[selectedIndex - 1] = itemB;
          newItems[selectedIndex] = itemA;

          // Update order numbers
          newItems.forEach((item, i) => item.order = i);

          const newPlaylist = { ...playlist, items: newItems };
          setPlaylist(newPlaylist);
          setSelectedIndex(selectedIndex - 1);
        }
      } else {
        setSelectedIndex(i => Math.max(0, i - 1));
      }
    }

    if (key.downArrow) {
      if (isDragging && selectedIndex < playlist.items.length - 1) {
        // Reorder
        const newItems = [...playlist.items];
        const itemA = newItems[selectedIndex];
        const itemB = newItems[selectedIndex + 1];
        if (itemA && itemB) {
          newItems[selectedIndex] = itemB;
          newItems[selectedIndex + 1] = itemA;

          newItems.forEach((item, i) => item.order = i);

          const newPlaylist = { ...playlist, items: newItems };
          setPlaylist(newPlaylist);
          setSelectedIndex(selectedIndex + 1);
        }
      } else {
        setSelectedIndex(i => Math.min(playlist.items.length - 1, i + 1));
      }
    }

    // Playback controls
    if (input === ' ') {
      if (editable && !isPlaying) {
        // Toggle drag mode when not playing
        if (isDragging) {
          setIsDragging(false);
          onResult?.({ action: 'reorder', playlist });
        } else {
          setIsDragging(true);
        }
      } else {
        // Play/pause
        setIsPlaying(!isPlaying);
        onResult?.({
          action: isPlaying ? 'pause' : 'play',
          playlist,
          itemId: currentlyPlaying,
        });
      }
    }

    if (key.return && selectedItem) {
      // Play selected
      setCurrentlyPlaying(selectedItem.id);
      setIsPlaying(true);
      onResult?.({
        action: 'play',
        playlist,
        itemId: selectedItem.id,
        item: selectedItem,
      });
    }

    // Next/Previous
    if (input === 'n' || input === ']') {
      const currentIndex = playlist.items.findIndex(i => i.id === currentlyPlaying);
      if (currentIndex < playlist.items.length - 1) {
        const nextItem = playlist.items[currentIndex + 1];
        if (nextItem) {
          setCurrentlyPlaying(nextItem.id);
          setSelectedIndex(currentIndex + 1);
          onResult?.({ action: 'next', playlist, itemId: nextItem.id, item: nextItem });
        }
      }
    }

    if (input === 'p' || input === '[') {
      const currentIndex = playlist.items.findIndex(i => i.id === currentlyPlaying);
      if (currentIndex > 0) {
        const prevItem = playlist.items[currentIndex - 1];
        if (prevItem) {
          setCurrentlyPlaying(prevItem.id);
          setSelectedIndex(currentIndex - 1);
          onResult?.({ action: 'prev', playlist, itemId: prevItem.id, item: prevItem });
        }
      }
    }

    // Shuffle
    if (input === 's') {
      const newItems = [...playlist.items].sort(() => Math.random() - 0.5);
      newItems.forEach((item, i) => item.order = i);
      const newPlaylist = { ...playlist, items: newItems };
      setPlaylist(newPlaylist);
      onResult?.({ action: 'shuffle', playlist: newPlaylist });
    }

    // Remove
    if (input === 'd' && editable && selectedItem) {
      const newItems = playlist.items.filter(i => i.id !== selectedItem.id);
      newItems.forEach((item, i) => item.order = i);
      const newPlaylist = {
        ...playlist,
        items: newItems,
        duration: newItems.reduce((sum, i) => sum + i.duration, 0),
      };
      setPlaylist(newPlaylist);
      setSelectedIndex(Math.min(selectedIndex, newItems.length - 1));
      onResult?.({ action: 'remove', playlist: newPlaylist, itemId: selectedItem.id });
    }
  });

  // Render track item
  const renderTrack = (item: PlaylistItem, visibleIndex: number, isSelected: boolean) => {
    const actualIndex = scrollOffset + visibleIndex;
    const isNowPlaying = item.id === currentlyPlaying;

    return (
      <Box
        key={item.id}
        backgroundColor={isSelected ? 'gray' : undefined}
      >
        {/* Track number / Now playing indicator */}
        <Text color={isNowPlaying ? 'green' : 'gray'} bold={isNowPlaying}>
          {isNowPlaying ? (isPlaying ? '▶' : '❚❚') : String(actualIndex + 1).padStart(3)}
          {' '}
        </Text>

        {/* Drag indicator */}
        {isDragging && isSelected && (
          <Text color="yellow">☰ </Text>
        )}

        {/* Title */}
        <Text bold={isSelected || isNowPlaying} color={isNowPlaying ? 'green' : undefined}>
          {truncate(item.title, 35).padEnd(35)}
        </Text>

        {/* Artist */}
        <Text dimColor={!isNowPlaying}>
          {truncate(item.artist || 'Unknown', 20).padEnd(20)}
        </Text>

        {/* Album */}
        {item.album && (
          <Text dimColor>
            {truncate(item.album, 20).padEnd(20)}
          </Text>
        )}

        {/* Duration */}
        {showDuration && (
          <Text dimColor>
            {formatDuration(item.duration)}
          </Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">{playlist.name}</Text>
          {playlist.description && <Text dimColor>{playlist.description}</Text>}
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Text>{playlist.items.length} tracks</Text>
          <Text dimColor>{formatDuration(Math.floor(playlist.duration / 60))}</Text>
        </Box>
      </Box>

      {/* Now playing bar */}
      {currentlyPlaying && (
        <Box
          borderStyle="round"
          borderColor="green"
          padding={1}
          marginBottom={1}
          justifyContent="space-between"
        >
          <Box>
            <Text color="green">{isPlaying ? '▶' : '❚❚'} </Text>
            <Text bold>
              {playlist.items.find(i => i.id === currentlyPlaying)?.title || 'Unknown'}
            </Text>
            <Text dimColor>
              {' - '}{playlist.items.find(i => i.id === currentlyPlaying)?.artist || 'Unknown'}
            </Text>
          </Box>
          <Text dimColor>[p] prev | [n] next</Text>
        </Box>
      )}

      {/* Column headers */}
      <Box marginBottom={1}>
        <Text bold dimColor>{'#'.padStart(4)} </Text>
        <Text bold dimColor>{'Title'.padEnd(35)}</Text>
        <Text bold dimColor>{'Artist'.padEnd(20)}</Text>
        <Text bold dimColor>{'Album'.padEnd(20)}</Text>
        {showDuration && <Text bold dimColor>Time</Text>}
      </Box>

      {/* Track list */}
      {playlist.items.length === 0 ? (
        <Text dimColor italic>Empty playlist</Text>
      ) : (
        <Box flexDirection="column">
          {visibleItems.map((item, visibleIndex) => {
            const actualIndex = scrollOffset + visibleIndex;
            return renderTrack(item, visibleIndex, actualIndex === selectedIndex);
          })}
        </Box>
      )}

      {/* Scroll indicator */}
      {playlist.items.length > maxVisible && (
        <Box marginTop={1} justifyContent="center">
          <Text dimColor>
            {scrollOffset > 0 && '▲ '}
            {selectedIndex + 1}/{playlist.items.length}
            {scrollOffset + maxVisible < playlist.items.length && ' ▼'}
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>↑↓</Text> navigate</Text>
        <Text dimColor><Text bold>Enter</Text> play</Text>
        <Text dimColor><Text bold>Space</Text> {isDragging ? 'drop' : (editable ? 'drag' : 'pause')}</Text>
        <Text dimColor><Text bold>s</Text> shuffle</Text>
        <Text dimColor><Text bold>n/p</Text> next/prev</Text>
        {editable && <Text dimColor><Text bold>d</Text> remove</Text>}
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default PlaylistCanvas;
