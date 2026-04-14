import { supabase, isSupabaseConfigured } from './supabase';
import { fetchAllMetaData } from './meta';
import { MetricData, RepPerformance, PeriodContext, FunnelStage, MarketingChannelStats, MarketingProductStats, FollowUpDeal, MetaCampaignData, MetaLeadData, MetaDemographicData } from '../types';

export interface DashboardData {
   kpis: Record<string, MetricData>;
   dailyTrends: any[];
   rawMarketingData: any[];
   sdrData: RepPerformance[];
   closerData: RepPerformance[];
   channels: MarketingChannelStats[];
   products: MarketingProductStats[];
   context: PeriodContext;
   funnelData: FunnelStage[];
   lastUpdated: Date;
   rawTeamData?: any[];
   rawDeals: FollowUpDeal[];
   metaCampaigns: MetaCampaignData[];
   metaLeads: MetaLeadData[];
   metaDemographics: MetaDemographicData;
}

// --- Pipedrive Config ---
// API token is now server-side only (in Vercel env vars)
// Frontend calls go through /api/pipedrive proxy
const PIPEDRIVE_PROXY = '/api/pipedrive';
const PIPELINE_VENDAS = 2;

const STAGE_MAP: Record<number, string> = {
   6: 'Oportunidades', 7: 'Filtro 1', 8: 'Filtro 2', 9: 'Agendado',
   22: 'Reagendamento', 10: 'Maturação', 20: 'Negociação',
   21: 'Envio de Contrato', 11: 'Vendido'
};

// Custom field keys from Pipedrive
const FIELD_CANAL_ORIGEM = 'af9399eff946d6d06390b9c1f7eec1af620a89a5';
const FIELD_SDR_RESPONSAVEL = '17d4f2deba2b2d6302b1f5ac1a2d18abc855fc3c';

const ORIGIN_MAP: Record<number, string> = {
   49: 'Outbound', 50: 'Allbound', 51: 'Inbound', 52: 'Eventos', 53: 'Indicação', 54: 'Upsell'
};

// SDR users (pre-vendas): Isaque, Luan, Rodrigo
// Closer users (fechamento): Joel, Leonardo (Padilha), Leonardo Souza
const USER_ROLES: Record<number, { name: string; role: 'SDR' | 'Closer' }> = {
   25959419: { name: 'Isaque Inacio', role: 'SDR' },
   25955327: { name: 'Luan Gabriel', role: 'SDR' },
   25955316: { name: 'Rodrigo Fernandes', role: 'SDR' },
   25909798: { name: 'João Vitor Gaspar', role: 'SDR' },
   25963379: { name: 'Paim', role: 'SDR' },
   25952137: { name: 'Joel Carlos', role: 'Closer' },
   25952181: { name: 'Leonardo Padilha', role: 'Closer' },
   25959529: { name: 'Leonardo Souza', role: 'Closer' },
   25839024: { name: 'Allan Silva', role: 'Closer' },
};

const N8N_META_ADS_WEBHOOK = 'https://automacao-n8n.zs0trp.easypanel.host/webhook/30135616-a1ea-4196-abb1-367e88b1d882';

export const triggerMetaAdsAutomation = async (): Promise<void> => {
   const now = new Date();
   const todayLocal = new Date(now.getTime() - 3 * 60 * 60 * 1000);
   const todayStr = todayLocal.toISOString().split('T')[0];
   const response = await fetch(N8N_META_ADS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync_meta_ads', timestamp: now.toISOString(), date: todayStr, date_preset: 'today' })
   });
   if (!response.ok) throw new Error(`n8n webhook failed: ${response.status}`);
};

// --- Helpers ---
const safeNumber = (val: any): number => {
   if (typeof val === 'number') return val;
   if (!val) return 0;
   const clean = String(val).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(,|$))/g, '').replace(',', '.');
   const num = Number(clean);
   return isNaN(num) ? 0 : num;
};

const extractProductFromCampaign = (campaignName: string): string => {
   const match = campaignName.match(/\[([^\]]+)\]/);
   if (!match) return 'Outros';
   const tag = match[1].trim();
   const map: Record<string, string> = {
      'Legado': 'Executória', 'IE': 'Inteligência Empresarial',
      'Imersão': 'Impulsão Empresarial', 'TESTE': 'Teste',
   };
   return map[tag] || tag;
};

