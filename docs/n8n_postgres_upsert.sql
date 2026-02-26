-- ============================================================
-- N8N Postgres Node - "Execute Query"
-- Upsert de dados do Meta Ads em fact_daily_marketing
-- ============================================================
-- Parâmetros (queryParams no nó):
-- $1 = {{ $json.date }}
-- $2 = {{ $json.product_name }}
-- $3 = {{ $json.cost }}
-- $4 = {{ $json.impressions }}
-- $5 = {{ $json.clicks }}
-- $6 = {{ $json.leads }}
-- $7 = {{ $json.channel_name }}
-- $8 = {{ $json.campaign_name }}
-- $9 = {{ $json.mqls }}
-- ============================================================

WITH upsert_product AS (
  -- Cria o produto se não existir, ou atualiza (retorna ID em ambos os casos)
  INSERT INTO dim_products (name)
  VALUES ($2)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
)
INSERT INTO fact_daily_marketing (
  date,
  channel_id,
  product_id,
  campaign_name,
  cost,
  impressions,
  clicks,
  leads,
  mqls
)
SELECT
  $1::DATE,
  (SELECT id FROM dim_channels WHERE name = $7 LIMIT 1),
  (SELECT id FROM upsert_product),
  $8,
  $3::NUMERIC,
  $4::INTEGER,
  $5::INTEGER,
  $6::INTEGER,
  $9::INTEGER
ON CONFLICT (date, channel_id, product_id, campaign_name)
DO UPDATE SET
  cost        = EXCLUDED.cost,
  impressions = EXCLUDED.impressions,
  clicks      = EXCLUDED.clicks,
  leads       = EXCLUDED.leads,
  mqls        = EXCLUDED.mqls;
