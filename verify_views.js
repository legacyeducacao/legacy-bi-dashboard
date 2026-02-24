import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('🔍 Verifying Views...');

  // 1. Check Marketing Channels View
  const { data: channels, error: errChannels } = await supabase.from('marketing_channels').select('*');
  if (errChannels) {
    console.error('❌ Error fetching marketing_channels:', errChannels);
  } else {
    console.log(`✅ marketing_channels: Found ${channels.length} rows`);
    if (channels.length > 0) console.log('Sample:', channels[0]);
  }

  // 2. Check Team Performance View
  const { data: team, error: errTeam } = await supabase.from('team_performance').select('*');
  if (errTeam) {
    console.error('❌ Error fetching team_performance:', errTeam);
  } else {
    console.log(`✅ team_performance: Found ${team.length} rows`);
    if (team.length > 0) console.log('Sample:', team[0]);
  }
}

verify().catch(console.error);
