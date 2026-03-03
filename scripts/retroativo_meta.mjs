/**
 * RETROATIVO 30 DIAS — Meta Ads → Supabase (v2)
 * Corrigido: verifica channel_id e product_id antes do upsert
 * Debug verbose para identificar falhas silenciosas
 */

const META_TOKEN      = process.env.META_TOKEN      || 'SEU_TOKEN_META_AQUI';
const META_ACCOUNT_ID = process.env.META_ACCOUNT    || 'act_SEU_AD_ACCOUNT_ID';
const SUPABASE_URL    = 'https://ibhkisoudreapebtvpga.supabase.co';
const SUPABASE_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGtpc291ZHJlYXBlYnR2cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mzg5ODIsImV4cCI6MjA4NzAxNDk4Mn0.jSaYkf0stVkPxw3bWAIxsDl0sFVPsOynShNQDua4AxY';
const DAYS_BACK       = 30;

// ── HELPERS DE DATA ───────────────────────────────────────────────────────────

function getBRTToday() {
  const now = new Date();
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function getDateRange() {
  const dates = [];
  const today = getBRTToday();
  const end   = new Date(today + 'T00:00:00');
  for (let i = DAYS_BACK; i >= 1; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// ── TRANSFORMADOR ─────────────────────────────────────────────────────────────

function extractProductName(campaignName) {
  if (!campaignName) return 'Institucional';
  const m1 = campaignName.match(/^\d+\s*[-–]\s*\[([^\]]+)\]/);
  if (m1) return m1[1].trim();
  const m2 = campaignName.match(/\[([^\]]+)\]/);
  if (m2 && m2[1].trim().length > 3) return m2[1].trim();
  return 'Institucional';
}

function transformAdInsights(insights) {
  const results = {};
  for (const ad of insights) {
    if (!ad.campaign_name) continue;
    const date = ad.date_start;
    const campaignName = ad.campaign_name;
    const productName  = extractProductName(campaignName);
    const cost         = parseFloat(ad.spend)      || 0;
    const impressions  = parseInt(ad.impressions)  || 0;
    let clicks         = parseInt(ad.clicks)       || 0;
    let leads = 0, mqls = 0;

    if (ad.actions && Array.isArray(ad.actions)) {
      if (clicks === 0) {
        const ca = ad.actions.find(a => a.action_type === 'link_click');
        if (ca) clicks = parseInt(ca.value) || 0;
      }
      const leadObj     = ad.actions.find(a => a.action_type === 'lead');
      const leadGrouped = ad.actions.find(a => a.action_type === 'onsite_conversion.lead_grouped');
      const offsiteReg  = ad.actions.find(a => a.action_type === 'offsite_complete_registration_add_meta_leads');
      const pixelCustom = ad.actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_custom');
      const mqlActions  = ad.actions.filter(a =>
        a.action_type.toLowerCase().includes('mql') || a.action_type.toLowerCase().includes('qualified')
      );
      let maxLeads = 0;
      if (leadObj)     maxLeads = Math.max(maxLeads, parseInt(leadObj.value)     || 0);
      if (leadGrouped) maxLeads = Math.max(maxLeads, parseInt(leadGrouped.value) || 0);
      if (maxLeads > 0) leads = maxLeads;
      else if (offsiteReg)  leads = parseInt(offsiteReg.value)  || 0;
      else if (pixelCustom) leads = parseInt(pixelCustom.value) || 0;
      let customMqls = 0;
      mqlActions.forEach(a => {
        if (a.action_type !== 'lead' && a.action_type !== 'onsite_conversion.lead_grouped')
          customMqls += parseInt(a.value) || 0;
      });
      const isNative = campaignName.toLowerCase().includes('nativo');
      if (isNative) { mqls = leads; leads = 0; } else { mqls = customMqls; }
    }

    const key = `${date}|${campaignName}`;
    if (!results[key]) results[key] = { date, product_name: productName, campaign_name: campaignName, cost: 0, impressions: 0, clicks: 0, leads: 0, mqls: 0 };
    results[key].cost += cost;
    results[key].impressions += impressions;
    results[key].clicks += clicks;
    results[key].leads += leads;
    results[key].mqls  += mqls;
  }
  return Object.values(results).map(r => ({ ...r, cost: Math.round(r.cost * 100) / 100 }));
}

// ── META API ──────────────────────────────────────────────────────────────────

async function fetchMetaInsights(date) {
  const params = new URLSearchParams({
    fields: 'campaign_name,spend,impressions,clicks,actions',
    time_range: JSON.stringify({ since: date, until: date }),
    level: 'campaign',
    limit: '500',
    access_token: META_TOKEN
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/${META_ACCOUNT_ID}/insights?${params}`);
  if (!res.ok) {
    const err = await res.text();
    // 400 with "no data" is normal for days with no active campaigns
    if (res.status === 400 && (err.includes('no data') || err.includes('No data'))) return [];
    throw new Error(`Meta ${res.status}: ${err.substring(0, 200)}`);
  }
  const data = await res.json();
  return data.data || [];
}

// ── SUPABASE HELPERS ──────────────────────────────────────────────────────────

const sbHeaders = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json'
};

async function getOrCreateId(table, field, value) {
  // 1. Try upsert (insert or update)
  const postRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ [field]: value })
  });
  if (postRes.ok) {
    const rows = await postRes.json();
    const row  = Array.isArray(rows) ? rows[0] : rows;
    if (row?.id) return row.id;
  }
  // 2. Fallback: GET
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}&select=id`,
    { headers: sbHeaders }
  );
  if (!getRes.ok) throw new Error(`Could not get ${table} id for "${value}": ${getRes.status}`);
  const rows = await getRes.json();
  if (rows?.[0]?.id) return rows[0].id;
  throw new Error(`No ${table} id found for "${value}" after upsert and GET`);
}

async function upsertRows(rows) {
  if (rows.length === 0) return { saved: 0, errors: 0 };
  const BATCH = 50;
  let saved = 0, errors = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fact_daily_marketing`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ batch ${i}-${i+BATCH}: ${res.status}: ${err.substring(0, 150)}`);
      errors += batch.length;
    } else {
      saved += batch.length;
    }
  }
  return { saved, errors };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  if (META_TOKEN === 'SEU_TOKEN_META_AQUI') {
    console.error('❌ Falta META_TOKEN. Use: $env:META_TOKEN="xxx"; $env:META_ACCOUNT="act_yyy"; node scripts/retroativo_meta.mjs');
    process.exit(1);
  }

  console.log('🚀 RETROATIVO 30 DIAS — Meta Ads → Supabase (v2)');
  console.log('='.repeat(60));
  console.log(`  Ad Account: ${META_ACCOUNT_ID}`);

  const dates = getDateRange();
  console.log(`  Período: ${dates[0]} → ${dates[dates.length - 1]} (${dates.length} dias)`);

  // Pre-load channel and product cache
  console.log('\n🔧 Configurando dimensões...');
  let channelId;
  try {
    channelId = await getOrCreateId('dim_channels', 'name', 'Meta Ads');
    console.log(`  ✅ channel_id (Meta Ads): ${channelId}`);
  } catch (e) {
    console.error('❌ Não foi possível obter channel_id:', e.message);
    process.exit(1);
  }

  const productCache = {};
  async function getProductId(name) {
    if (!productCache[name]) {
      productCache[name] = await getOrCreateId('dim_products', 'name', name);
    }
    return productCache[name];
  }

  let totalInsights = 0, totalSaved = 0, totalErrors = 0, emptyDays = 0;

  for (const date of dates) {
    process.stdout.write(`  ${date}... `);
    try {
      const insights    = await fetchMetaInsights(date);
      const transformed = transformAdInsights(insights);
      totalInsights += insights.length;

      if (transformed.length === 0) {
        process.stdout.write(`(sem campanhas)\n`);
        emptyDays++;
        continue;
      }

      // Monta rows com IDs de dimensão já resolvidos
      const rows = [];
      for (const item of transformed) {
        let productId;
        try {
          productId = await getProductId(item.product_name);
        } catch (e) {
          console.warn(`\n  ⚠️  Produto "${item.product_name}" sem ID: ${e.message}`);
          continue;
        }
        rows.push({
          date:          item.date,
          channel_id:    channelId,
          product_id:    productId,
          campaign_name: item.campaign_name,
          cost:          item.cost,
          impressions:   item.impressions,
          clicks:        item.clicks,
          leads:         item.leads,
          mqls:          item.mqls
        });
      }

      const { saved, errors } = await upsertRows(rows);
      totalSaved  += saved;
      totalErrors += errors;
      process.stdout.write(`${insights.length} campanhas → ${saved} rows upserted\n`);

      // 150ms entre dias (rate limit)
      await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      process.stdout.write(`❌ ${err.message.substring(0, 60)}\n`);
      totalErrors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ RETROATIVO META ADS CONCLUÍDO!');
  console.log(`  Período:       ${dates[0]} → ${dates[dates.length - 1]}`);
  console.log(`  Days com dado: ${dates.length - emptyDays} / ${dates.length}`);
  console.log(`  Insights raw:  ${totalInsights}`);
  console.log(`  Rows salvos:   ${totalSaved}`);
  if (totalErrors > 0) console.log(`  ⚠️  Erros:     ${totalErrors}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  process.exit(1);
});
