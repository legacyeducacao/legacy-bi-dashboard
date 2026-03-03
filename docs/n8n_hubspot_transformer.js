// =============================================================================
// N8N HubSpot CRM Transformer 
// Extrai Deals e agrupa por Rep/Dia para inserir na tabela fact_daily_sales
// =============================================================================

// Mapeamento de Fases do HubSpot para nossas colunas
// O usuário informou que Deals tem fases como "Vendido" e o Faturamento é a propriedade "amount"
const STAGE_MAP = {
    // Exemplo de mapeamentos que você deve customizar com o nome EXATO das etapas do seu HubSpot
    'agendado': 'meetings_booked',
    'realizado': 'meetings_held',
    'vendido': 'sales',
    'ganho': 'sales',
    'ganho': 'sales',
    'closed won': 'sales',
    '1226813477': 'sales' // Etapa exata informada via JSON
};

const results = {};
let inputItems = [];

// Normaliza a entrada do n8n
if (Array.isArray(items)) {
    for (const item of items) {
        if (item.json) inputItems.push(item.json);
        else inputItems.push(item);
    }
} else {
    inputItems = [items.json || items];
}

inputItems = inputItems.flat();

// Tabela de Vendedores Hardcoded (SDR vs CLOSER)
// O ideal é ler isso de uma API, mas para o painel podemos inferir pelos nomes padrões
function getRepRole(repName) {
    const nameStr = String(repName).toUpperCase();
    // Exemplo genérico: Se tiver SDR no nome é SDR, senão é CLOSER.
    if (nameStr.includes('SDR')) return 'SDR';
    return 'CLOSER';
}

for (const deal of inputItems) {
    if (!deal.properties) continue;

    const props = deal.properties;
    
    // Nomes Padrões do HubSpot:
    // "dealname" -> Nome do Negócio
    // "amount" -> Faturamento / Valor
    // "dealstage" -> Etapa atual
    // "closedate" -> Data de fechamento (Se não tiver, usamos a hs_lastmodifieddate)
    // "hubspot_owner_id" -> ID do dono. (Como não retornou nome na sua query, 
    // precisaremos ou usar o ID no BI, ou o nó HubSpot Owner Info depois).
    
    const dealName = props.dealname?.value || 'Sem Nome';
    const amountVal = parseFloat(props.recent_deal_amount?.value || props.amount?.value) || 0.00;
    const stage = String(props.dealstage?.value || '').toLowerCase();
    
    // Obtendo a Data: Tenta usar Data de Fechamento ou a Data do Dealstage (Timestamp da propriedade)
    let timestampMs = props.dealstage?.timestamp || Date.now();
    
    // Se o hubspot enviar closedate em millis ou formato iso
    if (props.closedate && props.closedate.value) {
       timestampMs = parseInt(props.closedate.value) || new Date(props.closedate.value).getTime();
    }
    
    const dateObj = new Date(timestampMs);
    const dateStr = dateObj.toISOString().split('T')[0]; // Puxa 'YYYY-MM-DD'
    
    // Owner
    let ownerId = props.hubspot_owner_id?.value || 'Sem_Dono';
    let role = getRepRole(ownerId); // Por enquanto usa o ID pra definir
    
    const key = `${dateStr}|${ownerId}|${role}`;
    
    if (!results[key]) {
        results[key] = {
            date: dateStr,
            rep_name: ownerId, // <--- Aqui idealmente viria o Nome do Vendedor ("Lara")
            role: role,
            opportunities: 0,
            connections: 0,
            meetings_booked: 0,
            meetings_held: 0,
            sales: 0,
            revenue: 0.00
        };
    }
    
    // Lógica de Funil baseada na Etapa
    // Sempre conta 1 oportunidade/conexão se o Deal foi atualizado (isso depende muito da sua regra interna!)
    results[key].opportunities += 1;
    
    let mappedColumn = null;
    
    // Encontra em qual "balde" a etapa do Hubspot vai cair
    for (const [hsStage, dbColumn] of Object.entries(STAGE_MAP)) {
        if (stage.includes(hsStage)) {
            mappedColumn = dbColumn;
            break;
        }
    }
    
    // Se for 'vendido', soma a venda e o faturamento
    if (mappedColumn === 'sales') {
        results[key].sales += 1;
        results[key].revenue += amountVal;
    } else if (mappedColumn) {
        // Se for reunião, apenas incrementa o termômetro
        results[key][mappedColumn] += 1;
    }
}

return Object.values(results).map(item => {
    return { json: item };
});
