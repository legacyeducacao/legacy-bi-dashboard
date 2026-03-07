/**
 * RETROATIVO 30 DIAS — HubSpot → Supabase
 * Funil Comercial Legacy (827389965)
 *
 * Execução: node scripts/retroativo_hubspot.mjs
 *
 * O script:
 *  1. Busca todos os deals dos últimos 30 dias
 *  2. Aplica o filtro de 70K (transformer v7)
 *  3. Faz UPSERT direto no Supabase via REST API
 *  4. Salva leads rejeitados em rejected_leads_log
 */

// ── CREDENCIAIS ───────────────────────────────────────────────────────────────
const HS_TOKEN      = 'pat-na1-134a4b35-253e-4b87-b9fa-8e6565ad2582';
const SUPABASE_URL  = 'https://ibhkisoudreapebtvpga.supabase.co';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGtpc291ZHJlYXBlYnR2cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mzg5ODIsImV4cCI6MjA4NzAxNDk4Mn0.jSaYkf0stVkPxw3bWAIxsDl0sFVPsOynShNQDua4AxY';
const PIPELINE_ID   = '827389965';
const DAYS_BACK     = 30;

// ── MAPAS (do transformer v7) ─────────────────────────────────────────────────
const REVENUE_THRESHOLD = 70000;
const REVENUE_FIELDS    = ['faturamento_mensal','annual_revenue','faturamento_atual','receita_mensal_empresa'];

const STAGE_MAP = {
  '1225098146': 'opportunities',
  '1225098147': 'connections',
  '1225098148': 'connections',
  '1225098149': 'meetings_booked',   // Agendado → conta como Agendada (NÃO conta Reagendamento)
  '1239126390': 'connections',        // Reagendamento → só conexão, NÃO é Agendada
  '1225098150': 'connections',        // Maturação → conexão (meetings_held tratado via MEETINGS_HELD_STAGES)
  '1225098151': 'connections',        // Negociação
  '1225024929': 'no_shows',
  '1225098152': 'sales',
  '1226813477': 'connections'
};

// Estágios que implicam que a reunião foi realizada
// Tratado SEPARADAMENTE do STAGE_MAP para não interferir com outros contadores
const MEETINGS_HELD_STAGES = new Set([
  '1225098150', // Maturação (deal passou pela reunião, entrou em negociação)
  '1225098151', // Negociação
  '1225024929', // Assinatura de Contrato
  '1225098152'  // Vendido
]);

const STAGE_NAMES = {
  '1225098146':'Entrada','1225098147':'Filtro 1','1225098148':'Filtro 2',
  '1225098149':'Agendado','1239126390':'Reagendamento','1225098150':'Maturação',
  '1225098151':'Negociação','1225024929':'Assinatura de Contrato',
  '1225098152':'Vendido','1226813477':'Perdido'
};

const WON_STAGES = new Set(['1225098152']);

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

// ── HELPERS ───────────────────────────────────────────────────────────────────

function getBRTDateRange() {
  const now    = new Date();
  const endBRT = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const start  = new Date(endBRT);
  start.setDate(start.getDate() - DAYS_BACK);
  return {
    start: start.toISOString().split('T')[0],
    end:   endBRT.toISOString().split('T')[0]
  };
}

function checkRevenue(props) {
  for (const field of REVENUE_FIELDS) {
    const raw = props[field];
    if (raw !== null && raw !== undefined && raw !== '' && raw !== '0') {
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) {
        return val >= REVENUE_THRESHOLD
          ? { qualified: true, val, field }
          : { qualified: false, val, field, reason: `${field} R$ ${val.toLocaleString('pt-BR')} < 70K` };
      }
    }
  }
  return { qualified: true, noData: true }; // Opção A
}

function resolveOwner(ownerHistory, currentId) {
  const sorted = [...(ownerHistory || [])].sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
  for (const e of sorted) if (OWNER_MAP[e.value]) return OWNER_MAP[e.value];
  return OWNER_MAP[currentId] || null;
}

function resolveOwnerByStage(stageHistory) {
  const sorted = [...(stageHistory || [])].sort((a,b) => new Date(b.timestamp)-new Date(a.timestamp));
  for (const e of sorted) {
    if (!WON_STAGES.has(e.value)) continue;
    const uid = String(e.updatedByUserId || '');
    if (OWNER_MAP[uid]) return OWNER_MAP[uid];
  }
  return null;
}

// ── HUBSPOT API ───────────────────────────────────────────────────────────────

