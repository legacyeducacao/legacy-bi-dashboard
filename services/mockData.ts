
import { MetricData, RepPerformance, PeriodContext, FunnelStage, MarketingChannelStats, MarketingProductStats } from '../types';

// Simulate we are on the 18th day of a 30 day month
export const MOCK_CONTEXT: PeriodContext = {
  currentDay: 18,
  totalDays: 30
};

export const KPI_METRICS: Record<string, MetricData> = {
  // Marketing Macro
  investment: { id: 'invest', label: 'Investimento Ads', value: 15450, goal: 25000, unit: 'currency' },
  leads: { id: 'leads', label: 'Leads Totais', value: 850, goal: 1200, unit: 'number' },
  cpl: { id: 'cpl', label: 'CPL Médio', value: 18.17, goal: 20.00, unit: 'currency' },

  // Marketing Sales/Revenue Attribution
  marketingRevenue: { id: 'mkt_revenue', label: 'Receita Marketing', value: 185000, goal: 300000, unit: 'currency' },
  marketingSales: { id: 'mkt_sales', label: 'Vendas Marketing', value: 12, goal: 20, unit: 'number' },

  // Efficiency
  cac: { id: 'cac', label: 'CAC Blended', value: 1287.50, goal: 1500, unit: 'currency' },
  ltv: { id: 'ltv', label: 'LTV Médio', value: 32000, goal: 30000, unit: 'currency' },
  roas: { id: 'roas', label: 'ROAS Macro', value: 11.9, goal: 12, unit: 'number', suffix: 'x' },

  // Marketing Micro
  mqls: { id: 'mqls', label: 'MQLs', value: 210, goal: 350, unit: 'number' },
  cpmql: { id: 'cpmql', label: 'Custo por MQL', value: 73.57, goal: 80, unit: 'currency' },

  // Comercial Macro (Shared & SDR)
  opportunities: { id: 'opps', label: 'Oportunidades', value: 650, goal: 900, unit: 'number' },
  connections: { id: 'connections', label: 'Conexões', value: 325, goal: 450, unit: 'number' },
  meetingsBooked: { id: 'meetings_booked', label: 'Reuniões Agendadas', value: 65, goal: 100, unit: 'number' },
  meetingsHeld: { id: 'meetings_held', label: 'Reuniões Realizadas', value: 48, goal: 85, unit: 'number' },

  // Comercial Micro Indicators
  responseTime: { id: 'response_time', label: 'Response Time (min)', value: 12, goal: 15, unit: 'time' },
  connectionRate: { id: 'connection_rate', label: '% Conexão', value: 50.0, goal: 45, unit: 'percentage' }, // 325/650
  conversionConnMeeting: { id: 'conv_conn_meet', label: '% Conexão → Agend.', value: 20.0, goal: 22, unit: 'percentage' }, // 65/325

  // Closer Specifics
  sales: { id: 'sales', label: 'Vendas', value: 12, goal: 20, unit: 'number' },
  revenue: { id: 'revenue', label: 'Faturamento Total', value: 185000, goal: 300000, unit: 'currency' },
  ticket: { id: 'ticket', label: 'Ticket Médio', value: 15416, goal: 15000, unit: 'currency' },
  conversionMeetingSale: { id: 'conv_meet_sale', label: 'Conv. Reunião → Venda', value: 25.0, goal: 20, unit: 'percentage' }, // 12/48
  noShowRate: { id: 'no_show_rate', label: 'Taxa No Show', value: 26.1, goal: 20, unit: 'percentage' }, // (65-48)/65
};

export const FUNNEL_DATA: FunnelStage[] = [
  { name: 'Leads', value: 850 },
  { name: 'Oportunidades', value: 650 },
  { name: 'Conexões', value: 325 },
  { name: 'Agendadas', value: 65 },
  { name: 'Realizadas', value: 48 },
  { name: 'Vendas', value: 12 },
];

export const SDR_DATA: RepPerformance[] = [
  { id: '1', name: 'Ana Silva', role: 'SDR', opportunities: 200, connections: 110, meetingsBooked: 22, meetingsHeld: 18, noShowCount: 4, responseTime: 8 },
  { id: '2', name: 'Carlos Souza', role: 'SDR', opportunities: 180, connections: 85, meetingsBooked: 15, meetingsHeld: 10, noShowCount: 5, responseTime: 25 },
  { id: '3', name: 'Beatriz Costa', role: 'SDR', opportunities: 150, connections: 80, meetingsBooked: 20, meetingsHeld: 15, noShowCount: 5, responseTime: 12 },
  { id: '4', name: 'João Pereira', role: 'SDR', opportunities: 120, connections: 50, meetingsBooked: 8, meetingsHeld: 5, noShowCount: 3, responseTime: 45 },
];

