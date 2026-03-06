const axios = require('axios');
const HUBSPOT_TOKEN = 'pat-na1-01f2fe96-3c22-487c-a444-c78ca1496a75';
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
        limit: 10
    };

    const res = await axios.post('https://api.hubapi.com/crm/v3/objects/deals/search', payload, {
        headers: { 'Authorization': 'Bearer ' + HUBSPOT_TOKEN, 'Content-Type': 'application/json' }
    });

    const deals = res.data.results;
    console.log('Found ' + deals.length + ' recent deals.');
    deals.forEach(d => {
        console.log('\n--- Deal: ' + d.properties.dealname + ' (' + d.id + ') ---');
        console.log('Stage: ' + d.properties.dealstage);
        console.log('Owner ID: ' + d.properties.hubspot_owner_id);
        console.log('Amount: ' + d.properties.amount);
        console.log('Modified: ' + d.properties.hs_lastmodifieddate);
    });
  } catch (err) {
    console.error('Error fetching deals:', err.response ? err.response.data : err.message);
  }
}

fetchRecentDeals();