async function fetchAllDeals(startDate) {
  const all = [];
  let after = null;
  console.log(`\n  📡 Buscando deals criados após ${startDate}...`);
  do {
    const body = {
      limit: 100,
      properties: [
        'dealname','amount','dealstage','pipeline','hubspot_owner_id',
        'createdate','closedate','hs_analytics_source','origem_do_lead',
        'inbound_ou_outbound', 'reuniao_ocorrida',
        'response_time_1_ligacao',
        ...REVENUE_FIELDS
      ],
      filterGroups: [
        {
          filters: [
            { propertyName: 'pipeline',   operator: 'EQ',  value: PIPELINE_ID },
            { propertyName: 'createdate', operator: 'GTE', value: `${startDate}T00:00:00.000Z` }
          ]
        },
        // Também captura deals fechados (Vendido) no mês atual, mesmo criados antes do período
        {
          filters: [
            { propertyName: 'pipeline',   operator: 'EQ',  value: PIPELINE_ID },
            { propertyName: 'dealstage',  operator: 'EQ',  value: '1225098152' },
            { propertyName: 'closedate',  operator: 'GTE', value: `${startDate}T00:00:00.000Z` }
          ]
        }
      ],
      propertiesWithHistory: ['hubspot_owner_id','dealstage'],
      ...(after ? { after } : {})
    };
    const res  = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${HS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
    const data = await res.json();
    console.log(`  [Debug] Page result count: ${data.results?.length || 0} | Total in HS: ${data.total}`);
    all.push(...(data.results || []));
    after = data.paging?.next?.after || null;
    process.stdout.write(`\r  Fetched ${all.length} deals...`);
  } while (after);
  console.log(`\n  ✅ Total deals: ${all.length}`);
  return all;
}

// ── TRANSFORMER (lógica do v7) ────────────────────────────────────────────────

function transformDeals(deals) {
  const aggregated = {};
  const rejected   = [];

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

    const check = checkRevenue(props);
    if (!check.qualified) {
      rejected.push({
        deal_id:            String(item.id || ''),
        deal_name:          props.dealname || '',
        pipeline_id:        PIPELINE_ID,
        stage_id:           props.dealstage,
        stage_name:         STAGE_NAMES[props.dealstage] || props.dealstage,
        faturamento_mensal: check.val,
        deal_amount:        parseFloat(props.amount) || 0,
        rejection_reason:   check.reason,
        hubspot_owner_id:   String(props.hubspot_owner_id || ''),
        created_date:       props.createdate?.split('T')[0] || null
      });
      continue;
    }

    const ownerHistory = item.propertiesWithHistory?.hubspot_owner_id || [];
    const sdrHistory = item.propertiesWithHistory?.sdr_responsavel || [];
    let currentOwnerId = String(props.hubspot_owner_id || '');
    let currentSDRId = String(props.sdr_responsavel || '');

    // Resolve SDR first, if not found, Resolve General Owner
    let ownerInfo = resolveOwner(sdrHistory, currentSDRId);
    if (!ownerInfo) {
       ownerInfo = resolveOwner(ownerHistory, currentOwnerId);
    }
    
    if (!ownerInfo && WON_STAGES.has(props.dealstage)) {
      ownerInfo = resolveOwnerByStage(item.propertiesWithHistory?.dealstage || []);
    }
    if (!ownerInfo) continue;

    const amountVal  = parseFloat(props.amount) || 0;
    const respTimeMs = parseFloat(props.response_time_1_ligacao) || 0;
    
    // Inbound/Outbound: usa campo dedicado `inbound_ou_outbound` se disponível
    // Fallback para hs_analytics_source
    const inboundField = String(props.inbound_ou_outbound || '').toLowerCase();
    let isInbound;
    if (inboundField === 'inbound') {
      isInbound = true;
    } else if (inboundField === 'outbound') {
      isInbound = false;
    } else {
      const src = String(props.hs_analytics_source || props.origem_do_lead || '').toUpperCase();
      isInbound = ['PAID_SOCIAL','PAID_SEARCH','ORGANIC_SEARCH','ORGANIC_SOCIAL',
                   'EMAIL_MARKETING','REFERRALS','INBOUND'].some(k => src.includes(k));
    }

    // Verifica se reunião ocorreu pelo campo dedicado
    const reuniaoOcorrida = props.reuniao_ocorrida === 'true' || props.reuniao_ocorrida === true;

    const stageHistory   = item.propertiesWithHistory?.dealstage || [];
    const stagesToProcess = stageHistory.length > 0
      ? stageHistory
      : [{ value: props.dealstage, timestamp: props.createdate || new Date().toISOString() }];

    const seen = new Set();
    let dealBookedDate = null;   // Data em que foi agendado (para evitar dupla contagem)
    let dealHeldDate   = null;   // Data em que a reunião foi realizada

    for (const stg of stagesToProcess) {
      const stageId = stg.value;
      const mapped  = STAGE_MAP[stageId];
      if (!mapped) continue;

      let dateStr = (stg.timestamp || new Date().toISOString()).split('T')[0];
      if (mapped === 'sales' && props.closedate) {
        dateStr = props.closedate.split('T')[0];
      }
      const rec     = getRecord(dateStr, ownerInfo.name, ownerInfo.role);

      if (mapped === 'sales' && !seen.has('sales')) {
        seen.add('sales');
        rec.sales += 1; rec.revenue += amountVal;
        isInbound ? rec.inbound++ : rec.outbound++;
      } else if (mapped === 'opportunities' && !seen.has('opportunities')) {
        seen.add('opportunities');
        rec.opportunities += 1;
        if (respTimeMs > 0) {
          rec.response_time_sum   += respTimeMs > 10000 ? respTimeMs/60000 : respTimeMs;
          rec.response_time_count += 1;
        }
      } else if (mapped === 'no_shows' && !seen.has('no_shows')) {
        seen.add('no_shows');
        rec.no_shows += 1;
      } else if (mapped === 'meetings_booked' && !dealBookedDate) {
        // Agendado — conta apenas uma vez por deal
        dealBookedDate = dateStr;
        rec.meetings_booked += 1;
      } else if (mapped === 'connections' && !seen.has(`conn_${stageId}`)) {
        seen.add(`conn_${stageId}`);
        rec.connections += 1;
      }

      // Verifica se este estágio implica que a reunião foi realizada
      if (MEETINGS_HELD_STAGES.has(stageId) && !dealHeldDate) {
        dealHeldDate = dateStr;
      }
    }

    // Registra meetings_held: estágio Maturação (ou campo reuniao_ocorrida)
    if (reuniaoOcorrida && !dealHeldDate) {
      dealHeldDate = (props.createdate || new Date().toISOString()).split('T')[0];
    }
    if (dealHeldDate) {
      const rec = getRecord(dealHeldDate, ownerInfo.name, ownerInfo.role);
      rec.meetings_held += 1;
    }
  }

  return { qualified: Object.values(aggregated), rejected };
}

