
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

async function clearDatabase() {
  console.log('🚮 Clearing Fact Tables...');
  
  const tables = ['fact_daily_marketing', 'fact_team_activities', 'fact_deals'];
  
  for (const table of tables) {
    console.log(`Clearing ${table}...`);
    // 'fact_deals' uses 'created_date', others use 'created_at'
    const filterCol = table === 'fact_deals' ? 'created_date' : 'created_at';
    const { error } = await supabase.from(table).delete().neq(filterCol, '1970-01-01');
    
    if (error) {
      console.error(`Error clearing ${table}:`, error.message);
    } else {
      console.log(`✅ ${table} cleared.`);
    }
  }
  
  console.log('✨ Data reset complete. You can now re-upload your sheets.');
  process.exit(0);
}

clearDatabase();
