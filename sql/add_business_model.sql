BEGIN;

DO $$
DECLARE
  current_revision text;
BEGIN
  SELECT version_num INTO current_revision FROM alembic_version;
  IF current_revision IS DISTINCT FROM '3d8e6e1f4a2b' THEN
    RAISE EXCEPTION 'Expected alembic revision 3d8e6e1f4a2b, found %', current_revision;
  END IF;
END $$;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_model VARCHAR(20);
UPDATE businesses SET business_model = 'hybrid' WHERE business_model IS NULL;
ALTER TABLE businesses ALTER COLUMN business_model SET NOT NULL;
ALTER TABLE businesses ALTER COLUMN business_model SET DEFAULT 'stock';

UPDATE alembic_version SET version_num = 'e4353398e982' WHERE version_num = '3d8e6e1f4a2b';

COMMIT;

SELECT business_model, count(*) FROM businesses GROUP BY business_model;
