-- Adiciona suporte a Status de Campanhas na tabela Fato

-- 1. Adicionar coluna status na tabela fato
ALTER TABLE fact_daily_marketing 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'UNKNOWN';

-- 2. Atualizar a chave de conflito do Upsert (já é date, channel_id, product_id, campaign_name)
-- O status será atualizado via DO UPDATE SET no nó do N8N.
