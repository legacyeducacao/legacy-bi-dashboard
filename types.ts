
// Metric Data Structure
export interface MetricData {
  id: string;
  db_id?: string; // Original ID from database for updates
  label: string;
  value: number; // Current realized value
  goal: number;  // Monthly goal
  unit: 'currency' | 'number' | 'percentage' | 'time';
  prefix?: string;
  suffix?: string;
}

// Result of the Pace Calculation Logic (PDF Page 2)
export interface PaceAnalysis {
  realized: number;
  goal: number;
  provisioned: number; // Ideal pace
  projection: number;  // Forecast based on current pace
  projectionPercent: number;
  deviation: number;
  isOnTrack: boolean;
}

// SDR / Rep Data
export interface RepPerformance {
  id: string;
  name: string;
  role: 'SDR' | 'Closer';
  // Common
  sales?: number;
  revenue?: number;
  // SDR Specifics
  opportunities?: number; // Leads/Opps received
  connections?: number;
  meetingsBooked?: number;
  responseTime?: number; // In minutes
  // Closer/SDR Shared
  meetingsHeld?: number;
  noShowCount?: number;
}

export interface FunnelStage {
  name: string;
  value: number;
  conversionRate?: number; // Conversion from previous step
}

// Marketing Micro Data - Channels
export interface MarketingChannelStats {
  channel: string;
  investment: number;
  leads: number;
  cpl: number;
  mqls: number;
  sales: number;
  revenue: number;
  roas: number;
  cac: number;
  impressions: number;
  clicks: number;
  cpm: number;
  ctr: number;
}

export interface MarketingCampaignStats {
  campaign: string;
  investment: number;
  leads: number;
  sales: number;
  cpl: number;
  cpl_mql: number;
  cac: number;
  roas: number;
  impressions: number;
  clicks: number;
  mqls: number;
  ctr: number;
  cpc: number;
}

// Marketing Micro Data - Products
export interface MarketingProductStats {
  product: string;
  investment: number;
  leads: number;
  cpl: number;
  sales: number;
  revenue: number;
  roas: number;
}

// Date Context
export interface PeriodContext {
  currentDay: number;
  totalDays: number;
}

// Board Types
export type NodeType = 'rectangle' | 'circle' | 'diamond' | 'sticky' | 'text' | 'funnel' | 'persona' | 'campaign' | 'channel';

export interface BoardNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  content: string;
  color?: string;
  width: number;
  height: number;
}

export interface BoardConnection {
  id: string;
  fromId: string;
  toId: string;
}

// App Settings
export interface TabDurationConfig {
  overview: number;
  analysis: number;
  marketing: number;
  sdr: number;
  sales: number;
  ranking: number; // Added ranking
  board: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  autoRotate: boolean;
  tabDurations: TabDurationConfig;
}

// Filter Types
export type PeriodFilter = 'today' | '7d' | '15d' | '30d' | 'this_month' | 'custom';

export interface FilterState {
  period: PeriodFilter;
  customStartDate?: string; // ISO Date String YYYY-MM-DD
  customEndDate?: string;   // ISO Date String YYYY-MM-DD
  sdrId: string | 'all';
  closerId: string | 'all';
  channel: string | 'all';
  product: string | 'all';
  source: string | 'all'; // Origem do Lead
}

export interface FilterOptions {
  sdrs: { id: string; name: string }[];
  closers: { id: string; name: string }[];
  channels: string[];
  products: string[];
  sources: string[];
}
