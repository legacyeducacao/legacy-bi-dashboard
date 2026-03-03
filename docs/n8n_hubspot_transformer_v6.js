/**
 * TRANSFORMER V6.4 - ATRIBUIÇÃO INTELIGENTE DE DONO
 *
 * PROBLEMA RESOLVIDO:
 * Negócios entram no HubSpot com dono "2011790555" (automação) e
 * depois são reatribuídos para um SDR ativo. A versão anterior
 * descartava esses negócios porque o dono no momento da "Triagem"
 * era inválido.
 *
 * SOLUÇÃO:
 * Para cada negócio, encontra o DONO VÁLIDO MAIS RECENTE no histórico
 * (ou seja, o último membro ativo que ficou responsável).
 * Esse dono recebe o crédito por TODOS os estágios do negócio.
 */

// ── CONFIGURAÇÕES ────────────────────────────────────────────────────────────

const STAGE_MAP = {
    '1225098146': 'opportunities', // Triagem
    '1225098147': 'connections',   // Diagnóstico
    '1225098148': 'connections',   // Apresentação
    '1225098149': 'sales',         // Fechamento (Venda 11)
    '1225098150': 'connections',   // Contrato
    '1239126390': 'sales',         // Faturamento
    '1225098152': 'sales',         // Pago / Ganho
    '1226813477': 'connections',   // Ganho / Won (Dirty/Automated bot)
    '1225024929': 'no_shows'       // Perda
};

// Estágios que representam venda real (para fallback de owner)
const WON_STAGES = new Set(['1225098152', '1239126390', '1225098149']);

// 6 membros ativos (apenas eles aparecem no BI)
// IMPORTANTE: role deve ser 'Closer' ou 'SDR' — conforme o check constraint dim_team_role_check
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

// ── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────────

const results = {};

function getInitObj(date, name, role) {
    const key = `${date}|${name}`;
    if (!results[key]) {
        results[key] = {
            date, rep_name: name, role,
            opportunities: 0, connections: 0,
            meetings_booked: 0, meetings_held: 0, no_shows: 0,
            sales: 0, revenue: 0.00,
            response_time_sum: 0, response_time_count: 0,
            inbound: 0, outbound: 0
        };
    }
    return results[key];
}

/**
 * Retorna o membro ativo mais recente do histórico de owners.
 * Se nenhum histórico existir, usa o owner atual da propriedade.
 */
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

/**
 * Fallback para deals ganhos com owner da automação.
 * Procura quem moveu o deal para um estágio Won via updatedByUserId.
 */
function resolveOwnerByStageHistory(stageHistory) {
    // Ordena do mais recente para o mais antigo
    const sorted = [...(stageHistory || [])].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    for (const entry of sorted) {
        if (!WON_STAGES.has(entry.value)) continue;
        // updatedByUserId é quem manualmente moveu o deal para Won
        const userId = String(entry.updatedByUserId || '');
        if (OWNER_MAP[userId]) return OWNER_MAP[userId];
    }
    return null;
}

// ── PROCESSAMENTO ────────────────────────────────────────────────────────────

let inputItems = Array.isArray(items)
    ? items.flatMap(i => i.json || i)
    : [items.json || items];

// Desempacota resultado de nó Batch/Search
if (inputItems.some(i => i.results)) {
    inputItems = inputItems.flatMap(i => i.results || [i]);
}

