-- Migração para suportar a métrica de Tempo de Resposta e Origem (Inbound/Outbound)
ALTER TABLE fact_team_activities 
ADD COLUMN IF NOT EXISTS opportunities INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_time_sum NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS response_time_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS inbound_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS outbound_count INTEGER DEFAULT 0;

-- View atualizada (Dropamos primeiro para evitar erro de renomeação de colunas)
DROP VIEW IF EXISTS team_performance CASCADE;
CREATE VIEW team_performance AS
SELECT 
    t.id::text as id,
    t.name,
    t.role,
    COALESCE(SUM(a.meetings_booked), 0) as meetings_booked,
    COALESCE(SUM(a.meetings_held), 0) as meetings_held,
    COALESCE(SUM(a.connections), 0) as connections,
    COALESCE(SUM(a.no_shows), 0) as no_show_count,
    COALESCE(SUM(a.opportunities), 0) as opportunities,
    COALESCE(SUM(a.sales), 0) as sales,
    COALESCE(SUM(a.revenue), 0) as revenue,
    COALESCE(SUM(a.inbound_count), 0) as inbound,
    COALESCE(SUM(a.outbound_count), 0) as outbound,
    CASE 
        WHEN SUM(a.response_time_count) > 0 THEN SUM(a.response_time_sum) / SUM(a.response_time_count)
        ELSE 0 
    END as response_time
FROM dim_team t
LEFT JOIN fact_team_activities a ON t.id = a.team_member_id
GROUP BY t.id, t.name, t.role;

-- Função Helper para o n8n: Realiza o Upsert cruzando nomes com IDs
CREATE OR REPLACE FUNCTION upsert_team_activity(
    p_date DATE,
    p_name TEXT,
    p_role TEXT,
    p_opportunities INTEGER,
    p_connections INTEGER,
    p_meetings_booked INTEGER,
    p_meetings_held INTEGER,
    p_no_shows INTEGER,
    p_sales INTEGER,
    p_revenue NUMERIC,
    p_response_time_sum NUMERIC,
    p_response_time_count INTEGER,
    p_inbound INTEGER,
    p_outbound INTEGER
) RETURNS VOID AS $$
DECLARE
    v_team_id UUID;
BEGIN
    -- Busca ou cria o membro do time pelo nome
    SELECT id INTO v_team_id FROM dim_team WHERE name = p_name;
    IF NOT FOUND THEN
        INSERT INTO dim_team (name, role) VALUES (p_name, p_role) RETURNING id INTO v_team_id;
    END IF;

    -- Upsert na tabela de fatos
    INSERT INTO fact_team_activities (
        date, team_member_id, opportunities, connections, meetings_booked, 
        meetings_held, no_shows, sales, revenue, response_time_sum, 
        response_time_count, inbound_count, outbound_count
    )
    VALUES (
        p_date, v_team_id, p_opportunities, p_connections, p_meetings_booked, 
        p_meetings_held, p_no_shows, p_sales, p_revenue, p_response_time_sum, 
        p_response_time_count, p_inbound, p_outbound
    )
    ON CONFLICT (date, team_member_id) DO UPDATE SET
        opportunities = EXCLUDED.opportunities,
        connections = EXCLUDED.connections,
        meetings_booked = EXCLUDED.meetings_booked,
        meetings_held = EXCLUDED.meetings_held,
        no_shows = EXCLUDED.no_shows,
        sales = EXCLUDED.sales,
        revenue = EXCLUDED.revenue,
        response_time_sum = EXCLUDED.response_time_sum,
        response_time_count = EXCLUDED.response_time_count,
        inbound_count = EXCLUDED.inbound_count,
        outbound_count = EXCLUDED.outbound_count;
END;
$$ LANGUAGE plpgsql;
