import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; 

// NOTE: Ideally use SERVICE_ROLE_KEY for seeding to bypass RLS, 
// but for now we try with ANON key if RLS allows or if no RLS is set yet.
// If it fails, user might need to run in SQL Editor or provide Service Key.

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CHANNELS = ['Google Ads', 'Meta Ads', 'LinkedIn Ads', 'Orgânico', 'Indicação'];
const PRODUCTS = ['Imersão', 'Mentoria', 'Consultoria', 'Curso Online', 'Geral']; // Added Geral
const TEAM = [
  { name: 'Ana Silva', role: 'SDR' },
  { name: 'Carlos Souza', role: 'SDR' },
  { name: 'Roberto Lima', role: 'Closer' },
  { name: 'Fernanda Alves', role: 'Closer' }
];

async function seed() {
  console.log('🌱 Starting V2 Seed...');

  // 1. Seed Dimensions
  console.log('Seeding Dimensions...');
  
  // Channels
  for (const name of CHANNELS) {
    const { error } = await supabase.from('dim_channels').upsert({ name }, { onConflict: 'name' });
    if (error) console.error('Error seeding channel:', error);
  }

  // Products
  for (const name of PRODUCTS) {
    const { error } = await supabase.from('dim_products').upsert({ name }, { onConflict: 'name' });
    if (error) console.error('Error seeding product:', error);
  }

  // Team
  for (const person of TEAM) {
    const { error } = await supabase.from('dim_team').upsert({ name: person.name, role: person.role, email: `${person.name.toLowerCase().replace(' ', '.')}@example.com` }, { onConflict: 'email' });
    if (error) console.error('Error seeding team:', person.name, error);
  }

  // Get IDs back
  const { data: channels } = await supabase.from('dim_channels').select('id, name');
  const { data: products } = await supabase.from('dim_products').select('id, name');
  const { data: team } = await supabase.from('dim_team').select('id, name, role');

  if (!channels || !products || !team) {
    console.error('Failed to retrieve dimension IDs');
    return;
  }

  const generalProduct = products.find(p => p.name === 'Geral') || products[0];

  // 2. Seed Facts (Daily Marketing)
  console.log('Seeding Facts: Daily Marketing...');
  const today = new Date();
  const daysToSeed = 30;

  for (let i = 0; i < daysToSeed; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    for (const channel of channels) {
      const isMeta = channel.name.includes('Meta');
      const isGoogle = channel.name.includes('Google');
      
      const cost = isMeta ? Math.random() * 200 : (isGoogle ? Math.random() * 300 : 0);
      const leads = Math.floor(cost / (Math.random() * 20 + 10)); // CPL approx 10-30
      
      // Use Geral product for generic channel spend, or distribute? Keeping it simple.
      const { error } = await supabase.from('fact_daily_marketing').upsert({
        date: dateStr,
        channel_id: channel.id,
        product_id: generalProduct.id, 
        cost: Math.round(cost * 100) / 100,
        leads,
        impressions: leads * 100,
        clicks: leads * 5
      });
      if (error) console.error('Error seeding marketing fact:', error);
    }
  }

  // 3. Seed Facts (Team & Deals)
  console.log('Seeding Facts: Team & Deals...');
  
  for (let i = 0; i < daysToSeed; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    for (const member of team) {
      if (member.role === 'SDR') {
         await supabase.from('fact_team_activities').upsert({
            date: dateStr,
            team_member_id: member.id,
            connections: Math.floor(Math.random() * 50),
            calls: Math.floor(Math.random() * 80),
            meetings_booked: Math.floor(Math.random() * 5)
         });
      }
    }
  }

  // Create some Deals
  for (let i = 0; i < 20; i++) {
     const status = Math.random() > 0.5 ? 'Won' : 'Lost';
     const value = status === 'Won' ? (Math.random() * 10000 + 5000) : 0;
     const randomChannel = channels[Math.floor(Math.random() * channels.length)];
     const randomProduct = products[Math.floor(Math.random() * products.length)];
     const randomSdr = team.find(t => t.role === 'SDR');
     const randomCloser = team.find(t => t.role === 'Closer');

     await supabase.from('fact_deals').upsert({
        deal_id: `deal_${i}`,
        sdr_id: randomSdr?.id,
        closer_id: randomCloser?.id,
        product_id: randomProduct?.id,
        channel_id: randomChannel.id,
        created_date: new Date().toISOString().split('T')[0],
        status,
        value
     });
  }

  console.log('✅ Seed V2 Complete!');
}

seed().catch(console.error);
