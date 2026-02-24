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

const KPIS_TO_SEED = [
  // Global / Marketing
  { id: 'invest', label: 'Investimento Ads', value: 0, goal: 0, unit: 'currency' },
  { id: 'leads', label: 'Leads Totais', value: 0, goal: 0, unit: 'number' },
  { id: 'mqls', label: 'MQLs', value: 0, goal: 0, unit: 'number' },
  { id: 'cpl', label: 'CPL (Custo Lead)', value: 0, goal: 0, unit: 'currency' },
  { id: 'cpmql', label: 'Custo por MQL', value: 0, goal: 0, unit: 'currency' },
  { id: 'mkt_revenue', label: 'Faturamento Mkt', value: 0, goal: 0, unit: 'currency' },
  { id: 'mkt_sales', label: 'Vendas Mkt', value: 0, goal: 0, unit: 'number' },
  { id: 'roas', label: 'ROAS Macro', value: 0, goal: 0, unit: 'number', suffix: 'x' },
  { id: 'cac', label: 'CAC', value: 0, goal: 0, unit: 'currency' },
  { id: 'ltv', label: 'LTV', value: 0, goal: 0, unit: 'currency' },
  
  // Comercial / SDR
  { id: 'opps', label: 'Oportunidades', value: 0, goal: 0, unit: 'number' },
  { id: 'connections', label: 'Conexões (Alô)', value: 0, goal: 0, unit: 'number' },
  { id: 'meetings_booked', label: 'Agendamentos', value: 0, goal: 0, unit: 'number' },
  { id: 'response_time', label: 'Tempo de Resposta', value: 0, goal: 0, unit: 'number', suffix: ' min' },
  
  // Comercial / Vendas
  { id: 'meetings_held', label: 'Realizadas', value: 0, goal: 0, unit: 'number' },
  { id: 'sales', label: 'Vendas Totais', value: 0, goal: 0, unit: 'number' },
  { id: 'revenue', label: 'Faturamento Total', value: 0, goal: 0, unit: 'currency' },
  { id: 'no_show_rate', label: 'Taxa de No-Show', value: 0, goal: 0, unit: 'percent' },
  { id: 'ticket', label: 'Ticket Médio', value: 0, goal: 0, unit: 'currency' },
  { id: 'conv_meet_sale', label: 'Conv. Realizada/Venda', value: 0, goal: 0, unit: 'percent' }
];

async function seedKpis() {
  console.log('🌱 Seeding missing KPIs...');
  const { error } = await supabase.from('kpis').upsert(KPIS_TO_SEED, { onConflict: 'id' });
  
  if (error) {
    console.error('Error seeding kpis:', error);
  } else {
    console.log('✅ KPIs seeded successfully!');
  }
}

seedKpis();
