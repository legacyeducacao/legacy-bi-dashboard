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
   leadsByPlatform: { platform: string; count: number; origin: string; mqls: number; leads: number }[];
   wonDealsTimeline: { id: string; name: string; valor: number; closer: string; sdr: string; date: string }[];
   formLeadsList: { nome: string; telefone: string; email: string; empresa: string; cargo: string; faturamento: string; colaboradores: string; produto: string; source: string; medium: string; isMql: boolean }[];
   meetingsList: { subject: string; type: string; userName: string; role: string; date: string; time: string; dealId: string | null; personId: string | null }[];
   noShowsList: { subject: string; userName: string; role: string; date: string; time: string }[];
   reagendamentosList: { subject: string; userName: string; role: string; date: string; time: string; dealId: string | null }[];
   leadsByRegion: { region: string; count: number; states: { state: string; count: number }[] }[];
   leadsByState: { state: string; ddd: string; count: number; region: string }[];
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

const USER_ROLES: Record<string, { name: string; role: 'SDR' | 'Closer'; revenueGoal?: number }> = {
   '25959419': { name: 'Isaque Inacio', role: 'SDR', revenueGoal: 290000 },
   '25955327': { name: 'Luan Gabriel', role: 'SDR', revenueGoal: 270000 },
   '25955316': { name: 'Rodrigo Fernandes', role: 'SDR' },
   '25909798': { name: 'João Vitor Gaspar', role: 'SDR' },
   '25963379': { name: 'Paim', role: 'SDR' },
   '25952137': { name: 'Joel Carlos', role: 'Closer', revenueGoal: 270000 },
   '25952181': { name: 'Leonardo Padilha', role: 'Closer', revenueGoal: 290000 },
   '25959529': { name: 'Leonardo Souza', role: 'Closer', revenueGoal: 270000 },
   '25839024': { name: 'Allan Silva', role: 'Closer' },
};

// João Vitor excluded from meetings held count (operational SDR)
const EXCLUDE_FROM_MEETINGS_HELD = '25909798';

// Classify lead origin
function classifyOrigin(from: string): 'Ads' | 'Orgânico' | 'Outbound' {
   const f = (from || '').toLowerCase();
   if (['facebook', 'fb', 'ig', 'google', 'meta'].some(x => f.includes(x))) return 'Ads';
   if (f === 'outbound') return 'Outbound';
   return 'Orgânico';
}

// Classify platform from Rede Social field
function classifyPlatform(redeSocial: string, from: string): string {
   const rs = (redeSocial || '').toLowerCase();
   if (rs.includes('instagram_reels') || rs === 'reels') return 'Instagram Reels';
   if (rs.includes('instagram_feed')) return 'Instagram Feed';
   if (rs.includes('instagram_stories')) return 'Instagram Stories';
   if (rs === 'ig' || rs === 'instagram') return 'Instagram';
   if (rs.includes('facebook_mobile_reels')) return 'Facebook Reels';
   if (rs.includes('facebook_mobile_feed') || rs === 'fb') return 'Facebook Feed';
   if (rs === 'search') return 'Google';
   if (rs === 'tiktok') return 'TikTok';
   if (rs === 'youtube') return 'YouTube';
   const f = (from || '').toLowerCase();
   if (f === 'google') return 'Google';
   if (f === 'facebook' || f === 'fb') return 'Facebook';
   if (f === 'organico') return 'Orgânico Direto';
   if (f === 'outbound') return 'Outbound';
   if (f === 'inbound') return 'Inbound';
   return 'Outros';
}

