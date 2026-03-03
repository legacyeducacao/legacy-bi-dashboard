-- Revertendo a adição da coluna status
ALTER TABLE fact_daily_marketing 
DROP COLUMN IF EXISTS status;
