import { supabase, isSupabaseConfigured } from './supabase';
import { MetricData, RepPerformance, PeriodContext, FunnelStage, MarketingChannelStats, MarketingProductStats, FollowUpDeal } from '../types';

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
}

const N8N_META_ADS_WEBHOOK = 'https://automacao-n8n.zs0trp.easypanel.host/webhook/30135616-a1ea-4196-abb1-367e88b1d882';

export const triggerMetaAdsAutomation = async (): Promise<void> => {
   const now = new Date();
   const todayLocal = new Date(now.getTime() - 3 * 60 * 60 * 1000);
   const todayStr = todayLocal.toISOString().split('T')[0];

   const response = await fetch(N8N_META_ADS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
         action: 'sync_meta_ads',
         timestamp: now.toISOString(),
         date: todayStr,
         date_preset: 'today'
      })
   });

   if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
   }
};

const safeNumber = (val: any): number => {
   if (typeof val === 'number') return val;
   if (!val) return 0;
   const str = String(val);
   const clean = str
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(,|$))/g, '')
      .replace(',', '.');
   const num = Number(clean);
   return isNaN(num) ? 0 : num;
};

/** Extract product name from campaign_name pattern like "[Legado]" or "[IE]" */
const extractProductFromCampaign = (campaignName: string): string => {
   const match = campaignName.match(/\[([^\]]+)\]/);
   if (!match) return 'Outros';
   const tag = match[1].trim();
   const map: Record<string, string> = {
      'Legado': 'Executória',
      'IE': 'Inteligência Empresarial',
      'Imersão': 'Impulsão Empresarial',
      'TESTE': 'Teste',
   };
   return map[tag] || tag;
};

