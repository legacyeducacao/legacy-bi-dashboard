import type { MetaCampaignData, MetaLeadData, MetaDemographicData } from '../types';

const META_PROXY = '/api/meta';

async function fetchMetaEndpoint(action: string, params: Record<string, string> = {}): Promise<any> {
  const searchParams = new URLSearchParams({ action, ...params });
  const res = await fetch(`${META_PROXY}?${searchParams}`);
  if (!res.ok) {
    console.warn(`Meta proxy error (${action}):`, res.status);
    return { success: false, data: null };
  }
  return res.json();
}

function extractLeadCount(actions: any[] | undefined): number {
  if (!actions) return 0;
  const leadAction = actions.find(
    (a: any) => a.action_type === 'lead' || a.action_type === 'leadgen.other'
  );
  return leadAction ? Number(leadAction.value) || 0 : 0;
}

// --- Campaigns with metrics ---
export async function fetchMetaCampaigns(dateFrom: string, dateTo: string): Promise<MetaCampaignData[]> {
  const json = await fetchMetaEndpoint('campaigns', { date_from: dateFrom, date_to: dateTo });
  if (!json.success || !json.data) return [];

  return json.data.map((row: any) => ({
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    objective: row.objective || '',
    status: row.status || '',
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    reach: Number(row.reach) || 0,
    frequency: Number(row.frequency) || 0,
    leads: extractLeadCount(row.actions),
    ctr: Number(row.ctr) || 0,
    cpc: Number(row.cpc) || 0,
    cpm: Number(row.cpm) || 0,
  }));
}

// --- Daily insights ---
export async function fetchMetaInsights(dateFrom: string, dateTo: string): Promise<any[]> {
  const json = await fetchMetaEndpoint('insights', { date_from: dateFrom, date_to: dateTo });
  if (!json.success || !json.data) return [];

  return json.data.map((row: any) => ({
    date: row.date_start,
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    reach: Number(row.reach) || 0,
    frequency: Number(row.frequency) || 0,
    leads: extractLeadCount(row.actions),
    ctr: Number(row.ctr) || 0,
    cpc: Number(row.cpc) || 0,
    cpm: Number(row.cpm) || 0,
  }));
}

// --- Lead Ads form submissions ---
export async function fetchMetaLeadAds(dateFrom: string, dateTo: string): Promise<MetaLeadData[]> {
  const json = await fetchMetaEndpoint('leads', { date_from: dateFrom, date_to: dateTo });
  if (!json.success || !json.data) return [];

  return json.data.map((lead: any) => {
    const fields: Record<string, string> = {};
    (lead.field_data || []).forEach((f: any) => {
      fields[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
    });

    return {
      id: lead.id,
      createdTime: lead.created_time,
      formName: lead.form_name || '',
      campaignName: lead.campaign_name || '',
      campaignId: lead.campaign_id || '',
      adName: lead.ad_name || '',
      platform: lead.platform || '',
      name: fields['full_name'] || fields['nome'] || fields['nome_completo'] || '',
      email: fields['email'] || '',
      phone: fields['phone_number'] || fields['telefone'] || fields['whatsapp'] || '',
      city: fields['city'] || fields['cidade'] || '',
      // Additional fields that may exist
      customFields: fields,
      pipelineStatus: '', // Will be enriched with Supabase data
    };
  });
}

// --- Demographics ---
export async function fetchMetaDemographics(dateFrom: string, dateTo: string): Promise<MetaDemographicData> {
  const json = await fetchMetaEndpoint('demographics', { date_from: dateFrom, date_to: dateTo });
  if (!json.success || !json.data) {
    return { ageGender: [], regions: [] };
  }

  const ageGender = (json.data.ageGender || []).map((row: any) => ({
    age: row.age || '',
    gender: row.gender === 'male' ? 'Masculino' : row.gender === 'female' ? 'Feminino' : row.gender || '',
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    reach: Number(row.reach) || 0,
    leads: extractLeadCount(row.actions),
  }));

  const regions = (json.data.region || []).map((row: any) => ({
    region: row.region || '',
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || 0,
    clicks: Number(row.clicks) || 0,
    reach: Number(row.reach) || 0,
    leads: extractLeadCount(row.actions),
  }));

  return { ageGender, regions };
}

// --- Fetch all Meta data in parallel ---
export async function fetchAllMetaData(dateFrom: string, dateTo: string) {
  const [campaigns, insights, leads, demographics] = await Promise.all([
    fetchMetaCampaigns(dateFrom, dateTo).catch(() => [] as MetaCampaignData[]),
    fetchMetaInsights(dateFrom, dateTo).catch(() => [] as any[]),
    fetchMetaLeadAds(dateFrom, dateTo).catch(() => [] as MetaLeadData[]),
    fetchMetaDemographics(dateFrom, dateTo).catch(() => ({ ageGender: [], regions: [] } as MetaDemographicData)),
  ]);

  return { campaigns, insights, leads, demographics };
}
