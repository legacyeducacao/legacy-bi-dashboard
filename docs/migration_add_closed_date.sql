-- Adiciona closed_date à tabela de deals para permitir filtros corretos de venda no mês
ALTER TABLE deals_followup ADD COLUMN IF NOT EXISTS closed_date DATE;

-- Se você usa a tabela fact_deals, adicione nela também (opcional dependendo do seu n8n)
-- ALTER TABLE fact_deals ADD COLUMN IF NOT EXISTS closed_date DATE;
