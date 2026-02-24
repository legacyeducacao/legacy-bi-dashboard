import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURAÇÃO
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://automacao-n8n.zs0trp.easypanel.host/webhook-test/30135616-a1ea-4196-abb1-367e88b1d882'; 
const DATA_FILE = path.join(__dirname, '../docs/raw_meta_ads_data.json');

// Função para enviar dados via POST
const postData = (url, data) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const body = JSON.stringify(data);

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseBody);
                } else {
                    reject(new Error(`Status Code: ${res.statusCode}, Body: ${responseBody}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(body);
        req.end();
    });
};

// Execução Principal
(async () => {
    try {
        if (N8N_WEBHOOK_URL === 'YOUR_N8N_WEBHOOK_URL_HERE') {
            console.error('❌ ERRO: Você precisa configurar a URL do Webhook do N8N.');
            console.error('   Edite este arquivo ou defina a variável de ambiente N8N_WEBHOOK_URL.');
            process.exit(1);
        }

        console.log(`📄 Lendo arquivo de dados: ${DATA_FILE}`);
        if (!fs.existsSync(DATA_FILE)) {
            throw new Error('Arquivo de dados não encontrado!');
        }

        const rawData = fs.readFileSync(DATA_FILE, 'utf8');
        const json = JSON.parse(rawData);

        console.log(`🚀 Enviando ${json.length} registros para o N8N: ${N8N_WEBHOOK_URL}...`);
        
        await postData(N8N_WEBHOOK_URL, { data: json }); // Envelopa em 'data' como o N8N costuma esperar de Webhooks simples

        console.log('✅ Dados enviados com sucesso!');
    } catch (error) {
        console.error('❌ Erro durante o envio:', error.message);
    }
})();
