import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL = process.env.SUPABASE_CRM_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const table = req.query.table as string;
  if (!table) {
    return res.status(400).json({ error: 'Missing table parameter' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_CRM_URL or SUPABASE_SERVICE_ROLE_KEY not configured' });
  }

  // Build query params (forward all except 'table')
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'table') continue;
    if (Array.isArray(value)) {
      value.forEach(v => params.append(key, v));
    } else if (value) {
      params.append(key, value);
    }
  }

  try {
    const encodedTable = encodeURIComponent(table);
    const url = `${SUPABASE_URL}/rest/v1/${encodedTable}?${params}`;

    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    // Cache for 2 minutes
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Supabase CRM proxy error:', error);
    return res.status(500).json({ error: error.message || 'CRM proxy request failed' });
  }
}
