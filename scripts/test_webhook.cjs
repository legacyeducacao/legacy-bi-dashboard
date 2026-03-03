const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
    const parts = line.split('=');
    if (parts.length >= 2) acc[parts[0].trim()] = parts.slice(1).join('=').trim();
    return acc;
}, {});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_KEY = env['VITE_SUPABASE_ANON_KEY'];

async function req(url, body) {
   const res = await fetch(SUPABASE_URL + url, {
      method: 'POST',
      headers: { 
         'apikey': SUPABASE_KEY, 
         'Authorization': 'Bearer ' + SUPABASE_KEY,
         'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
   });
   console.log(url, res.status, await res.text());
}

async function run() {
    const today = new Date().toISOString().split('T')[0];

    // 1. Ingest Marketing Data
    // We will use standard insert since we don't have rpc for this, or upsert.
    await req('/rest/v1/fact_daily_marketing', {
      date: today,
      channel_id: '1e3752e5-4f40-410a-b108-c89b88cf1d08', // Assuming Meta Ads has this ID or we'll just skip and use the real webhook. 
      // Actually, better to just rely on the API. 
      // I will just push commercial data for now, as that's where the bug was.
    });

    // 2. Ingest Commercial Data (Pre-sales & Sales) via RPC
    const basePayload = {
       p_date: today,
       p_opportunities: 0,
       p_connections: 0,
       p_meetings_booked: 0,
       p_meetings_held: 0,
       p_no_shows: 0,
       p_sales: 0,
       p_revenue: 0,
       p_response_time_sum: 0,
       p_response_time_count: 0,
       p_inbound: 0,
       p_outbound: 0
    };

    // SDR 1
    await req('/rest/v1/rpc/upsert_team_activity', {
       ...basePayload, p_name: 'Isaque Inacio', p_role: 'SDR',
       p_opportunities: 50, p_connections: 20, p_meetings_booked: 10,
       p_response_time_sum: 150, p_response_time_count: 20, p_inbound: 30, p_outbound: 20
    });

    // SDR 2
    await req('/rest/v1/rpc/upsert_team_activity', {
       ...basePayload, p_name: 'Luan Silva', p_role: 'SDR',
       p_opportunities: 40, p_connections: 15, p_meetings_booked: 5,
       p_response_time_sum: 300, p_response_time_count: 15, p_inbound: 25, p_outbound: 15
    });

    // SDR 3 (Rodrigo - with the new ID mapping issue resolved)
    await req('/rest/v1/rpc/upsert_team_activity', {
       ...basePayload, p_name: 'Rodrigo Fernandes', p_role: 'SDR',
       p_opportunities: 30, p_connections: 10, p_meetings_booked: 3,
       p_response_time_sum: 125, p_response_time_count: 10, p_inbound: 20, p_outbound: 10
    });

    // CLOSER 1
    await req('/rest/v1/rpc/upsert_team_activity', {
       ...basePayload, p_name: 'Leonardo Padilha', p_role: 'Closer',
       p_meetings_held: 8, p_no_shows: 2, p_sales: 3, p_revenue: 45000
    });

    // CLOSER 2
    await req('/rest/v1/rpc/upsert_team_activity', {
       ...basePayload, p_name: 'Leonardo Souza', p_role: 'Closer',
       p_meetings_held: 6, p_no_shows: 1, p_sales: 2, p_revenue: 32000
    });

    // CLOSER 3
    await req('/rest/v1/rpc/upsert_team_activity', {
       ...basePayload, p_name: 'Joel Carlos', p_role: 'Closer',
       p_meetings_held: 5, p_no_shows: 3, p_sales: 1, p_revenue: 15000
    });
}
run();
