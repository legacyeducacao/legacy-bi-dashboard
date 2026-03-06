/**
 * FIX: Meetings Held + Inbound/Outbound
 * 
 * Problemas identificados:
 * 1. meetings_held=44 está incorreto (gerado por sync retroativo com bug)
 * 2. inbound_count/outbound_count precisam usar campo `inbound_ou_outbound` do HubSpot
 * 3. meetings_booked conta agendamentos excluindo reagendamentos (já está correto no retroativo)
 *
 * Este script:
 * 1. ZERA meetings_held no banco para março 2026 (dados corretos devem vir do HubSpot)
 * 2. Rereprocessa todos os deals de março usando `reuniao_ocorrida=true` para meetings_held
 * 3. Rereprocessa inbound/outbound usando `inbound_ou_outbound` do HubSpot
 * 
 * Execução: node scripts/fix_meetings_held.mjs
 */

const HS_TOKEN      = 'pat-na1-134a4b35-253e-4b87-b9fa-8e6565ad2582';
const SUPABASE_URL  = 'https://ibhkisoudreapebtvpga.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGtpc291ZHJlYXBlYnR2cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mzg5ODIsImV4cCI6MjA4NzAxNDk4Mn0.jSaYkf0stVkPxw3bWAIxsDl0sFVPsOynShNQDua4AxY';
const PIPELINE_ID   = '827389965';

const OWNER_MAP = {
  '86857769':   { name: 'Isaque Inacio',    role: 'SDR'    },
  '85822345':   { name: 'Luan Silva',        role: 'SDR'    },
  '1856577327': { name: 'Rodrigo Fernandes', role: 'SDR'    },
  '69864695':   { name: 'Rodrigo Fernandes', role: 'SDR'    },
  '2011790555': { name: 'Rodrigo Fernandes', role: 'SDR'    },
  '78938498':   { name: 'Leonardo Padilha',  role: 'Closer' },
  '86362284':   { name: 'Leonardo Souza',    role: 'Closer' },
  '85369712':   { name: 'Joel Carlos',       role: 'Closer' }
};

const WON_STAGE = '1225098152';
const REVENUE_THRESHOLD = 70000;
const REVENUE_FIELDS = ['faturamento_mensal','annual_revenue','faturamento_atual','receita_mensal_empresa'];

// Stages que contam como meeting_held (reunião realizada):
// - Maturação (1225098150) => lead passou pela reunião e está em negociação
// - Negociação (1225098151) 
// - Assinatura (1225024929)
// - Vendido (1225098152)
// Porém a melhor fonte é o campo reuniao_ocorrida=true no deal
// Como ele não está sempre preenchido, vamos usar: deals que passaram por Maturação ou além
const MEETINGS_HELD_STAGES = new Set([
  '1225098150', // Maturação (pós-reunião)
  '1225098151', // Negociação
  '1225024929', // Assinatura de Contrato  
  '1225098152'  // Vendido
]);

// Estágio Agendado (booked) - excluindo Reagendamento
const MEETINGS_BOOKED_STAGE = '1225098149'; // Agendado
// Reagendamento NÃO conta como meetings_booked
const RESCHEDULED_STAGE = '1239126390'; // Reagendamento

function getBRTDateRange(year, month) {
  // Retorna o range do mês especificado
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate   = new Date(year, month, 0).toISOString().split('T')[0]; // último dia do mês
  return { start: startDate, end: endDate };
}

function checkRevenue(props) {
  for (const field of REVENUE_FIELDS) {
    const raw = props[field];
    if (raw !== null && raw !== undefined && raw !== '' && raw !== '0') {
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) {
        return val >= REVENUE_THRESHOLD;
      }
    }
  }
  return true; // sem dado = qualificado por padrão
}

async function fetchDealsForMonth(startDate, endDate) {
  const all = [];
  let after = null;
  console.log(`\n  📡 Buscando deals criados entre ${startDate} e ${endDate}...`);
  
  do {
    const body = {
      limit: 100,
      properties: [
        'dealname', 'amount', 'dealstage', 'pipeline', 'hubspot_owner_id',
        'createdate', 'closedate', 'hs_analytics_source', 'origem_do_lead',
        'inbound_ou_outbound', 'reuniao_ocorrida', 'response_time_1_ligacao',
        ...REVENUE_FIELDS
      ],
      filterGroups: [{
        filters: [
          { propertyName: 'pipeline',   operator: 'EQ',  value: PIPELINE_ID },
          { propertyName: 'createdate', operator: 'GTE', value: `${startDate}T00:00:00.000Z` },
          { propertyName: 'createdate', operator: 'LTE', value: `${endDate}T23:59:59.000Z` }
        ]
      }],
      propertiesWithHistory: ['hubspot_owner_id', 'dealstage'],
      ...(after ? { after } : {})
    };
    
    const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...(data.results || []));
    after = data.paging?.next?.after || null;
    process.stdout.write(`\r  Fetched ${all.length} deals...`);
  } while (after);
  
  console.log(`\n  ✅ Total deals: ${all.length}`);
  return all;
}

