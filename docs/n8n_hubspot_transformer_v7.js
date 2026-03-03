/**
 * N8N HUBSPOT TRANSFORMER v7.1 (Simplified)
 * Funil Comercial Legacy — Pipeline 827389965
 *
 * MODIFICAÇÃO ATUAL:
 * - Filtro de 70k e leads rejeitados REMOVIDOS temporariamente a pedido.
 * - Correção de "Agendado" (1225098149) mantida: agora mapeia para meetings_booked em vez de sales.
 * - Output volta a ser único (apenas fact_team_activities).
 */

const STAGE_MAP = {
  '1225098146': 'opportunities', // Entrada
  '1225098147': 'connections',   // Filtro 1
  '1225098148': 'connections',   // Filtro 2
  '1225098149': 'meetings_booked', // Agendado (CORRIGIDO)
  '1239126390': 'connections',   // Reagendamento
  '1225098150': 'connections',   // Maturação
  '1225098151': 'connections',   // Negociação
  '1225024929': 'no_shows',      // Assinatura de Contrato
  '1225098152': 'sales',         // Vendido
  '1226813477': 'connections'    // Perdido
};

// Estágios que representam venda realizada (Agendado removido)
const WON_STAGES = new Set(['1225098152']);

// Membros ativos do time
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

// ── FUNÇÕES DE OWNER ─────────────────────────────────────────────────────────

function resolveActiveOwner(ownerHistory, currentOwnerId) {
  const sorted = [...(ownerHistory || [])].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  for (const entry of sorted) {
    if (OWNER_MAP[entry.value]) return OWNER_MAP[entry.value];
  }
  if (OWNER_MAP[currentOwnerId]) return OWNER_MAP[currentOwnerId];
  return null;
}

function resolveOwnerByStageHistory(stageHistory) {
  const sorted = [...(stageHistory || [])].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  for (const entry of sorted) {
    if (!WON_STAGES.has(entry.value)) continue;
    const userId = String(entry.updatedByUserId || '');
    if (OWNER_MAP[userId]) return OWNER_MAP[userId];
  }
  return null;
}

// ── PROCESSAMENTO PRINCIPAL ───────────────────────────────────────────────────

const aggregated = {};

// Normaliza input do n8n
let inputItems = Array.isArray(items)
  ? items.flatMap(i => i.json || i)
  : [items.json || items];

if (inputItems.some(i => i.results)) {
  inputItems = inputItems.flatMap(i => i.results || [i]);
}

function getAggregationKey(date, name) { return `${date}|${name}`; }

function getOrCreateRecord(date, name, role) {
  const key = getAggregationKey(date, name);
  if (!aggregated[key]) {
    aggregated[key] = {
      date, rep_name: name, role,
      opportunities: 0, connections: 0,
      meetings_booked: 0, meetings_held: 0, no_shows: 0,
      sales: 0, revenue: 0.00,
      response_time_sum: 0, response_time_count: 0,
      inbound: 0, outbound: 0
    };
  }
  return aggregated[key];
}

for (const item of inputItems) {
  const props = item.properties || item;

  // ── CASO 1: NEGÓCIO (DEAL) ─────────────────────────────────────────────────
  if (props.dealstage !== undefined) {

    // [REMOVIDA A LÓGICA DE QUALIFICAÇÃO DE RECEITA AQUI]
    // Todos os deals passam direto agora

    const currentOwnerId = String(props.hubspot_owner_id || '');
    const ownerHistory   = item.propertiesWithHistory?.hubspot_owner_id || [];

    let ownerInfo = resolveActiveOwner(ownerHistory, currentOwnerId);

    if (!ownerInfo && WON_STAGES.has(props.dealstage)) {
      const stageHistory = item.propertiesWithHistory?.dealstage || [];
      ownerInfo = resolveOwnerByStageHistory(stageHistory);
    }

    if (!ownerInfo) continue; // Sem membro ativo identificável → ignora

    const amountVal  = parseFloat(props.amount) || 0;
    const respTimeMs = parseFloat(props.response_time_1_ligacao) || 0;

    const src = String(
      props.hs_analytics_source || props.origem_do_lead || ''
    ).toUpperCase();
    const isInbound = ['PAID_SOCIAL', 'PAID_SEARCH', 'ORGANIC_SEARCH',
                       'ORGANIC_SOCIAL', 'EMAIL_MARKETING', 'REFERRALS',
                       'INBOUND'].some(k => src.includes(k));

    const stageHistory = item.propertiesWithHistory?.dealstage || [];
    const stagesToProcess = stageHistory.length > 0
      ? stageHistory
      : [{ value: props.dealstage, timestamp: props.createdate || new Date().toISOString() }];

    const processed = new Set();

    for (const stg of stagesToProcess) {
      const mapped = STAGE_MAP[stg.value];
      if (!mapped) continue;
      if (processed.has(mapped) && mapped !== 'opportunities') continue;
      processed.add(mapped);

      const dateStr = (stg.timestamp || new Date().toISOString()).split('T')[0];
      const record  = getOrCreateRecord(dateStr, ownerInfo.name, ownerInfo.role);

      if (mapped === 'sales') {
        record.sales   += 1;
        record.revenue += amountVal;
      } else if (mapped === 'opportunities') {
        record.opportunities += 1;
        if (respTimeMs > 0) {
          record.response_time_sum   += respTimeMs > 10000 ? respTimeMs / 60000 : respTimeMs;
          record.response_time_count += 1;
        }
        if (isInbound) record.inbound  += 1;
        else           record.outbound += 1;
      } else if (mapped === 'no_shows') {
        record.no_shows += 1;
      } else if (mapped === 'meetings_booked') {
        record.meetings_booked += 1;
      } else {
        record[mapped] += 1;
      }
    }
  }

  // ── CASO 2: REUNIÃO (MEETING) ──────────────────────────────────────────────
  else if (
    props.hs_meeting_start_time ||
    props.hs_meeting_outcome !== undefined ||
    item.type === 'MEETING'
  ) {
    const closerId   = String(props.hubspot_owner_id || '');
    const bookedById = String(props.hs_created_by || props.hubspot_owner_id || '');

    const closerInfo = OWNER_MAP[closerId];
    const bookerInfo = OWNER_MAP[bookedById];

    if (bookerInfo) {
      const bookedDate = (props.hs_createdate || new Date().toISOString()).split('T')[0];
      getOrCreateRecord(bookedDate, bookerInfo.name, bookerInfo.role).meetings_booked += 1;
    }

    const ownerForResult = closerInfo || bookerInfo;
    if (!ownerForResult) continue;

    const startTs   = props.hs_meeting_start_time || props.hs_createdate || new Date().toISOString();
    const startDate = new Date(startTs).toISOString().split('T')[0];
    const outcome   = String(props.hs_meeting_outcome || '').toUpperCase();

    const rec = getOrCreateRecord(startDate, ownerForResult.name, ownerForResult.role);
    if (['COMPLETED', 'BUSY', 'REALIZADA'].includes(outcome)) {
      rec.meetings_held += 1;
    } else if (['NO_SHOW', 'CANCELLED', 'NO_SHOW_SCHEDULED', 'CANCELED'].includes(outcome)) {
      rec.no_shows += 1;
    } else if (new Date(startTs) < new Date() && outcome === '') {
      rec.meetings_held += 1;
    }
  }
}

// ── OUTPUT ÚNICO (COMPATÍVEL COM N8N ATUAL) ──────────────────────────────────
return Object.values(aggregated).map(item => ({ json: item }));