export const CLOSER_DATA: RepPerformance[] = [
  { id: '10', name: 'Roberto Lima', role: 'Closer', meetingsHeld: 20, sales: 6, revenue: 95000, noShowCount: 5, meetingsBooked: 25 }, // 25 booked, 20 held = 5 no show
  { id: '11', name: 'Fernanda Alves', role: 'Closer', meetingsHeld: 18, sales: 4, revenue: 60000, noShowCount: 4, meetingsBooked: 22 },
  { id: '12', name: 'Ricardo Gois', role: 'Closer', meetingsHeld: 10, sales: 2, revenue: 30000, noShowCount: 8, meetingsBooked: 18 },
];

// Micro View: Marketing Channels Data
export const MARKETING_CHANNELS_DATA: MarketingChannelStats[] = [
  { channel: 'Google Ads (Search)', investment: 8500, leads: 280, cpl: 30.35, mqls: 95, sales: 5, revenue: 75000, roas: 8.8, cac: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0 },
  { channel: 'Meta Ads (Insta/FB)', investment: 5000, leads: 350, cpl: 14.28, mqls: 60, sales: 3, revenue: 45000, roas: 9.0, cac: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0 },
  { channel: 'LinkedIn Ads', investment: 1950, leads: 50, cpl: 39.00, mqls: 25, sales: 2, revenue: 35000, roas: 17.9, cac: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0 },
  { channel: 'Orgânico / SEO', investment: 0, leads: 120, cpl: 0, mqls: 20, sales: 1, revenue: 15000, roas: 0, cac: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0 },
  { channel: 'Indicação / Email', investment: 0, leads: 50, cpl: 0, mqls: 10, sales: 1, revenue: 15000, roas: 0, cac: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0 },
];

// Micro View: Products Data
export const MARKETING_PRODUCTS_DATA: MarketingProductStats[] = [
  { product: 'Legado Empresarial', investment: 6000, leads: 150, cpl: 40.00, sales: 3, revenue: 90000, roas: 15.0 },
  { product: 'Imersão de 1 Dia', investment: 2500, leads: 300, cpl: 8.33, sales: 5, revenue: 10000, roas: 4.0 },
  { product: 'Imersão de 3 Dias', investment: 3500, leads: 200, cpl: 17.50, sales: 2, revenue: 30000, roas: 8.5 },
  { product: 'Legado Incompany', investment: 1500, leads: 40, cpl: 37.50, sales: 1, revenue: 40000, roas: 26.6 },
  { product: 'Inteligência Empresarial', investment: 1950, leads: 160, cpl: 12.18, sales: 1, revenue: 15000, roas: 7.6 },
];

export const LEAD_SOURCES = [
  { name: 'Google Ads', value: 280 },
  { name: 'Meta Ads', value: 350 },
  { name: 'LinkedIn', value: 50 },
  { name: 'Orgânico', value: 120 },
  { name: 'Indicação', value: 50 },
];

export const REVENUE_TYPES = [
  { name: 'Vendas Diretas', value: 135000 },
  { name: 'Parcerias', value: 50000 },
];

// Daily Trends
export const DAILY_TRENDS = Array.from({ length: 18 }, (_, i) => {
  const isWeekend = (i % 7) === 5 || (i % 7) === 6;
  const saleProb = isWeekend ? 0.05 : 0.6;
  let dailySales = Math.random() < saleProb ? 1 : 0;
  if (dailySales > 0 && Math.random() < 0.2) dailySales = 2;

  const avgTicket = 15000;
  const dailyTicket = avgTicket + (Math.random() * 3000 - 1500);
  const dailyRevenue = dailySales * dailyTicket;
  const dailyInvestment = Math.floor(Math.random() * 300) + 800;
  const dailyActivities = isWeekend ? 0 : Math.floor(Math.random() * 60) + 220;
  const connectionRate = 0.18 + (Math.random() * 0.06 - 0.03);
  const dailyConnected = Math.floor(dailyActivities * connectionRate);

  return {
    day: `Dia ${i + 1}`,
    dayIndex: i + 1,
    leads: Math.floor(Math.random() * 20) + (isWeekend ? 10 : 35),
    mqls: Math.floor(Math.random() * 8) + (isWeekend ? 2 : 10),
    investment: dailyInvestment,
    revenue: dailyRevenue,
    sales: dailySales,
    activities: dailyActivities,
    connected: dailyConnected
  };
});
