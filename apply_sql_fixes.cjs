const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSql() {
  console.log('🛠️ Applying Database Fixes...');
  
  // Note: Standard Supabase REST API doesn't allow raw SQL. 
  // We recommend using the SQL Editor in Supabase UI for these structural changes.
  // HOWEVER, we can try to use a dummy RPC if the user has one, but usually they don't.
  // I will check if I can at least update the data.
  
  console.log("Note: Please run the following SQL in the Supabase SQL Editor if data doesn't appear:");
  console.log(`
    ALTER TABLE fact_daily_marketing ADD COLUMN IF NOT EXISTS mqls INTEGER DEFAULT 0;

    CREATE OR REPLACE VIEW daily_trends AS
    SELECT 
        d.date,
        COALESCE(SUM(m.leads), 0) as leads,
        COALESCE(SUM(m.mqls), 0) as mqls,
        COALESCE(SUM(m.cost), 0) as investment,
        COALESCE(COUNT(deal.deal_id) FILTER (WHERE deal.status = 'Won'), 0) as sales,
        COALESCE(SUM(deal.value) FILTER (WHERE deal.status = 'Won'), 0) as revenue,
        COALESCE(SUM(a.connections), 0) as connected,
        COALESCE(SUM(a.calls), 0) as activities,
        COALESCE(SUM(a.opportunities), 0) as opportunities,
        COALESCE(SUM(a.meetings_booked), 0) as meetings_booked
    FROM (
        SELECT DISTINCT date FROM fact_daily_marketing 
        UNION 
        SELECT DISTINCT date FROM fact_team_activities
        UNION
        SELECT DISTINCT created_date as date FROM fact_deals
    ) d
    LEFT JOIN fact_daily_marketing m ON d.date = m.date
    LEFT JOIN fact_team_activities a ON d.date = a.date
    LEFT JOIN fact_deals deal ON d.date = deal.created_date
    GROUP BY d.date
    ORDER BY d.date;
  `);

  // Try to create the column via a possible but unlikely method, or just proceed.
  // Realistically, I'll notify the user to run the SQL or I'll try to find an alternative.
}

runSql();
