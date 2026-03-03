-- =============================================================================
-- Inserção Consolida de Performance (Postgres Node)
-- Recebe JSON do n8n_hubspot_transformer.js e insere no Supabase
-- =============================================================================

INSERT INTO fact_daily_sales (
    date,
    rep_name,
    role,
    opportunities,
    connections,
    meetings_booked,
    meetings_held,
    sales,
    revenue,
    updated_at
)
VALUES (
    $1::DATE,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    timezone('utc'::text, now())
)
ON CONFLICT (date, rep_name, role) DO UPDATE SET
    opportunities = EXCLUDED.opportunities,
    connections = EXCLUDED.connections,
    meetings_booked = EXCLUDED.meetings_booked,
    meetings_held = EXCLUDED.meetings_held,
    sales = EXCLUDED.sales,
    revenue = EXCLUDED.revenue,
    updated_at = EXCLUDED.updated_at;
