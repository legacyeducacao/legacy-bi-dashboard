import type { VercelRequest, VercelResponse } from '@vercel/node';

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN || '';
const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const endpoint = req.query.endpoint as string;
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  if (!PIPEDRIVE_API_TOKEN) {
    return res.status(500).json({ error: 'PIPEDRIVE_API_TOKEN not configured' });
  }

  // Build query params, injecting the API token server-side
  const params = new URLSearchParams(req.query as Record<string, string>);
  params.delete('endpoint');
  params.set('api_token', PIPEDRIVE_API_TOKEN);

  try {
    const url = `${PIPEDRIVE_BASE}/${endpoint}?${params}`;
    const response = await fetch(url);
    const data = await response.json();

    // Cache for 2 minutes to reduce API calls
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error('Pipedrive proxy error:', error);
    return res.status(500).json({ error: error.message || 'Proxy request failed' });
  }
}