// DDD → Region/State mapping
const DDD_MAP: Record<string, { state: string; region: string }> = {};
const addDDDs = (ddds: string[], state: string, region: string) => ddds.forEach(d => { DDD_MAP[d] = { state, region }; });
addDDDs(['68'], 'AC', 'Norte'); addDDDs(['96'], 'AP', 'Norte'); addDDDs(['92','97'], 'AM', 'Norte');
addDDDs(['95'], 'RR', 'Norte'); addDDDs(['91','93','94'], 'PA', 'Norte'); addDDDs(['69'], 'RO', 'Norte'); addDDDs(['63'], 'TO', 'Norte');
addDDDs(['82'], 'AL', 'Nordeste'); addDDDs(['71','73','74','75','77'], 'BA', 'Nordeste'); addDDDs(['85','88'], 'CE', 'Nordeste');
addDDDs(['98','99'], 'MA', 'Nordeste'); addDDDs(['83'], 'PB', 'Nordeste'); addDDDs(['81','87'], 'PE', 'Nordeste');
addDDDs(['86','89'], 'PI', 'Nordeste'); addDDDs(['84'], 'RN', 'Nordeste'); addDDDs(['79'], 'SE', 'Nordeste');
addDDDs(['61'], 'DF', 'Centro-Oeste'); addDDDs(['62','64'], 'GO', 'Centro-Oeste'); addDDDs(['65','66'], 'MT', 'Centro-Oeste'); addDDDs(['67'], 'MS', 'Centro-Oeste');
addDDDs(['27','28'], 'ES', 'Sudeste'); addDDDs(['31','32','33','34','35','37','38'], 'MG', 'Sudeste');
addDDDs(['21','22','24'], 'RJ', 'Sudeste'); addDDDs(['11','12','13','14','15','16','17','18','19'], 'SP', 'Sudeste');
addDDDs(['41','42','43','44','45','46'], 'PR', 'Sul'); addDDDs(['47','48','49'], 'SC', 'Sul'); addDDDs(['51','53','54','55'], 'RS', 'Sul');

function extractDDD(phone: string): string | null {
   if (!phone) return null;
   const digits = phone.replace(/\D/g, '');
   // Format: 55DDXXXXXXXXX or DDXXXXXXXXX or (DD)...
   if (digits.length >= 12 && digits.startsWith('55')) return digits.substring(2, 4);
   if (digits.length >= 10 && !digits.startsWith('55')) return digits.substring(0, 2);
   return null;
}

function getDDDInfo(phone: string): { ddd: string; state: string; region: string } | null {
   const ddd = extractDDD(phone);
   if (!ddd || !DDD_MAP[ddd]) return null;
   return { ddd, ...DDD_MAP[ddd] };
}

// MQL qualification: Faturamento >= 70k
function isFaturamento70kPlus(faturamento: string): boolean {
   if (!faturamento) return false;
   const f = faturamento.toLowerCase().trim();

   // Explicitly NOT qualifying (< 70k)
   const notQualifying = [
      'até 25', 'até r$ 25', 'de 26 mil', 'r$ 26', 'de 51 mil', 'r$ 51',
      'de 16 ', 'de 31 ', 'de 4 à 7',
   ];
   if (notQualifying.some(q => f.includes(q))) return false;

   // Explicitly qualifying (>= 70k)
   const qualifying = [
      'de 71 mil', 'de 101 mil', 'de 401 mil',
      'r$ 71', 'r$ 101', 'r$ 401',
      '71 mil a', '101 mil a',
      'de 1 à 4 milh', 'de 1 à 4 milhoe', 'de r$ 1 à',
      'mais de 4 milh', 'mais de r$ 4',
      '401 mil à 1 milh',
   ];
   if (qualifying.some(q => f.includes(q))) return true;

   // Try parsing numeric values (only for raw numbers like "100000", "70k")
   const num = parseFloat(f.replace(/[^\d.]/g, ''));
   if (!isNaN(num) && num >= 70000) return true;
   if (!isNaN(num) && f.includes('k') && !f.includes('mil') && num >= 70) return true;

   return false;
}

