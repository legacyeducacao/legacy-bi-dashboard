-- FIX: Criar view daily_trends agregando dados da fact_daily_marketing por dia
-- Execute este script no SQL Editor do Supabase

-- Remove a tabela antiga (se ainda existir como tabela, não view)
-- Já foi dropada pelo schema v2, mas por segurança:
DROP VIEW IF EXISTS daily_trends CASCADE;
DROP TABLE IF EXISTS daily_trends CASCADE;

-- Cria a view daily_trends com base nas tabelas fato do schema V2
CREATE OR REPLACE VIEW daily_trends AS
SELECT
    f.date,
    COALESCE(SUM(f.leads), 0)::int AS leads,
    0::int AS mqls,
    COALESCE(SUM(f.cost), 0) AS investment,
    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'Won'), 0) AS revenue,
    COALESCE(COUNT(d.deal_id) FILTER (WHERE d.status = 'Won'), 0)::int AS sales,
    COALESCE(SUM(a.connections), 0)::int AS connected,
    COALESCE(SUM(a.calls), 0)::int AS activities,
    COALESCE(SUM(a.meetings_booked), 0)::int AS opportunities,
    COALESCE(SUM(a.meetings_booked), 0)::int AS meetings_booked
FROM fact_daily_marketing f
LEFT JOIN fact_deals d ON d.created_date = f.date
LEFT JOIN fact_team_activities a ON a.date = f.date
GROUP BY f.date

UNION

-- Inclui dias que só têm atividades de time (sem marketing)
SELECT
    a.date,
    0::int AS leads,
    0::int AS mqls,
    0 AS investment,
    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'Won'), 0) AS revenue,
    COALESCE(COUNT(d.deal_id) FILTER (WHERE d.status = 'Won'), 0)::int AS sales,
    COALESCE(SUM(a.connections), 0)::int AS connected,
    COALESCE(SUM(a.calls), 0)::int AS activities,
    COALESCE(SUM(a.meetings_booked), 0)::int AS opportunities,
    COALESCE(SUM(a.meetings_booked), 0)::int AS meetings_booked
FROM fact_team_activities a
LEFT JOIN fact_deals d ON d.created_date = a.date
WHERE a.date NOT IN (SELECT date FROM fact_daily_marketing)
GROUP BY a.date;
