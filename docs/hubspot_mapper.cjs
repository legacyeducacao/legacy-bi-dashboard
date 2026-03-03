const fs = require('fs');

const TOKEN = 'pat-na1-134a4b35-253e-4b87-b9fa-8e6565ad2582';
const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json'
};

async function run() {
  const pipeRes = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', { headers });
  const pipelines = await pipeRes.json();
  fs.writeFileSync('docs/pipelines.json', JSON.stringify(pipelines, null, 2));

  const ownerRes = await fetch('https://api.hubapi.com/crm/v3/owners?limit=100', { headers });
  const owners = await ownerRes.json();
  fs.writeFileSync('docs/owners.json', JSON.stringify(owners, null, 2));

  const propRes = await fetch('https://api.hubapi.com/crm/v3/properties/deals', { headers });
  const props = await propRes.json();
  if (props.results) {
    const interestingProps = props.results.filter(p => 
      p.label.toLowerCase().includes('tempo') || 
      p.label.toLowerCase().includes('resposta') ||
      p.label.toLowerCase().includes('response') ||
      p.label.toLowerCase().includes('agendada') ||
      p.label.toLowerCase().includes('motivo') ||
      p.name.includes('tempo')
    );
    fs.writeFileSync('docs/props.json', JSON.stringify(interestingProps, null, 2));
  }
}

run().catch(console.error);
