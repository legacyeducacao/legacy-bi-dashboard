import { supabase } from './supabase';
import { MetricData, RepPerformance, PeriodContext, FunnelStage, MarketingChannelStats, MarketingProductStats } from '../types';

export interface DashboardData {
   kpis: Record<string, MetricData>;
   dailyTrends: any[];
   sdrData: RepPerformance[];
   closerData: RepPerformance[];
   channels: MarketingChannelStats[];
   products: MarketingProductStats[];
   context: PeriodContext;
   funnelData: FunnelStage[];
   lastUpdated: Date;
}

const KEY_MAP: Record<string, string> = {
   'invest': 'investment',
   'leads': 'leads',
   'cpl': 'cpl',
   'mqls': 'mqls',
   'cpmql': 'cpmql',
   'mkt_revenue': 'marketingRevenue',
   'mkt_sales': 'marketingSales',
   'opps': 'opportunities',
   'connections': 'connections',
   'meetings_booked': 'meetingsBooked',
   'meetings_held': 'meetingsHeld',
   'response_time': 'responseTime',
   'sales': 'sales',
   'revenue': 'revenue',
   'ticket': 'ticket',
   'conv_meet_sale': 'conversionMeetingSale',
   'no_show_rate': 'noShowRate',
   'cac': 'cac',
   'ltv': 'ltv',
   'roas': 'roas'
};

const N8N_META_ADS_WEBHOOK = 'https://automacao-n8n.zs0trp.easypanel.host/webhook/30135616-a1ea-4196-abb1-367e88b1d882';

export const triggerMetaAdsAutomation = async () => {
   try {
      console.log("Triggering n8n Meta Ads Automation...");
      // We use a simple POST. Depending on how the user configured n8n, 
      // they might need specific data, but usually a simple trigger suffices for "Fetch Insights".
      const response = await fetch(N8N_META_ADS_WEBHOOK, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action: 'sync_meta_ads', timestamp: new Date().toISOString() })
      });

      if (!response.ok) {
         throw new Error(`Failed to trigger n8n: ${response.statusText}`);
      }
      return true;
   } catch (error) {
      console.error("Error triggering n8n automation:", error);
      throw error;
   }
};

export const fetchDashboardData = async (): Promise<DashboardData> => {
   try {
      console.log("Fetching data with Architecture V2...");

      const [
         { data: kpisData, error: kpisError },
         { data: trendsData, error: trendsError },
         { data: teamData, error: teamError },
         { data: channelsData, error: channelsError },
         { data: productsData, error: productsError }
      ] = await Promise.all([
         supabase.from('kpis').select('*'),
         supabase.from('daily_trends').select('*').order('date', { ascending: true }),
         supabase.from('team_performance').select('*'),
         supabase.from('marketing_channels').select('*'),
         supabase.from('marketing_products').select('*')
      ]);

      if (kpisError) throw kpisError;

      const kpis: Record<string, MetricData> = {};
      if (kpisData) {
         kpisData.forEach((row: any) => {
            const mappedId = KEY_MAP[row.id] || row.id;
            kpis[mappedId] = {
               id: mappedId,
               label: row.label,
               value: Number(row.value),
               goal: Number(row.goal),
               unit: row.unit as any,
               prefix: row.prefix || undefined,
               suffix: row.suffix || undefined
            };
         });
      }

      const now = new Date();
      const context: PeriodContext = {
         currentDay: now.getDate(),
         totalDays: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      };

      const dailyTrends = (trendsData || []).map((row: any, idx: number) => ({
         day: `Dia ${parseInt(row.date.split('-')[2], 10)}`,
         dayIndex: idx + 1,
         date: row.date,
         leads: Number(row.leads) || 0,
         mqls: Number(row.mqls) || 0,
         investment: Number(row.investment) || 0,
         revenue: Number(row.revenue) || 0,
         sales: Number(row.sales) || 0,
         connected: Number(row.connected) || 0,
         activities: Number(row.activities) || 0,
         opportunities: Number(row.opportunities) || 0,
         meetingsBooked: Number(row.meetings_booked) || 0
      }));

      const sdrData = (teamData || []).filter((r: any) => r.role === 'SDR').map((r: any) => ({
         id: r.id,
         name: r.name,
         role: 'SDR' as 'SDR' | 'Closer',
         opportunities: r.opportunities,
         connections: r.connections,
         meetingsBooked: r.meetings_booked,
         meetingsHeld: r.meetings_held,
         noShowCount: r.no_show_count,
         responseTime: Number(r.response_time)
      }));

      const closerData = (teamData || []).filter((r: any) => r.role === 'Closer').map((r: any) => ({
         id: r.id,
         name: r.name,
         role: 'Closer' as 'SDR' | 'Closer',
         meetingsHeld: r.meetings_held,
         sales: r.sales,
         revenue: Number(r.revenue),
         noShowCount: r.no_show_count,
         meetingsBooked: r.meetings_booked
      }));

      const funnelData = [
         { name: 'Leads', value: kpis.leads?.value || 0 },
         { name: 'MQLs', value: kpis.mqls?.value || 0 },
         { name: 'Oportunidades', value: kpis.opportunities?.value || 0 },
         { name: 'Conexões', value: kpis.connections?.value || 0 },
         { name: 'Agendadas', value: kpis.meetingsBooked?.value || 0 },
         { name: 'Realizadas', value: kpis.meetingsHeld?.value || 0 },
         { name: 'Vendas', value: kpis.sales?.value || 0 },
      ].filter(item => item.value > 0);

      return {
         kpis,
         dailyTrends,
         sdrData,
         closerData,
         channels: (channelsData || []).map(r => ({ ...r, roas: Number(r.roas) })),
         products: (productsData || []).map(r => ({ ...r, roas: Number(r.roas) })),
         context,
         funnelData,
         lastUpdated: new Date()
      };

   } catch (error) {
      console.error("Supabase API Error:", error);
      return {
         kpis: {},
         dailyTrends: [],
         sdrData: [],
         closerData: [],
         channels: [],
         products: [],
         context: { currentDay: 1, totalDays: 30 },
         funnelData: [],
         lastUpdated: new Date()
      };
   }
};

