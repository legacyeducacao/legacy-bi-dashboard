-- ============================================================
-- N8N Postgres Node — "Execute Query"
-- Upsert de Leads REJEITADOS → rejected_leads_log
-- ============================================================
-- Conectado ao Output 1 do transformer v7
-- Este nó recebe apenas os deals que NÃO passaram no filtro 70K
--
-- PARÂMETROS do nó n8n (queryParams):
--   $1  = {{ $json.deal_id }}
--   $2  = {{ $json.deal_name }}
--   $3  = {{ $json.pipeline_id }}
--   $4  = {{ $json.stage_id }}
--   $5  = {{ $json.stage_name }}
--   $6  = {{ $json.faturamento_mensal }}
--   $7  = {{ $json.deal_amount }}
--   $8  = {{ $json.rejection_reason }}
--   $9  = {{ $json.hubspot_owner_id }}
--   $10 = {{ $json.created_date }}
-- ============================================================

INSERT INTO rejected_leads_log (
    deal_id,
    deal_name,
    pipeline_id,
    stage_id,
    stage_name,
    faturamento_mensal,
    deal_amount,
    rejection_reason,
    hubspot_owner_id,
    created_date,
    rejected_at
)
VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6::NUMERIC,
    $7::NUMERIC,
    $8,
    $9,
    $10::DATE,
    NOW()
)
ON CONFLICT (deal_id, (rejected_at::DATE))
DO UPDATE SET
    -- Atualiza se o deal foi processado novamente no mesmo dia
    -- (por exemplo: schedule rodou duas vezes)
    faturamento_mensal = EXCLUDED.faturamento_mensal,
    deal_amount        = EXCLUDED.deal_amount,
    rejection_reason   = EXCLUDED.rejection_reason,
    stage_name         = EXCLUDED.stage_name;
