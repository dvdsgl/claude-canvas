// Invoice Canvas - Invoice generator and viewer

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import type { Invoice, LineItem, Money, Address } from '../../shared/types';
import { useTerminalSize, useNavigation } from '../../shared/hooks';
import { formatMoney, formatDate, truncate, generateId } from '../../shared/utils';

export interface InvoiceConfig {
  invoice?: Invoice;
  editable?: boolean;
  template?: 'standard' | 'modern' | 'minimal';
}

export interface InvoiceResult {
  action: 'save' | 'send' | 'download' | 'update' | 'add-item' | 'remove-item';
  invoice: Invoice;
  itemId?: string;
}

export interface InvoiceProps {
  config: InvoiceConfig;
  onResult?: (result: InvoiceResult) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'gray',
  sent: 'blue',
  viewed: 'cyan',
  paid: 'green',
  overdue: 'red',
  cancelled: 'gray',
};

export function InvoiceCanvas({ config, onResult }: InvoiceProps): React.ReactElement {
  const { width, height } = useTerminalSize();
  const { exit } = useApp();
  const { editable = false, template = 'standard' } = config;

  const defaultInvoice: Invoice = config.invoice || {
    id: generateId('inv'),
    number: 'INV-0001',
    date: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'draft',
    from: {
      name: 'Your Company',
      street: '123 Business St',
      city: 'City',
      zip: '12345',
      country: 'US',
    },
    to: {
      name: 'Client Name',
      street: '456 Client Ave',
      city: 'Client City',
      zip: '67890',
      country: 'US',
    },
    items: [],
    subtotal: { amount: 0, currency: 'USD' },
    tax: { amount: 0, currency: 'USD' },
    total: { amount: 0, currency: 'USD' },
  };

  const [invoice, setInvoice] = useState<Invoice>(defaultInvoice);
  const [selectedSection, setSelectedSection] = useState<'header' | 'items' | 'footer'>('items');
  const [selectedItem, setSelectedItem] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Calculate totals
  const calculateTotals = (items: LineItem[]): { subtotal: Money; tax: Money; total: Money } => {
    const subtotal = items.reduce((sum, item) => sum + item.total.amount, 0);
    const taxRate = 0.1; // 10% tax
    const tax = Math.round(subtotal * taxRate);
    return {
      subtotal: { amount: subtotal, currency: invoice.subtotal.currency },
      tax: { amount: tax, currency: invoice.tax.currency },
      total: { amount: subtotal + tax, currency: invoice.total.currency },
    };
  };

  useInput((input, key) => {
    if (key.escape) {
      if (isEditing) {
        setIsEditing(false);
      } else {
        exit();
      }
      return;
    }

    // Section navigation
    if (key.tab) {
      const sections: Array<'header' | 'items' | 'footer'> = ['header', 'items', 'footer'];
      const currentIdx = sections.indexOf(selectedSection);
      const nextIdx = key.shift
        ? (currentIdx - 1 + sections.length) % sections.length
        : (currentIdx + 1) % sections.length;
      setSelectedSection(sections[nextIdx] ?? 'items');
    }

    // Item navigation
    if (selectedSection === 'items') {
      if (key.upArrow) {
        setSelectedItem(i => Math.max(0, i - 1));
      }
      if (key.downArrow) {
        setSelectedItem(i => Math.min(invoice.items.length - 1, i + 1));
      }
    }

    // Actions
    if (editable) {
      // Add item
      if (input === 'a' && selectedSection === 'items') {
        const newItem: LineItem = {
          id: generateId('item'),
          description: 'New Item',
          quantity: 1,
          unitPrice: { amount: 0, currency: invoice.subtotal.currency },
          total: { amount: 0, currency: invoice.subtotal.currency },
        };
        const newItems = [...invoice.items, newItem];
        const totals = calculateTotals(newItems);
        setInvoice({ ...invoice, items: newItems, ...totals });
        setSelectedItem(newItems.length - 1);
        onResult?.({ action: 'add-item', invoice: { ...invoice, items: newItems, ...totals } });
      }

      // Remove item
      if (input === 'd' && selectedSection === 'items' && invoice.items.length > 0) {
        const currentItem = invoice.items[selectedItem];
        if (!currentItem) return;
        const itemId = currentItem.id;
        const newItems = invoice.items.filter((_, i) => i !== selectedItem);
        const totals = calculateTotals(newItems);
        setInvoice({ ...invoice, items: newItems, ...totals });
        setSelectedItem(Math.min(selectedItem, newItems.length - 1));
        onResult?.({ action: 'remove-item', invoice: { ...invoice, items: newItems, ...totals }, itemId });
      }

      // Edit item
      if (key.return && selectedSection === 'items' && invoice.items.length > 0) {
        const currentItem = invoice.items[selectedItem];
        if (currentItem) {
          setIsEditing(true);
          onResult?.({ action: 'update', invoice, itemId: currentItem.id });
        }
      }
    }

    // Save
    if (input === 's') {
      onResult?.({ action: 'save', invoice });
    }

    // Send
    if (input === 'S') {
      setInvoice({ ...invoice, status: 'sent' });
      onResult?.({ action: 'send', invoice: { ...invoice, status: 'sent' } });
    }

    // Download
    if (input === 'p') {
      onResult?.({ action: 'download', invoice });
    }
  });

  // Render address block
  const renderAddress = (address: Address, label: string) => (
    <Box flexDirection="column" width={35}>
      <Text bold dimColor>{label}</Text>
      <Text bold>{address.name}</Text>
      {address.company && <Text>{address.company}</Text>}
      <Text>{address.street}</Text>
      <Text>{address.city}, {address.state} {address.zip}</Text>
      <Text>{address.country}</Text>
      {address.email && <Text dimColor>{address.email}</Text>}
      {address.phone && <Text dimColor>{address.phone}</Text>}
    </Box>
  );

  // Render line item
  const renderLineItem = (item: LineItem, index: number, isSelected: boolean) => {
    const COL_DESC = 30;
    const COL_QTY = 8;
    const COL_UNIT = 12;
    const COL_TOTAL = 12;
    return (
      <Box key={item.id} backgroundColor={isSelected ? 'gray' : undefined}>
        <Text inverse={isSelected} bold={isSelected}>
          {truncate(item.description, COL_DESC).padEnd(COL_DESC)}
        </Text>
        <Text inverse={isSelected}>
          {String(item.quantity).padStart(COL_QTY)}
        </Text>
        <Text inverse={isSelected}>
          {formatMoney(item.unitPrice).padStart(COL_UNIT)}
        </Text>
        <Text inverse={isSelected} bold>
          {formatMoney(item.total).padStart(COL_TOTAL)}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Invoice Header */}
      <Box
        flexDirection="column"
        borderStyle={selectedSection === 'header' ? 'bold' : 'single'}
        borderColor={selectedSection === 'header' ? 'cyan' : 'gray'}
        padding={1}
      >
        {/* Title and Status */}
        <Box justifyContent="space-between">
          <Text bold color="cyan">INVOICE</Text>
          <Text
            backgroundColor={STATUS_COLORS[invoice.status] as never}
            color="white"
          >
            {' '}{invoice.status.toUpperCase()}{' '}
          </Text>
        </Box>

        {/* Invoice details */}
        <Box justifyContent="space-between" marginTop={1}>
          <Box flexDirection="column">
            <Text>Invoice #: <Text bold>{invoice.number}</Text></Text>
            <Text>Date: {formatDate(invoice.date)}</Text>
            <Text>Due Date: <Text color={new Date(invoice.dueDate) < new Date() ? 'red' : undefined}>
              {formatDate(invoice.dueDate)}
            </Text></Text>
          </Box>
        </Box>

        {/* Addresses */}
        <Box marginTop={1} gap={4}>
          {renderAddress(invoice.from, 'FROM')}
          {renderAddress(invoice.to, 'BILL TO')}
        </Box>
      </Box>

      {/* Line Items */}
      <Box
        flexDirection="column"
        borderStyle={selectedSection === 'items' ? 'bold' : 'single'}
        borderColor={selectedSection === 'items' ? 'cyan' : 'gray'}
        padding={1}
        marginTop={1}
      >
        {/* Header row */}
        <Box borderBottom>
          <Text bold>{'Description'.padEnd(30)}</Text>
          <Text bold>{'Qty'.padStart(8)}</Text>
          <Text bold>{'Unit Price'.padStart(12)}</Text>
          <Text bold>{'Total'.padStart(12)}</Text>
        </Box>

        {/* Items */}
        {invoice.items.length === 0 ? (
          <Text dimColor italic>No items. Press 'a' to add.</Text>
        ) : (
          invoice.items.map((item, index) =>
            renderLineItem(item, index, selectedSection === 'items' && index === selectedItem)
          )
        )}
      </Box>

      {/* Totals */}
      <Box
        flexDirection="column"
        borderStyle={selectedSection === 'footer' ? 'bold' : 'single'}
        borderColor={selectedSection === 'footer' ? 'cyan' : 'gray'}
        padding={1}
        marginTop={1}
        alignItems="flex-end"
      >
        <Box width={30} justifyContent="space-between">
          <Text>Subtotal:</Text>
          <Text>{formatMoney(invoice.subtotal)}</Text>
        </Box>
        <Box width={30} justifyContent="space-between">
          <Text>Tax (10%):</Text>
          <Text>{formatMoney(invoice.tax)}</Text>
        </Box>
        <Box width={30} justifyContent="space-between" borderTop>
          <Text bold>Total:</Text>
          <Text bold color="green">{formatMoney(invoice.total)}</Text>
        </Box>

        {/* Notes/Terms */}
        {invoice.notes && (
          <Box marginTop={1} flexDirection="column" alignSelf="flex-start">
            <Text bold>Notes:</Text>
            <Text dimColor>{invoice.notes}</Text>
          </Box>
        )}
        {invoice.terms && (
          <Box marginTop={1} flexDirection="column" alignSelf="flex-start">
            <Text bold>Terms:</Text>
            <Text dimColor>{invoice.terms}</Text>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box marginTop={1} gap={2}>
        <Text dimColor><Text bold>Tab</Text> sections</Text>
        {selectedSection === 'items' && (
          <>
            <Text dimColor><Text bold>↑↓</Text> items</Text>
            {editable && <Text dimColor><Text bold>a</Text> add</Text>}
            {editable && <Text dimColor><Text bold>d</Text> delete</Text>}
            {editable && <Text dimColor><Text bold>Enter</Text> edit</Text>}
          </>
        )}
        <Text dimColor><Text bold>s</Text> save</Text>
        <Text dimColor><Text bold>S</Text> send</Text>
        <Text dimColor><Text bold>p</Text> PDF</Text>
        <Text dimColor><Text bold>ESC</Text> exit</Text>
      </Box>
    </Box>
  );
}

export default InvoiceCanvas;