// Check if lead qualifies as MQL: Fat >= 70k OR (no fat but >= 5 colaboradores)
function isLeadMql(faturamento: string, colaboradores: string): boolean {
   if (isFaturamento70kPlus(faturamento)) return true;
   if (!faturamento && colaboradores) {
      const c = colaboradores.toLowerCase();
      // >= 5 colaboradores qualifies
      if (c.includes('de 8') || c.includes('de 16') || c.includes('de 31') || c.includes('mais de 100')) return true;
   }
   return false;
}

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
      metaCampaigns: [], metaLeads: [], metaDemographics: { ageGender: [], regions: [] },
      leadsByPlatform: [], wonDealsTimeline: [], formLeadsList: [],
      meetingsList: [], noShowsList: [], reagendamentosList: [],
      leadsByRegion: [], leadsByState: []
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
            return { dealsCreated: [], dealsUpdated: [], wonDeals: [], lostDeals: [], activitiesCreated: [], activitiesUpdated: [], personsCreated: [], formLeads: [] };
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
      const { dealsCreated, wonDeals: rawWonDeals, lostDeals, activitiesCreated, activitiesUpdated, personsCreated, dealsUpdated, formLeads } = crmData;

      // Deduplicate deals
      const latestOpenDeals = getLatestDealStates(dealsUpdated.filter(d => d.Status === 'open'));
      const uniqueWonDeals = getUniqueWonDeals(rawWonDeals);
      const uniqueLostDeals = getUniqueWonDeals(lostDeals); // same dedup logic

      console.log(`CRM: ${dealsCreated.length} created, ${latestOpenDeals.length} open, ${uniqueWonDeals.length} won, ${uniqueLostDeals.length} lost`);
      console.log(`Activities: ${activitiesCreated.length} created, ${activitiesUpdated.length} updated | Persons: ${personsCreated.length}`);
      console.log(`Marketing: ${marketingRows.length} rows | Meta: ${metaData.campaigns.length} campaigns`);

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

      // --- 4. Platform breakdown + lead classification (MUST come first) ---
      const platformMap = new Map<string, { count: number; origin: string; mqls: number; leads: number }>();
      const addToPlatform = (platform: string, origin: string, isMql: boolean) => {
         const existing = platformMap.get(platform);
         if (existing) {
            existing.count++;
            if (isMql) existing.mqls++; else existing.leads++;
         } else {
            platformMap.set(platform, { count: 1, origin, mqls: isMql ? 1 : 0, leads: isMql ? 0 : 1 });
         }
      };

      let formLeadsOrganic = 0, formLeadsAds = 0, formMqls = 0;
      (formLeads || []).forEach((f: any) => {
         const src = (f.utm_source || '').toLowerCase();
         const med = (f.utm_medium || '').toLowerCase();
         const fat = f.Faturamento || '';
         const colab = f.Colaboradores || '';
         const isMql = isLeadMql(fat, colab);
         if (isMql) formMqls++;

         let origin: 'Ads' | 'Orgânico' | 'Outbound';
         let platform: string;

         if (src === 'organico' || src === 'direto') {
            origin = 'Orgânico';
            if (med.includes('reels')) platform = 'Reels';
            else if (med.includes('stories')) platform = 'Stories';
            else if (med.includes('instagram') || med === 'ig') platform = 'Instagram';
            else if (med.includes('tiktok')) platform = 'TikTok';
            else if (med.includes('youtube')) platform = 'YouTube';
            else if (med === 'none' || !med) platform = 'Direto';
            else platform = med;
            formLeadsOrganic++;
         } else if (src === 'facebook' || src === 'ig' || src === 'source') {
            origin = 'Ads';
            if (med.includes('instagram_reels') || med === 'reels') platform = 'IG Reels (Ads)';
            else if (med.includes('instagram_stories')) platform = 'IG Stories (Ads)';
            else if (med.includes('instagram_feed')) platform = 'IG Feed (Ads)';
            else if (med === 'ig') platform = 'Instagram (Ads)';
            else if (med === 'fb') platform = 'Facebook (Ads)';
            else if (med.includes('facebook_mobile_reels')) platform = 'FB Reels (Ads)';
            else if (med.includes('facebook_stories')) platform = 'FB Stories (Ads)';
            else platform = 'Meta Ads';
            formLeadsAds++;
         } else {
            origin = 'Ads';
            platform = src || 'Outros';
            formLeadsAds++;
         }

         addToPlatform(platform, origin, isMql);
      });

      // Fallback: count Person Criada if formLeads is empty
      if ((formLeads || []).length === 0) {
         personsCreated.forEach(p => {
            const platform = classifyPlatform(p['Rede Social'] as any || '', p.From);
            const origin = classifyOrigin(p.From);
            const isMql = isFaturamento70kPlus(p.Faturamento);
            addToPlatform(platform, origin, isMql);
         });
      }

      const leadsByPlatform = Array.from(platformMap.entries())
         .map(([platform, d]) => ({ platform, count: d.count, origin: d.origin, mqls: d.mqls, leads: d.leads }))
         .sort((a, b) => b.count - a.count);

      // --- 4a2. Build form leads list with MQL classification ---
      const formLeadsList = (formLeads || [])
         .filter((f: any) => f.Nome)
         .map((f: any) => ({
            nome: f.Nome || '',
            telefone: f.Telefone || '',
            email: f['E-mail'] || '',
            empresa: f.Empresa || '',
            cargo: f.Cargo || '',
            faturamento: f.Faturamento || '',
            colaboradores: f.Colaboradores || '',
            produto: f.Produto || '',
            source: f.utm_source || '',
            medium: f.utm_medium || '',
            isMql: isLeadMql(f.Faturamento || '', f.Colaboradores || ''),
         }));

      // --- 4a3. Regional breakdown from phone DDDs ---
      const regionMap: Record<string, { count: number; states: Record<string, number> }> = {};
      const stateMap: Record<string, { count: number; region: string; ddds: Set<string> }> = {};
      const phoneSource = formLeadsList.length > 0 ? formLeadsList.map(l => l.telefone) : personsCreated.map(p => p.Telefone);
      phoneSource.forEach(phone => {
         const info = getDDDInfo(phone);
         if (!info) return;
         if (!regionMap[info.region]) regionMap[info.region] = { count: 0, states: {} };
         regionMap[info.region].count++;
         regionMap[info.region].states[info.state] = (regionMap[info.region].states[info.state] || 0) + 1;
         if (!stateMap[info.state]) stateMap[info.state] = { count: 0, region: info.region, ddds: new Set() };
         stateMap[info.state].count++;
         stateMap[info.state].ddds.add(info.ddd);
      });
      const leadsByRegion = Object.entries(regionMap)
         .map(([region, d]) => ({
            region, count: d.count,
            states: Object.entries(d.states).map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count)
         }))
         .sort((a, b) => b.count - a.count);
      const leadsByState = Object.entries(stateMap)
         .map(([state, d]) => ({ state, ddd: [...d.ddds].join(','), count: d.count, region: d.region }))
         .sort((a, b) => b.count - a.count);

      // --- 4b. Compute commercial KPIs from CRM ---
      const totalLeads = (formLeads || []).length || personsCreated.length || dealsCreated.length;
      const totalSales = uniqueWonDeals.length;
      const totalRevenue = uniqueWonDeals.reduce((sum, d) => sum + (d.valor || 0), 0);

      // SAL = Sales Accepted Leads (Filtro 1+ = stage_order >= 2)
      const sal = latestOpenDeals.filter(d => (STAGE_ORDER[d.stage_id] || 0) >= 2).length + totalSales;
      // SQL = Sales Qualified Leads (Filtro 2+ = stage_order >= 3)
      const sql = latestOpenDeals.filter(d => (STAGE_ORDER[d.stage_id] || 0) >= 3).length + totalSales;
      const connections = sal;

      // MQL qualificado = Fat. >= 70k
      const mqlQualified = (formLeads || []).length > 0
         ? formMqls
         : personsCreated.filter(p => isFaturamento70kPlus(p.Faturamento)).length;

      // Origin: Ads vs Orgânico
      let leadsAds = formLeadsAds, leadsOrganic = formLeadsOrganic, leadsOutbound = 0;
      let salesInbound = 0, salesOutbound = 0;
      if ((formLeads || []).length === 0) {
         leadsAds = 0; leadsOrganic = 0;
         personsCreated.forEach(p => {
            const origin = classifyOrigin(p.From);
            if (origin === 'Ads') leadsAds++;
            else if (origin === 'Outbound') leadsOutbound++;
            else leadsOrganic++;
         });
      }
      uniqueWonDeals.forEach(d => {
         const person = personsCreated.find(p => p.entidade_id === d.person_id);
         const origin = classifyOrigin(person?.From || '');
         if (origin === 'Outbound') salesOutbound++;
         else salesInbound++;
      });

      // --- 4c. Won deals timeline (with SDR who qualified the lead) ---
      const sdrIdSet: Record<string, boolean> = {};
      Object.entries(USER_ROLES).forEach(([k, v]) => {
         if (v.role === 'SDR' && v.name !== 'João Vitor Gaspar') sdrIdSet[k] = true;
      });
      // Find first SDR activity per person_id
      const firstSdrByPerson: Record<string, string> = {};
      [...activitiesUpdated].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')).forEach(act => {
         if (act.person_id && sdrIdSet[act.user_id] && !firstSdrByPerson[act.person_id]) {
            firstSdrByPerson[act.person_id] = act.user_id;
         }
      });

      const wonDealsTimeline = uniqueWonDeals.map(d => {
         const closerName = USER_ROLES[d.owner_id]?.name || d.owner_id || 'Desconhecido';
         const sdrId = d.person_id ? firstSdrByPerson[d.person_id] : undefined;
         const sdrName = sdrId ? (USER_ROLES[sdrId]?.name || '') : '';
         return {
            id: String(d.id),
            name: d.Nome || 'Sem título',
            valor: d.valor || 0,
            closer: closerName,
            sdr: sdrName,
            date: d.created_at?.substring(0, 10) || '',
         };
      }).sort((a, b) => b.date.localeCompare(a.date));

      // --- 4d. Build meetings, no-shows, reagendamentos lists ---
      const isSessionSubject = (subject: string) => /sess[aã]o/i.test(subject) || /fechamento/i.test(subject) || /impuls[aã]o/i.test(subject);
      const isRolePlay = (subject: string) => /roleplay|role.?play|daily|kickoff|alinhamento|forecast|pipeline review|treinamento|coaching|1:1|integra|reunião jci|reunião de alinhamento/i.test(subject);

      // --- No-Shows: deduplicate by Subject (one no-show per session name) ---
      const noShowsBySubject = new Map<string, { subject: string; userName: string; role: string; date: string; time: string }>();
      activitiesUpdated.forEach(act => {
         if (isNoShow(act.type)) {
            const info = getUserInfo(act.user_id);
            if (!noShowsBySubject.has(act.Subject)) {
               noShowsBySubject.set(act.Subject, {
                  subject: act.Subject,
                  userName: info.name,
                  role: info.role,
                  date: act.created_at?.substring(0, 10) || '',
                  time: act.created_at?.substring(11, 16) || '',
               });
            }
         }
      });
      const noShowsList = Array.from(noShowsBySubject.values());

      // --- Meetings: deduplicate by Subject (one entry per session name) ---
      const meetingsBySubject = new Map<string, { subject: string; type: string; userName: string; role: string; date: string; time: string; dealId: string | null; personId: string | null }>();
      activitiesUpdated.forEach(act => {
         if (isMeetingSubject(act.Subject, act.type) && isSessionSubject(act.Subject) && !isRolePlay(act.Subject) && !isNoShow(act.type)) {
            const info = getUserInfo(act.user_id);
            if (!meetingsBySubject.has(act.Subject)) {
               meetingsBySubject.set(act.Subject, {
                  subject: act.Subject,
                  type: act.type,
                  userName: info.name,
                  role: info.role,
                  date: act.created_at?.substring(0, 10) || '',
                  time: act.created_at?.substring(11, 16) || '',
                  dealId: act.deal_id,
                  personId: act.person_id,
               });
            }
         }
      });
      const meetingsList = Array.from(meetingsBySubject.values());

      // --- Reagendamentos: deduplicate by subject ---
      const reagendBySubject = new Map<string, { subject: string; userName: string; role: string; date: string; time: string; dealId: string | null }>();
      const addReagend = (subject: string, userId: string, date: string, dealId: string | null) => {
         const info = getUserInfo(userId);
         if (!reagendBySubject.has(subject + '|' + date.substring(0, 10))) {
            reagendBySubject.set(subject + '|' + date.substring(0, 10), {
               subject, userName: info.name, role: info.role,
               date: date.substring(0, 10), time: date.substring(11, 16), dealId,
            });
         }
      };
      activitiesCreated.forEach(act => {
         if (isSchedulingAttempt(act.subject)) addReagend(act.subject, act.user_id, act.created_at || '', null);
      });
      activitiesUpdated.forEach(act => {
         if (isSchedulingAttempt(act.Subject)) addReagend(act.Subject, act.user_id, act.created_at || '', act.deal_id);
      });
      const reagendamentosList = Array.from(reagendBySubject.values());

      // --- 5. Aggregate counts (deduplicated) ---
      const meetingsHeld = meetingsList.length;
      const totalNoShows = noShowsList.length;
      const totalRescheduled = reagendamentosList.length;

      // Reuniões Agendadas = SDR cria sessão (dedup by subject)
      const bookedBySubject = new Set<string>();
      activitiesCreated.forEach(act => {
         if (isMeetingSubject(act.subject, act.type) && isSessionSubject(act.subject) && !isRolePlay(act.subject)) {
            const userInfo = getUserInfo(act.user_id);
            if (userInfo.role === 'SDR' && !bookedBySubject.has(act.subject)) {
               bookedBySubject.add(act.subject);
            }
         }
      });
      const meetingsBooked = bookedBySubject.size;

      // --- 6. Build team data from CRM ---
      const teamMap = new Map<string, any>();

      const initTeamMember = (userId: string) => {
         const info = getUserInfo(userId);
         const roleInfo = USER_ROLES[userId];
         if (!teamMap.has(info.name)) {
            teamMap.set(info.name, {
               id: info.name.replace(/\s+/g, ''),
               name: info.name,
               role: info.role,
               revenueGoal: roleInfo?.revenueGoal || 0,
               opportunities: 0, connections: 0, meetingsBooked: 0,
               meetingsHeld: 0, sales: 0, revenue: 0, noShowCount: 0,
               rescheduled: 0, calls: 0,
               preQualificacoes: 0, tentativasConexao: 0, whatsapps: 0,
               filtro1: 0, filtro2: 0, agendados: 0, sessionsCreated: 0,
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

      // Open deals → pipeline breakdown per SDR
      latestOpenDeals.forEach(d => {
         if (!d.owner_id) return;
         const member = initTeamMember(d.owner_id);
         const order = STAGE_ORDER[d.stage_id] || 0;
         if (order >= 2) member.connections++;
         if (d.stage_id === '7') member.filtro1++;
         if (d.stage_id === '8') member.filtro2++;
         if (d.stage_id === '9') member.agendados++;
      });

      // Won deals → sales + revenue by owner
      uniqueWonDeals.forEach(d => {
         if (!d.owner_id) return;
         const member = initTeamMember(d.owner_id);
         member.sales++;
         member.revenue += d.valor || 0;
         member.connections++;
      });

      // Activities created → per user (detailed SDR tracking)
      activitiesCreated.forEach(act => {
         if (!act.user_id) return;
         const member = initTeamMember(act.user_id);
         if (isConnectionAttempt(act.subject)) member.connections++;
         if (isMeetingSubject(act.subject, act.type) && isSessionSubject(act.subject) && !isRolePlay(act.subject)) member.meetingsBooked++;
         if (isNoShow(act.type)) member.noShowCount++;
         if (isSchedulingAttempt(act.subject)) member.rescheduled++;
         if (act.type === 'call') member.calls++;
         if (act.subject === 'Pré-qualificação') member.preQualificacoes++;
         if (/tentativa de conex/i.test(act.subject)) member.tentativasConexao++;
         if (act.type === 'whatsapp') member.whatsapps++;
         if (isSessionSubject(act.subject) && !isRolePlay(act.subject)) member.sessionsCreated++;
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
            sales: m.sales, revenue: m.revenue, revenueGoal: m.revenueGoal,
            responseTime: 0,
            preQualificacoes: m.preQualificacoes,
            tentativasConexao: m.tentativasConexao,
            calls: m.calls,
            whatsapps: m.whatsapps,
            filtro1: m.filtro1,
            filtro2: m.filtro2,
            agendados: m.agendados,
            sessionsCreated: m.sessionsCreated,
         }));

      const closerData: RepPerformance[] = allTeamMembers
         .filter(m => m.role === 'Closer')
         .map(m => ({
            id: m.id, name: m.name, role: 'Closer' as const,
            sales: m.sales, revenue: m.revenue, revenueGoal: m.revenueGoal,
            meetingsBooked: m.meetingsBooked, meetingsHeld: m.meetingsHeld,
            noShowCount: m.noShowCount
         }));

      // --- 7. Build KPIs ---
      const cpl = totalLeads > 0 ? totalCost / totalLeads : 0;
      const costPerMql = mqlQualified > 0 ? totalCost / mqlQualified : 0;
      const cac = totalSales > 0 ? totalCost / totalSales : 0;
      const roas = totalCost > 0 ? totalRevenue / totalCost : 0;
      const ticket = totalSales > 0 ? totalRevenue / totalSales : 0;
      // Taxa No-Show = No-Shows / (Reuniões Realizadas + No-Shows)
      const noShowRate = (meetingsHeld + totalNoShows) > 0 ? (totalNoShows / (meetingsHeld + totalNoShows)) * 100 : 0;
      const convMeetSale = meetingsHeld > 0 ? (totalSales / meetingsHeld) * 100 : 0;

      const kpis: Record<string, MetricData> = {
         investment: { id: 'investment', label: 'Investimento', value: totalCost, goal: 200000, unit: 'currency' },
         leads: { id: 'leads', label: 'Leads', value: totalLeads, goal: 800, unit: 'number' },
         leadsAds: { id: 'leadsAds', label: 'Leads Ads', value: leadsAds, goal: 600, unit: 'number' },
         leadsOrganic: { id: 'leadsOrganic', label: 'Leads Orgânico', value: leadsOrganic, goal: 200, unit: 'number' },
         cpl: { id: 'cpl', label: 'CPL', value: cpl, goal: 150, unit: 'currency' },
         sal: { id: 'sal', label: 'SAL', value: sal, goal: 571, unit: 'number' },
         sql: { id: 'sql', label: 'SQL', value: sql, goal: 400, unit: 'number' },
         mqls: { id: 'mqls', label: 'MQL (Fat. 70k+)', value: mqlQualified, goal: 571, unit: 'number' },
         cpmql: { id: 'cpmql', label: 'Custo por MQL', value: costPerMql, goal: 350, unit: 'currency' },
         sales: { id: 'sales', label: 'Vendas Total', value: totalSales, goal: 20, unit: 'number' },
         revenue: { id: 'revenue', label: 'Faturamento', value: totalRevenue, goal: 830000, unit: 'currency' },
         ticket: { id: 'ticket', label: 'Ticket Médio', value: ticket, goal: 25000, unit: 'currency' },
         connections: { id: 'connections', label: 'Conexões', value: connections, goal: 300, unit: 'number' },
         meetingsBooked: { id: 'meetingsBooked', label: 'Reuniões Agendadas', value: meetingsBooked, goal: 264, unit: 'number' },
         meetingsHeld: { id: 'meetingsHeld', label: 'Reuniões Realizadas', value: meetingsHeld, goal: 180, unit: 'number' },
         noShowRate: { id: 'noShowRate', label: 'Taxa No-Show', value: noShowRate, goal: 30, unit: 'percentage' },
         cac: { id: 'cac', label: 'CAC', value: cac, goal: 6000, unit: 'currency' },
         roas: { id: 'roas', label: 'ROAS', value: roas, goal: 5, unit: 'number', suffix: 'x' },
         salesInbound: { id: 'salesInbound', label: 'Vendas Inbound', value: salesInbound, goal: 15, unit: 'number' },
         salesOutbound: { id: 'salesOutbound', label: 'Vendas Outbound', value: salesOutbound, goal: 5, unit: 'number' },
         conversionMeetingSale: { id: 'conversionMeetingSale', label: 'Conv. Venda/Realizada', value: convMeetSale, goal: 20, unit: 'percentage' },
         opportunities: { id: 'opportunities', label: 'Oportunidades', value: dealsCreated.length, goal: 500, unit: 'number' },
         marketingSales: { id: 'marketingSales', label: 'Vendas MKT', value: totalSales, goal: 20, unit: 'number' },
         marketingRevenue: { id: 'marketingRevenue', label: 'Faturamento MKT', value: totalRevenue, goal: 830000, unit: 'currency' },
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
               connected: 0, activities: 0, prequalificacoes: 0,
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

      // CRM activities → per day (connections, meetings, total activities)
      activitiesCreated.forEach(act => {
         const dateKey = act.created_at?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         t.activities++;
         if (isConnectionAttempt(act.subject)) t.connected++;
         if (act.subject === 'Pré-qualificação') t.prequalificacoes++;
         if (isMeetingSubject(act.subject, act.type) && isSessionSubject(act.subject) && !isRolePlay(act.subject)) t.rm++;
         if (isSchedulingAttempt(act.subject)) t.rescheduled++;
      });

      activitiesUpdated.forEach(act => {
         const dateKey = act.created_at?.substring(0, 10);
         if (!dateKey) return;
         const t = ensureTrendDay(dateKey);
         t.activities++;
         if (isNoShow(act.type)) t.no_shows++;
         if (isMeetingSubject(act.Subject, act.type) && isSessionSubject(act.Subject) && !isRolePlay(act.Subject)) t.rr++;
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
            connections: row.connected, opportunities: 0,
            connected: row.connected, activities: row.activities,
            prequalificacoes: row.prequalificacoes,
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
         mqls: mqlQualified, sales: totalSales, revenue: totalRevenue,
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
         { name: 'SAL', value: sal },
         { name: 'SQL', value: sql },
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
         leadsByPlatform,
         wonDealsTimeline,
         formLeadsList,
         meetingsList,
         noShowsList,
         reagendamentosList,
         leadsByRegion,
         leadsByState,
      };

   } catch (error: any) {
      console.error("Dashboard API Error:", error?.message || error, error?.stack);
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

const GOALS_STORAGE_KEY = 'legacy_bi_kpi_goals';

export const updateKPIGoals = async (kpis: any[]) => {
   const goals: Record<string, number> = {};
   kpis.forEach(k => { goals[k.id] = k.goal; });
   localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
   return true;
};

export function getSavedGoals(): Record<string, number> {
   try {
      const raw = localStorage.getItem(GOALS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
   } catch {}
   return {};
}

export function applyGoalsToDashboard(dashData: DashboardData): DashboardData {
   const saved = getSavedGoals();
   if (Object.keys(saved).length === 0) return dashData;
   const kpis = { ...dashData.kpis };
   for (const [id, goal] of Object.entries(saved)) {
      if (kpis[id]) {
         kpis[id] = { ...kpis[id], goal };
      }
   }
   return { ...dashData, kpis };
}
