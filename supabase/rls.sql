-- Lock down application tables. The Vercel API uses service_role and bypasses RLS;
-- browser clients should use the API instead of reading tables directly.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'users', 'requests', 'transactions', 'budgets', 'inventory',
    'suppliers', 'assets', 'logs', 'import_logs',
    'notification_logs', 'request_templates'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END
$$;