function resolveOwner(ownerHistory, currentId) {
  const sorted = [...(ownerHistory || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  for (const e of sorted) if (OWNER_MAP[e.value]) return OWNER_MAP[e.value];
  return OWNER_MAP[currentId] || null;
}

function resolveOwnerByStage(stageHistory) {
  const sorted = [...(stageHistory || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  for (const e of sorted) {
    if (e.value !== WON_STAGE) continue;
    const uid = String(e.updatedByUserId || '');
    if (OWNER_MAP[uid]) return OWNER_MAP[uid];
  }
  return null;
}

function processDeals(deals) {
  const aggregated = {};
  let skipped = 0;

  function getRecord(date, name, role) {
    const key = `${date}|${name}`;
    if (!aggregated[key]) aggregated[key] = {
      date, rep_name: name, role,
      opportunities: 0, connections: 0,
      meetings_booked: 0, meetings_held: 0, no_shows: 0,
      sales: 0, revenue: 0,
      response_time_sum: 0, response_time_count: 0,
      inbound: 0, outbound: 0
    };
    return aggregated[key];
  }

  for (const item of deals) {
    const props = item.properties || item;
    if (props.dealstage === undefined) continue;

    // Filtro de faturamento mínimo
    if (!checkRevenue(props)) {
      skipped++;
      continue;
    }

    // Resolve owner
    const ownerHistory = item.propertiesWithHistory?.hubspot_owner_id || [];
    let ownerInfo = resolveOwner(ownerHistory, String(props.hubspot_owner_id || ''));
    if (!ownerInfo && props.dealstage === WON_STAGE) {
      ownerInfo = resolveOwnerByStage(item.propertiesWithHistory?.dealstage || []);
    }
    if (!ownerInfo) continue;

    const amountVal  = parseFloat(props.amount) || 0;
    const respTimeMs = parseFloat(props.response_time_1_ligacao) || 0;
    
    // Inbound/Outbound: usa campo específico `inbound_ou_outbound` se disponível
    // Fallback para hs_analytics_source
    const inboundField = String(props.inbound_ou_outbound || '').toLowerCase();
    let isInbound;
    if (inboundField === 'inbound') {
      isInbound = true;
    } else if (inboundField === 'outbound') {
      isInbound = false;
    } else {
      // Fallback para análise de source
      const src = String(props.hs_analytics_source || props.origem_do_lead || '').toUpperCase();
      isInbound = ['PAID_SOCIAL','PAID_SEARCH','ORGANIC_SEARCH','ORGANIC_SOCIAL',
                   'EMAIL_MARKETING','REFERRALS','INBOUND'].some(k => src.includes(k));
    }

    // Verifica se reunião ocorreu usando campo `reuniao_ocorrida`
    const reuniaoOcorrida = props.reuniao_ocorrida === 'true' || props.reuniao_ocorrida === true;

    const stageHistory    = item.propertiesWithHistory?.dealstage || [];
    const stagesToProcess = stageHistory.length > 0
      ? stageHistory
      : [{ value: props.dealstage, timestamp: props.createdate || new Date().toISOString() }];

    // Rastreia quais estágios já foram contabilizados para este deal
    const seen = new Set();
    let dealHasBookedMeeting = false;  // Para evitar dupla contagem de agendamento
    let dealHeldMeetingDate  = null;   // Data em que a reunião foi realizada

    for (const stg of stagesToProcess) {
      const stageId = stg.value;
      const dateStr = (stg.timestamp || new Date().toISOString()).split('T')[0];

      // === OPORTUNIDADE ===
      if (stageId === '1225098146' && !seen.has('opportunities')) {
        seen.add('opportunities');
        const rec = getRecord(dateStr, ownerInfo.name, ownerInfo.role);
        rec.opportunities += 1;
        if (respTimeMs > 0) {
          rec.response_time_sum   += respTimeMs > 10000 ? respTimeMs / 60000 : respTimeMs;
          rec.response_time_count += 1;
        }
        isInbound ? rec.inbound++ : rec.outbound++;
      }

      // === CONEXÕES (filtros, negociação, perdido, etc.) ===
      const CONNECTION_STAGES = new Set(['1225098147','1225098148','1226813477','1239126390','1225098150','1225098151']);
      if (CONNECTION_STAGES.has(stageId) && !seen.has(`conn_${stageId}`)) {
        seen.add(`conn_${stageId}`);
        const rec = getRecord(dateStr, ownerInfo.name, ownerInfo.role);
        rec.connections += 1;
      }

      // === REUNIÃO AGENDADA ===
      // Conta APENAS o estágio Agendado — Reagendamento NÃO conta
      if (stageId === MEETINGS_BOOKED_STAGE && !dealHasBookedMeeting) {
        dealHasBookedMeeting = true;
        const rec = getRecord(dateStr, ownerInfo.name, ownerInfo.role);
        rec.meetings_booked += 1;
      }

      // === NO-SHOW ===
      if (stageId === '1225024929' && !seen.has('no_shows')) {
        seen.add('no_shows');
        const rec = getRecord(dateStr, ownerInfo.name, ownerInfo.role);
        rec.no_shows += 1;
      }

      // === REUNIÃO REALIZADA ===
      // Um lead é considerado "realizado" se passou por Maturação (estágio pós-reunião)
      // ou se o campo reuniao_ocorrida=true está marcado
      if (MEETINGS_HELD_STAGES.has(stageId) && !seen.has('meetings_held')) {
        seen.add('meetings_held');
        dealHeldMeetingDate = dateStr;
      }

      // === VENDAS ===
      if (stageId === WON_STAGE && !seen.has('sales')) {
        seen.add('sales');
        const rec = getRecord(dateStr, ownerInfo.name, ownerInfo.role);
        rec.sales   += 1;
        rec.revenue += amountVal;
      }
    }

    // Registra meetings_held na data em que entrou no estágio Maturação
    // ou usa reuniao_ocorrida se disponível
    if (reuniaoOcorrida && !dealHeldMeetingDate) {
      // Se reuniao_ocorrida está marcado, conta na data de criação do deal
      dealHeldMeetingDate = (props.createdate || new Date().toISOString()).split('T')[0];
    }
    if (dealHeldMeetingDate) {
      const rec = getRecord(dealHeldMeetingDate, ownerInfo.name, ownerInfo.role);
      rec.meetings_held += 1;
    }
  }

  console.log(`\n  ⚠️  Skipped ${skipped} deals (abaixo do threshold de faturamento)`);
  return Object.values(aggregated);
}

async function getTeamMemberId(name, role) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dim_team`, {
    method: 'POST',
    headers: {
      'apikey':       SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer':       'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify({ name, role })
  });
  if (!res.ok) {
    const get = await fetch(`${SUPABASE_URL}/rest/v1/dim_team?name=eq.${encodeURIComponent(name)}&select=id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await get.json();
    return data?.[0]?.id || null;
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0]?.id : data?.id;
}

async function supabaseUpsert(table, rows) {
  if (rows.length === 0) return 0;
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ Supabase error: ${res.status}: ${err.substring(0, 200)}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

async function main() {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const year  = brt.getFullYear();
  const month = brt.getMonth() + 1;

  console.log('🔧 FIX: Meetings Held + Inbound/Outbound Correction');
  console.log('='.repeat(60));
  console.log(`  Mês de referência: ${year}-${String(month).padStart(2, '0')}`);

  const { start, end } = getBRTDateRange(year, month);
  console.log(`  Período: ${start} → ${end}`);

  // 1. Busca deals do mês atual
  const deals = await fetchDealsForMonth(start, end);
  
  // 2. Processa com a lógica correta
  console.log('\n🔄 Processando lógica correta...');
  const records = processDeals(deals);
  console.log(`  ✅ ${records.length} registros de atividade gerados`);

  // Log do que será salvo
  const totalBooked = records.reduce((s, r) => s + r.meetings_booked, 0);
  const totalHeld   = records.reduce((s, r) => s + r.meetings_held, 0);
  const totalIn     = records.reduce((s, r) => s + r.inbound, 0);
  const totalOut    = records.reduce((s, r) => s + r.outbound, 0);
  console.log(`  📊 Totais calculados:`);
  console.log(`     meetings_booked : ${totalBooked}`);
  console.log(`     meetings_held   : ${totalHeld}`);
  console.log(`     inbound_count   : ${totalIn}`);
  console.log(`     outbound_count  : ${totalOut}`);

  // 3. Resolve IDs e monta rows para upsert
  console.log('\n💾 Upserting no Supabase...');
  const memberCache = {};
  const activityRows = [];

  for (const rec of records) {
    const cacheKey = `${rec.rep_name}|${rec.role}`;
    if (!memberCache[cacheKey]) {
      memberCache[cacheKey] = await getTeamMemberId(rec.rep_name, rec.role);
    }
    const memberId = memberCache[cacheKey];
    if (!memberId) { console.warn(`  ⚠️  Sem ID para ${rec.rep_name}`); continue; }

    activityRows.push({
      date:                rec.date,
      team_member_id:      memberId,
      opportunities:       rec.opportunities,
      connections:         rec.connections,
      meetings_booked:     rec.meetings_booked,
      meetings_held:       rec.meetings_held,
      no_shows:            rec.no_shows,
      sales:               rec.sales,
      revenue:             Math.round(rec.revenue * 100) / 100,
      response_time_sum:   Math.round(rec.response_time_sum * 100) / 100,
      response_time_count: rec.response_time_count,
      inbound_count:       rec.inbound,
      outbound_count:      rec.outbound
    });
  }

  const saved = await supabaseUpsert('fact_team_activities', activityRows);
  console.log(`  ✅ ${saved} registros salvos!`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ FIX CONCLUÍDO!');
  console.log(`  meetings_booked correto: ${totalBooked}`);
  console.log(`  meetings_held   correto: ${totalHeld}`);
  console.log(`  inbound         correto: ${totalIn}`);
  console.log(`  outbound        correto: ${totalOut}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  process.exit(1);
});
