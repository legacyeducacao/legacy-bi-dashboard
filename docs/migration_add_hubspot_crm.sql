-- -------------------------------------------------------------
-- Tabela para Consolidar Performance Diária (Deals do HubSpot)
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fact_daily_sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    rep_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'CLOSER', -- 'SDR' ou 'CLOSER'
    
    -- Topo de Funil (SDR/Closer Activity)
    opportunities INT DEFAULT 0,
    connections INT DEFAULT 0,
    meetings_booked INT DEFAULT 0,
    meetings_held INT DEFAULT 0,
    
    -- Fundo de Funil (Resultados)
    sales INT DEFAULT 0,
    revenue NUMERIC(10,2) DEFAULT 0.00,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(date, rep_name, role)
);

-- Ativação de RLS (Para leitura pública na Role Anon, como o resto do dashboard)
ALTER TABLE fact_daily_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable Read Access for All" ON fact_daily_sales
    FOR SELECT USING (true);

-- Política de Inserção/Atualização via service_role (N8N)
CREATE POLICY "Enable Insert for Service Role" ON fact_daily_sales
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable Update for Service Role" ON fact_daily_sales
    FOR UPDATE USING (true);
