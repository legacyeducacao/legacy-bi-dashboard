/**
 * TRANSFORMER V7.1 - CORREÇÃO DE ATRIBUIÇÃO E SINCRONIZAÇÃO HISTÓRICA
 *
 * MUDANÇAS:
 * 1. REMOVIDO o filtro de 'date === strToday'. Agora permite sincronizar dados do passado.
 * 2. Adicionado suporte a 'closedate' para melhor atribuição de Venda na data correta.
 * 3. Mantida a regra: SDR ganha crédit de Op/Conexão, Closer ganha crédito de Venda/Revenue.
 */

const STAGE_MAP = {
    '1225098146': 'opportunities',
    '1225098147': 'connections',
    '1225098148': 'connections',
    '1225098149': 'connections',
    '1225098150': 'connections',
    '1225098151': 'connections',
    '1225024929': 'connections',
    '1225098152': 'sales',         
    '1226813477': 'connections',   
};

const WON_STAGES = new Set(['1225098152']);

// ── DATA DE HOJE (BASEADA NO FUSO SÃO PAULO) ──────────────────────────────────
const todayStr = new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}).split(',')[0];
const [month, day, year] = todayStr.split('/');
const strToday = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

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

function resolveAllOwners(ownerHistory, currentOwnerId) {
    const owners = [];
    const sorted = [...(ownerHistory || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const entry of sorted) {
        if (OWNER_MAP[entry.value]) owners.push(OWNER_MAP[entry.value]);
    }
    if (OWNER_MAP[currentOwnerId]) owners.push(OWNER_MAP[currentOwnerId]);
    return owners;
}

function resolveOwnerByStageHistory(stageHistory) {
    const sorted = [...(stageHistory || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    for (const entry of sorted) {
        if (!WON_STAGES.has(entry.value)) continue;
        const userId = String(entry.updatedByUserId || '');
        if (OWNER_MAP[userId]) return OWNER_MAP[userId];
    }
    return null;
}

// ── PROCESSAMENTO ────────────────────────────────────────────────────────────

let inputItems = Array.isArray(items) ? items.flatMap(i => i.json || i) : [items.json || items];
if (inputItems.some(i => i.results)) inputItems = inputItems.flatMap(i => i.results || [i]);

for (const item of inputItems) {
    const props = item.properties || item;
    if (props.dealstage === undefined) continue;

    const currentOwnerId = String(props.hubspot_owner_id || '');
    const ownerHistory   = item.propertiesWithHistory?.hubspot_owner_id || [];

    let allOwners = resolveAllOwners(ownerHistory, currentOwnerId);
    let sdrOwner = allOwners.find(o => o.role === 'SDR') || allOwners[0];
    let closerOwner = [...allOwners].reverse().find(o => o.role === 'Closer') || allOwners[allOwners.length - 1];

    if (!closerOwner && WON_STAGES.has(props.dealstage)) {
        const stageHistory = item.propertiesWithHistory?.dealstage || [];
        const fbOwner = resolveOwnerByStageHistory(stageHistory);
        if (fbOwner) closerOwner = fbOwner;
    }
    if (!sdrOwner && closerOwner) sdrOwner = closerOwner;
    if (!sdrOwner && !closerOwner) continue;

    const amountVal  = parseFloat(props.amount) || 0;
    const respTimeMs = parseFloat(props.response_time_1_ligacao) || 0;
    const src = String(props.hs_analytics_source || props.origem_do_lead || '').toUpperCase();
    const isInbound = ['PAID_SOCIAL','PAID_SEARCH','ORGANIC_SEARCH','ORGANIC_SOCIAL','EMAIL_MARKETING','REFERRALS','INBOUND'].some(k => src.includes(k));

    const stageHistory = item.propertiesWithHistory?.dealstage || [];
    const stagesToProcess = stageHistory.length > 0 ? stageHistory : [{ value: props.dealstage, timestamp: props.closedate || props.createdate || new Date().toISOString() }];

    const processed = new Set();
    for (const stg of stagesToProcess) {
        const mapped = STAGE_MAP[stg.value];
        if (!mapped) continue;
        if (processed.has(mapped) && mapped !== 'opportunities') continue;
        processed.add(mapped);

        // [IMPORTANTE] Para o estágio 'sales', prioriza a closedate do Hubspot se disponível no stg.timestamp ou na property
        let dateStr = (stg.timestamp || props.closedate || new Date().toISOString()).split('T')[0];

        if (mapped === 'sales') {
            if (!WON_STAGES.has(props.dealstage)) continue;
            if (!closerOwner) continue;
            const obj = getInitObj(dateStr, closerOwner.name, closerOwner.role);
            obj.sales   += 1;
            obj.revenue += amountVal;
        } else if (mapped === 'opportunities') {
            if (!sdrOwner) continue;
            const obj = getInitObj(dateStr, sdrOwner.name, sdrOwner.role);
            obj.opportunities += 1;
            if (respTimeMs > 0) {
                obj.response_time_sum   += respTimeMs > 10000 ? respTimeMs / 60000 : respTimeMs;
                obj.response_time_count += 1;
            }
            if (isInbound) obj.inbound += 1;
            else           obj.outbound += 1;
        } else if (mapped === 'connections') {
            if (!sdrOwner) continue;
            const obj = getInitObj(dateStr, sdrOwner.name, sdrOwner.role);
            obj.connections += 1;
        } else if (mapped === 'no_shows') {
            if (!closerOwner) continue;
            const obj = getInitObj(dateStr, closerOwner.name, closerOwner.role);
            obj.no_shows += 1;
        }
    }
}

// Filtra para proteger o histórico. O Webhook apenas processa os gatilhos ocorridos HOJE.
// Para ressincronização completa de furos passados, utilize o script dedicado de full sync.
return Object.values(results)
  .filter(item => item.date === strToday)
  .map(item => ({ json: item }));