// Activity types that represent meetings (booked / held)
const MEETING_TYPES = new Set(['sessao_estrategica', 'reuniao_de_fechamento', 'meeting']);
const NO_SHOW_TYPE = 'no_show';
const RESCHEDULED_TYPE = 'reagendado';

// --- Pipedrive API (via serverless proxy) ---
async function fetchPipedriveEndpoint(endpoint: string, params: Record<string, string>): Promise<any> {
   const searchParams = new URLSearchParams({ endpoint, ...params });
   const res = await fetch(`${PIPEDRIVE_PROXY}?${searchParams}`);
   if (!res.ok) {
      console.warn(`Pipedrive proxy error (${endpoint}):`, res.status);
      return { success: false, data: null };
   }
   return res.json();
}

async function fetchPipedriveDeals(status: 'open' | 'won' | 'lost' | 'all_not_deleted', pipelineId?: number): Promise<any[]> {
   const allDeals: any[] = [];
   let start = 0;
   const limit = 500;

   while (true) {
      const params: Record<string, string> = {
         limit: String(limit),
         start: String(start),
         status,
         ...(pipelineId ? { pipeline_id: String(pipelineId) } : {})
      };

      const json = await fetchPipedriveEndpoint('deals', params);
      if (!json.success || !json.data) break;

      allDeals.push(...json.data);

      if (!json.additional_data?.pagination?.more_items_in_collection) break;
      start += limit;
   }

   return allDeals;
}

async function fetchPipedriveActivities(startDate: string, endDate: string): Promise<any[]> {
   const allActivities: any[] = [];
   let start = 0;
   const limit = 500;

   while (true) {
      const params: Record<string, string> = {
         limit: String(limit),
         start: String(start),
         start_date: startDate,
         end_date: endDate,
      };

      const json = await fetchPipedriveEndpoint('activities', params);
      if (!json.success || !json.data) break;

      allActivities.push(...json.data);

      if (!json.additional_data?.pagination?.more_items_in_collection) break;
      start += limit;
   }

   return allActivities;
}

