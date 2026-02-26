// =============================================================================
// N8N Meta Ads Transformer - Versão 2.1
// Convenção de nome de campanha: {numero} - [{Produto}] - [segmento] - ...
// Exemplo: "075 - [Legado] - [CAD] - [CBO] - Formulário Nativo [FLN]"
// =============================================================================

/**
 * Extrai o nome do produto do nome da campanha.
 * Regras (em ordem de prioridade):
 * 1. Primeiro colchete após o número inicial: "075 - [Legado] - ..." → "Legado"
 * 2. Qualquer [conteúdo] no nome da campanha (primeiro match)
 * 3. Fallback: 'Institucional'
 */
function extractProductName(campaignName) {
  if (!campaignName) return 'Institucional';

  // Padrão principal: número(s) + hífen + [Produto]
  // Ex: "075 - [Legado] - ..." ou "12 - [Impulsão] ..."
  const mainPattern = /^\d+\s*[-–]\s*\[([^\]]+)\]/;
  const mainMatch = campaignName.match(mainPattern);
  if (mainMatch) return mainMatch[1].trim();

  // Fallback: qualquer [conteúdo] no nome (pega o primeiro)
  const anyBracket = /\[([^\]]+)\]/;
  const bracketMatch = campaignName.match(anyBracket);
  if (bracketMatch) {
    const val = bracketMatch[1].trim();
    // Ignora siglas curtas (3 letras ou menos) como [CAD], [CBO], [FLN]
    if (val.length > 3) return val;
  }

  return 'Institucional';
}

// =============================================================================
// Processamento principal
// =============================================================================

const results = {};
let inputItems = [];

if (Array.isArray(items)) {
    for (const item of items) {
        if (item.json) {
            if (Array.isArray(item.json)) inputItems.push(...item.json);
            else if (item.json.data && Array.isArray(item.json.data)) inputItems.push(...item.json.data);
            else inputItems.push(item.json);
        } else {
            inputItems.push(item);
        }
    }
} else {
    if (items.json) {
        if (Array.isArray(items.json)) inputItems = items.json;
        else inputItems = [items.json];
    } else {
        inputItems = [items];
    }
}

inputItems = inputItems.flat();

for (const ad of inputItems) {
    if (!ad || !ad.campaign_name) continue;

    const date = ad.date_start;
    const campaignName = ad.campaign_name;

    // Extrai produto pela convenção de nomenclatura
    const productName = extractProductName(campaignName);

    // Métricas básicas
    const cost = parseFloat(ad.spend) || 0;
    const impressions = parseInt(ad.impressions) || 0;
    let clicks = parseInt(ad.clicks) || 0;

    // Extrai leads das actions
    let leads = 0;
    let mqls = 0; // Inicializa MQLs
    if (ad.actions && Array.isArray(ad.actions)) {
        if (clicks === 0) {
            const clickAction = ad.actions.find(a => a.action_type === 'link_click');
            if (clickAction) clicks = parseInt(clickAction.value) || 0;
        }

        // Fontes de lead e MQL
        const leadObj      = ad.actions.find(a => a.action_type === 'lead');
        const leadGrouped  = ad.actions.find(a => a.action_type === 'onsite_conversion.lead_grouped');
        const offsiteReg   = ad.actions.find(a => a.action_type === 'offsite_complete_registration_add_meta_leads');
        const pixelCustom  = ad.actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_custom');
        
        // MQLs: Leads Nativos são MQLs automáticos (para Legado)
        // Procuramos também por conversões personalizadas que contenham 'mql'
        const mqlActions = ad.actions.filter(a => 
            a.action_type.toLowerCase().includes('mql') || 
            a.action_type.toLowerCase().includes('qualified')
        );

        let nativeMqls = 0;
        if (leadObj)     nativeMqls = Math.max(nativeMqls, parseInt(leadObj.value) || 0);
        if (leadGrouped) nativeMqls = Math.max(nativeMqls, parseInt(leadGrouped.value) || 0);

        let customMqls = 0;
        mqlActions.forEach(a => {
            // Evita somar lead nativo de novo se ele tiver 'mql' no nome (raro, mas segurança)
            if (a.action_type !== 'lead' && a.action_type !== 'onsite_conversion.lead_grouped') {
                customMqls += parseInt(a.value) || 0;
            }
        });

        // Pega o maior valor entre os eventos primários de leads (evita dupla contagem)
        let maxLeads = 0;
        if (leadObj)     maxLeads = Math.max(maxLeads, parseInt(leadObj.value)    || 0);
        if (leadGrouped) maxLeads = Math.max(maxLeads, parseInt(leadGrouped.value)|| 0);

        if (maxLeads > 0) {
            leads = maxLeads;
        } else if (offsiteReg) {
            leads = parseInt(offsiteReg.value) || 0;
        } else if (pixelCustom) {
            leads = parseInt(pixelCustom.value) || 0;
        }

        // MQL Logic: Todo formulário nativo é MQL automáticamente (Leads e MQLs iguais)
        // Para Lead Web, mqls vem apenas de conversões personalizadas que contenham 'mql' no nome
        const normalizedCampaign = campaignName.toLowerCase();
        const isNative = normalizedCampaign.includes('nativo');
        
        if (isNative) {
            mqls = leads;
        } else {
            mqls = customMqls;
        }
    }


    // Agrupa por data + campanha para manter granularidade total
    const key = `${date}|${campaignName}`;
    
    if (!results[key]) {
        results[key] = {
            date,
            channel_name: 'Meta Ads',
            product_name: productName,
            campaign_name: campaignName,
            cost: 0,
            impressions: 0,
            clicks: 0,
            leads: 0,
            mqls: 0
        };
    }

    results[key].cost += cost;
    results[key].impressions += impressions;
    results[key].clicks += clicks;
    results[key].leads += leads;
    results[key].mqls += mqls;
}

// Formata output para o N8N
return Object.values(results).map(item => {
    item.cost = Math.round(item.cost * 100) / 100;
    return { json: item };
});
