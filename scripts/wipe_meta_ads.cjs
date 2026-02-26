const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeMetaAdsData() {
  console.log('Fetching Meta Ads channel ID...');
  
  const { data: channelData, error: channelError } = await supabase
    .from('dim_channels')
    .select('id')
    .eq('name', 'Meta Ads')
    .single();

  if (channelError) {
    console.error('Error finding Meta Ads channel:', channelError);
    return;
  }

  const channelId = channelData.id;
  console.log(`Meta Ads Channel ID: ${channelId}`);
  console.log('Wiping all fact_daily_marketing records for Meta Ads...');

  const { data, error } = await supabase
    .from('fact_daily_marketing')
    .delete()
    .eq('channel_id', channelId);

  if (error) {
    console.error('Error deleting records:', error);
  } else {
    console.log('Successfully wiped all Meta Ads records from fact_daily_marketing.');
    console.log('You can now run the N8N workflow to fetch the exact, clean 30-day history.');
  }
}

wipeMetaAdsData();
