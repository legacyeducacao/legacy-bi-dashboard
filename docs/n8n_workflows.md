# Documentação de Workflows N8N (ETL)

**Webhook de Produção:** `https://automacao-n8n.zs0trp.easypanel.host/webhook/30135616-a1ea-4196-abb1-367e88b1d882`
**Webhook de Teste:** `https://automacao-n8n.zs0trp.easypanel.host/webhook-test/30135616-a1ea-4196-abb1-367e88b1d882`

Esta documentação detalha os fluxos de automação no N8N para extração, transformação e carga (ETL) dos dados de Meta Ads e Hubspot para o Supabase.

---

## Configuração do Node Postgres no N8N

Para todos os passos abaixo, você usará o node **Postgres** no N8N.
1.  **Credenciais**:
    -   **Host**: `db.ibhkisoudreapebtvpga.supabase.co` (Pegue no Supabase > Settings > Database > Connection Parameters)
    -   **Database**: `postgres`
    -   **User**: `postgres`
    -   **Password**: (Sua senha do banco)
    -   **Port**: `5432`
    -   **SSL**: Ativado.

---

## Workflow 1 (Novo - Schema V2): Meta Ads -> Tabela `fact_daily_marketing`

**Objetivo**: Inserir dados diários de campanha (Meta Ads) na nova estrutura dimensional.

**Opção A: Automático (Recomendado)**
1.  **Meta Node**: Busca insights de ontem (`yesterday`).
2.  **Code Node**: Transformação de dados (use `docs/n8n_facebook_transformer.js`).
3.  **Postgres Node (Insert/Upsert)**:
    -   **Tabela**: `fact_daily_marketing`
    -   **Columns**: `date`, `channel_id`, `product_id`, `cost`, `impressions`, `clicks`, `leads`
    -   **Conflict Resolution**: Upsert nas colunas (`date`, `channel_id`, `product_id`).

**Opção B: Manual (Via Script de Push)**
1.  **Webhook Node (POST)**: Recebe o JSON cru.
2.  **Code Node**: Transformação de dados (use `docs/n8n_facebook_transformer.js`).
3.  **Postgres Node (Execute Query)**:
    *   **Recomendado**: Use *Execute Query* em vez de *Insert*, pois precisamos buscar o ID do Produto pelo Nome.
    *   **Query**:
        ```sql
        INSERT INTO fact_daily_marketing (
            date, 
            channel_id, 
            product_id, 
            campaign_name, 
            cost, 
            impressions, 
            clicks, 
            leads
        )
        SELECT 
            $1::date, 
            (SELECT id FROM dim_channels WHERE name = 'Meta Ads'),
            (SELECT id FROM dim_products WHERE name = $2),
            $3, -- campaign_name
            $4, -- cost
            $5, -- impressions
            $6, -- clicks
            $7  -- leads
        ON CONFLICT (date, channel_id, product_id, campaign_name) 
        DO UPDATE SET 
            cost = EXCLUDED.cost, 
            impressions = EXCLUDED.impressions,
            clicks = EXCLUDED.clicks,
            leads = EXCLUDED.leads;
        ```
    *   **Parameters**: Mapeie os campos do Code Node:
        *   $1: `{{ $json.date }}`
        *   $2: `{{ $json.product_name }}`
        *   $3: `{{ $json.campaign_name }}`
        *   $4: `{{ $json.cost }}`
        *   $5: `{{ $json.impressions }}`
        *   $6: `{{ $json.clicks }}`
        *   $7: `{{ $json.leads }}`

### Como rodar o envio manual:
1.  Configure o Webhook no N8N.
2.  No terminal local (PowerShell):
    ```powershell
    $env:N8N_WEBHOOK_URL="SUA_URL_DO_WEBHOOK"
    node scripts/push_meta_to_n8n.js
    ```
    *(Edite `docs/raw_meta_ads_data.json` com os dados que deseja enviar)*

---

## Workflow 2: HubSpot -> Tabela `team_performance` (ou Schema V2 `fact_team_activities`)

**Objetivo**: Atualizar performance de SDRs e Closers.

1.  **HubSpot Node**: Busca negócios ganhos por Owner.
2.  **Function Node**: Agrupa/Soma o valor por Vendedor.
3.  **Postgres Node (Upsert)**:
    -   **Tabela**: `team_performance` (ou V2)
    -   **Columns**: `id` (Email ou ID do vendedor), `name`, `role`, `sales`, `revenue`...
    -   **Conflict Resolution**: Upsert na coluna `id`.

---

## Workflow 3: KPIs Gerais -> Tabela `kpis`

**Objetivo**: Atualizar totais (ex: Faturamento Mês).

1.  **Postgres Node (Execute SQL)**:
    ```sql
    UPDATE kpis SET value = 50000 WHERE id = 'revenue';
    ```
