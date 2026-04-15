import { supabase, isSupabaseConfigured } from './supabase';
import { fetchAllMetaData } from './meta';
import { fetchAllCRMData, getLatestDealStates, getUniqueWonDeals } from './supabaseCRM';
import { MetricData, RepPerformance, PeriodContext, FunnelStage, MarketingChannelStats, MarketingProductStats, FollowUpDeal, MetaCampaignData, MetaLeadData, MetaDemographicData, CRMDealUpdated, CRMActivityCreated, CRMActivityUpdated } from '../types';

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

// --- Config ---
const STAGE_MAP: Record<string, string> = {
   '6': 'Oportunidades', '7': 'Filtro 1', '8': 'Filtro 2', '9': 'Agendado',
   '22': 'Reagendamento', '10': 'Maturação', '20': 'Negociação',
   '21': 'Envio de Contrato', '11': 'Vendido'
};

const STAGE_ORDER: Record<string, number> = {
   '6': 1, '7': 2, '8': 3, '9': 4, '22': 5, '10': 6, '20': 7, '21': 8, '11': 9
};

const USER_ROLES: Record<string, { name: string; role: 'SDR' | 'Closer' }> = {
   '25959419': { name: 'Isaque Inacio', role: 'SDR' },
   '25955327': { name: 'Luan Gabriel', role: 'SDR' },
   '25955316': { name: 'Rodrigo Fernandes', role: 'SDR' },
   '25909798': { name: 'João Vitor Gaspar', role: 'SDR' },
   '25963379': { name: 'Paim', role: 'SDR' },
   '25952137': { name: 'Joel Carlos', role: 'Closer' },
   '25952181': { name: 'Leonardo Padilha', role: 'Closer' },
   '25959529': { name: 'Leonardo Souza', role: 'Closer' },
   '25839024': { name: 'Allan Silva', role: 'Closer' },
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
      'LEGADO': 'Executória',
   };
   return map[tag] || tag;
};

// Activity subject classification
function isConnectionAttempt(subject: string): boolean {
   return /tentativa de conex/i.test(subject) || subject === 'Pré-qualificação';
}

function isMeetingSubject(subject: string, type: string): boolean {
   return type === 'sessao_estrategica' || type === 'meeting' ||
      /sess[aã]o estrat[eé]g/i.test(subject) || /sess[aã]o impuls/i.test(subject) ||
      /fechamento/i.test(subject);
}

function isNoShow(type: string): boolean {
   return type === 'no_show';
}

function isSchedulingAttempt(subject: string): boolean {
   return /tentativa de agendamento/i.test(subject) || /tentativa de reagendamento/i.test(subject);
}

