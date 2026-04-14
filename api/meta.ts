import type { VercelRequest, VercelResponse } from '@vercel/node';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || '';
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '';
const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string;
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return res.status(500).json({ error: 'META_ACCESS_TOKEN or META_AD_ACCOUNT_ID not configured' });
  }

  const dateFrom = (req.query.date_from as string) || '';
  const dateTo = (req.query.date_to as string) || '';

  try {
    let data: any;

    switch (action) {
      case 'campaigns': {
        data = await fetchCampaigns(dateFrom, dateTo);
        break;
      }
      case 'insights': {
        data = await fetchInsights(dateFrom, dateTo);
        break;
      }
      case 'leads': {
        data = await fetchLeadAds();
        break;
      }
      case 'demographics': {
        data = await fetchDemographics(dateFrom, dateTo);
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error(`Meta API error (${action}):`, error);
    return res.status(500).json({ error: error.message || 'Meta API request failed' });
  }
}

async function metaFetch(url: string): Promise<any> {
  const separator = url.includes('?') ? '&' : '?';
  const res = await fetch(`${url}${separator}access_token=${META_ACCESS_TOKEN}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchAllPages(url: string): Promise<any[]> {
  const allData: any[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const json = await metaFetch(nextUrl);
    if (json.data) allData.push(...json.data);
    nextUrl = json.paging?.next || null;
  }

  return allData;
}

// --- Campaigns with metrics ---
async function fetchCampaigns(dateFrom: string, dateTo: string): Promise<any[]> {
  const timeRange = dateFrom && dateTo
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since: dateFrom, until: dateTo }))}`
    : '';

  const fields = [
    'campaign_name', 'campaign_id', 'objective', 'status',
    'spend', 'impressions', 'clicks', 'reach', 'frequency',
    'actions', 'cost_per_action_type', 'ctr', 'cpc', 'cpm',
  ].join(',');

  const url = `${META_GRAPH_URL}/${META_AD_ACCOUNT_ID}/insights?fields=${fields}&level=campaign${timeRange}&limit=500`;
  return fetchAllPages(url);
}

// --- Aggregated insights ---
async function fetchInsights(dateFrom: string, dateTo: string): Promise<any[]> {
  const timeRange = dateFrom && dateTo
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since: dateFrom, until: dateTo }))}`
    : '';

  const fields = [
    'spend', 'impressions', 'clicks', 'reach', 'frequency',
    'actions', 'cost_per_action_type', 'ctr', 'cpc', 'cpm',
  ].join(',');

  const url = `${META_GRAPH_URL}/${META_AD_ACCOUNT_ID}/insights?fields=${fields}&time_increment=1${timeRange}&limit=500`;
  return fetchAllPages(url);
}

// --- Lead Ads (form submissions) ---
async function fetchLeadAds(): Promise<any[]> {
  // First get all forms (leadgen_forms) from the ad account
  const formsUrl = `${META_GRAPH_URL}/${META_AD_ACCOUNT_ID}/leadgen_forms?fields=id,name,status,leads_count&limit=100`;
  const forms = await fetchAllPages(formsUrl);

  // Then fetch leads from each form
  const allLeads: any[] = [];
  for (const form of forms) {
    const leadsUrl = `${META_GRAPH_URL}/${form.id}/leads?fields=id,created_time,field_data,ad_id,ad_name,campaign_id,campaign_name,form_id,platform&limit=500`;
    const leads = await fetchAllPages(leadsUrl);
    allLeads.push(...leads.map((lead: any) => ({
      ...lead,
      form_name: form.name,
    })));
  }

  return allLeads;
}

// --- Demographics breakdown ---
async function fetchDemographics(dateFrom: string, dateTo: string): Promise<any> {
  const timeRange = dateFrom && dateTo
    ? `&time_range=${encodeURIComponent(JSON.stringify({ since: dateFrom, until: dateTo }))}`
    : '';

  const fields = 'spend,impressions,clicks,reach,actions';

  const [ageGender, region] = await Promise.all([
    fetchAllPages(
      `${META_GRAPH_URL}/${META_AD_ACCOUNT_ID}/insights?fields=${fields}&breakdowns=age,gender${timeRange}&limit=500`
    ),
    fetchAllPages(
      `${META_GRAPH_URL}/${META_AD_ACCOUNT_ID}/insights?fields=${fields}&breakdowns=region${timeRange}&limit=500`
    ),
  ]);

  return { ageGender, region };
}
