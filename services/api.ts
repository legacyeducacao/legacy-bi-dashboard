import { supabase } from './supabase';
import { MetricData, RepPerformance, PeriodContext, FunnelStage, MarketingChannelStats, MarketingProductStats } from '../types';

export interface DashboardData {
   kpis: Record<string, MetricData>;
   dailyTrends: any[];
   rawMarketingData: any[]; // fact_daily_marketing com channel_name e product_name
   sdrData: RepPerformance[];
   closerData: RepPerformance[];
   channels: MarketingChannelStats[];
   products: MarketingProductStats[];
   context: PeriodContext;
   funnelData: FunnelStage[];
   lastUpdated: Date;
   rawTeamData?: any[];
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
   'roas': 'roas',
   'sales_inbound': 'salesInbound',
   'sales_outbound': 'salesOutbound'
};

const OWNER_MAP: Record<string, { name: string, role: string }> = {
   '86857769': { name: 'Isaque Inacio', role: 'SDR' },
   '85822345': { name: 'Luan Silva', role: 'SDR' },
   '1856577327': { name: 'Rodrigo Fernandes', role: 'SDR' },
   '78938498': { name: 'Leonardo Padilha', role: 'CLOSER' },
   '86362284': { name: 'Leonardo Souza', role: 'CLOSER' },
   '85369712': { name: 'Joel Carlos', role: 'CLOSER' }
};

const N8N_META_ADS_WEBHOOK = 'https://automacao-n8n.zs0trp.easypanel.host/webhook/30135616-a1ea-4196-abb1-367e88b1d882';

/**
 * Dispara o webhook do n8n.
 * O n8n busca dados do Meta Ads, transforma e salva no banco via nó Postgres.
 * O frontend apenas aguarda o processamento e então busca os dados atualizados.
 */
export const triggerMetaAdsAutomation = async (): Promise<void> => {
   const now = new Date();
   const todayLocal = new Date(now.getTime() - 3 * 60 * 60 * 1000); // BRT = UTC-3
   const todayStr = todayLocal.toISOString().split('T')[0];

   console.log(`[n8n] Disparando webhook para sync de ${todayStr}...`);

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

   console.log('[n8n] Webhook disparado. Aguardando processamento...');
};



