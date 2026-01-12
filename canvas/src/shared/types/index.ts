// Shared types for all canvases

// ============================================
// CORE TYPES
// ============================================

export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Range {
  start: number;
  end: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeSlot {
  start: string; // ISO datetime
  end: string;
  available?: boolean;
}

// ============================================
// DATA TYPES
// ============================================

export interface Column<T = unknown> {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, row: T) => string;
  format?: 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'percent';
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  value: unknown;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
}

// ============================================
// FORM TYPES
// ============================================

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'password'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'color'
  | 'slider'
  | 'rating';

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  options?: SelectOption[];
  validation?: ValidationRule[];
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface ValidationRule {
  type: 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'custom';
  value?: unknown;
  message: string;
  validator?: (value: unknown) => boolean;
}

export interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  isDirty: boolean;
}

// ============================================
// CHART TYPES
// ============================================

export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter' | 'sparkline' | 'gauge' | 'heatmap';

export interface DataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface DataSeries {
  name: string;
  data: DataPoint[];
  color?: string;
  type?: ChartType;
}

export interface ChartConfig {
  type: ChartType;
  title?: string;
  series: DataSeries[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  legend?: boolean;
  colors?: string[];
  height?: number;
  width?: number;
}

export interface AxisConfig {
  label?: string;
  min?: number;
  max?: number;
  gridLines?: boolean;
  format?: (value: number) => string;
}

// ============================================
// LAYOUT TYPES
// ============================================

export type LayoutType = 'stack' | 'split' | 'grid' | 'tabs' | 'accordion' | 'drawer' | 'modal';

export interface LayoutConfig {
  type: LayoutType;
  direction?: 'horizontal' | 'vertical';
  gap?: number;
  padding?: number;
  children: LayoutItem[];
}

export interface LayoutItem {
  id: string;
  content: unknown;
  size?: number | string;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
  collapsed?: boolean;
  title?: string;
}

export interface TabConfig {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  closable?: boolean;
}

// ============================================
// KANBAN TYPES
// ============================================

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  limit?: number;
  cards: KanbanCard[];
}

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  labels?: Label[];
  assignee?: Person;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  estimate?: number;
  attachments?: number;
  comments?: number;
  subtasks?: { completed: number; total: number };
  metadata?: Record<string, unknown>;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Person {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

// ============================================
// CALENDAR TYPES (ENHANCED)
// ============================================

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;
  allDay?: boolean;
  color?: string;
  location?: string;
  description?: string;
  attendees?: Person[];
  recurrence?: RecurrenceRule;
  reminders?: Reminder[];
  status?: 'confirmed' | 'tentative' | 'cancelled';
  busy?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  daysOfWeek?: number[]; // 0-6
  dayOfMonth?: number;
  monthOfYear?: number;
  until?: string;
  count?: number;
  exceptions?: string[];
}

export interface Reminder {
  method: 'popup' | 'email' | 'sms';
  minutes: number;
}

export type CalendarView = 'day' | 'week' | 'month' | 'year' | 'agenda' | 'schedule';

// ============================================
// FINANCE TYPES
// ============================================

export interface Money {
  amount: number; // in cents
  currency: string;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: Money;
  discount?: number;
  tax?: number;
  total: Money;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  dueDate: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
  from: Address;
  to: Address;
  items: LineItem[];
  subtotal: Money;
  tax: Money;
  total: Money;
  notes?: string;
  terms?: string;
}

