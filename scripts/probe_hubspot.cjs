const hubspot = require('@hubspot/api-client');

const hubspotClient = new hubspot.Client({ accessToken: 'pat-na1-134a4b35-253e-4b87-b9fa-8e6565ad2582' });

async function getHubspotData() {
  try {
    console.log('--- Fetching Deals ---');
    // We check deals to see revenue and sales
    const dealsResponse = await hubspotClient.crm.deals.basicApi.getPage(10, undefined, [
      'amount', 'dealstage', 'pipeline', 'createdate', 'closedate', 'hubspot_owner_id'
    ]);
    console.log(JSON.stringify(dealsResponse.results, null, 2));

    console.log('\n--- Fetching Owners (SDRs/Closers) ---');
    const ownersResponse = await hubspotClient.crm.owners.ownersApi.getPage();
    console.log(JSON.stringify(ownersResponse.results.map(o => ({ id: o.id, name: `${o.firstName} ${o.lastName}` })), null, 2));

  } catch (err) {
    console.error('Hubspot API Error:', err.message);
  }
}

getHubspotData();