export const fetchDashboardData = async (): Promise<DashboardData> => {
   try {
      console.log("Fetching data with Architecture V2...");

      // Busca trends e dados raw por canal/produto em paralelo
      const [
         { data: kpisData, error: kpisError },
         { data: rawTrendsData, error: trendsError },
         { data: rawMarketingRaw, error: marketingError },
         { data: teamData, error: teamError },
         { data: channelsData, error: channelsError },
         { data: productsData, error: productsError }
      ] = await Promise.all([
         supabase.from('kpis').select('*'),
         // Totais por dia (para o gráfico de tendência)
         supabase.from('fact_daily_marketing')
            .select('date, cost, leads, mqls')
            .order('date', { ascending: true }),
         // Dados raw por canal + produto + dia (para a tabela de performance com filtro de data)
         supabase.from('fact_daily_marketing')
            .select('date, cost, leads, mqls, impressions, clicks, campaign_name, dim_channels(name), dim_products(name)')
            .order('date', { ascending: true }),
         supabase.from('fact_team_activities').select('*, dim_team(name, role)').order('date', { ascending: true }),
         supabase.from('marketing_channels').select('*'),
         supabase.from('marketing_products').select('*')
      ]);

      // Normaliza os dados raw com nome de canal e produto
      const rawMarketingData = (rawMarketingRaw || []).map((row: any) => ({
         date: row.date,
         channel: row.dim_channels?.name || 'Desconhecido',
         product: row.dim_products?.name || 'Institucional',
         campaign: row.campaign_name || 'Diversos',
         cost: Number(row.cost) || 0,
         leads: Number(row.leads) || 0,
         mqls: Number(row.mqls) || 0,
         impressions: Number(row.impressions) || 0,
         clicks: Number(row.clicks) || 0,
      }));

      // Agrupa múltiplas linhas do mesmo dia (canais diferentes ou vendedores diferentes) em uma única entrada
      const trendsMap = new Map<string, any>();

      const getOrCreateTrend = (dateKey: string) => {
         if (!trendsMap.has(dateKey)) {
            trendsMap.set(dateKey, {
               date: dateKey, cost: 0, leads: 0, mqls: 0,
               revenue: 0, sales: 0, connections: 0,
               opportunities: 0, meetings_booked: 0, meetings_held: 0
            });
         }
         return trendsMap.get(dateKey);
      };

      (rawTrendsData || []).forEach((row: any) => {
         const existing = getOrCreateTrend(row.date);
         existing.cost += Number(row.cost) || 0;
         existing.leads += Number(row.leads) || 0;
         existing.mqls += Number(row.mqls) || 0;
      });

      (teamData || []).forEach((row: any) => {
         const existing = getOrCreateTrend(row.date);
         const repName = row.dim_team?.name || row.rep_name || 'Sem_Dono';
         existing.revenue += Number(row.revenue) || 0;
         existing.sales += Number(row.sales) || 0;
         existing.connections += Number(row.connections) || 0;
         existing.opportunities += Number(row.opportunities) || 0;
         existing.meetings_booked += Number(row.meetings_booked) || 0;
         existing.meetings_held += Number(row.meetings_held) || 0;
         existing.inbound += Number(row.inbound_count) || 0;
         existing.outbound += Number(row.outbound_count) || 0;
         existing.no_shows += Number(row.no_shows) || 0;
      });

      const trendsData = Array.from(trendsMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      if (kpisError) throw kpisError;

      const kpis: Record<string, MetricData> = {};
      if (kpisData) {
         kpisData.forEach((row: any) => {
            const mappedId = KEY_MAP[row.id] || row.id;
            kpis[mappedId] = {
               id: mappedId,
               db_id: row.id, // ID original do banco para updates
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
         investment: Number(row.cost ?? row.investment) || 0, // fact_daily_marketing usa 'cost'
         revenue: Number(row.revenue) || 0,
         sales: Number(row.sales) || 0,
         connections: Number(row.connections) || 0,
         opportunities: Number(row.opportunities) || 0,
         meetings_booked: Number(row.meetings_booked) || 0,
         meetings_held: Number(row.meetings_held) || 0,
         inbound: Number(row.inbound) || 0,
         outbound: Number(row.outbound) || 0
      }));

      // Group fact_daily_sales by rep_name to accumulate 30 day amounts per person
      const teamMap = new Map<string, any>();
      (teamData || []).forEach((r: any) => {
         const repName = r.dim_team?.name || r.rep_name || 'Sem_Dono';
         const role = r.dim_team?.role || r.role || 'SDR';
         if (!teamMap.has(repName)) {
            teamMap.set(repName, {
               id: repName.replace(/\s+/g, ''),
               name: repName,
               role: role,
               opportunities: 0,
               connections: 0,
               meetingsBooked: 0,
               meetingsHeld: 0,
               sales: 0,
               revenue: 0,
               no_shows: 0,
               response_time_sum: 0,
               response_time_count: 0
            });
         }
         const t = teamMap.get(repName);
         t.opportunities += Number(r.opportunities) || 0;
         t.connections += Number(r.connections) || 0;
         t.meetingsBooked += Number(r.meetings_booked) || 0;
         t.meetingsHeld += Number(r.meetings_held) || 0;
         t.sales += Number(r.sales) || 0;
         t.revenue += Number(r.revenue) || 0;
         t.no_shows += Number(r.no_shows) || 0;
         t.response_time_sum += Number(r.response_time_sum) || 0;
         t.response_time_count += Number(r.response_time_count) || 0;
      });

      const aggregatedTeamData = Array.from(teamMap.values()).filter((r: any) => {
         const nm = String(r.name).toUpperCase();
         return nm !== 'SISTEMA_APOIO' && nm !== 'SISTEMA APOIO';
      });

      const sdrData = aggregatedTeamData.filter((r: any) => String(r.role).toUpperCase() === 'SDR').map((r: any) => ({
         id: r.id,
         name: r.name,
         role: 'SDR' as 'SDR' | 'Closer',
         opportunities: r.opportunities,
         connections: r.connections,
         meetingsBooked: r.meetingsBooked,
         meetingsHeld: r.meetingsHeld,
         noShowCount: r.no_shows || Math.max(0, r.meetingsBooked - r.meetingsHeld),
         responseTime: r.response_time_count > 0 ? (r.response_time_sum / r.response_time_count) : 0
      }));

      const closerData = aggregatedTeamData.filter((r: any) => String(r.role).toUpperCase() === 'CLOSER').map((r: any) => ({
         id: r.id,
         name: r.name,
         role: 'Closer' as 'SDR' | 'Closer',
         meetingsHeld: r.meetingsHeld,
         sales: r.sales,
         revenue: r.revenue,
         meetingsBooked: r.meetingsBooked,
         noShowCount: r.no_shows || Math.max(0, r.meetingsBooked - r.meetingsHeld)
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
         rawMarketingData,
         sdrData,
         closerData,
         channels: (channelsData || []).map(r => ({ ...r, roas: Number(r.roas) })),
         products: (productsData || []).map(r => ({ ...r, roas: Number(r.roas) })),
         context,
         funnelData,
         lastUpdated: new Date(),
         rawTeamData: teamData || []
      };

   } catch (error) {
      console.error("Supabase API Error:", error);
      return {
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
         rawTeamData: []
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
      const campaignName = row['Campanha'] || row['campaign'] || row['campanha'] || 'Diversos';
      const date = row['Data'] || row['date'] || row['data'];

      if (!channelName || !date) continue;

      const channel_id = await ensureDimension('dim_channels', channelName);
      const product_id = productName ? await ensureDimension('dim_products', productName) : null;

      rows.push({
         date,
         channel_id,
         product_id,
         campaign_name: campaignName,
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

export const updateKPIGoals = async (kpis: any[]) => {
   const { error } = await supabase.from('kpis').upsert(kpis, { onConflict: 'id' });
   if (error) throw error;
   return true;
};
