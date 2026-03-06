module.exports = function(items) { 
let aggregated = {};
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
    // Para Vendas (WON_STAGES), a data exata deve ser o closedate. Para outros, lastmodified.
    let fallbackTimestamp = props.createdate || new Date().toISOString();
    if (WON_STAGES.has(props.dealstage) && props.closedate) {
        fallbackTimestamp = props.closedate;
    } else if (props.hs_lastmodifieddate) {
        fallbackTimestamp = props.hs_lastmodifieddate;
    }

    const stagesToProcess = stageHistory.length > 0
      ? stageHistory
      : [{ value: props.dealstage, timestamp: fallbackTimestamp }];

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

return Object.values(aggregated);
}