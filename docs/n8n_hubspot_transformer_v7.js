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
  '1239126390': 'meetings_booked', // Reagendamento (CONTABILIZAR COMO AGENDADO)
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

// ── FUNÇÕES AUXILIARES DE DATA ────────────────────────────────────────────────
function safeDate(timestamp) {
  if (!timestamp) return new Date().toISOString();
  if (!isNaN(timestamp)) return new Date(Number(timestamp)).toISOString();
  try {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch(e) {
    return new Date().toISOString();
  }
}

// ── DATA DE HOJE (BASEADA NO FUSO SÃO PAULO) ──────────────────────────────────
const todayStr = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}).split(',')[0];
// formata pra YYYY-MM-DD
const [month, day, year] = todayStr.split('/');
const strToday = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

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
    
    // Melhoria para Live Webhooks sem propertiesWithHistory:
    // Se não tivermos o histórico do estágio, a data do evento atual não é a data de criação.
    let fallbackTimestamp = props.createdate || new Date().toISOString();
    
    // Mapeamento de propriedades sistêmicas de entrada em estágio (evita usar lastmodified erro)
    const ENTRY_DATE_PROPS = {
        '1225098146': 'hs_v2_date_entered_1225098146', // Entrada
        '1225098147': 'hs_v2_date_entered_1225098147', // Filtro 1
        '1225098148': 'hs_v2_date_entered_1225098148', // Filtro 2
        '1225098149': 'hs_v2_date_entered_1225098149', // Agendado
        '1239126390': 'hs_v2_date_entered_1239126390'  // Reagendamento
    };

    if (ENTRY_DATE_PROPS[props.dealstage] && props[ENTRY_DATE_PROPS[props.dealstage]]) {
        // [FIX DUPLICAÇÃO] Se o N8N não tem history, usa a data exata em que entrou no estágio alvo!
        fallbackTimestamp = props[ENTRY_DATE_PROPS[props.dealstage]];
    } else if (WON_STAGES.has(props.dealstage) && props.closedate) {
        fallbackTimestamp = props.closedate;
    } else if (props.hs_lastmodifieddate) {
        fallbackTimestamp = props.hs_lastmodifieddate;
    }

    let stagesToProcess = [...stageHistory];

    // [SYNTHETIC HISTORY] Se não temos histórico formal (ex: script de sync ou webhook simples), 
    // tentamos gerar a partir das propriedades de data de entrada dos estágios.
    if (stagesToProcess.length === 0) {
        Object.entries(ENTRY_DATE_PROPS).forEach(([stageId, propName]) => {
            if (props[propName]) {
                stagesToProcess.push({ value: stageId, timestamp: props[propName] });
            }
        });
        // Se ainda vazio, fallback mínimo (estágio atual)
        if (stagesToProcess.length === 0) {
            stagesToProcess.push({ value: props.dealstage, timestamp: fallbackTimestamp });
        }
    }

    const processed = new Set();

    for (const stg of stagesToProcess) {
      const mapped = STAGE_MAP[stg.value];
      if (!mapped) continue;
      if (processed.has(mapped) && mapped !== 'opportunities' && mapped !== 'meetings_booked') continue;
      processed.add(mapped);

      // We extract the date strictly from the deal stage history timestamp to avoid dumping past events into "today"
      const dateStr = safeDate(stg.timestamp).split('T')[0];
      const entryDate = dateStr; // for legacy compatibility if needed in this block
      // [NOVA REGRA DE SDR] Se a métrica é Agendamento e o campo SDR Responsável existe, o crédito é cravado nele!
      let metricOwnerInfo = ownerInfo;
      if (mapped === 'meetings_booked') {
          const sdrInProp = props.sdr_responsavel ? OWNER_MAP[props.sdr_responsavel] : null;
          if (sdrInProp && sdrInProp.role === 'SDR') {
              metricOwnerInfo = sdrInProp;
          } else if (ownerInfo.role !== 'SDR') {
              // Se não tem SDR no campo E o dono atual é Closer -> ignoramos esse agendamento do ranking de SDR
              continue; 
          }
      }

      const record  = getOrCreateRecord(dateStr, metricOwnerInfo.name, metricOwnerInfo.role);

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
      // Se agendado, a data em que foi agendado normalmente é strToday se considerarmos o momento da ação, ou a data de criação.
      // Para garantir que apareça nas métricas de HOJE (quando o hook roda), contabilizamos no strToday.
      const bookedDateStr = props.hs_createdate ? safeDate(props.hs_createdate).split('T')[0] : strToday;
      // [FIX DUPLICAÇÃO] - Comentando o incremento de meetings_booked aqui, pois ele já é contado 
      // na transição de estágio do negócio (1225098149 = 'meetings_booked').
      // getOrCreateRecord(bookedDateStr === strToday ? strToday : bookedDateStr, bookerInfo.name, bookerInfo.role).meetings_booked += 1;
    }

    const ownerForResult = closerInfo || bookerInfo;
    if (!ownerForResult) continue;

    const startTs   = props.hs_meeting_start_time || props.hs_createdate || new Date().toISOString();
    // Usa strToday se o report for consolidar ações diárias no webhook, garantindo que "reuniões dadas como realizadas HOJE" entrem na meta de HOJE.
    // Assim não perdemos reuniões do passado que o vendedor só marcou como concluída hoje.
    const startDate = strToday;
    const outcome   = String(props.hs_meeting_outcome || '').toUpperCase();

    const rec = getOrCreateRecord(startDate, ownerForResult.name, ownerForResult.role);
    if (['COMPLETED', 'BUSY', 'REALIZADA'].includes(outcome)) {
      rec.meetings_held += 1;
    } else if (['NO_SHOW', 'CANCELLED', 'NO_SHOW_SCHEDULED', 'CANCELED'].includes(outcome)) {
      rec.no_shows += 1;
    } else if (new Date(safeDate(startTs)) < new Date() && outcome === '') {
      rec.meetings_held += 1;
    }
  }
}

// ── OUTPUT ÚNICO (COMPATÍVEL COM N8N ATUAL) ──────────────────────────────────
// Filtra apenas para o dia de hoje, já que o gatilho traz negócios que podem 
// ter histórico de 2025/2024 mas que só queremos reportar as métricas de HOJE.

return Object.values(aggregated)
  .filter(item => item.date === strToday)
  .map(item => ({ json: item }));
