const fs = require('fs');
const path = require('path');

const jsPath = path.join(process.cwd(), 'docs', 'n8n_facebook_transformer.js');
const sqlPath = path.join(process.cwd(), 'docs', 'n8n_postgres_upsert.sql');
const jsonPath = path.join(process.cwd(), 'docs', 'n8n_production_workflow.json');

const jsCode = fs.readFileSync(jsPath, 'utf8');
const sqlCode = fs.readFileSync(sqlPath, 'utf8');
const wfJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

wfJson.nodes.forEach(node => {
    if (node.name === 'Transform Meta Data' && node.parameters) {
        node.parameters.jsCode = jsCode;
    }
    if (node.name === 'Upsert Supabase' && node.parameters) {
        node.parameters.query = sqlCode;
        // Also update queryParams if mqls is missing
        if (node.parameters.additionalFields && node.parameters.additionalFields.queryParams) {
            let params = node.parameters.additionalFields.queryParams;
            if (!params.includes('{{ $json.mqls }}')) {
                params += ', {{ $json.channel_name }}, {{ $json.campaign_name }}, {{ $json.mqls }}';
                node.parameters.additionalFields.queryParams = params;
            }
        } else {
             node.parameters.additionalFields = {
                  queryParams: "={{ $json.date }}, {{ $json.product_name }}, {{ $json.cost }}, {{ $json.impressions }}, {{ $json.clicks }}, {{ $json.leads }}, {{ $json.channel_name }}, {{ $json.campaign_name }}, {{ $json.mqls }}"
             };
        }
    }
});

fs.writeFileSync(jsonPath, JSON.stringify(wfJson, null, 2));
console.log("n8n_production_workflow.json updated successfully!");