// --- Main fetch ---
export const fetchDashboardData = async (): Promise<DashboardData> => {
   const emptyData: DashboardData = {
      kpis: {}, dailyTrends: [], rawMarketingData: [], sdrData: [], closerData: [],
      channels: [], products: [], context: { currentDay: 1, totalDays: 30 },
      funnelData: [], lastUpdated: new Date(), rawTeamData: [], rawDeals: [],
      metaCampaigns: [], metaLeads: [], metaDemographics: { ageGender: [], regions: [] }
   };

   try {
      console.log("Fetching dashboard data (Pipedrive + Supabase)...");

      // --- 1. Fetch Pipedrive data (deals + activities) - graceful on failure ---
      let wonDeals: any[] = [];
      let openDeals: any[] = [];
      try {
         [wonDeals, openDeals] = await Promise.all([
            fetchPipedriveDeals('won', PIPELINE_VENDAS),
            fetchPipedriveDeals('open', PIPELINE_VENDAS),
         ]);
      } catch (e) {
         console.warn('Pipedrive deals fetch failed (rate limit?), continuing with Supabase data only');
      }

      // --- 2. Fetch Supabase marketing data ---
      // Determine data month from latest Supabase data
      let dataFirstOfMonth: string, dataLastOfMonth: string;
      let dataYear: number, dataMonth: number;

      if (isSupabaseConfigured) {
         const { data: latestRow } = await supabase
            .from('fact_daily_marketing').select('date').order('date', { ascending: false }).limit(1);
         const latestDate = latestRow?.[0]?.date;
         if (latestDate) {
            const d = new Date(latestDate + 'T00:00:00');
            dataYear = d.getFullYear();
            dataMonth = d.getMonth();
         } else {
            dataYear = new Date().getFullYear();
            dataMonth = new Date().getMonth();
         }
      } else {
         dataYear = new Date().getFullYear();
         dataMonth = new Date().getMonth();
      }

      dataFirstOfMonth = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}-01`;
      dataLastOfMonth = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}-${new Date(dataYear, dataMonth + 1, 0).getDate()}`;

      let marketingRows: any[] = [];
      if (isSupabaseConfigured) {
         const { data: rawRows } = await supabase
            .from('fact_daily_marketing').select('*')
            .gte('date', dataFirstOfMonth).lte('date', dataLastOfMonth)
            .order('date', { ascending: true }).limit(5000);
         marketingRows = rawRows || [];
      }

      // --- 2b. Fetch Pipedrive activities for the month ---
      let allActivities: any[] = [];
      try {
         allActivities = await fetchPipedriveActivities(dataFirstOfMonth, dataLastOfMonth);
      } catch (e) {
         console.warn('Pipedrive activities fetch failed (rate limit?), continuing without');
      }

      // --- 2c. Fetch Supabase leads and qualifications ---
      let supabaseLeads: any[] = [];
      let supabaseQualificacoes: any[] = [];
      if (isSupabaseConfigured) {
         const [leadsRes, qualsRes] = await Promise.all([
            supabase.from('formularios_anuncios').select('*')
               .not('Nome', 'is', null)
               .limit(5000),
            supabase.from('qualificacao_do_lead_na_3C_ao_encerrar_chamada').select('*')
               .gte('created_at', dataFirstOfMonth)
               .limit(5000),
         ]);
         supabaseLeads = leadsRes.data || [];
         supabaseQualificacoes = qualsRes.data || [];
      }

      // --- 2d. Fetch Meta Ads data directly from API ---
      let metaData = { campaigns: [] as MetaCampaignData[], insights: [] as any[], leads: [] as MetaLeadData[], demographics: { ageGender: [], regions: [] } as MetaDemographicData };
      try {
         metaData = await fetchAllMetaData(dataFirstOfMonth, dataLastOfMonth);
         console.log(`Meta API: ${metaData.campaigns.length} campaigns, ${metaData.leads.length} leads, ${metaData.insights.length} daily insights`);
      } catch (e) {
         console.warn('Meta API fetch failed, continuing with Supabase marketing data only');
      }

      // Enrich Meta leads with Supabase pipeline status
      if (metaData.leads.length > 0 && supabaseQualificacoes.length > 0) {
         metaData.leads = metaData.leads.map(lead => {
            const phone = lead.phone.replace(/\D/g, '');
            const match = supabaseQualificacoes.find((q: any) => {
               const qPhone = (q.Telefone || q.telefone || '').replace(/\D/g, '');
               return qPhone && phone && qPhone.endsWith(phone.slice(-8));
            });
            return {
               ...lead,
               pipelineStatus: match ? (match['Qualificação'] || '') : '',
            };
         });
      }

      // Use Meta API insights to supplement Supabase marketing data if available
      if (metaData.insights.length > 0 && marketingRows.length === 0) {
         marketingRows = metaData.insights.map((row: any) => ({
            date: row.date,
            campaign_name: 'Meta Ads',
            cost: row.spend,
            impressions: row.impressions,
            clicks: row.clicks,
            leads: row.leads,
            mqls: 0,
            vendas: 0,
            faturamento: 0,
         }));
      }

      console.log(`Marketing: ${marketingRows.length} rows | Pipedrive: ${wonDeals.length} won, ${openDeals.length} open | Activities: ${allActivities.length} | Leads: ${supabaseLeads.length} | Qualificações: ${supabaseQualificacoes.length} | Meta Campaigns: ${metaData.campaigns.length}`);

      // --- 3. Filter Pipedrive deals by data month ---
      const monthPrefix = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}`;

      const monthWonDeals = wonDeals.filter(d => d.won_time?.startsWith(monthPrefix));
      const monthOpenDeals = openDeals; // Open deals are always current

      // --- 4. Aggregate marketing totals ---
      let totalCost = 0, totalImpressions = 0, totalClicks = 0;
      let mktVendas = 0, mktFaturamento = 0;

      marketingRows.forEach((r: any) => {
         totalCost += safeNumber(r.cost);
         totalImpressions += safeNumber(r.impressions);
         totalClicks += safeNumber(r.clicks);
         mktVendas += safeNumber(r.vendas);
         mktFaturamento += safeNumber(r.faturamento);
      });

      // Leads from Supabase formularios_anuncios (real form submissions)
      const totalLeads = supabaseLeads.length || safeNumber(marketingRows.reduce((s: number, r: any) => s + safeNumber(r.leads), 0));

      // MQLs from Supabase qualificações (leads that were called and qualified)
      const qualifiedStatuses = ['Ganho', 'Sessão Estratégica Agendada', 'Ligação Agendada', 'Lead Qualificado / Filtro 2'];
      const totalMqls = supabaseQualificacoes.filter((q: any) =>
         qualifiedStatuses.includes(q['Qualificação'])
      ).length || safeNumber(marketingRows.reduce((s: number, r: any) => s + safeNumber(r.mqls), 0));

      // Extract sales/meetings from qualificações when Pipedrive is unavailable
      const sessionsFromQuals = supabaseQualificacoes.filter((q: any) =>
         q['Qualificação'] === 'Sessão Estratégica Agendada'
      ).length;
      const winsFromQuals = supabaseQualificacoes.filter((q: any) =>
         q['Qualificação'] === 'Ganho'
      ).length;

      // --- 5. Aggregate Pipedrive commercial data ---
      // Use Pipedrive data if available, fallback to Supabase qualificações
      const pipedriveAvailable = monthWonDeals.length > 0 || monthOpenDeals.length > 0;
      const totalSales = pipedriveAvailable ? monthWonDeals.length : winsFromQuals;
      const totalRevenue = monthWonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      // Inbound vs Outbound from Canal de Origem
      let salesInbound = 0, salesOutbound = 0;
      monthWonDeals.forEach(d => {
         const originId = d[FIELD_CANAL_ORIGEM];
         const origin = ORIGIN_MAP[originId] || '';
         if (origin === 'Inbound' || origin === 'Allbound') salesInbound++;
         else if (origin === 'Outbound') salesOutbound++;
         else salesInbound++; // Default to inbound for Eventos, Indicação, Upsell, etc
      });

      // Funnel stages from open deals
      const stageCountMap: Record<string, number> = {};
      monthOpenDeals.forEach(d => {
         const stage = STAGE_MAP[d.stage_id] || 'Outro';
         stageCountMap[stage] = (stageCountMap[stage] || 0) + 1;
      });

      // Connections = deals that passed beyond 'Oportunidades' stage (stage_order >= 2)
      const connectionsFromDeals = monthOpenDeals.filter(d => d.stage_order_nr >= 2).length + totalSales;
      // Fallback: connections from qualificações (total calls made)
      const connections = pipedriveAvailable ? connectionsFromDeals : supabaseQualificacoes.length;

      // --- 5b. Aggregate activity data for meetings, no-shows, rescheduled ---
      let meetingsBooked = 0;   // All meeting-type activities (scheduled)
      let meetingsHeld = 0;     // Meeting-type activities marked done (excluding no-shows)
      let totalNoShows = 0;     // Activities of type no_show
      let totalRescheduled = 0; // Activities of type reagendado

      if (allActivities.length > 0) {
         // Use real Pipedrive activity data
         allActivities.forEach(act => {
            const type = act.type || '';
            if (MEETING_TYPES.has(type)) {
               meetingsBooked++;
               if (act.done) meetingsHeld++;
            }
            if (type === NO_SHOW_TYPE) {
               totalNoShows++;
               meetingsBooked++;
            }
            if (type === RESCHEDULED_TYPE) {
               totalRescheduled++;
            }
         });
      } else if (supabaseQualificacoes.length > 0) {
         // Fallback: derive meeting metrics from Supabase qualificações
         meetingsBooked = sessionsFromQuals + winsFromQuals;
         meetingsHeld = winsFromQuals;
         totalNoShows = supabaseQualificacoes.filter((q: any) =>
            q['Qualificação'] === 'Não qualificada' || q['Qualificação'] === 'Caixa Postal'
         ).length;
      }

      // --- 6. Build team data from Pipedrive (deals + activities) + Supabase fallback ---
      const teamMap = new Map<string, any>();

      const initTeamMemberByName = (name: string, role: 'SDR' | 'Closer') => {
         if (!teamMap.has(name)) {
            teamMap.set(name, {
               id: name.replace(/\s+/g, ''),
               name,
               role,
               opportunities: 0, connections: 0, meetingsBooked: 0,
               meetingsHeld: 0, sales: 0, revenue: 0, noShowCount: 0,
               rescheduled: 0,
            });
         }
         return teamMap.get(name);
      };

      const initTeamMember = (userId: number) => {
         const info = USER_ROLES[userId] || { name: `User ${userId}`, role: 'SDR' as const };
         return initTeamMemberByName(info.name, info.role);
      };

      if (pipedriveAvailable) {
         // Count opportunities and connections from deals
         monthOpenDeals.forEach(d => {
            const member = initTeamMember(d.user_id?.id || d.user_id);
            member.opportunities++;
            if (d.stage_order_nr >= 2) member.connections++;
         });

         // Count won deals by owner
         monthWonDeals.forEach(d => {
            const member = initTeamMember(d.user_id?.id || d.user_id);
            member.sales++;
            member.revenue += d.value || 0;
            member.connections++;
         });

         // Enrich team members with REAL activity data (meetings, no-shows, rescheduled)
         allActivities.forEach(act => {
            const userId = act.assigned_to_user_id || act.user_id;
            if (!userId) return;
            const member = initTeamMember(userId);
            const type = act.type || '';

            if (MEETING_TYPES.has(type)) {
               member.meetingsBooked++;
               if (act.done) member.meetingsHeld++;
            }
            if (type === NO_SHOW_TYPE) {
               member.noShowCount++;
               member.meetingsBooked++;
            }
            if (type === RESCHEDULED_TYPE) {
               member.rescheduled++;
            }
         });
      } else if (supabaseQualificacoes.length > 0) {
         // Fallback: build team data from Supabase qualificações
         // Map agent names from discadora to proper names/roles
         const AGENT_MAP: Record<string, { name: string; role: 'SDR' | 'Closer' }> = {
            'isaque': { name: 'Isaque Inacio', role: 'SDR' },
            'luan': { name: 'Luan Gabriel', role: 'SDR' },
            'rodrigo': { name: 'Rodrigo Fernandes', role: 'SDR' },
            'paim': { name: 'Paim', role: 'SDR' },
            'joao': { name: 'João Vitor Gaspar', role: 'SDR' },
         };

         supabaseQualificacoes.forEach((q: any) => {
            const agentRaw = (q.Agente || '').toLowerCase().trim();
            const agentInfo = AGENT_MAP[agentRaw] || { name: q.Agente || 'Desconhecido', role: 'SDR' as const };
            const member = initTeamMemberByName(agentInfo.name, agentInfo.role);
            member.connections++;

            const qual = q['Qualificação'] || '';
            if (qual === 'Sessão Estratégica Agendada' || qual === 'Ligação Agendada') {
               member.meetingsBooked++;
            }
            if (qual === 'Ganho') {
               member.sales++;
               member.meetingsHeld++;
               member.meetingsBooked++;
            }
            if (qual === 'Não qualificada' || qual === 'Caixa Postal') {
               member.noShowCount++;
            }
         });
      }

      // Convert to flat format that App.tsx expects (snake_case fields for rawTeamData)
      const allTeamMembers = Array.from(teamMap.values()).map(m => ({
         ...m,
         rep_name: m.name,
         meetings_booked: m.meetingsBooked,
         meetings_held: m.meetingsHeld,
         no_shows: m.noShowCount,
      }));

      const sdrData: RepPerformance[] = allTeamMembers
         .filter(m => m.role === 'SDR')
         .map(m => ({
            id: m.id, name: m.name, role: 'SDR' as const,
            opportunities: m.opportunities, connections: m.connections,
            meetingsBooked: m.meetingsBooked, meetingsHeld: m.meetingsHeld,
            noShowCount: m.noShowCount,
            sales: m.sales, revenue: m.revenue, responseTime: 0
         }));

      const closerData: RepPerformance[] = allTeamMembers
         .filter(m => m.role === 'Closer')
         .map(m => ({
            id: m.id, name: m.name, role: 'Closer' as const,
            sales: m.sales, revenue: m.revenue,
            meetingsBooked: m.meetingsBooked, meetingsHeld: m.meetingsHeld,
            noShowCount: m.noShowCount
         }));

      // --- 7. Build KPIs ---
      const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;
      const cpmql = totalMqls > 0 ? totalCost / totalMqls : 0;
      const cac = totalSales > 0 ? totalCost / totalSales : 0;
      const roas = totalCost > 0 ? totalRevenue / totalCost : 0;
      const ticket = totalSales > 0 ? totalRevenue / totalSales : 0;
      const noShowRate = meetingsBooked > 0 ? (totalNoShows / meetingsBooked) * 100 : 0;
      const convMeetSale = meetingsHeld > 0 ? (totalSales / meetingsHeld) * 100 : 0;
      const convAgendConect = connections > 0 ? (meetingsBooked / connections) * 100 : 0;
      const convRealizAgend = meetingsBooked > 0 ? (meetingsHeld / meetingsBooked) * 100 : 0;

      const kpis: Record<string, MetricData> = {
         investment: { id: 'investment', label: 'Investimento', value: totalCost, goal: 120000, unit: 'currency' },
         leads: { id: 'leads', label: 'Leads', value: totalLeads, goal: 800, unit: 'number' },
         cpl: { id: 'cpl', label: 'CPL', value: cpl, goal: 150, unit: 'currency' },
         mqls: { id: 'mqls', label: 'MQLs', value: totalMqls, goal: 700, unit: 'number' },
         cpmql: { id: 'cpmql', label: 'Custo por MQL', value: cpmql, goal: 180, unit: 'currency' },
         sales: { id: 'sales', label: 'Vendas Total', value: totalSales, goal: 20, unit: 'number' },
         revenue: { id: 'revenue', label: 'Faturamento', value: totalRevenue, goal: 600000, unit: 'currency' },
         ticket: { id: 'ticket', label: 'Ticket Médio', value: ticket, goal: 25000, unit: 'currency' },
         connections: { id: 'connections', label: 'Conexões', value: connections, goal: 300, unit: 'number' },
         meetingsBooked: { id: 'meetingsBooked', label: 'Reuniões Agendadas', value: meetingsBooked, goal: 150, unit: 'number' },
         meetingsHeld: { id: 'meetingsHeld', label: 'Reuniões Realizadas', value: meetingsHeld, goal: 100, unit: 'number' },
         noShowRate: { id: 'noShowRate', label: 'Taxa No-Show', value: noShowRate, goal: 30, unit: 'percentage' },
         cac: { id: 'cac', label: 'CAC', value: cac, goal: 6000, unit: 'currency' },
         roas: { id: 'roas', label: 'ROAS', value: roas, goal: 5, unit: 'number', suffix: 'x' },
         salesInbound: { id: 'salesInbound', label: 'Vendas Inbound', value: salesInbound, goal: 15, unit: 'number' },
         salesOutbound: { id: 'salesOutbound', label: 'Vendas Outbound', value: salesOutbound, goal: 5, unit: 'number' },
         conversionMeetingSale: { id: 'conversionMeetingSale', label: 'Conv. Venda/Realizada', value: convMeetSale, goal: 20, unit: 'percentage' },
         opportunities: { id: 'opportunities', label: 'Oportunidades', value: monthOpenDeals.length + totalSales, goal: 500, unit: 'number' },
         marketingSales: { id: 'marketingSales', label: 'Vendas MKT', value: totalSales, goal: 20, unit: 'number' },
         marketingRevenue: { id: 'marketingRevenue', label: 'Faturamento MKT', value: totalRevenue, goal: 600000, unit: 'currency' },
         noShows: { id: 'noShows', label: 'No-Shows', value: totalNoShows, goal: 20, unit: 'number' },
         rescheduled: { id: 'rescheduled', label: 'Reagendamentos', value: totalRescheduled, goal: 15, unit: 'number' },
      };

      // --- 8. Business day context ---
      const maxDaysInMonth = new Date(dataYear, dataMonth + 1, 0).getDate();
      let totalBusinessDays = 0;
      for (let d = 1; d <= maxDaysInMonth; d++) {
         const date = new Date(dataYear, dataMonth, d);
         if (date.getDay() !== 0 && date.getDay() !== 6) totalBusinessDays++;
      }

      // Find latest data day
      const latestMarketingDate = marketingRows.length > 0 ? marketingRows[marketingRows.length - 1].date : dataLastOfMonth;
      const latestDay = new Date(latestMarketingDate + 'T00:00:00').getDate();
      let currentBusinessDay = 0;
      for (let d = 1; d <= latestDay; d++) {
         const date = new Date(dataYear, dataMonth, d);
         if (date.getDay() !== 0 && date.getDay() !== 6) currentBusinessDay++;
      }

      const context: PeriodContext = {
         currentDay: currentBusinessDay || 1,
         totalDays: totalBusinessDays || 1
      };

      // --- 9. Daily trends ---
      const trendsMap = new Map<string, any>();

      const ensureTrendDay = (dateKey: string) => {
         if (!trendsMap.has(dateKey)) {
            trendsMap.set(dateKey, {
               date: dateKey, cost: 0, leads: 0, mqls: 0, vendas: 0,
               faturamento: 0, rm: 0, rr: 0, impressions: 0, clicks: 0,
               no_shows: 0, rescheduled: 0,
            });
         }
         return trendsMap.get(dateKey);
      };

      marketingRows.forEach((r: any) => {
         const t = ensureTrendDay(r.date);
         t.cost += safeNumber(r.cost);
         t.leads += safeNumber(r.leads);
         t.mqls += safeNumber(r.mqls);
         t.vendas += safeNumber(r.vendas);
         t.faturamento += safeNumber(r.faturamento);
         t.impressions += safeNumber(r.impressions);
         t.clicks += safeNumber(r.clicks);
      });

      // Enrich trends with Pipedrive won deals by date
      monthWonDeals.forEach(d => {
         const dateKey = d.won_time?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         t.vendas++;
         t.faturamento += d.value || 0;
      });

      // Enrich trends with Pipedrive activities by date (meetings, no-shows, rescheduled)
      allActivities.forEach(act => {
         const dateKey = act.due_date;
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         const type = act.type || '';
         if (MEETING_TYPES.has(type)) {
            t.rm++; // meetings booked
            if (act.done) t.rr++; // meetings held (done)
         }
         if (type === NO_SHOW_TYPE) {
            t.rm++; // was booked
            t.no_shows++;
         }
         if (type === RESCHEDULED_TYPE) {
            t.rescheduled++;
         }
      });

      const dailyTrends = Array.from(trendsMap.values())
         .sort((a, b) => a.date.localeCompare(b.date))
         .map((row, idx) => ({
            day: `Dia ${parseInt(row.date.split('-')[2], 10)}`,
            dayIndex: idx + 1,
            date: row.date,
            leads: row.leads, mqls: row.mqls,
            investment: row.cost,
            revenue: row.faturamento, sales: row.vendas,
            connections: 0, opportunities: 0,
            meetings_booked: row.rm, meetings_held: row.rr,
            no_shows: row.no_shows, rescheduled: row.rescheduled,
            impressions: row.impressions, clicks: row.clicks,
            inbound: 0, outbound: 0
         }));

      // --- 10. Raw marketing data ---
      const rawMarketingData = marketingRows.map((r: any) => ({
         date: r.date,
         channel: 'Meta Ads',
         product: extractProductFromCampaign(r.campaign_name || ''),
         campaign: r.campaign_name || 'Diversos',
         ad_name: r.ad_name || '',
         cost: safeNumber(r.cost),
         leads: safeNumber(r.leads),
         mqls: safeNumber(r.mqls),
         impressions: safeNumber(r.impressions),
         clicks: safeNumber(r.clicks),
         sales: safeNumber(r.vendas),
         revenue: safeNumber(r.faturamento),
      }));

      // --- 11. Channel stats ---
      const channels: MarketingChannelStats[] = [{
         channel: 'Meta Ads',
         investment: totalCost, leads: totalLeads, cpl,
         mqls: totalMqls, sales: totalSales, revenue: totalRevenue,
         roas, cac,
         impressions: totalImpressions, clicks: totalClicks,
         cpm: totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0,
         ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      }];

      // --- 12. Product stats ---
      const productMap = new Map<string, any>();
      rawMarketingData.forEach((r: any) => {
         const prod = r.product;
         if (!productMap.has(prod)) {
            productMap.set(prod, { product: prod, investment: 0, leads: 0, mqls: 0, sales: 0, revenue: 0, roas: 0, cpl: 0 });
         }
         const p = productMap.get(prod);
         p.investment += r.cost;
         p.leads += r.leads;
         p.mqls += r.mqls;
         p.sales += r.sales;
         p.revenue += r.revenue;
      });
      const products: MarketingProductStats[] = Array.from(productMap.values()).map(p => ({
         ...p,
         cpl: p.leads > 0 ? p.investment / p.leads : 0,
         roas: p.investment > 0 ? p.revenue / p.investment : 0,
      }));

      // --- 13. Funnel data ---
      const funnelData: FunnelStage[] = [
         { name: 'Leads', value: totalLeads },
         { name: 'MQLs', value: totalMqls },
         { name: 'Conexões', value: connections },
         { name: 'Agendadas', value: meetingsBooked },
         { name: 'Realizadas', value: meetingsHeld },
         { name: 'Vendas', value: totalSales },
      ].filter(item => item.value > 0);

      // --- 14. Raw deals for follow-up table ---
      const rawDeals: FollowUpDeal[] = [...monthOpenDeals, ...monthWonDeals]
         .filter(d => d.stage_order_nr >= 6 || d.status === 'won') // Maturação+ or won
         .map(d => ({
            deal_id: String(d.id),
            deal_name: d.title || 'Sem título',
            owner_id: d.owner_name || USER_ROLES[d.user_id?.id || d.user_id]?.name || 'Desconhecido',
            stage_id: STAGE_MAP[d.stage_id] || `Stage ${d.stage_id}`,
            amount: d.value || 0,
            created_date: d.add_time?.substring(0, 10) || '',
            closed_date: d.won_time?.substring(0, 10) || '',
            status: d.status,
         })) as any[];

      return {
         kpis, dailyTrends, rawMarketingData, sdrData, closerData,
         channels, products, context, funnelData,
         lastUpdated: new Date(), rawTeamData: allTeamMembers, rawDeals,
         metaCampaigns: metaData.campaigns,
         metaLeads: metaData.leads,
         metaDemographics: metaData.demographics,
      };

   } catch (error) {
      console.error("Dashboard API Error:", error);
      return emptyData;
   }
};

export const uploadMarketingSector = async (parsedData: any[]) => {
   if (!isSupabaseConfigured) return false;
   const rows = parsedData.map(row => ({
      date: row['Data'] || row['date'],
      channel_id: row['channel_id'] || null,
      product_id: row['product_id'] || null,
      campaign_name: row['Campanha'] || row['campaign'] || 'Diversos',
      cost: safeNumber(row['Investimento'] || row['cost'] || 0),
      leads: safeNumber(row['Leads'] || row['leads'] || 0),
      mqls: safeNumber(row['MQLs'] || row['mqls'] || 0),
      impressions: safeNumber(row['Impressoes'] || row['impressions'] || 0),
      clicks: safeNumber(row['Cliques'] || row['clicks'] || 0),
      vendas: safeNumber(row['Vendas'] || row['vendas'] || 0),
      faturamento: safeNumber(row['Faturamento'] || row['faturamento'] || 0),
   })).filter(r => r.date);
   const { error } = await supabase.from('fact_daily_marketing').insert(rows);
   if (error) throw error;
   return true;
};

export const uploadCommercialSector = async (_parsedData: any[]) => {
   console.warn('Commercial data comes from Pipedrive automatically');
   return true;
};

export const uploadGoalsSector = async (_parsedData: any[]) => {
   console.warn('KPIs are computed from Pipedrive + Supabase data');
   return true;
};

export const updateKPIGoals = async (_kpis: any[]) => {
   console.warn('KPI goals are defined in code');
   return true;
};