export interface Address {
  name: string;
  company?: string;
  street: string;
  city: string;
  state?: string;
  zip: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: Money;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  account: string;
  tags?: string[];
  recurring?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Budget {
  id: string;
  name: string;
  period: 'weekly' | 'monthly' | 'yearly';
  categories: BudgetCategory[];
  startDate: string;
  endDate: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budgeted: Money;
  spent: Money;
  color?: string;
}

// ============================================
// PIPELINE / CRM TYPES
// ============================================

export interface Deal {
  id: string;
  name: string;
  company: string;
  contact: Person;
  value: Money;
  probability: number;
  stage: string;
  expectedCloseDate: string;
  owner: Person;
  activities?: Activity[];
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'task' | 'note';
  subject: string;
  description?: string;
  date: string;
  completed?: boolean;
  outcome?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  probability: number;
  order: number;
  color?: string;
  deals: Deal[];
}

// ============================================
// TRAVEL TYPES (ENHANCED)
// ============================================

export interface Hotel {
  id: string;
  name: string;
  chain?: string;
  rating: number;
  stars: number;
  location: Location;
  pricePerNight: Money;
  roomTypes: RoomType[];
  amenities: string[];
  images?: string[];
  reviews?: Review[];
  policies?: HotelPolicies;
}

export interface RoomType {
  id: string;
  name: string;
  description: string;
  maxOccupancy: number;
  bedType: string;
  pricePerNight: Money;
  available: boolean;
  amenities: string[];
}

export interface HotelPolicies {
  checkIn: string;
  checkOut: string;
  cancellation: string;
  petsAllowed: boolean;
  smokingAllowed: boolean;
}

export interface Location {
  address: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  title?: string;
  content: string;
  date: string;
  helpful?: number;
}

export interface Itinerary {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: Person[];
  days: ItineraryDay[];
  budget?: Budget;
  notes?: string;
}

export interface ItineraryDay {
  date: string;
  activities: ItineraryActivity[];
  accommodation?: string;
  notes?: string;
}

export interface ItineraryActivity {
  id: string;
  time: string;
  title: string;
  location?: string;
  duration?: number;
  cost?: Money;
  type: 'transport' | 'accommodation' | 'food' | 'activity' | 'sightseeing' | 'other';
  booked?: boolean;
  confirmationNumber?: string;
  notes?: string;
}

// ============================================
// PROJECT MANAGEMENT TYPES
// ============================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on-hold' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  owner: Person;
  team: Person[];
  tasks: Task[];
  milestones: Milestone[];
  tags?: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: Person;
  dueDate?: string;
  estimate?: number; // hours
  logged?: number; // hours
  dependencies?: string[];
  subtasks?: Subtask[];
  comments?: Comment[];
  attachments?: Attachment[];
  labels?: Label[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  dueDate: string;
  completed: boolean;
  tasks?: string[];
}

export interface Comment {
  id: string;
  author: Person;
  content: string;
  createdAt: string;
  updatedAt?: string;
  reactions?: Reaction[];
}

export interface Reaction {
  emoji: string;
  users: Person[];
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: Person;
  uploadedAt: string;
}

// ============================================
// WORKFLOW / APPROVAL TYPES
// ============================================

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'rejected';
  steps: WorkflowStep[];
  currentStep: number;
  initiator: Person;
  createdAt: string;
  completedAt?: string;
  data: Record<string, unknown>;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'approval' | 'review' | 'input' | 'action' | 'notification';
  status: 'pending' | 'in-progress' | 'approved' | 'rejected' | 'skipped';
  assignees: Person[];
  completedBy?: Person;
  completedAt?: string;
  comments?: string;
  required?: boolean;
}

// ============================================
// SMART HOME / IOT TYPES
// ============================================

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  room: string;
  status: 'online' | 'offline' | 'error';
  state: DeviceState;
  capabilities: string[];
  lastSeen?: string;
  battery?: number;
  firmware?: string;
}

export type DeviceType =
  | 'light'
  | 'switch'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'sensor'
  | 'speaker'
  | 'tv'
  | 'blind'
  | 'fan'
  | 'vacuum'
  | 'doorbell';

export interface DeviceState {
  on?: boolean;
  brightness?: number;
  color?: string;
  temperature?: number;
  targetTemperature?: number;
  locked?: boolean;
  open?: boolean;
  level?: number;
  mode?: string;
  playing?: boolean;
  volume?: number;
  motion?: boolean;
  humidity?: number;
  battery?: number;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
}

export interface AutomationTrigger {
  type: 'time' | 'device' | 'location' | 'event';
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  type: 'device' | 'time' | 'day' | 'location';
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'between';
  value: unknown;
}

export interface AutomationAction {
  type: 'device' | 'scene' | 'notification' | 'delay';
  target?: string;
  config: Record<string, unknown>;
}

// ============================================
// HEALTH / FITNESS TYPES
// ============================================

