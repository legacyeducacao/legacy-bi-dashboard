const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data, error } = await supabase
    .from('fact_daily_marketing')
    .select(`date, campaign_name, leads, mqls`)
    .order('date', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  data.forEach(d => {
      console.log(`${d.date} | ${d.campaign_name} | Leads: ${d.leads} | MQLs: ${d.mqls}`);
  });
}

checkData();
