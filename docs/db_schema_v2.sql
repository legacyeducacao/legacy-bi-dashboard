-- SCHEMA V2 - MODELAGEM DIMENSIONAL (STAR SCHEMA)
-- Recomendado para preservar histórico e permitir análise temporal detalhada.

-- 1. Tabelas Dimensão (Cadastros)
-- Armazenam QUEM e O QUE. Mudam pouco ao longo do tempo.

CREATE TABLE IF NOT EXISTS dim_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'Google Ads', 'Meta Ads'
    platform TEXT, -- 'Google', 'Meta', 'LinkedIn'
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dim_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'Imersão', 'Mentoria'
    category TEXT,
    price NUMERIC,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dim_team (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('SDR', 'Closer', 'Manager')),
    email TEXT UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabelas Fato (Eventos/Transações)
-- Armazenam O QUE ACONTECEU e QUANDO. Crescem todos os dias.

-- Fato: Marketing Diário (Granularidade: Dia + Canal)
CREATE TABLE IF NOT EXISTS fact_daily_marketing (
    date DATE NOT NULL,
    channel_id UUID REFERENCES dim_channels(id),
    product_id UUID REFERENCES dim_products(id), -- Opcional, se conseguir quebrar por produto
    cost NUMERIC DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (date, channel_id, product_id)
);

-- Fato: Atividades do Time (Granularidade: Dia + Pessoa)
CREATE TABLE IF NOT EXISTS fact_team_activities (
    date DATE NOT NULL,
    team_member_id UUID REFERENCES dim_team(id),
    connections INTEGER DEFAULT 0,
    calls INTEGER DEFAULT 0,
    meetings_booked INTEGER DEFAULT 0,
    meetings_held INTEGER DEFAULT 0,
    no_shows INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (date, team_member_id)
);

-- Fato: Vendas/Negócios (Granularidade: Negócio Individual)
CREATE TABLE IF NOT EXISTS fact_deals (
    deal_id TEXT PRIMARY KEY, -- ID original do CRM (HubSpot ID)
    sdr_id UUID REFERENCES dim_team(id),
    closer_id UUID REFERENCES dim_team(id),
    product_id UUID REFERENCES dim_products(id),
    channel_id UUID REFERENCES dim_channels(id), -- Origem do Lead
    
    created_date DATE NOT NULL,
    closed_date DATE,
    
    status TEXT, -- 'Won', 'Lost', 'Open'
    value NUMERIC DEFAULT 0,
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Views de Compatibilidade (Para o Frontend Atual)
-- Estas views simulam as tabelas antigas para que o React continue funcionando sem mudanças drásticas imediatas.

-- 3. Views de Compatibilidade (Para o Frontend Atual)
-- Estas views simulam as tabelas antigas para que o React continue funcionando sem mudanças drásticas imediatas.

-- IMPORTANTE: Remove as tabelas antigas (se existirem) para serem substituídas por Views
DROP TABLE IF EXISTS marketing_channels CASCADE;
DROP TABLE IF EXISTS team_performance CASCADE;
DROP TABLE IF EXISTS marketing_products CASCADE;
DROP TABLE IF EXISTS daily_trends CASCADE; -- Opcional, se não for mais usada

-- View: marketing_channels
CREATE OR REPLACE VIEW marketing_channels AS
SELECT 
    c.name as channel,
    COALESCE(SUM(f.cost), 0) as investment,
    COALESCE(SUM(f.leads), 0) as leads,
    CASE 
        WHEN SUM(f.leads) > 0 THEN SUM(f.cost) / SUM(f.leads) 
        ELSE 0 
    END as cpl,
    0 as mqls, -- TODO: Implementar lógica de MQL na fact_daily_marketing ou fact_deals
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

-- View: team_performance
CREATE OR REPLACE VIEW team_performance AS
SELECT 
    t.id::text as id, -- Cast UUID to text for frontend compatibility
    t.name,
    t.role,
    -- Agregação de Atividades (SDR)
    COALESCE(SUM(a.meetings_booked), 0) as meetings_booked,
    COALESCE(SUM(a.meetings_held), 0) as meetings_held,
    COALESCE(SUM(a.connections), 0) as connections,
    COALESCE(SUM(a.no_shows), 0) as no_show_count,
    -- Agregação de Vendas (Closer/SDR)
    COALESCE(COUNT(d.deal_id), 0) as opportunities, -- Total deals associated
    COALESCE(COUNT(d.deal_id) FILTER (WHERE d.status = 'Won'), 0) as sales,
    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'Won'), 0) as revenue,
    0 as response_time -- Placeholder for now
FROM dim_team t
LEFT JOIN fact_team_activities a ON t.id = a.team_member_id AND a.date >= date_trunc('month', CURRENT_DATE)
LEFT JOIN fact_deals d ON (t.id = d.sdr_id OR t.id = d.closer_id) AND d.created_date >= date_trunc('month', CURRENT_DATE)
GROUP BY t.id, t.name, t.role;

-- View: marketing_products
CREATE OR REPLACE VIEW marketing_products AS
SELECT
    p.name as product,
    0 as investment, -- Difícil ratear investimento por produto sem mais dados
    0 as leads,
    0 as cpl,
    COALESCE(COUNT(d.deal_id) FILTER (WHERE d.status = 'Won'), 0) as sales,
    COALESCE(SUM(d.value) FILTER (WHERE d.status = 'Won'), 0) as revenue,
    0 as roas
FROM dim_products p
LEFT JOIN fact_deals d ON p.id = d.product_id AND d.created_date >= date_trunc('month', CURRENT_DATE)
GROUP BY p.name;

-- 4. Função Helper para popular Dimensões automaticamente (opcional)
-- Útil para o n8n criar canais/pessoas se não existirem
CREATE OR REPLACE FUNCTION get_or_create_channel(channel_name TEXT) RETURNS UUID AS $$
DECLARE
    chan_id UUID;
BEGIN
    SELECT id INTO chan_id FROM dim_channels WHERE name = channel_name;
    IF NOT FOUND THEN
        INSERT INTO dim_channels (name) VALUES (channel_name) RETURNING id INTO chan_id;
    END IF;
    RETURN chan_id;
END;
$$ LANGUAGE plpgsql;
