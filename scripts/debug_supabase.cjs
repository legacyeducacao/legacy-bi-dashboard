// Script de diagnóstico - executa direto no Node
// Roda: node scripts/debug_supabase.cjs

const SUPABASE_URL = 'https://ibhkisoudreapebtvpga.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGtpc291ZHJlYXBlYnR2cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mzg5ODIsImV4cCI6MjA4NzAxNDk4Mn0.jSaYkf0stVkPxw3bWAIxsDl0sFVPsOynShNQDua4AxY';

async function query(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const err = await res.text();
    return { error: `${res.status}: ${err}`, data: null };
  }
  return { data: await res.json(), error: null };
}

async function main() {
  const today = new Date();
  // Ajusta para BRT (UTC-3)
  const todayBRT = new Date(today.getTime() - 3 * 60 * 60 * 1000);
  const todayStr = todayBRT.toISOString().split('T')[0];

  console.log('='.repeat(60));
  console.log(`📅 Data de hoje (BRT): ${todayStr}`);
  console.log(`📅 UTC: ${today.toISOString()}`);
  console.log('='.repeat(60));

  // 1. Verifica last 5 registros em fact_daily_marketing (ordenado por data desc)
  console.log('\n📊 ÚLTIMOS 5 REGISTROS em fact_daily_marketing:');
  const { data: marketing, error: mErr } = await query(
    'fact_daily_marketing',
    '?select=date,cost,leads,mqls,channel_id,product_id&order=date.desc&limit=10'
  );
  if (mErr) console.log('❌ Erro:', mErr);
  else if (!marketing || marketing.length === 0) console.log('⚠️  TABELA VAZIA - n8n nunca salvou dados!');
  else marketing.forEach(r => console.log(`  ${r.date} | cost: ${r.cost} | leads: ${r.leads} | channel: ${r.channel_id?.slice(0, 8)}...`));

  // 2. Verifica dados de HOJE especificamente
  console.log(`\n🔍 DADOS DE HOJE (${todayStr}) em fact_daily_marketing:`);
  const { data: todayData, error: tErr } = await query(
    'fact_daily_marketing',
    `?select=date,cost,leads,mqls&date=eq.${todayStr}`
  );
  if (tErr) console.log('❌ Erro:', tErr);
  else if (!todayData || todayData.length === 0) console.log(`⚠️  NENHUM DADO para ${todayStr}!`);
  else todayData.forEach(r => console.log(`  ✅ ${r.date} | cost: ${r.cost} | leads: ${r.leads}`));

  // 3. Verifica se daily_trends existe (view ou tabela)
  console.log('\n📋 VERIFICANDO se daily_trends existe:');
  const { data: trends, error: trErr } = await query('daily_trends', '?limit=1');
  if (trErr) console.log('❌ daily_trends NÃO EXISTE:', trErr.substring(0, 100));
  else console.log(`✅ daily_trends EXISTE com ${trends?.length} registros na amostra`);

  // 4. Verifica dim_channels
  console.log('\n📋 dim_channels (canais cadastrados):');
  const { data: channels } = await query('dim_channels', '?select=id,name');
  if (!channels || channels.length === 0) console.log('⚠️  NENHUM CANAL - Se vazio, o n8n não consegue salvar!');
  else channels.forEach(c => console.log(`  Canal: "${c.name}" | id: ${c.id}`));

  // 5. Verifica dim_products
  console.log('\n📋 dim_products (produtos cadastrados):');
  const { data: products } = await query('dim_products', '?select=id,name');
  if (!products || products.length === 0) console.log('⚠️  NENHUM PRODUTO - Se vazio, product_id vai ser NULL (quebra PRIMARY KEY!)');
  else products.forEach(p => console.log(`  Produto: "${p.name}" | id: ${p.id}`));

  // 6. Verifica kpis
  console.log('\n📋 TABELA kpis:');
  const { data: kpis, error: kErr } = await query('kpis', '?select=id,label,value,goal');
  if (kErr) console.log('❌ Erro:', kErr);
  else if (!kpis || kpis.length === 0) console.log('⚠️  kpis VAZIA - Metas não configuradas!');
  else kpis.forEach(k => console.log(`  ${k.id}: valor=${k.value} | meta=${k.goal}`));

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNÓSTICO COMPLETO');
  console.log('='.repeat(60));
}

main().catch(console.error);
