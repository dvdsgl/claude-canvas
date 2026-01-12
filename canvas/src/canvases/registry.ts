// Canvas Registry - Central registry for all canvas types

import React from 'react';

export interface CanvasDefinition {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'travel' | 'personal' | 'creative' | 'development' | 'ai';
  component: React.ComponentType<{ config: unknown; onResult?: (result: unknown) => void }>;
  defaultConfig?: unknown;
  scenarios?: string[];
}

// Import all canvas components
import { Kanban } from './kanban';
import { Pipeline } from './pipeline';
import { Dashboard } from './dashboard';
import { InvoiceCanvas } from './invoice';
import { BudgetCanvas } from './budget';
import { HotelCanvas } from './hotel';
import { ItineraryCanvas } from './itinerary';
import { SmartHomeCanvas } from './smart-home';
import { AgentDashboard } from './agent-dashboard';
import { WorkoutCanvas } from './workout';
import { PlaylistCanvas } from './playlist';
import { GanttCanvas } from './gantt';
import { GitDiffCanvas } from './git-diff';
import { OrgChartCanvas } from './org-chart';

// Registry of all available canvases
export const canvasRegistry: Map<string, CanvasDefinition> = new Map([
  // Business
  ['kanban', {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Drag and drop task management board with columns and cards',
    category: 'business',
    component: Kanban as never,
    scenarios: ['project', 'sprint', 'personal'],
  }],
  ['pipeline', {
    id: 'pipeline',
    name: 'Sales Pipeline',
    description: 'CRM-style deal pipeline with stages and probability tracking',
    category: 'business',
    component: Pipeline as never,
    scenarios: ['sales', 'leads', 'opportunities'],
  }],
  ['dashboard', {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Multi-widget dashboard with charts, stats, and KPIs',
    category: 'business',
    component: Dashboard as never,
    scenarios: ['analytics', 'metrics', 'monitoring'],
  }],
  ['invoice', {
    id: 'invoice',
    name: 'Invoice',
    description: 'Invoice generator and viewer with line items and totals',
    category: 'business',
    component: InvoiceCanvas as never,
    scenarios: ['create', 'view', 'edit'],
  }],
  ['gantt', {
    id: 'gantt',
    name: 'Gantt Chart',
    description: 'Project timeline visualization with tasks and milestones',
    category: 'business',
    component: GanttCanvas as never,
    scenarios: ['project', 'timeline', 'planning'],
  }],
  ['org-chart', {
    id: 'org-chart',
    name: 'Org Chart',
    description: 'Organization hierarchy visualization',
    category: 'business',
    component: OrgChartCanvas as never,
    scenarios: ['company', 'team', 'hierarchy'],
  }],

  // Travel
  ['hotel', {
    id: 'hotel',
    name: 'Hotel Search',
    description: 'Hotel comparison and booking interface',
    category: 'travel',
    component: HotelCanvas as never,
    scenarios: ['search', 'compare', 'book'],
  }],
  ['itinerary', {
    id: 'itinerary',
    name: 'Itinerary',
    description: 'Trip planning with day-by-day activities',
    category: 'travel',
    component: ItineraryCanvas as never,
    scenarios: ['plan', 'view', 'edit'],
  }],

  // Personal
  ['budget', {
    id: 'budget',
    name: 'Budget Tracker',
    description: 'Personal/business budget tracking with categories',
    category: 'personal',
    component: BudgetCanvas as never,
    scenarios: ['monthly', 'yearly', 'project'],
  }],
  ['smart-home', {
    id: 'smart-home',
    name: 'Smart Home',
    description: 'IoT device dashboard and control panel',
    category: 'personal',
    component: SmartHomeCanvas as never,
    scenarios: ['control', 'monitor', 'automate'],
  }],
  ['workout', {
    id: 'workout',
    name: 'Workout',
    description: 'Exercise planning and tracking',
    category: 'personal',
    component: WorkoutCanvas as never,
    scenarios: ['plan', 'active', 'review'],
  }],

  // Creative
  ['playlist', {
    id: 'playlist',
    name: 'Playlist',
    description: 'Music playlist builder and player',
    category: 'creative',
    component: PlaylistCanvas as never,
    scenarios: ['build', 'play', 'edit'],
  }],

  // Development
  ['git-diff', {
    id: 'git-diff',
    name: 'Git Diff',
    description: 'Side-by-side diff viewer for git changes',
    category: 'development',
    component: GitDiffCanvas as never,
    scenarios: ['review', 'stage', 'commit'],
  }],

  // AI
  ['agent-dashboard', {
    id: 'agent-dashboard',
    name: 'Agent Dashboard',
    description: 'Monitor and manage AI agents',
    category: 'ai',
    component: AgentDashboard as never,
    scenarios: ['monitor', 'manage', 'logs'],
  }],
]);

// Helper functions
export function getCanvas(id: string): CanvasDefinition | undefined {
  return canvasRegistry.get(id);
}

export function getCanvasesByCategory(category: string): CanvasDefinition[] {
  return Array.from(canvasRegistry.values()).filter(c => c.category === category);
}

export function getAllCanvases(): CanvasDefinition[] {
  return Array.from(canvasRegistry.values());
}

export function getCanvasCategories(): string[] {
  const categories = new Set<string>();
  canvasRegistry.forEach(c => categories.add(c.category));
  return Array.from(categories);
}

export function searchCanvases(query: string): CanvasDefinition[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(canvasRegistry.values()).filter(c =>
    c.name.toLowerCase().includes(lowerQuery) ||
    c.description.toLowerCase().includes(lowerQuery) ||
    c.id.toLowerCase().includes(lowerQuery)
  );
}

export default canvasRegistry;