export const fetchDashboardData = async (): Promise<DashboardData> => {
   const emptyData: DashboardData = {
      kpis: {},
      dailyTrends: [],
      rawMarketingData: [],
      sdrData: [],
      closerData: [],
      channels: [],
      products: [],
      context: { currentDay: 1, totalDays: 30 },
      funnelData: [],
      lastUpdated: new Date(),
      rawTeamData: [],
      rawDeals: []
   };

   if (!isSupabaseConfigured) {
      console.warn("Supabase not configured. Returning empty data.");
      return emptyData;
   }

   try {
      console.log("Fetching dashboard data...");

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

      // If current month has no data, use last month with data (March 2026)
      const { data: latestRow } = await supabase
         .from('fact_daily_marketing')
         .select('date')
         .order('date', { ascending: false })
         .limit(1);

      const latestDate = latestRow?.[0]?.date || firstOfMonth;
      const latestDateObj = new Date(latestDate + 'T00:00:00');
      const dataYear = latestDateObj.getFullYear();
      const dataMonth = latestDateObj.getMonth();
      const dataFirstOfMonth = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}-01`;
      const dataLastOfMonth = `${dataYear}-${String(dataMonth + 1).padStart(2, '0')}-${new Date(dataYear, dataMonth + 1, 0).getDate()}`;

      // Fetch all marketing data for the data month (up to 5000 rows)
      const { data: rawRows, error: rawError } = await supabase
         .from('fact_daily_marketing')
         .select('*')
         .gte('date', dataFirstOfMonth)
         .lte('date', dataLastOfMonth)
         .order('date', { ascending: true })
         .limit(5000);

      if (rawError) throw rawError;

      const rows = rawRows || [];
      console.log(`Loaded ${rows.length} marketing rows for ${dataFirstOfMonth} to ${dataLastOfMonth}`);

      // --- Aggregate totals for KPIs ---
      let totalCost = 0, totalLeads = 0, totalMqls = 0, totalVendas = 0, totalFaturamento = 0;
      let totalRm = 0, totalRr = 0, totalImpressions = 0, totalClicks = 0;

      rows.forEach((r: any) => {
         totalCost += safeNumber(r.cost);
         totalLeads += safeNumber(r.leads);
         totalMqls += safeNumber(r.mqls);
         totalVendas += safeNumber(r.vendas);
         totalFaturamento += safeNumber(r.faturamento);
         totalRm += safeNumber(r.rm);
         totalRr += safeNumber(r.rr);
         totalImpressions += safeNumber(r.impressions);
         totalClicks += safeNumber(r.clicks);
      });

      const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;
      const cpmql = totalMqls > 0 ? totalCost / totalMqls : 0;
      const cac = totalVendas > 0 ? totalCost / totalVendas : 0;
      const roas = totalCost > 0 ? totalFaturamento / totalCost : 0;
      const ticket = totalVendas > 0 ? totalFaturamento / totalVendas : 0;
      const noShowRate = totalRm > 0 ? ((totalRm - totalRr) / totalRm) * 100 : 0;

      // --- Build KPIs (computed from data) ---
      const kpis: Record<string, MetricData> = {
         investment: { id: 'investment', label: 'Investimento', value: totalCost, goal: 120000, unit: 'currency' },
         leads: { id: 'leads', label: 'Leads', value: totalLeads, goal: 800, unit: 'number' },
         cpl: { id: 'cpl', label: 'CPL', value: cpl, goal: 150, unit: 'currency' },
         mqls: { id: 'mqls', label: 'MQLs', value: totalMqls, goal: 700, unit: 'number' },
         cpmql: { id: 'cpmql', label: 'Custo por MQL', value: cpmql, goal: 180, unit: 'currency' },
         sales: { id: 'sales', label: 'Vendas', value: totalVendas, goal: 60, unit: 'number' },
         revenue: { id: 'revenue', label: 'Faturamento', value: totalFaturamento, goal: 1500000, unit: 'currency' },
         ticket: { id: 'ticket', label: 'Ticket Médio', value: ticket, goal: 20000, unit: 'currency' },
         meetingsBooked: { id: 'meetingsBooked', label: 'Reuniões Agendadas', value: totalRm, goal: 600, unit: 'number' },
         meetingsHeld: { id: 'meetingsHeld', label: 'Reuniões Realizadas', value: totalRr, goal: 350, unit: 'number' },
         noShowRate: { id: 'noShowRate', label: 'Taxa No-Show', value: noShowRate, goal: 30, unit: 'percentage' },
         cac: { id: 'cac', label: 'CAC', value: cac, goal: 2500, unit: 'currency' },
         roas: { id: 'roas', label: 'ROAS', value: roas, goal: 10, unit: 'number', suffix: 'x' },
      };

      // --- Business day context ---
      const maxDaysInMonth = new Date(dataYear, dataMonth + 1, 0).getDate();
      let totalBusinessDays = 0;
      for (let d = 1; d <= maxDaysInMonth; d++) {
         const date = new Date(dataYear, dataMonth, d);
         if (date.getDay() !== 0 && date.getDay() !== 6) totalBusinessDays++;
      }

      // Use latest data date as "current day" reference
      const latestDay = latestDateObj.getDate();
      let currentBusinessDay = 0;
      for (let d = 1; d <= latestDay; d++) {
         const date = new Date(dataYear, dataMonth, d);
         if (date.getDay() !== 0 && date.getDay() !== 6) currentBusinessDay++;
      }

      const context: PeriodContext = {
         currentDay: currentBusinessDay || 1,
         totalDays: totalBusinessDays || 1
      };

      // --- Daily trends (aggregate per day) ---
      const trendsMap = new Map<string, any>();
      rows.forEach((r: any) => {
         const dateKey = r.date;
         if (!trendsMap.has(dateKey)) {
            trendsMap.set(dateKey, {
               date: dateKey, cost: 0, leads: 0, mqls: 0, vendas: 0,
               faturamento: 0, rm: 0, rr: 0, impressions: 0, clicks: 0
            });
         }
         const t = trendsMap.get(dateKey);
         t.cost += safeNumber(r.cost);
         t.leads += safeNumber(r.leads);
         t.mqls += safeNumber(r.mqls);
         t.vendas += safeNumber(r.vendas);
         t.faturamento += safeNumber(r.faturamento);
         t.rm += safeNumber(r.rm);
         t.rr += safeNumber(r.rr);
         t.impressions += safeNumber(r.impressions);
         t.clicks += safeNumber(r.clicks);
      });

      const dailyTrends = Array.from(trendsMap.values())
         .sort((a, b) => a.date.localeCompare(b.date))
         .map((row, idx) => ({
            day: `Dia ${parseInt(row.date.split('-')[2], 10)}`,
            dayIndex: idx + 1,
            date: row.date,
            leads: row.leads,
            mqls: row.mqls,
            investment: row.cost,
            revenue: row.faturamento,
            sales: row.vendas,
            connections: 0,
            opportunities: 0,
            meetings_booked: row.rm,
            meetings_held: row.rr,
            impressions: row.impressions,
            clicks: row.clicks,
            inbound: 0,
            outbound: 0
         }));

      // --- Raw marketing data for tables/filters ---
      const rawMarketingData = rows.map((r: any) => ({
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

      // --- Channel stats (single channel for now: Meta Ads) ---
      const channels: MarketingChannelStats[] = [{
         channel: 'Meta Ads',
         investment: totalCost,
         leads: totalLeads,
         cpl: cpl,
         mqls: totalMqls,
         sales: totalVendas,
         revenue: totalFaturamento,
         roas: roas,
         cac: cac,
         impressions: totalImpressions,
         clicks: totalClicks,
         cpm: totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0,
         ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      }];

      // --- Product stats (grouped by campaign tag) ---
      const productMap = new Map<string, any>();
      rawMarketingData.forEach((r: any) => {
         const prod = r.product;
         if (!productMap.has(prod)) {
            productMap.set(prod, { product: prod, investment: 0, leads: 0, cpl: 0, sales: 0, revenue: 0, roas: 0 });
         }
         const p = productMap.get(prod);
         p.investment += r.cost;
         p.leads += r.leads;
         p.sales += r.vendas;
         p.revenue += r.faturamento;
      });
      const products: MarketingProductStats[] = Array.from(productMap.values()).map(p => ({
         ...p,
         cpl: p.leads > 0 ? p.investment / p.leads : 0,
         roas: p.investment > 0 ? p.revenue / p.investment : 0,
      }));

      // --- Funnel ---
      const funnelData: FunnelStage[] = [
         { name: 'Impressões', value: totalImpressions },
         { name: 'Cliques', value: totalClicks },
         { name: 'Leads', value: totalLeads },
         { name: 'MQLs', value: totalMqls },
         { name: 'Agendadas', value: totalRm },
         { name: 'Realizadas', value: totalRr },
         { name: 'Vendas', value: totalVendas },
      ].filter(item => item.value > 0);

      return {
         kpis,
         dailyTrends,
         rawMarketingData,
         sdrData: [],
         closerData: [],
         channels,
         products,
         context,
         funnelData,
         lastUpdated: new Date(),
         rawTeamData: [],
         rawDeals: []
      };

   } catch (error) {
      console.error("Supabase API Error:", error);
      return emptyData;
   }
};

export const uploadMarketingSector = async (parsedData: any[]) => {
   const rows = parsedData.map(row => ({
      date: row['Data'] || row['date'] || row['data'],
      channel_id: row['channel_id'] || null,
      product_id: row['product_id'] || null,
      campaign_name: row['Campanha'] || row['campaign'] || row['campanha'] || 'Diversos',
      cost: safeNumber(row['Investimento'] || row['investment'] || row['cost'] || 0),
      leads: safeNumber(row['Leads'] || row['leads'] || 0),
      mqls: safeNumber(row['MQLs'] || row['mqls'] || 0),
      impressions: safeNumber(row['Impressoes'] || row['impressions'] || 0),
      clicks: safeNumber(row['Cliques'] || row['clicks'] || 0),
      vendas: safeNumber(row['Vendas'] || row['vendas'] || 0),
      faturamento: safeNumber(row['Faturamento'] || row['faturamento'] || 0),
      rm: safeNumber(row['RM'] || row['rm'] || 0),
      rr: safeNumber(row['RR'] || row['rr'] || 0),
   })).filter(r => r.date);

   const { error } = await supabase.from('fact_daily_marketing').insert(rows);
   if (error) throw error;
   return true;
};

export const uploadCommercialSector = async (_parsedData: any[]) => {
   console.warn('uploadCommercialSector: Pipedrive integration pending');
   return true;
};

export const uploadGoalsSector = async (_parsedData: any[]) => {
   console.warn('uploadGoalsSector: KPIs are computed from marketing data');
   return true;
};

export const updateKPIGoals = async (_kpis: any[]) => {
   console.warn('updateKPIGoals: KPIs are computed from marketing data');
   return true;
};
