// Raw Markdown Renderer - Syntax highlighted markdown source view

import React from "react";
import { Box, Text } from "ink";

interface Props {
  content: string;
  cursorPosition?: number;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  scrollOffset?: number;
  viewportHeight?: number;
  terminalWidth?: number;
}

// Markdown syntax highlighting colors
const SYNTAX_COLORS = {
  header: "cyan",
  bold: "yellow",
  italic: "magenta",
  code: "green",
  codeBlock: "green",
  link: "blue",
  linkUrl: "gray",
  blockquote: "gray",
  listMarker: "yellow",
  hr: "gray",
} as const;

interface HighlightedSegment {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  dimColor?: boolean;
}

// Tokenize a line of markdown for syntax highlighting
function highlightLine(line: string): HighlightedSegment[] {
  const segments: HighlightedSegment[] = [];

  // Check for header
  const headerMatch = line.match(/^(#{1,6})\s/);
  if (headerMatch) {
    segments.push({ text: headerMatch[1], color: SYNTAX_COLORS.header, bold: true });
    segments.push({ text: " " });
    // Highlight rest of header line
    const rest = line.slice(headerMatch[0].length);
    segments.push(...highlightInline(rest, { bold: true }));
    return segments;
  }

  // Check for blockquote
  if (line.startsWith("> ")) {
    segments.push({ text: "> ", color: SYNTAX_COLORS.blockquote, bold: true });
    segments.push(...highlightInline(line.slice(2), { dimColor: true }));
    return segments;
  }

  // Check for code block fence
  if (line.startsWith("```")) {
    segments.push({ text: line, color: SYNTAX_COLORS.codeBlock, dimColor: true });
    return segments;
  }

  // Check for horizontal rule
  if (/^[-*_]{3,}\s*$/.test(line)) {
    segments.push({ text: line, color: SYNTAX_COLORS.hr, dimColor: true });
    return segments;
  }

  // Check for list item
  const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
  if (listMatch) {
    if (listMatch[1]) {
      segments.push({ text: listMatch[1] });
    }
    segments.push({ text: listMatch[2], color: SYNTAX_COLORS.listMarker, bold: true });
    segments.push({ text: " " });
    const rest = line.slice(listMatch[0].length);
    segments.push(...highlightInline(rest));
    return segments;
  }

  // Regular line - just highlight inline elements
  segments.push(...highlightInline(line));
  return segments;
}

// Highlight inline markdown elements
function highlightInline(text: string, baseStyle: Partial<HighlightedSegment> = {}): HighlightedSegment[] {
  const segments: HighlightedSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      segments.push({ text: "`", color: SYNTAX_COLORS.code, ...baseStyle });
      segments.push({ text: codeMatch[1], color: SYNTAX_COLORS.code, ...baseStyle });
      segments.push({ text: "`", color: SYNTAX_COLORS.code, ...baseStyle });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      segments.push({ text: "**", color: SYNTAX_COLORS.bold, dimColor: true, ...baseStyle });
      segments.push({ text: boldMatch[1], color: SYNTAX_COLORS.bold, bold: true, ...baseStyle });
      segments.push({ text: "**", color: SYNTAX_COLORS.bold, dimColor: true, ...baseStyle });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      segments.push({ text: "*", color: SYNTAX_COLORS.italic, dimColor: true, ...baseStyle });
      segments.push({ text: italicMatch[1], color: SYNTAX_COLORS.italic, italic: true, ...baseStyle });
      segments.push({ text: "*", color: SYNTAX_COLORS.italic, dimColor: true, ...baseStyle });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      segments.push({ text: "[", color: SYNTAX_COLORS.link, dimColor: true, ...baseStyle });
      segments.push({ text: linkMatch[1], color: SYNTAX_COLORS.link, ...baseStyle });
      segments.push({ text: "](", color: SYNTAX_COLORS.link, dimColor: true, ...baseStyle });
      segments.push({ text: linkMatch[2], color: SYNTAX_COLORS.linkUrl, dimColor: true, ...baseStyle });
      segments.push({ text: ")", color: SYNTAX_COLORS.link, dimColor: true, ...baseStyle });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text - take until next special character
    const plainMatch = remaining.match(/^[^`*\[]+/);
    if (plainMatch) {
      segments.push({ text: plainMatch[0], ...baseStyle });
      remaining = remaining.slice(plainMatch[0].length);
      continue;
    }

    // Single special character (didn't match any pattern)
    segments.push({ text: remaining[0], ...baseStyle });
    remaining = remaining.slice(1);
  }

  return segments;
}

export function RawMarkdownRenderer({
  content,
  cursorPosition,
  selectionStart,
  selectionEnd,
  scrollOffset = 0,
  viewportHeight = 20,
  terminalWidth = 76,
}: Props) {
  const lines = content.split("\n");
  const visibleLines = lines.slice(scrollOffset, scrollOffset + viewportHeight);

  // Calculate cursor line and column
  let cursorLine = -1;
  let cursorCol = -1;
  if (cursorPosition !== undefined) {
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= cursorPosition) {
        cursorLine = i;
        cursorCol = cursorPosition - charCount;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }
    // Handle cursor at very end
    if (cursorLine === -1) {
      cursorLine = lines.length - 1;
      cursorCol = lines[lines.length - 1].length;
    }
  }

  // Normalize selection bounds
  const selStart = selectionStart != null && selectionEnd != null
    ? Math.min(selectionStart, selectionEnd)
    : null;
  const selEnd = selectionStart != null && selectionEnd != null
    ? Math.max(selectionStart, selectionEnd)
    : null;
  const hasSelection = selStart !== null && selEnd !== null && selStart !== selEnd;

  // Calculate line offsets for selection
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }

  // Track if we're inside a code block
  let inCodeBlock = false;

  return (
    <Box flexDirection="column">
      {visibleLines.map((line, idx) => {
        const absoluteLineNumber = scrollOffset + idx;
        const lineStartOffset = lineOffsets[absoluteLineNumber] || 0;
        const lineEndOffset = lineStartOffset + line.length;

        // Track code block state
        if (line.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
        }

        // Check if cursor is on this line
        const hasCursor = cursorLine === absoluteLineNumber;

        // Calculate selection range for this line
        let lineSelStart = -1;
        let lineSelEnd = -1;
        if (hasSelection && selStart !== null && selEnd !== null) {
          if (selStart < lineEndOffset && selEnd > lineStartOffset) {
            lineSelStart = Math.max(0, selStart - lineStartOffset);
            lineSelEnd = Math.min(line.length, selEnd - lineStartOffset);
          }
        }

        // Inside code block - render as plain green (with cursor/selection support)
        if (inCodeBlock && !line.startsWith("```")) {
          return (
            <Box key={absoluteLineNumber}>
              {renderLineWithCursorAndSelection(
                line,
                hasCursor ? cursorCol : -1,
                lineSelStart,
                lineSelEnd,
                { color: SYNTAX_COLORS.codeBlock }
              )}
            </Box>
          );
        }

        // Highlight the line with cursor and selection
        const segments = highlightLine(line);

        return (
          <Box key={absoluteLineNumber}>
            {renderSegmentsWithCursorAndSelection(
              segments,
              line,
              hasCursor ? cursorCol : -1,
              lineSelStart,
              lineSelEnd
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// Render a plain line with cursor and selection
function renderLineWithCursorAndSelection(
  line: string,
  cursorCol: number,
  selStart: number,
  selEnd: number,
  style: Partial<HighlightedSegment>
): React.ReactNode {
  const hasSelection = selStart >= 0 && selEnd > selStart;
  const hasCursor = cursorCol >= 0;

  if (!hasSelection && !hasCursor) {
    return <Text color={style.color as any}>{line || " "}</Text>;
  }

  // Build character-by-character rendering
  const result: React.ReactNode[] = [];
  const lineLen = line.length || 1; // At least 1 for empty lines

  for (let i = 0; i <= line.length; i++) {
    const char = line[i] || (i === line.length && hasCursor && cursorCol >= line.length ? " " : "");
    if (!char) continue;

    const isSelected = hasSelection && i >= selStart && i < selEnd;
    const isCursor = hasCursor && i === cursorCol;

    if (isCursor) {
      result.push(
        <Text key={i} backgroundColor="white" color="black">{char}</Text>
      );
    } else if (isSelected) {
      result.push(
        <Text key={i} backgroundColor="blue" color="white">{char}</Text>
      );
    } else {
      result.push(
        <Text key={i} color={style.color as any}>{char}</Text>
      );
    }
  }

  return result.length > 0 ? <>{result}</> : <Text> </Text>;
}

// Render highlighted segments with cursor and selection
function renderSegmentsWithCursorAndSelection(
  segments: HighlightedSegment[],
  originalLine: string,
  cursorCol: number,
  selStart: number,
  selEnd: number
): React.ReactNode {
  const hasSelection = selStart >= 0 && selEnd > selStart;
  const hasCursor = cursorCol >= 0;

  if (segments.length === 0) {
    if (hasCursor && cursorCol >= 0) {
      return <Text backgroundColor="white" color="black"> </Text>;
    }
    return <Text> </Text>;
  }

  if (!hasSelection && !hasCursor) {
    // No cursor or selection - render normally
    return segments.map((seg, segIdx) => (
      <Text
        key={segIdx}
        color={seg.color as any}
        bold={seg.bold}
        italic={seg.italic}
        dimColor={seg.dimColor}
      >
        {seg.text}
      </Text>
    ));
  }

  // Render character by character for cursor/selection support
  const result: React.ReactNode[] = [];
  let charIndex = 0;

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const seg = segments[segIdx];

    for (let i = 0; i < seg.text.length; i++) {
      const globalIdx = charIndex + i;
      const char = seg.text[i];
      const isSelected = hasSelection && globalIdx >= selStart && globalIdx < selEnd;
      const isCursor = hasCursor && globalIdx === cursorCol;

      if (isCursor) {
        result.push(
          <Text key={`${segIdx}-${i}`} backgroundColor="white" color="black">{char}</Text>
        );
      } else if (isSelected) {
        result.push(
          <Text key={`${segIdx}-${i}`} backgroundColor="blue" color="white">{char}</Text>
        );
      } else {
        result.push(
          <Text
            key={`${segIdx}-${i}`}
            color={seg.color as any}
            bold={seg.bold}
            italic={seg.italic}
            dimColor={seg.dimColor}
          >
            {char}
          </Text>
        );
      }
    }

    charIndex += seg.text.length;
  }

  // Cursor at end of line
  if (hasCursor && cursorCol >= charIndex) {
    result.push(
      <Text key="cursor-end" backgroundColor="white" color="black">{" "}</Text>
    );
  }

  return result;
}
