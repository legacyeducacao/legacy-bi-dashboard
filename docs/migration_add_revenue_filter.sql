-- ============================================================
-- MIGRATION: Revenue Filter & Rejected Leads Audit Log
-- Pipeline: Funil Comercial Legacy (827389965)
-- Data: 2026-03-03
-- ============================================================
-- Propósito:
--   1. Criar tabela de log para leads rejeitados pelo filtro de 70K
--   2. Adicionar campo faturamento_mensal em fact_deals para rastreamento
--   3. Criar view de auditoria para análise do filtro
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABELA: rejected_leads_log
--    Registra todos os deals rejeitados pelo filtro de R$ 70K
--    ANTES de chegar ao banco de dados principal.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rejected_leads_log (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id            TEXT NOT NULL,
    deal_name          TEXT,
    pipeline_id        TEXT DEFAULT '827389965',
    stage_id           TEXT,
    stage_name         TEXT,
    faturamento_mensal NUMERIC,
    deal_amount        NUMERIC,
    rejection_reason   TEXT,
    hubspot_owner_id   TEXT,
    created_date       DATE,
    rejected_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas de auditoria eficientes
CREATE INDEX IF NOT EXISTS idx_rejected_leads_stage
    ON rejected_leads_log (stage_name);

CREATE INDEX IF NOT EXISTS idx_rejected_leads_date
    ON rejected_leads_log (rejected_at::DATE);

CREATE INDEX IF NOT EXISTS idx_rejected_leads_deal_id
    ON rejected_leads_log (deal_id);

-- Upsert seguro: garante que o mesmo deal não vire duplicata no log
-- (o transformer pode rodar múltiplas vezes via schedule)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rejected_leads_deal_unique
    ON rejected_leads_log (deal_id, rejected_at::DATE);

-- ─────────────────────────────────────────────────────────────
-- 2. CAMPO ADICIONAL em fact_deals
--    Armazena o faturamento_mensal do lead qualificado
--    para análises futuras de segmentação de receita.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE fact_deals
    ADD COLUMN IF NOT EXISTS faturamento_mensal NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS qualification_status TEXT
        DEFAULT 'qualified'
        CHECK (qualification_status IN ('qualified', 'no_data'));

COMMENT ON COLUMN fact_deals.faturamento_mensal IS
    'Faturamento mensal da empresa do lead (campo faturamento_mensal do HubSpot). NULL = campo não preenchido.';
COMMENT ON COLUMN fact_deals.qualification_status IS
    'qualified = passed 70K filter. no_data = no revenue field found (Opção A: allowed through).';

-- ─────────────────────────────────────────────────────────────
-- 3. VIEW: v_revenue_filter_audit
--    Painel de auditoria do filtro de 70K — mostra eficiência
--    da automação vs. o que está chegando ao banco.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_revenue_filter_audit AS
WITH qualified AS (
    SELECT
        DATE_TRUNC('week', created_date) AS week,
        COUNT(*)                          AS qualified_count,
        AVG(faturamento_mensal)           AS avg_revenue_qualified,
        COUNT(*) FILTER (WHERE qualification_status = 'no_data') AS no_data_count
    FROM fact_deals
    WHERE pipeline_id IS NULL OR pipeline_id = '827389965'
    GROUP BY 1
),
rejected AS (
    SELECT
        DATE_TRUNC('week', rejected_at) AS week,
        COUNT(*)                         AS rejected_count,
        AVG(faturamento_mensal)          AS avg_revenue_rejected,
        COUNT(*) FILTER (WHERE stage_name NOT IN ('Perdido', 'Vendido')) AS active_rejected_count
    FROM rejected_leads_log
    GROUP BY 1
)
SELECT
    COALESCE(q.week, r.week)                       AS week,
    COALESCE(q.qualified_count, 0)                 AS qualified_deals,
    COALESCE(r.rejected_count, 0)                  AS rejected_deals,
    COALESCE(q.no_data_count, 0)                   AS no_revenue_data_deals,
    COALESCE(r.active_rejected_count, 0)           AS active_pipeline_rejected,
    ROUND(q.avg_revenue_qualified::NUMERIC, 2)     AS avg_revenue_qualified,
    ROUND(r.avg_revenue_rejected::NUMERIC, 2)      AS avg_revenue_rejected,
    CASE
        WHEN (COALESCE(q.qualified_count,0) + COALESCE(r.rejected_count,0)) > 0
        THEN ROUND(
            100.0 * COALESCE(q.qualified_count,0) /
            (COALESCE(q.qualified_count,0) + COALESCE(r.rejected_count,0)),
            1)
        ELSE 0
    END AS qualification_rate_pct
FROM qualified q
FULL OUTER JOIN rejected r ON q.week = r.week
ORDER BY week DESC;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS (Row Level Security) — proteção básica do log de rejeitos
--    Somente usuários autenticados podem ler/gravar.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE rejected_leads_log ENABLE ROW LEVEL SECURITY;

-- Política: somente o service_role (n8n) pode inserir
CREATE POLICY IF NOT EXISTS "Service role can insert rejected leads"
    ON rejected_leads_log FOR INSERT
    WITH CHECK (true); -- Supabase service_role bypassa RLS

-- Política: usuários autenticados podem somente ler
CREATE POLICY IF NOT EXISTS "Authenticated users can read rejected leads"
    ON rejected_leads_log FOR SELECT
    TO authenticated
    USING (true);