for (const item of inputItems) {
    const props = item.properties || item;

    // ── CASO 1: NEGÓCIO (DEAL) ────────────────────────────────────────────
    if (props.dealstage !== undefined) {
        const currentOwnerId = String(props.hubspot_owner_id || '');
        const ownerHistory   = item.propertiesWithHistory?.hubspot_owner_id || [];

        // Encontra o membro ativo que ficou responsável pelo deal
        let ownerInfo = resolveActiveOwner(ownerHistory, currentOwnerId);

        // Fallback: para deals ganhos com owner da automação,
        // usa quem moveu o deal para o estágio Won no histórico de estágios
        if (!ownerInfo && WON_STAGES.has(props.dealstage)) {
            const stageHistory = item.propertiesWithHistory?.dealstage || [];
            ownerInfo = resolveOwnerByStageHistory(stageHistory);
        }

        if (!ownerInfo) continue; // Nenhum membro ativo envolvido → ignora

        const amountVal  = parseFloat(props.amount) || 0;
        const respTimeMs = parseFloat(props.response_time_1_ligacao) || 0;

        // Inbound / Outbound
        const src = String(
            props.hs_analytics_source || props.origem_do_lead || ''
        ).toUpperCase();
        const isInbound = ['PAID_SOCIAL', 'PAID_SEARCH', 'ORGANIC_SEARCH',
                           'ORGANIC_SOCIAL', 'EMAIL_MARKETING', 'REFERRALS',
                           'INBOUND'].some(k => src.includes(k));

        const stageHistory = item.propertiesWithHistory?.dealstage || [];

        // Se não houver histórico de estágios, usa propriedade atual
        const stagesToProcess = stageHistory.length > 0
            ? stageHistory
            : [{ value: props.dealstage, timestamp: props.createdate || new Date().toISOString() }];

        const processed = new Set();

        for (const stg of stagesToProcess) {
            const mapped = STAGE_MAP[stg.value];
            if (!mapped) continue;
            // Conta connections/no_shows só uma vez por deal
            if (processed.has(mapped) && mapped !== 'opportunities') continue;
            processed.add(mapped);

            const dateStr = (stg.timestamp || new Date().toISOString()).split('T')[0];
            const obj = getInitObj(dateStr, ownerInfo.name, ownerInfo.role);

            if (mapped === 'sales') {
                obj.sales   += 1;
                obj.revenue += amountVal;
            } else if (mapped === 'opportunities') {
                obj.opportunities += 1;
                if (respTimeMs > 0) {
                    // Converte ms → minutos (guard: se > 10.000 assume ms)
                    obj.response_time_sum   += respTimeMs > 10000 ? respTimeMs / 60000 : respTimeMs;
                    obj.response_time_count += 1;
                }
                if (isInbound) obj.inbound += 1;
                else           obj.outbound += 1;
            } else if (mapped === 'no_shows') {
                obj.no_shows += 1;
            } else {
                // connections
                obj[mapped] += 1;
            }
        }
    }

    // ── CASO 2: REUNIÃO (MEETING) ─────────────────────────────────────────
    // SDR agenda (hs_created_by) → meetings_booked
    // CLOSER conduz (hubspot_owner_id) → meetings_held / no_shows
    else if (
        props.hs_meeting_start_time ||
        props.hs_meeting_outcome !== undefined ||
        item.type === 'MEETING'
    ) {
        const closerId   = String(props.hubspot_owner_id || '');
        const bookedById = String(props.hs_created_by   || props.hubspot_owner_id || '');

        const closerInfo = OWNER_MAP[closerId];
        const bookerInfo = OWNER_MAP[bookedById];

        // Reuniões agendadas — crédito para o SDR que agendou
        if (bookerInfo) {
            const bookedDate = (props.hs_createdate || new Date().toISOString()).split('T')[0];
            getInitObj(bookedDate, bookerInfo.name, bookerInfo.role).meetings_booked += 1;
        }

        // Resultado da reunião — crédito para o CLOSER que conduziu
        const ownerForResult = closerInfo || bookerInfo;
        if (!ownerForResult) continue;

        const startTs   = props.hs_meeting_start_time || props.hs_createdate || new Date().toISOString();
        const startDate = new Date(startTs).toISOString().split('T')[0];
        const outcome   = String(props.hs_meeting_outcome || '').toUpperCase();

        const objH = getInitObj(startDate, ownerForResult.name, ownerForResult.role);
        if (['COMPLETED', 'BUSY', 'REALIZADA'].includes(outcome)) {
            objH.meetings_held += 1;
        } else if (['NO_SHOW', 'CANCELLED', 'NO_SHOW_SCHEDULED', 'CANCELED'].includes(outcome)) {
            objH.no_shows += 1;
        } else if (new Date(startTs) < new Date() && outcome === '') {
            objH.meetings_held += 1;
        }
    }
}

return Object.values(results).map(item => ({ json: item }));