function getUserInfo(userId: string): { name: string; role: 'SDR' | 'Closer' } {
   return USER_ROLES[userId] || { name: `User ${userId}`, role: 'SDR' };
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
      console.log("Fetching dashboard data (Supabase CRM + Meta API)...");

      // --- 1. Determine current data month ---
      const now = new Date();
      const brazilNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const dataYear = brazilNow.getFullYear();
      const dataMonth = brazilNow.getMonth();
      const monthStart = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}-01`;
      const maxDay = new Date(dataYear, dataMonth + 1, 0).getDate();
      const monthEnd = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}-${maxDay}`;

      // --- 2. Fetch all data in parallel ---
      const [crmData, metaData, marketingResult] = await Promise.all([
         // CRM data from Supabase (primary source)
         fetchAllCRMData(monthStart, monthEnd).catch(e => {
            console.warn('CRM data fetch failed:', e);
            return { dealsCreated: [], dealsUpdated: [], wonDeals: [], lostDeals: [], activitiesCreated: [], activitiesUpdated: [], personsCreated: [] };
         }),
         // Meta Ads API
         fetchAllMetaData(monthStart, monthEnd).catch(() => ({
            campaigns: [] as MetaCampaignData[], insights: [] as any[],
            leads: [] as MetaLeadData[], demographics: { ageGender: [], regions: [] } as MetaDemographicData
         })),
         // Supabase marketing data (fact_daily_marketing)
         isSupabaseConfigured
            ? supabase.from('fact_daily_marketing').select('*').gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: true }).limit(5000)
            : Promise.resolve({ data: [] as any[] }),
      ]);

      const marketingRows = (marketingResult as any).data || [];
      const { dealsCreated, wonDeals: rawWonDeals, lostDeals, activitiesCreated, activitiesUpdated, personsCreated, dealsUpdated } = crmData;

      // Deduplicate deals
      const latestOpenDeals = getLatestDealStates(dealsUpdated.filter(d => d.Status === 'open'));
      const uniqueWonDeals = getUniqueWonDeals(rawWonDeals);
      const uniqueLostDeals = getUniqueWonDeals(lostDeals); // same dedup logic

      console.log(`CRM: ${dealsCreated.length} created, ${latestOpenDeals.length} open, ${uniqueWonDeals.length} won, ${uniqueLostDeals.length} lost | Activities: ${activitiesCreated.length} created, ${activitiesUpdated.length} updated | Persons: ${personsCreated.length} | Marketing: ${marketingRows.length} rows | Meta: ${metaData.campaigns.length} campaigns`);

      // --- 3. Aggregate marketing totals ---
      let totalCost = 0, totalImpressions = 0, totalClicks = 0;
      let mktVendas = 0, mktFaturamento = 0;

      marketingRows.forEach((r: any) => {
         totalCost += safeNumber(r.cost);
         totalImpressions += safeNumber(r.impressions);
         totalClicks += safeNumber(r.clicks);
         mktVendas += safeNumber(r.vendas);
         mktFaturamento += safeNumber(r.faturamento);
      });

      // If no Supabase marketing data, use Meta API insights
      if (marketingRows.length === 0 && metaData.insights.length > 0) {
         metaData.insights.forEach((row: any) => {
            totalCost += row.spend || 0;
            totalImpressions += row.impressions || 0;
            totalClicks += row.clicks || 0;
         });
      }

      // --- 4. Compute commercial KPIs from CRM ---
      const totalLeads = personsCreated.length || dealsCreated.length;
      const totalSales = uniqueWonDeals.length;
      const totalRevenue = uniqueWonDeals.reduce((sum, d) => sum + (d.valor || 0), 0);

      // MQLs = leads that passed Filtro 1+ (stage_id >= 7) or were qualified
      const mqls = latestOpenDeals.filter(d => {
         const order = STAGE_ORDER[d.stage_id] || 0;
         return order >= 2; // Past Oportunidades
      }).length + totalSales;

      // Connections = deals past Oportunidades (stage >= Filtro 1)
      const connections = latestOpenDeals.filter(d => {
         const order = STAGE_ORDER[d.stage_id] || 0;
         return order >= 2;
      }).length + totalSales;

      // Person origins for inbound/outbound split
      let salesInbound = 0, salesOutbound = 0;
      uniqueWonDeals.forEach(d => {
         const person = personsCreated.find(p => p.entidade_id === d.person_id);
         const from = (person?.From || '').toLowerCase();
         if (from === 'outbound') salesOutbound++;
         else salesInbound++;
      });

      // --- 5. Aggregate activities ---
      let meetingsBooked = 0, meetingsHeld = 0, totalNoShows = 0, totalRescheduled = 0;

      // From atividade_criada: count meetings booked, connections
      activitiesCreated.forEach(act => {
         if (isMeetingSubject(act.subject, act.type)) meetingsBooked++;
         if (isNoShow(act.type)) { totalNoShows++; meetingsBooked++; }
         if (isSchedulingAttempt(act.subject)) totalRescheduled++;
      });

      // From Atividade Alterada: count meetings held (done activities)
      activitiesUpdated.forEach(act => {
         if (isMeetingSubject(act.Subject, act.type)) meetingsHeld++;
         if (isNoShow(act.type)) totalNoShows++;
      });

      // Avoid double counting
      if (totalNoShows > 0) totalNoShows = Math.ceil(totalNoShows / 2);

      // --- 6. Build team data from CRM ---
      const teamMap = new Map<string, any>();

      const initTeamMember = (userId: string) => {
         const info = getUserInfo(userId);
         if (!teamMap.has(info.name)) {
            teamMap.set(info.name, {
               id: info.name.replace(/\s+/g, ''),
               name: info.name,
               role: info.role,
               opportunities: 0, connections: 0, meetingsBooked: 0,
               meetingsHeld: 0, sales: 0, revenue: 0, noShowCount: 0,
               rescheduled: 0, calls: 0,
            });
         }
         return teamMap.get(info.name);
      };

      // Deals created → opportunities by owner
      dealsCreated.forEach(d => {
         if (!d.owner_id) return;
         const member = initTeamMember(d.owner_id);
         member.opportunities++;
      });

      // Open deals → connections (stage >= Filtro 1)
      latestOpenDeals.forEach(d => {
         if (!d.owner_id) return;
         const member = initTeamMember(d.owner_id);
         const order = STAGE_ORDER[d.stage_id] || 0;
         if (order >= 2) member.connections++;
      });

      // Won deals → sales + revenue by owner
      uniqueWonDeals.forEach(d => {
         if (!d.owner_id) return;
         const member = initTeamMember(d.owner_id);
         member.sales++;
         member.revenue += d.valor || 0;
         member.connections++;
      });

      // Activities created → per user
      activitiesCreated.forEach(act => {
         if (!act.user_id) return;
         const member = initTeamMember(act.user_id);
         if (isConnectionAttempt(act.subject)) member.connections++;
         if (isMeetingSubject(act.subject, act.type)) member.meetingsBooked++;
         if (isNoShow(act.type)) member.noShowCount++;
         if (isSchedulingAttempt(act.subject)) member.rescheduled++;
         if (act.type === 'call') member.calls++;
      });

      // Activities updated → meetings held per user
      activitiesUpdated.forEach(act => {
         if (!act.user_id) return;
         const member = initTeamMember(act.user_id);
         if (isMeetingSubject(act.Subject, act.type)) member.meetingsHeld++;
      });

      // Build SDR and Closer arrays
      const allTeamMembers = Array.from(teamMap.values());

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
      const cpmql = mqls > 0 ? totalCost / mqls : 0;
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
         mqls: { id: 'mqls', label: 'MQLs', value: mqls, goal: 700, unit: 'number' },
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
         opportunities: { id: 'opportunities', label: 'Oportunidades', value: dealsCreated.length, goal: 500, unit: 'number' },
         marketingSales: { id: 'marketingSales', label: 'Vendas MKT', value: totalSales, goal: 20, unit: 'number' },
         marketingRevenue: { id: 'marketingRevenue', label: 'Faturamento MKT', value: totalRevenue, goal: 600000, unit: 'currency' },
         noShows: { id: 'noShows', label: 'No-Shows', value: totalNoShows, goal: 20, unit: 'number' },
         rescheduled: { id: 'rescheduled', label: 'Reagendamentos', value: totalRescheduled, goal: 15, unit: 'number' },
      };

      // --- 8. Business day context ---
      let totalBusinessDays = 0;
      for (let d = 1; d <= maxDay; d++) {
         const date = new Date(dataYear, dataMonth, d);
         if (date.getDay() !== 0 && date.getDay() !== 6) totalBusinessDays++;
      }

      const todayDay = brazilNow.getDate();
      let currentBusinessDay = 0;
      for (let d = 1; d <= todayDay; d++) {
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

      // Marketing rows
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

      // CRM deals created → leads per day
      dealsCreated.forEach(d => {
         const dateKey = d.created_at?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         t.leads++;
      });

      // CRM won deals → sales per day
      uniqueWonDeals.forEach(d => {
         const dateKey = d.created_at?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         t.vendas++;
         t.faturamento += d.valor || 0;
      });

      // CRM activities → meetings per day
      activitiesCreated.forEach(act => {
         const dateKey = act.created_at?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         if (isMeetingSubject(act.subject, act.type)) t.rm++;
         if (isNoShow(act.type)) { t.rm++; t.no_shows++; }
         if (isSchedulingAttempt(act.subject)) t.rescheduled++;
      });

      activitiesUpdated.forEach(act => {
         const dateKey = act.created_at?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         if (isMeetingSubject(act.Subject, act.type)) t.rr++;
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
         mqls, sales: totalSales, revenue: totalRevenue,
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

      // --- 13. Funnel data from CRM pipeline ---
      const stageCountMap: Record<string, number> = {};
      latestOpenDeals.forEach(d => {
         const stage = STAGE_MAP[d.stage_id] || 'Outro';
         stageCountMap[stage] = (stageCountMap[stage] || 0) + 1;
      });

      const funnelData: FunnelStage[] = [
         { name: 'Leads', value: totalLeads },
         { name: 'MQLs', value: mqls },
         { name: 'Conexões', value: connections },
         { name: 'Agendadas', value: meetingsBooked },
         { name: 'Realizadas', value: meetingsHeld },
         { name: 'Vendas', value: totalSales },
      ].filter(item => item.value > 0);

      // --- 14. Raw deals for follow-up table ---
      const rawDeals: FollowUpDeal[] = [
         ...latestOpenDeals.filter(d => (STAGE_ORDER[d.stage_id] || 0) >= 6), // Maturação+
         ...uniqueWonDeals,
      ].map(d => ({
         deal_id: String(d.id),
         deal_name: d.Nome || 'Sem título',
         owner_id: USER_ROLES[d.owner_id]?.name || d.owner_id || 'Desconhecido',
         stage_id: STAGE_MAP[d.stage_id] || `Stage ${d.stage_id}`,
         amount: d.valor || 0,
         created_date: d.created_at?.substring(0, 10) || '',
         closed_date: d.Status === 'won' ? d.created_at?.substring(0, 10) || '' : '',
         status: d.Status,
      })) as any[];

      // Enrich Meta leads with Supabase qualifications
      if (metaData.leads.length > 0 && isSupabaseConfigured) {
         const { data: qualificacoes } = await supabase
            .from('qualificacao_do_lead_na_3C_ao_encerrar_chamada')
            .select('*').gte('created_at', monthStart).limit(5000);
         if (qualificacoes && qualificacoes.length > 0) {
            metaData.leads = metaData.leads.map(lead => {
               const phone = lead.phone.replace(/\D/g, '');
               const match = qualificacoes.find((q: any) => {
                  const qPhone = (q.Telefone || q.telefone || '').replace(/\D/g, '');
                  return qPhone && phone && qPhone.endsWith(phone.slice(-8));
               });
               return { ...lead, pipelineStatus: match ? (match['Qualificação'] || '') : '' };
            });
         }
      }

      return {
         kpis, dailyTrends, rawMarketingData, sdrData, closerData,
         channels, products, context, funnelData,
         lastUpdated: new Date(),
         rawTeamData: allTeamMembers.map(m => ({
            ...m, rep_name: m.name,
            meetings_booked: m.meetingsBooked, meetings_held: m.meetingsHeld,
            no_shows: m.noShowCount,
         })),
         rawDeals,
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
   console.warn('Commercial data comes from Supabase CRM automatically');
   return true;
};

export const uploadGoalsSector = async (_parsedData: any[]) => {
   console.warn('KPIs are computed from CRM + marketing data');
   return true;
};

export const updateKPIGoals = async (_kpis: any[]) => {
   console.warn('KPI goals are defined in code');
   return true;
};
