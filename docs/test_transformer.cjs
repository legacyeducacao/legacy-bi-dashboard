const fs = require('fs');

// Mock n8n 'items' variable
const items = [
    {
        json: {
            results: [
                {
                    id: "TEST_DEAL_1",
                    properties: {
                        amount: "5000",
                        dealstage: "1225098152", // Vendido (Funil Legacy)
                        hubspot_owner_id: "85822345", // Luan Silva
                        response_time_1_ligacao: "15" // 15 mins
                    },
                    propertiesWithHistory: {
                        dealstage: [
                            { value: "1225098152", timestamp: "2026-02-27T10:00:00Z" },
                            { value: "1225098149", timestamp: "2026-02-26T10:00:00Z" },
                            { value: "1225098146", timestamp: "2026-02-25T10:00:00Z" }
                        ],
                        hubspot_owner_id: [
                            { value: "85822345", timestamp: "2026-02-25T10:00:00Z" }
                        ]
                    }
                }
            ]
        }
    }
];

// Load the transformer code
const code = fs.readFileSync('c:/Users/Hills/Documents/Projeto BI/docs/n8n_hubspot_transformer_v2.js', 'utf8');

// Wrap in a function to execute
function executeTransformer(items) {
    // Inject variables
    const STAGE_MAP_CODE = code;
    // We need to evaluate the code in a way that respects the n8n structure
    // Since the code uses 'items' and 'return', we can wrap it
    const script = `
        (function() {
            const items = ${JSON.stringify(items)};
            ${code}
        })()
    `;
    return eval(script);
}

const output = executeTransformer(items);
console.log(JSON.stringify(output, null, 2));
