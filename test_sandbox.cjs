const fs = require('fs');

const transformerCode = fs.readFileSync('docs/n8n_hubspot_transformer_v7.js', 'utf8');
const rawDeals = JSON.parse(fs.readFileSync('joel_deals.json', 'utf8'));

const items = rawDeals.map(d => ({
   json: {
      properties: d.properties,
      propertiesWithHistory: d.propertiesWithHistory || null,
      type: 'DEAL'
   }
}));

const executionContext = `
module.exports = function() {
  let items = ${JSON.stringify(items)};
  ${transformerCode}
}
`;

fs.writeFileSync('test_sandbox_run.cjs', executionContext);
