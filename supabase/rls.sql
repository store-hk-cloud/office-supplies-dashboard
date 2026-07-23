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
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated', table_name);
    END IF;
  END LOOP;
END
$$;

-- The application no longer reads public.users from the browser. Remove legacy
-- public SELECT policies so a future GRANT cannot re-expose user profiles.
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.users;
    DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
  END IF;
END
$$;