export interface Workout {
  id: string;
  name: string;
  date: string;
  duration: number; // minutes
  type: 'strength' | 'cardio' | 'flexibility' | 'sports' | 'other';
  exercises: Exercise[];
  notes?: string;
  calories?: number;
  heartRate?: HeartRateData;
}

export interface Exercise {
  id: string;
  name: string;
  sets?: ExerciseSet[];
  duration?: number;
  distance?: number;
  calories?: number;
  notes?: string;
}

export interface ExerciseSet {
  reps?: number;
  weight?: number;
  duration?: number;
  restAfter?: number;
}

export interface HeartRateData {
  average: number;
  max: number;
  zones: { zone: string; duration: number }[];
}

export interface Meal {
  id: string;
  name: string;
  date: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: Food[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  notes?: string;
}

export interface Food {
  id: string;
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetCount: number;
  color?: string;
  icon?: string;
  completions: HabitCompletion[];
  streak: number;
  bestStreak: number;
}

export interface HabitCompletion {
  date: string;
  count: number;
  notes?: string;
}

// ============================================
// MEDIA / ENTERTAINMENT TYPES
// ============================================

export interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'show' | 'book' | 'album' | 'podcast' | 'game';
  year?: number;
  rating?: number;
  userRating?: number;
  genres: string[];
  duration?: number;
  description?: string;
  coverImage?: string;
  status?: 'want' | 'watching' | 'completed' | 'dropped';
  progress?: number;
  metadata?: Record<string, unknown>;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  items: PlaylistItem[];
  duration: number;
  createdBy: Person;
  isPublic: boolean;
  coverImage?: string;
}

export interface PlaylistItem {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration: number;
  order: number;
}

export interface Event {
  id: string;
  name: string;
  type: 'concert' | 'sports' | 'theater' | 'festival' | 'conference' | 'other';
  date: string;
  venue: Venue;
  artists?: string[];
  priceRange: { min: Money; max: Money };
  ticketTypes: TicketType[];
  description?: string;
  image?: string;
}

export interface Venue {
  id: string;
  name: string;
  location: Location;
  capacity: number;
  sections?: VenueSection[];
}

export interface VenueSection {
  id: string;
  name: string;
  rows: number;
  seatsPerRow: number;
  priceMultiplier: number;
}

export interface TicketType {
  id: string;
  name: string;
  price: Money;
  available: number;
  description?: string;
  perks?: string[];
}

// ============================================
// DOCUMENTATION / CONTENT TYPES
// ============================================

export interface Document {
  id: string;
  title: string;
  content: string;
  format: 'markdown' | 'html' | 'text' | 'json';
  author: Person;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags?: string[];
  folder?: string;
  status: 'draft' | 'review' | 'published' | 'archived';
}

export interface WikiPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  parent?: string;
  children?: string[];
  breadcrumb: { id: string; title: string }[];
  lastEditor: Person;
  updatedAt: string;
}

export interface Outline {
  id: string;
  title: string;
  items: OutlineItem[];
}

export interface OutlineItem {
  id: string;
  content: string;
  level: number;
  children: OutlineItem[];
  collapsed?: boolean;
  notes?: string;
  status?: 'todo' | 'done';
}

// ============================================
// AGENT / AI TYPES
// ============================================

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  currentTask?: string;
  startedAt?: string;
  completedAt?: string;
  logs: AgentLog[];
  metrics?: AgentMetrics;
}

export interface AgentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

export interface AgentMetrics {
  tokensUsed: number;
  toolCalls: number;
  duration: number;
  cost?: Money;
}

export interface ConversationContext {
  id: string;
  tokensUsed: number;
  maxTokens: number;
  messages: number;
  memories: Memory[];
}

export interface Memory {
  id: string;
  type: 'fact' | 'preference' | 'context';
  content: string;
  confidence: number;
  source: string;
  createdAt: string;
}

// ============================================
// THEME / STYLING TYPES
// ============================================

export interface Theme {
  name: string;
  colors: ThemeColors;
  spacing: number;
  borderRadius: number;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
}

// ============================================
// NOTIFICATION / TOAST TYPES
// ============================================

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
}
