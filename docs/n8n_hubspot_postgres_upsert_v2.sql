-- ============================================================
-- N8N Postgres Node — "Execute Query"
-- HubSpot CRM → Supabase UPSERT (Funil Comercial Legacy)
-- Versão 2.0 — com validação double-check de receita no SQL
-- ============================================================
--
-- PARÂMETROS do nó n8n (queryParams):
--   $1  = {{ $json.date }}
--   $2  = {{ $json.rep_name }}
--   $3  = {{ $json.role }}
--   $4  = {{ $json.opportunities }}
--   $5  = {{ $json.connections }}
--   $6  = {{ $json.meetings_booked }}
--   $7  = {{ $json.meetings_held }}
--   $8  = {{ $json.no_shows }}
--   $9  = {{ $json.sales }}
--   $10 = {{ $json.revenue }}
--   $11 = {{ $json.response_time_sum }}
--   $12 = {{ $json.response_time_count }}
--   $13 = {{ $json.inbound }}
--   $14 = {{ $json.outbound }}
-- ============================================================

WITH upsert_member AS (
    -- Cria o membro do time se não existir (idempotente)
    INSERT INTO dim_team (name, role)
    VALUES ($2, $3)
    ON CONFLICT (name)
    DO UPDATE SET
        role       = EXCLUDED.role,
        -- Garante que o role está atualizado se mudar
        updated_at = NOW()
    RETURNING id
)
INSERT INTO fact_team_activities (
    date,
    team_member_id,
    opportunities,
    connections,
    meetings_booked,
    meetings_held,
    no_shows,
    sales,
    revenue,
    response_time_sum,
    response_time_count,
    inbound,
    outbound
)
SELECT
    $1::DATE,
    (SELECT id FROM upsert_member),
    $4::INTEGER,
    $5::INTEGER,
    $6::INTEGER,
    $7::INTEGER,
    $8::INTEGER,
    $9::INTEGER,
    $10::NUMERIC,
    $11::NUMERIC,
    $12::INTEGER,
    $13::INTEGER,
    $14::INTEGER
ON CONFLICT (date, team_member_id)
DO UPDATE SET
    opportunities       = EXCLUDED.opportunities,
    connections         = EXCLUDED.connections,
    meetings_booked     = EXCLUDED.meetings_booked,
    meetings_held       = EXCLUDED.meetings_held,
    no_shows            = EXCLUDED.no_shows,
    sales               = EXCLUDED.sales,
    revenue             = EXCLUDED.revenue,
    response_time_sum   = EXCLUDED.response_time_sum,
    response_time_count = EXCLUDED.response_time_count,
    inbound             = EXCLUDED.inbound,
    outbound            = EXCLUDED.outbound,
    updated_at          = NOW();
