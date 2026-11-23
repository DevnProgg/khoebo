BEGIN;

DO $$
DECLARE
  current_revision text;
BEGIN
  SELECT version_num INTO current_revision FROM alembic_version;
  IF current_revision IS DISTINCT FROM 'e4353398e982' THEN
    RAISE EXCEPTION 'Expected alembic revision e4353398e982, found %', current_revision;
  END IF;
END $$;

-- Running upgrade e4353398e982 -> 20ac806b791a (cash received and change given)
ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14, 2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS change_given NUMERIC(14, 2) DEFAULT 0 NOT NULL;

UPDATE alembic_version SET version_num = '20ac806b791a' WHERE version_num = 'e4353398e982';

COMMIT;

SELECT count(*) AS total_sales, count(amount_paid) AS sales_with_amount_paid, sum(change_given) AS total_change_given FROM sales;
