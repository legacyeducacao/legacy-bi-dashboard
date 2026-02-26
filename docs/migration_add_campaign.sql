-- Adiciona suporte a Campanhas na tabela Fato

-- 1. Adicionar coluna campaign_name
ALTER TABLE fact_daily_marketing 
ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- 2. Corrigir dados existentes (PK não permite NULL)
UPDATE fact_daily_marketing 
SET campaign_name = 'Diversos' 
WHERE campaign_name IS NULL;

-- 3. Tornar a coluna obrigatória
ALTER TABLE fact_daily_marketing 
ALTER COLUMN campaign_name SET NOT NULL;

-- 4. Remover a Primary Key antiga (que era Date + Channel + Product)
ALTER TABLE fact_daily_marketing 
DROP CONSTRAINT IF EXISTS fact_daily_marketing_pkey;

-- 5. Adicionar nova Primary Key (Date + Channel + Product + Campaign)
ALTER TABLE fact_daily_marketing 
ADD PRIMARY KEY (date, channel_id, product_id, campaign_name);
