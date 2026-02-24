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

async function checkKpis() {
  const { data, error } = await supabase.from('kpis').select('*');
  if (error) {
    console.error('Error fetching kpis:', error);
  } else {
    console.log('KPIs in DB:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkKpis();
