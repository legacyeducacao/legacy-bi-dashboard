-- Execute este script no SQL Editor do Supabase para criar as tabelas necessárias

-- 1. Tabela de KPIs Principais
CREATE TABLE IF NOT EXISTS kpis (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value NUMERIC,
  goal NUMERIC,
  unit TEXT,
  prefix TEXT,
  suffix TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Tendência Diária
CREATE TABLE IF NOT EXISTS daily_trends (
  date DATE PRIMARY KEY,
  leads INTEGER DEFAULT 0,
  mqls INTEGER DEFAULT 0,
  investment NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  sales INTEGER DEFAULT 0,
  activities INTEGER DEFAULT 0,
  connected INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Performance de SDRs/Closers
CREATE TABLE IF NOT EXISTS team_performance (
  id TEXT PRIMARY KEY, -- ex: 'sdr_1', 'closer_2'
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('SDR', 'Closer')),
  opportunities INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  connections INTEGER DEFAULT 0,
  meetings_booked INTEGER DEFAULT 0,
  meetings_held INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,
  response_time NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Canais de Marketing
CREATE TABLE IF NOT EXISTS marketing_channels (
  channel TEXT PRIMARY KEY,
  investment NUMERIC DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  mqls INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Produtos
CREATE TABLE IF NOT EXISTS marketing_products (
  product TEXT PRIMARY KEY,
  investment NUMERIC DEFAULT 0,
  leads INTEGER DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  sales INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- DADOS DE EXEMPLO (MOCK DATA) PARA TESTE INICIAL
-- Descomente as linhas abaixo se quiser popular o banco com dados iniciais

/*
INSERT INTO kpis (id, label, value, goal, unit) VALUES
('sales', 'Vendas', 14, 20, 'number'),
('mkt_revenue', 'Faturamento Marketing', 185000, 300000, 'currency');

INSERT INTO daily_trends (date, leads, sales, revenue) VALUES
(CURRENT_DATE - 1, 35, 2, 30000),
(CURRENT_DATE, 12, 0, 0);
*/
