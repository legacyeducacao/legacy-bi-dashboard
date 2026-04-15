
// === Supabase CRM Types (Pipedrive webhook mirror) ===

export interface CRMDealCreated {
  id: string;
  Nome: string;
  status: string;
  person_id: string;
  user_id: string;
  owner_id: string;
  pipeline_id: string;
  entidade_id: string;
  created_at: string;
}

export interface CRMDealUpdated {
  uid: string;
  id: string;
  Nome: string;
  Status: 'open' | 'won' | 'lost';
  stage_id: string;
  owner_id: string;
  person_id: string;
  pipeline_id: string;
  valor: number;
  'Lost Reason': string | null;
  org_id: string | null;
  created_at: string;
}

export interface CRMActivityCreated {
  type: string;
  subject: string;
  action: string;
  user_id: string;
  entidade_id: string;
  company_id: string;
  created_at: string;
}

export interface CRMActivityUpdated {
  deal_id: string | null;
  type: string;
  Subject: string;
  Action: string;
  owner_id: string;
  person_id: string | null;
  user_id: string;
  Entidade_id: string;
  Company_id: string;
  public_description: string;
  created_at: string;
}

export interface CRMPersonCreated {
  Nome: string;
  Email: string;
  Telefone: string;
  From: string;
  Campanha: string;
  Faturamento: string;
  Segmento: string;
  Cargo: string;
  Empresa: string;
  Owner_ID: string;
  entidade_id: string;
  Action: string;
  created_at: string;
}

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
  revenueGoal?: number;
  // SDR Specifics
  opportunities?: number;
  connections?: number;
  meetingsBooked?: number;
  responseTime?: number;
  // Closer/SDR Shared
  meetingsHeld?: number;
  noShowCount?: number;
}

export interface FunnelStage {
  name: string;
  value: number;
  conversionRate?: number; // Conversion from previous step
}

export interface FollowUpDeal {
  deal_id: string;
  deal_name: string;
  owner_id: string;
  stage_id: string;
  amount: number;
  created_date: string;
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

// Meta Ads Campaign Data
export interface MetaCampaignData {
  campaignId: string;
  campaignName: string;
  objective: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

// Meta Lead Ads - individual lead from form
export interface MetaLeadData {
  id: string;
  createdTime: string;
  formName: string;
  campaignName: string;
  campaignId: string;
  adName: string;
  platform: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  customFields: Record<string, string>;
  pipelineStatus: string; // Enriched from Supabase qualification data
}

// Meta Demographics breakdown
export interface MetaDemographicData {
  ageGender: {
    age: string;
    gender: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    leads: number;
  }[];
  regions: {
    region: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    leads: number;
  }[];
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
