// Mapeamento Exato de Fases do HubSpot para o Supabase (Extraido via API)
const STAGE_MAP = {
    // --- FUNIL COMERCIAL LEGACY ---
    '1225098146': 'opportunities',   // Entrada
    '1225098147': 'connections',     // Filtro 1
    '1225098148': 'connections',     // Filtro 2
    '1225098149': 'meetings_booked', // Agendado
    '1239126390': 'meetings_booked', // Reagendamento
    '1225098150': 'meetings_held',   // Maturação (Reunião Aconteceu)
    '1225098151': 'meetings_held',   // Negociação
    '1225024929': 'sales',           // Assinatura de Contrato
    '1225098152': 'sales'            // Vendido
};

// --- Mapeamento de Vendedores (Extraído via API) ---
const OWNER_MAP = {
    // SDRs
    '86857769': { name: 'Isaque Inacio', role: 'SDR' },
    '85822345': { name: 'Luan Silva', role: 'SDR' },
    '1856577327': { name: 'Rodrigo Fernandes', role: 'SDR' },
    
    // Closers
    '78938498': { name: 'Leonardo Padilha', role: 'CLOSER' },
    '86362284': { name: 'Leonardo Souza', role: 'CLOSER' },
    '85369712': { name: 'Joel Carlos', role: 'CLOSER' }
};

const results = {};
let inputItems = Array.isArray(items) ? items.flatMap(i => i.json || i) : [items.json || items];

// Desempacotador Inteligente para HTTP Node GET (Tira os leads de dentro de "results")
if (inputItems.length === 1 && inputItems[0].results) {
    inputItems = inputItems[0].results;
} else if (inputItems.some(i => i.results)) {
    inputItems = inputItems.flatMap(i => i.results || [i]);
}

for (const deal of inputItems) {
    if (!deal.properties) continue;
    const props = deal.properties;
    
    // Valor do Negócio
    const amountVal = parseFloat(props.recent_deal_amount?.value || props.amount?.value || props.amount) || 0.00;
    
    // Extrai o Tempo de Resposta (vem do HubSpot em minutos ou ms dependendo da config)
    const responseTimeVal = parseFloat(deal.propertiesWithHistory?.response_time_1_ligacao || props.response_time_1_ligacao?.value || props.response_time_1_ligacao) || 0;

    // Timeline de Estágios do Negócio
    const stageVersions = deal.propertiesWithHistory?.dealstage || props.dealstage?.versions || [ props.dealstage ];
    
    // Timeline de Donos do Negócio
    const ownerVersions = deal.propertiesWithHistory?.hubspot_owner_id || props.hubspot_owner_id?.versions || [ props.hubspot_owner_id ];

    function getOwnerAtTimestamp(targetMs) {
        if (!ownerVersions || ownerVersions.length === 0) return 'Sem_Dono';
        let assignedOwner = ownerVersions[ownerVersions.length - 1]?.value || ownerVersions[ownerVersions.length - 1]; 
        
        for (const ov of ownerVersions) {
            const ovTs = ov.timestamp || 0;
            const ovVal = ov.value || ov;
            if (ovTs <= targetMs) {
                assignedOwner = ovVal;
                break;
            }
        }
        return assignedOwner || 'Sem_Dono';
    }

    const processedStages = new Set();
    const reversedStages = [...stageVersions].reverse();
    
    for (const stg of reversedStages) {
        if (!stg) continue;
        const stgValue = stg.value || stg;
        if (!stgValue) continue;
        
        const stageName = String(stgValue).toLowerCase();
        const stageMs = stg.timestamp ? new Date(stg.timestamp).getTime() : Date.now();
        const dateStr = new Date(stageMs).toISOString().split('T')[0];
        
        const mappedColumn = STAGE_MAP[stageName];
        
        if (!mappedColumn) continue;
        
        // Evita contar o mesmo estágio duplicado para o mesmo Deal
        if (processedStages.has(mappedColumn) && mappedColumn !== 'opportunities') continue;
        processedStages.add(mappedColumn);
        
        const ownerAtThatTime = getOwnerAtTimestamp(stageMs);
        const ownerInfo = OWNER_MAP[ownerAtThatTime] || { name: 'Sem_Dono', role: 'SDR' };
        
        const repName = ownerInfo.name;
        const role = ownerInfo.role;

        // Filtro de Segurança: Ignorar sistema de apoio se configurado assim
        if (repName === 'Sistema_Apoio') continue;

        const key = `${dateStr}|${repName}|${role}`;
        
        if (!results[key]) {
            results[key] = {
                date: dateStr,
                rep_name: repName, 
                role: role,
                opportunities: 0,
                connections: 0,
                meetings_booked: 0,
                meetings_held: 0,
                sales: 0,
                revenue: 0.00,
                response_time_sum: 0,
                response_time_count: 0
            };
        }
        
        if (mappedColumn === 'sales') {
            results[key].sales += 1;
            results[key].revenue += amountVal; 
        } else if (mappedColumn === 'opportunities') {
            results[key].opportunities += 1;
            // Só somamos o tempo de resposta se for > 0
            if (responseTimeVal > 0) {
                results[key].response_time_sum += responseTimeVal;
                results[key].response_time_count += 1;
            }
        } else {
            results[key][mappedColumn] += 1;
        }
    }
}

return Object.values(results).map(item => ({ json: item }));
