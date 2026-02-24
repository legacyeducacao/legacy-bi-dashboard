-- Adiciona suporte a Campanhas na tabela Fato

-- 1. Adicionar coluna campaign_name
ALTER TABLE fact_daily_marketing 
ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- 2. Remover a Primary Key antiga (que era Date + Channel + Product)
ALTER TABLE fact_daily_marketing 
DROP CONSTRAINT IF EXISTS fact_daily_marketing_pkey;

-- 3. Adicionar nova Primary Key (Date + Channel + Product + Campaign)
-- Isso permite salvar múltiplas campanhas do mesmo produto no mesmo dia
ALTER TABLE fact_daily_marketing 
ADD PRIMARY KEY (date, channel_id, product_id, campaign_name);
