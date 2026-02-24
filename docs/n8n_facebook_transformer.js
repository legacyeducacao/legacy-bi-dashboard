// Mapeamento de Produtos (Nome na Campanha -> Nome no Banco/dim_products)
const PRODUCT_MAP = {
  'Executoria': 'Mentoria',
  'Inteligência Empresarial': 'Consultoria',
  'Imersão': 'Imersão',
  'Curso': 'Curso Online'
};

// Input esperado: array de objetos do Facebook (conforme colado pelo usuário)
// O N8N pode passar multiplos itens. Vamos iterar sobre todos.
const results = {}; // Mudado para Objeto para facilitar agrupamento

// Helper para normalizar o input (pode vir de várias formas no N8N)
let inputItems = [];

// Caso 1: Array direto de items (padrão N8N quando vem do webhook body)
if (Array.isArray(items)) {
    // Verifica se os items tem uma propriedade 'json' que é array ou objeto
    for (const item of items) {
        if (item.json) {
            if (Array.isArray(item.json)) {
                // Caso: item.json = [ {campaign...}, {campaign...} ]
                inputItems.push(...item.json);
            } else if (item.json.data && Array.isArray(item.json.data)) {
                 // Caso: item.json = { data: [ ... ] }
                 inputItems.push(...item.json.data);
            } else {
                // Caso: item.json = { campaign... } (um único objeto)
                inputItems.push(item.json);
            }
        } else {
            // Caso items seja o array de dados cru (raro no n8n, mas possível em testes)
            inputItems.push(item);
        }
    }
} else {
    // Caso items seja um único objeto
    if (items.json) {
         if (Array.isArray(items.json)) inputItems = items.json;
         else inputItems = [items.json];
    } else {
        inputItems = [items];
    }
}

// Achata arrays aninhados se houver (ex: output do HTTP Request as vezes é [[...]])
inputItems = inputItems.flat();

for (const ad of inputItems) {
    if (!ad || !ad.campaign_name) continue; // Pula itens vazios/inválidos

    const date = ad.date_start;
    const campaignName = ad.campaign_name;
    
    // 1. Extrair Métricas Básicas
    const cost = parseFloat(ad.spend) || 0;
    const impressions = parseInt(ad.impressions) || 0;
    // Clicks geralmente vem em 'clicks' ou dentro de actions 'link_click'
    // No JSON de exemplo, tem 'link_click' em actions. Vamos tentar pegar de lá se não tiver na raiz.
    let clicks = parseInt(ad.clicks) || 0;

    // 2. Processar Actions para Leads e Clicks
    let leads = 0;
    if (ad.actions && Array.isArray(ad.actions)) {
      
      // Clicks (se não veio na raiz)
      if (clicks === 0) {
          const clickAction = ad.actions.find(a => a.action_type === 'link_click');
          if (clickAction) clicks = parseInt(clickAction.value) || 0;
      }

      // Leads: Soma de vários tipos de conversão que representam leads
      // Ajuste conforme seus eventos de conversão reais
      const leadActionTypes = [
          'lead', 
          'offsite_conversion.fb_pixel_lead', 
          'offsite_complete_registration_add_meta_leads',
          'onsite_conversion.lead_grouped',
          'offsite_conversion.fb_pixel_custom' // Atenção: verificar se todo custom pixel é lead
      ];

      // Para evitar duplicidade (ex: lead + lead_grouped reportando o mesmo evento),
      // o ideal é pegar o mais confiável ou o totalizador.
      // Neste exemplo, vou priorizar 'lead' ou 'offsite_complete_registration' ou 'onsite_conversion.lead_grouped'
      // O Facebook as vezes reporta o mesmo evento com nomes diferentes.
      // Vamos somar com cuidado. 
      // Estratégia segura: Pegar o maior valor entre 'lead' e os outros específicos, ou somar se forem canais diferentes.
      // Dado o JSON, 'lead' parece ser um totalizador ou 'lead_grouped'.
      
      const leadObj = ad.actions.find(a => a.action_type === 'lead');
      const leadGrouped = ad.actions.find(a => a.action_type === 'onsite_conversion.lead_grouped');
      const offsiteRegistration = ad.actions.find(a => a.action_type === 'offsite_complete_registration_add_meta_leads');
      
      // Tenta pegar o valor mais alto que representa o total de leads
      let maxLeads = 0;
      if (leadObj) maxLeads = Math.max(maxLeads, parseInt(leadObj.value));
      if (leadGrouped) maxLeads = Math.max(maxLeads, parseInt(leadGrouped.value));
      // Se offsite for maior que onsite, pode ser que o pixel pegou mais.
      // Simples: se tiver 'lead', usa, senão tenta os outros.
      
      if (maxLeads > 0) {
          leads = maxLeads;
      } else {
           if (offsiteRegistration) leads = parseInt(offsiteRegistration.value);
      }
    }

    // 3. Determinar Produto pelo Nome da Campanha
    let productName = 'Institucional'; // Default se não der match
    for (const [key, value] of Object.entries(PRODUCT_MAP)) {
      if (campaignName.toLowerCase().includes(key.toLowerCase())) {
        productName = value;
        break;
      }
    }

    // 4. Montar objeto intermediário
    const key = `${date}|${productName}`; // Chave de Agrupamento

    if (!results[key]) {
        results[key] = {
            date: date,
            channel_name: 'Meta Ads',
            product_name: productName,
            cost: 0,
            impressions: 0,
            clicks: 0,
            leads: 0,
            campaign_names: [] // Apenas para debug/referência
        };
    }

    // Somar métricas
    results[key].cost += cost;
    results[key].impressions += impressions;
    results[key].clicks += clicks;
    results[key].leads += leads;
    results[key].campaign_names.push(campaignName);
}

// Transformar objeto de volta em array para o N8N
const finalOutput = Object.values(results).map(item => {
    // Arredondar custo para 2 casas decimais
    item.cost = Math.round(item.cost * 100) / 100;
    return { json: item };
});

return finalOutput;
