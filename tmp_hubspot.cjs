const HUBSPOT_TOKEN = 'pat-na1-134a4b35-253e-4b87-b9fa-8e6565ad2582';
const pipelineId = '827389965';

async function fetchRecentDeals() {
  try {
    console.log('Fetching recently modified deals from pipeline...');
    let payload = {
        filterGroups: [{
            filters: [
                { propertyName: 'pipeline', operator: 'EQ', value: pipelineId },
            ]
        }],
        sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'DESCENDING' }],
        properties: [
            'dealname', 'dealstage', 'amount', 'hubspot_owner_id', 
            'closedate', 'createdate', 'faturamento_mensal'
        ],
        limit: 15
    };

    const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + HUBSPOT_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.results) {
       console.log('API Error:', JSON.stringify(data, null, 2));
       return;
    }
    
    const deals = data.results;
    console.log('Found ' + deals.length + ' recent deals.');
    deals.forEach(d => {
        console.log('\n--- Deal: ' + d.properties.dealname + ' (' + d.id + ') ---');
        console.log('Stage: ' + d.properties.dealstage);
        console.log('Owner ID: ' + d.properties.hubspot_owner_id);
        console.log('Amount: ' + d.properties.amount);
        console.log('Faturamento Mensal: ' + d.properties.faturamento_mensal);
        console.log('Modified: ' + d.properties.hs_lastmodifieddate);
    });
  } catch (err) {
    console.error('Error fetching deals:', err.message);
  }
}

fetchRecentDeals();
