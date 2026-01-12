// Form - Form input components for canvases

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import type { FormField, SelectOption } from '../types';
import { useNavigation, useFocusManager } from '../hooks';

// ============================================
// TEXT INPUT
// ============================================

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  password?: boolean;
  multiline?: boolean;
  width?: number;
  focused?: boolean;
  onSubmit?: (value: string) => void;
}

export function TextInput({
  value,
  onChange,
  placeholder = '',
  label,
  error,
  disabled = false,
  password = false,
  multiline = false,
  width = 30,
  focused = true,
  onSubmit,
}: TextInputProps): React.ReactElement {
  const [cursorPos, setCursorPos] = useState(value.length);

  useInput((input, key) => {
    if (!focused || disabled) return;

    if (key.return && !multiline) {
      onSubmit?.(value);
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorPos > 0) {
        const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(cursorPos - 1);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPos(Math.max(0, cursorPos - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPos(Math.min(value.length, cursorPos + 1));
      return;
    }

    if (key.ctrl && input === 'a') {
      setCursorPos(0);
      return;
    }

    if (key.ctrl && input === 'e') {
      setCursorPos(value.length);
      return;
    }

    // Regular character input
    if (input && !key.ctrl && !key.meta) {
      const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
      onChange(newValue);
      setCursorPos(cursorPos + input.length);
    }
  });

  const displayValue = password ? '•'.repeat(value.length) : value;
  const showPlaceholder = value.length === 0 && placeholder;

  // Build display with cursor
  let display = displayValue || placeholder;
  if (focused && !disabled) {
    const before = displayValue.slice(0, cursorPos);
    const cursor = displayValue[cursorPos] || ' ';
    const after = displayValue.slice(cursorPos + 1);
    display = before + '\x1b[7m' + cursor + '\x1b[0m' + after;
  }

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box
        borderStyle={focused ? 'bold' : 'single'}
        borderColor={error ? 'red' : focused ? 'cyan' : 'gray'}
        width={width + 2}
        paddingX={0}
      >
        <Text dimColor={!!showPlaceholder || disabled} color={disabled ? 'gray' : undefined}>
          {showPlaceholder ? placeholder : display}
        </Text>
      </Box>
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}

// ============================================
// SELECT / DROPDOWN
// ============================================

export interface SelectProps {
  options: SelectOption[];
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  focused?: boolean;
  width?: number;
}

export function Select({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select...',
  error,
  disabled = false,
  focused = true,
  width = 30,
}: SelectProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);
  const selectedIndex = options.findIndex(o => o.value === value);

  const { selectedIndex: highlightedIndex, setSelectedIndex: setHighlightedIndex } = useNavigation({
    itemCount: options.length,
    initialIndex: Math.max(0, selectedIndex),
    onActivate: (index) => {
      if (!options[index].disabled) {
        onChange(options[index].value);
        setIsOpen(false);
      }
    },
  });

  useInput((input, key) => {
    if (!focused || disabled) return;

    if (key.return || input === ' ') {
      if (isOpen) {
        if (!options[highlightedIndex].disabled) {
          onChange(options[highlightedIndex].value);
          setIsOpen(false);
        }
      } else {
        setIsOpen(true);
        setHighlightedIndex(Math.max(0, selectedIndex));
      }
    }

    if (key.escape && isOpen) {
      setIsOpen(false);
    }
  });

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box
        borderStyle={focused ? 'bold' : 'single'}
        borderColor={error ? 'red' : focused ? 'cyan' : 'gray'}
        width={width + 2}
      >
        <Text dimColor={!selectedOption || disabled}>
          {selectedOption ? selectedOption.label : placeholder}
          {' ▼'}
        </Text>
      </Box>

      {isOpen && !disabled && (
        <Box flexDirection="column" borderStyle="single" width={width + 2}>
          {options.map((option, index) => (
            <Box key={String(option.value)}>
              <Text
                inverse={highlightedIndex === index}
                dimColor={option.disabled}
                color={option.value === value ? 'cyan' : undefined}
              >
                {option.value === value ? '● ' : '  '}
                {option.label.padEnd(width - 2)}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}

// ============================================
// MULTI-SELECT
// ============================================

export interface MultiSelectProps {
  options: SelectOption[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  focused?: boolean;
  maxHeight?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  label,
  error,
  disabled = false,
  focused = true,
  maxHeight = 6,
}: MultiSelectProps): React.ReactElement {
  const { selectedIndex } = useNavigation({
    itemCount: options.length,
    onSelect: (index) => {
      if (disabled || options[index].disabled) return;
      const optValue = options[index].value;
      if (value.includes(optValue)) {
        onChange(value.filter(v => v !== optValue));
      } else {
        onChange([...value, optValue]);
      }
    },
  });

  useInput((input) => {
    if (!focused || disabled) return;

    if (input === ' ') {
      const optValue = options[selectedIndex].value;
      if (value.includes(optValue)) {
        onChange(value.filter(v => v !== optValue));
      } else {
        onChange([...value, optValue]);
      }
    }

    if (input === 'a') {
      onChange(options.filter(o => !o.disabled).map(o => o.value));
    }

    if (input === 'd') {
      onChange([]);
    }
  });

  const visibleStart = Math.max(0, Math.min(selectedIndex - Math.floor(maxHeight / 2), options.length - maxHeight));
  const visibleOptions = options.slice(visibleStart, visibleStart + maxHeight);

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box flexDirection="column" borderStyle={focused ? 'bold' : 'single'} borderColor={focused ? 'cyan' : 'gray'}>
        {visibleOptions.map((option, visibleIndex) => {
          const actualIndex = visibleStart + visibleIndex;
          const isSelected = actualIndex === selectedIndex;
          const isChecked = value.includes(option.value);

          return (
            <Box key={String(option.value)}>
              <Text
                inverse={isSelected}
                dimColor={option.disabled}
                color={isChecked ? 'green' : undefined}
              >
                {isChecked ? '[✓]' : '[ ]'} {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Text dimColor>Space: toggle | a: all | d: none | {value.length} selected</Text>
      {error && <Text color="red">{error}</Text>}
    </Box>
  );
}

// ============================================
// CHECKBOX
// ============================================

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  focused?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  focused = true,
}: CheckboxProps): React.ReactElement {
  useInput((input, key) => {
    if (!focused || disabled) return;
    if (input === ' ' || key.return) {
      onChange(!checked);
    }
  });

  return (
    <Box>
      <Text
        color={focused ? 'cyan' : undefined}
        dimColor={disabled}
        inverse={focused}
      >
        {checked ? '[✓]' : '[ ]'} {label}
      </Text>
    </Box>
  );
}

// ============================================
// RADIO GROUP
// ============================================

export interface RadioGroupProps {
  options: SelectOption[];
  value: string | number | undefined;
  onChange: (value: string | number) => void;
  label?: string;
  disabled?: boolean;
  focused?: boolean;
  horizontal?: boolean;
}

export function RadioGroup({
  options,
  value,
  onChange,
  label,
  disabled = false,
  focused = true,
  horizontal = false,
}: RadioGroupProps): React.ReactElement {
  const { selectedIndex } = useNavigation({
    itemCount: options.length,
    columns: horizontal ? options.length : 1,
    initialIndex: Math.max(0, options.findIndex(o => o.value === value)),
    onActivate: (index) => {
      if (!options[index].disabled) {
        onChange(options[index].value);
      }
    },
  });

  useInput((input, key) => {
    if (!focused || disabled) return;
    if (input === ' ' || key.return) {
      if (!options[selectedIndex].disabled) {
        onChange(options[selectedIndex].value);
      }
    }
  });

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box flexDirection={horizontal ? 'row' : 'column'} gap={horizontal ? 2 : 0}>
        {options.map((option, index) => {
          const isSelected = selectedIndex === index;
          const isChecked = option.value === value;

          return (
            <Box key={String(option.value)}>
              <Text
                inverse={isSelected && focused}
                dimColor={option.disabled || disabled}
                color={isChecked ? 'cyan' : undefined}
              >
                {isChecked ? '(●)' : '( )'} {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ============================================
// SLIDER
// ============================================

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  width?: number;
  focused?: boolean;
  disabled?: boolean;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  width = 30,
  focused = true,
  disabled = false,
}: SliderProps): React.ReactElement {
  useInput((input, key) => {
    if (!focused || disabled) return;

    if (key.leftArrow) {
      onChange(Math.max(min, value - step));
    }
    if (key.rightArrow) {
      onChange(Math.min(max, value + step));
    }
    if (key.ctrl && key.leftArrow) {
      onChange(min);
    }
    if (key.ctrl && key.rightArrow) {
      onChange(max);
    }
  });

  const percent = ((value - min) / (max - min)) * 100;
  const filled = Math.round((percent / 100) * width);
  const thumbPos = Math.min(filled, width - 1);

  const track = '─'.repeat(width);
  const filledTrack = track.slice(0, thumbPos) + '●' + track.slice(thumbPos + 1);

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text color={focused ? 'cyan' : undefined} dimColor={disabled}>
          {filledTrack}
        </Text>
        {showValue && <Text> {value}</Text>}
      </Box>
    </Box>
  );
}

// ============================================
// RATING
// ============================================

export interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  label?: string;
  focused?: boolean;
  readOnly?: boolean;
}

export function Rating({
  value,
  onChange,
  max = 5,
  label,
  focused = true,
  readOnly = false,
}: RatingProps): React.ReactElement {
  useInput((input, key) => {
    if (!focused || readOnly || !onChange) return;

    if (key.leftArrow && value > 0) {
      onChange(value - 1);
    }
    if (key.rightArrow && value < max) {
      onChange(value + 1);
    }

    const num = parseInt(input, 10);
    if (num >= 0 && num <= max) {
      onChange(num);
    }
  });

  const stars = Array.from({ length: max }, (_, i) => i < value ? '★' : '☆').join('');

  return (
    <Box>
      {label && <Text>{label} </Text>}
      <Text color={focused ? 'yellow' : undefined}>{stars}</Text>
      <Text dimColor> ({value}/{max})</Text>
    </Box>
  );
}

// ============================================
// DATE PICKER
// ============================================

export interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  label?: string;
  focused?: boolean;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  label,
  focused = true,
  disabled = false,
}: DatePickerProps): React.ReactElement {
  const [mode, setMode] = useState<'day' | 'month' | 'year'>('day');
  const currentDate = value || new Date();

  useInput((input, key) => {
    if (!focused || disabled) return;

    const newDate = new Date(currentDate);

    if (mode === 'day') {
      if (key.leftArrow) {
        newDate.setDate(newDate.getDate() - 1);
        onChange(newDate);
      }
      if (key.rightArrow) {
        newDate.setDate(newDate.getDate() + 1);
        onChange(newDate);
      }
      if (key.upArrow) {
        newDate.setDate(newDate.getDate() - 7);
        onChange(newDate);
      }
      if (key.downArrow) {
        newDate.setDate(newDate.getDate() + 7);
        onChange(newDate);
      }
    }

    if (input === 'm') setMode('month');
    if (input === 'y') setMode('year');
    if (input === 'd') setMode('day');

    if (input === 't') {
      onChange(new Date());
    }
  });

  const formatted = currentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box
        borderStyle={focused ? 'bold' : 'single'}
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={1}
      >
        <Text>{formatted}</Text>
      </Box>
      <Text dimColor>←→ day | ↑↓ week | t today | m month | y year</Text>
    </Box>
  );
}

// ============================================
// TIME PICKER
// ============================================

export interface TimePickerProps {
  value: { hours: number; minutes: number };
  onChange: (time: { hours: number; minutes: number }) => void;
  label?: string;
  focused?: boolean;
  disabled?: boolean;
  use24Hour?: boolean;
}

export function TimePicker({
  value,
  onChange,
  label,
  focused = true,
  disabled = false,
  use24Hour = false,
}: TimePickerProps): React.ReactElement {
  const [editingHours, setEditingHours] = useState(true);

  useInput((input, key) => {
    if (!focused || disabled) return;

    if (key.leftArrow || key.rightArrow || key.tab) {
      setEditingHours(!editingHours);
      return;
    }

    if (editingHours) {
      if (key.upArrow) {
        onChange({ ...value, hours: (value.hours + 1) % 24 });
      }
      if (key.downArrow) {
        onChange({ ...value, hours: (value.hours - 1 + 24) % 24 });
      }
    } else {
      if (key.upArrow) {
        onChange({ ...value, minutes: (value.minutes + 5) % 60 });
      }
      if (key.downArrow) {
        onChange({ ...value, minutes: (value.minutes - 5 + 60) % 60 });
      }
    }
  });

  let displayHours = value.hours;
  let ampm = '';
  if (!use24Hour) {
    ampm = value.hours >= 12 ? ' PM' : ' AM';
    displayHours = value.hours % 12 || 12;
  }

  const hoursStr = String(displayHours).padStart(2, '0');
  const minsStr = String(value.minutes).padStart(2, '0');

  return (
    <Box flexDirection="column">
      {label && <Text bold>{label}</Text>}
      <Box>
        <Text inverse={editingHours && focused} color={focused ? 'cyan' : undefined}>
          {hoursStr}
        </Text>
        <Text>:</Text>
        <Text inverse={!editingHours && focused} color={focused ? 'cyan' : undefined}>
          {minsStr}
        </Text>
        {!use24Hour && <Text>{ampm}</Text>}
      </Box>
    </Box>
  );
}

// ============================================
// FORM BUILDER
// ============================================

export interface FormBuilderProps {
  fields: FormField[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (name: string, value: unknown) => void;
  onSubmit?: () => void;
}

export function FormBuilder({
  fields,
  values,
  errors,
  onChange,
  onSubmit,
}: FormBuilderProps): React.ReactElement {
  const { focusedIndex, isFocused } = useFocusManager(fields.length);

  useInput((_, key) => {
    if (key.return && focusedIndex === fields.length - 1) {
      onSubmit?.();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      {fields.map((field, index) => {
        const focused = isFocused(index);
        const value = values[field.name];
        const error = errors[field.name];

        switch (field.type) {
          case 'text':
          case 'email':
          case 'password':
            return (
              <TextInput
                key={field.name}
                label={field.label}
                value={String(value || '')}
                onChange={(v) => onChange(field.name, v)}
                placeholder={field.placeholder}
                error={error}
                disabled={field.disabled}
                password={field.type === 'password'}
                focused={focused}
              />
            );

          case 'textarea':
            return (
              <TextInput
                key={field.name}
                label={field.label}
                value={String(value || '')}
                onChange={(v) => onChange(field.name, v)}
                placeholder={field.placeholder}
                error={error}
                disabled={field.disabled}
                multiline
                focused={focused}
              />
            );

          case 'select':
            return (
              <Select
                key={field.name}
                label={field.label}
                options={field.options || []}
                value={value as string | number}
                onChange={(v) => onChange(field.name, v)}
                placeholder={field.placeholder}
                error={error}
                disabled={field.disabled}
                focused={focused}
              />
            );

          case 'multiselect':
            return (
              <MultiSelect
                key={field.name}
                label={field.label}
                options={field.options || []}
                value={(value as (string | number)[]) || []}
                onChange={(v) => onChange(field.name, v)}
                error={error}
                disabled={field.disabled}
                focused={focused}
              />
            );

          case 'checkbox':
            return (
              <Checkbox
                key={field.name}
                label={field.label}
                checked={Boolean(value)}
                onChange={(v) => onChange(field.name, v)}
                disabled={field.disabled}
                focused={focused}
              />
            );

          case 'radio':
            return (
              <RadioGroup
                key={field.name}
                label={field.label}
                options={field.options || []}
                value={value as string | number}
                onChange={(v) => onChange(field.name, v)}
                disabled={field.disabled}
                focused={focused}
              />
            );

          case 'slider':
            return (
              <Slider
                key={field.name}
                label={field.label}
                value={Number(value) || 0}
                onChange={(v) => onChange(field.name, v)}
                min={field.min}
                max={field.max}
                step={field.step}
                disabled={field.disabled}
                focused={focused}
              />
            );

          case 'rating':
            return (
              <Rating
                key={field.name}
                label={field.label}
                value={Number(value) || 0}
                onChange={(v) => onChange(field.name, v)}
                max={field.max}
                focused={focused}
              />
            );

          default:
            return (
              <TextInput
                key={field.name}
                label={field.label}
                value={String(value || '')}
                onChange={(v) => onChange(field.name, v)}
                focused={focused}
              />
            );
        }
      })}
    </Box>
  );
}

export default {
  TextInput,
  Select,
  MultiSelect,
  Checkbox,
  RadioGroup,
  Slider,
  Rating,
  DatePicker,
  TimePicker,
  FormBuilder,
};