// ── SUPABASE DELETE + INSERT (evita duplicação) ───────────────────────────────

async function supabaseDeletePeriod(table, startDate, endDate) {
  // Delete all rows in the date range to avoid duplicates on re-run
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?date=gte.${startDate}&date=lte.${endDate}`, {
    method: 'DELETE',
    headers: {
      'apikey':       SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ❌ Supabase DELETE error on ${table}: ${res.status}: ${err.substring(0,200)}`);
  }
  return res.status;
}

async function supabaseInsert(table, rows) {
  if (rows.length === 0) return 0;

  // Batch in groups of 50 to respect Supabase limits
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey':       SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal'
      },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ Supabase INSERT error on ${table}: ${res.status}: ${err.substring(0,200)}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

// Keep old name for rejected_leads_log (uses deal_id conflict key via UPSERT)
async function supabaseUpsert(table, rows, conflictCols) {
  if (rows.length === 0) return 0;
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey':       SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  'application/json',
        'Prefer':        `resolution=merge-duplicates,return=minimal`
      },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ Supabase error on ${table}: ${res.status}: ${err.substring(0,200)}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

// ── Garante que dim_team tenha o membro, retorna seu UUID ─────────────────────

async function upsertTeamMember(name, role) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dim_team`, {
    method: 'POST',
    headers: {
      'apikey':       SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify({ name, role })
  });
  if (!res.ok) {
    // Try GET fallback
    const get = await fetch(`${SUPABASE_URL}/rest/v1/dim_team?name=eq.${encodeURIComponent(name)}&select=id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await get.json();
    return data?.[0]?.id || null;
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0]?.id : data?.id;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 RETROATIVO 30 DIAS — HubSpot → Supabase');
  console.log('='.repeat(60));

  const { start, end } = getBRTDateRange();
  console.log(`  Período: ${start} → ${end} (BRT)`);

  // 1. Busca deals
  const deals = await fetchAllDeals(start);

  // 2. Transforma (aplica filtro 70K + atribuição de owner)
  console.log('\n🔄 Transformando dados...');
  const { qualified, rejected } = transformDeals(deals);
  console.log(`  ✅ Qualificados:  ${qualified.length} registros de atividade`);
  console.log(`  ❌ Rejeitados:    ${rejected.length} deals abaixo de 70K`);

  // 3. Monta rows para fact_team_activities
  console.log('\n💾 Salvando fact_team_activities (DELETE + INSERT)...');
  const memberCache = {};
  const activityRows = [];

  for (const rec of qualified) {
    const cacheKey = `${rec.rep_name}|${rec.role}`;
    if (!memberCache[cacheKey]) {
      memberCache[cacheKey] = await upsertTeamMember(rec.rep_name, rec.role);
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

  // DELETE the period first to prevent duplicates, then INSERT fresh
  const deleteStatus = await supabaseDeletePeriod('fact_team_activities', start, end);
  console.log(`  🗑️  Dados do período ${start}→${end} deletados (status: ${deleteStatus})`);
  const savedActivities = await supabaseInsert('fact_team_activities', activityRows);
  console.log(`  ✅ ${savedActivities} registros de atividade salvos!`);

  // 4. Salva leads rejeitados
  if (rejected.length > 0) {
    console.log('\n🚫 Salvando rejected_leads_log...');
    const savedRejected = await supabaseUpsert('rejected_leads_log', rejected, ['deal_id']);
    console.log(`  ✅ ${savedRejected} leads rejeitados registrados.`);
  }

  // 5. Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('✅ RETROATIVO CONCLUÍDO!');
  console.log(`  Período:         ${start} → ${end}`);
  console.log(`  Deals no funil:  ${deals.length}`);
  console.log(`  Qualificados:    ${qualified.length} registros → Supabase`);
  console.log(`  Rejeitados 70K:  ${rejected.length} → rejected_leads_log`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  process.exit(1);
});