const safeNumber = (val: any) => {
   if (typeof val === 'number') return val;
   if (!val || typeof val !== 'string') return 0;
   // Handle format like "3.433,05" or "3433,05"
   const clean = val
      .replace(/[^\d,.-]/g, '') // Remove symbols
      .replace(/\.(?=\d{3}(,|$))/g, '') // Remove thousands separator if it's followed by 3 digits and a decimal comma or end
      .replace(',', '.'); // Convert decimal comma to dot
   const num = Number(clean);
   return isNaN(num) ? 0 : num;
};

async function ensureDimension(table: string, name: string, extra: object = {}) {
   if (!name) return null;
   const { data, error } = await supabase.from(table).select('id').eq('name', name).maybeSingle();
   if (data) return data.id;

   const { data: newDim, error: createError } = await supabase
      .from(table)
      .insert({ name, ...extra })
      .select('id')
      .single();

   if (createError) throw createError;
   return newDim.id;
}

export const uploadMarketingSector = async (parsedData: any[]) => {
   const rows = [];
   for (const row of parsedData) {
      const channelName = row['Canal'] || row['channel'] || row['canal'];
      const productName = row['Produto'] || row['product'] || row['produto'];
      const date = row['Data'] || row['date'] || row['data'];

      if (!channelName || !date) continue;

      const channel_id = await ensureDimension('dim_channels', channelName);
      const product_id = productName ? await ensureDimension('dim_products', productName) : null;

      rows.push({
         date,
         channel_id,
         product_id,
         cost: safeNumber(row['Investimento'] || row['investment'] || 0),
         leads: safeNumber(row['Leads'] || row['leads'] || 0),
         mqls: safeNumber(row['MQLs'] || row['mqls'] || 0),
         impressions: safeNumber(row['Impressoes'] || row['impressions'] || 0),
         clicks: safeNumber(row['Cliques'] || row['clicks'] || 0)
      });
   }

   const { error } = await supabase.from('fact_daily_marketing').upsert(rows, { onConflict: 'date,channel_id,product_id' });
   if (error) throw error;
   return true;
};

export const uploadCommercialSector = async (parsedData: any[]) => {
   const rows = [];
   for (const row of parsedData) {
      const memberName = row['Vendedor'] || row['member_name'] || row['vendedor'];
      const role = row['Cargo'] || row['role'] || row['cargo'];
      const date = row['Data'] || row['date'] || row['data'];

      if (!memberName || !date) continue;

      const team_member_id = await ensureDimension('dim_team', memberName, role ? { role } : {});

      rows.push({
         date,
         team_member_id,
         connections: safeNumber(row['Conexoes'] || row['connections'] || 0),
         calls: safeNumber(row['Chamadas'] || row['calls'] || 0),
         opportunities: safeNumber(row['Oportunidades'] || row['opportunities'] || 0),
         meetings_booked: safeNumber(row['Agendamentos'] || row['meetings_booked'] || 0),
         meetings_held: safeNumber(row['Reunioes_Realizadas'] || row['meetings_held'] || 0),
         no_shows: safeNumber(row['No_Show'] || row['no_show'] || 0)
      });
   }

   const { error } = await supabase.from('fact_team_activities').upsert(rows, { onConflict: 'date,team_member_id' });
   if (error) throw error;
   return true;
};

export const uploadGoalsSector = async (parsedData: any[]) => {
   const rows = parsedData.map(row => ({
      id: row['Metrica'] || row['id'] || row['metrica'],
      label: row['Nome_Exibicao'] || row['label'] || row['nome_exibicao'],
      value: safeNumber(row['Valor_Atual'] || row['value'] || row['valor_atual'] || 0),
      goal: safeNumber(row['Meta_Mensal'] || row['goal'] || row['meta_mensal'] || 0),
      unit: row['Unidade'] || row['unit'] || 'number'
   }));

   const { error } = await supabase.from('kpis').upsert(rows, { onConflict: 'id' });
   if (error) throw error;
   return true;
};
