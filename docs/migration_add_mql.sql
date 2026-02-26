-- ============================================================
-- MIGRATION: Adiciona MQLs ao Schema Dimensional
-- ============================================================

-- 1. Adiciona coluna na tabela fato
ALTER TABLE fact_daily_marketing 
ADD COLUMN IF NOT EXISTS mqls INTEGER DEFAULT 0;

-- 2. Atualiza a View de Canais
-- Removemos primeiro para evitar erro de mudança de assinatura/ordens de colunas
DROP VIEW IF EXISTS marketing_channels CASCADE;

CREATE VIEW marketing_channels AS
SELECT 
    c.name as channel,
    COALESCE(SUM(f.cost), 0) as investment,
    COALESCE(SUM(f.leads), 0) as leads,
    COALESCE(SUM(f.mqls), 0) as mqls,
    CASE 
        WHEN SUM(f.leads) > 0 THEN SUM(f.cost) / SUM(f.leads) 
        ELSE 0 
    END as cpl,
    COALESCE(COUNT(d.deal_id) FILTER (WHERE d.status = 'Won'), 0) as sales,
    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'Won'), 0) as revenue,
    CASE 
        WHEN SUM(f.cost) > 0 THEN COALESCE(SUM(d.value) FILTER (WHERE d.status = 'Won'), 0) / SUM(f.cost)
        ELSE 0 
    END as roas
FROM dim_channels c
LEFT JOIN fact_daily_marketing f ON c.id = f.channel_id AND f.date >= date_trunc('month', CURRENT_DATE)
LEFT JOIN fact_deals d ON c.id = d.channel_id AND d.created_date >= date_trunc('month', CURRENT_DATE)
GROUP BY c.name;
