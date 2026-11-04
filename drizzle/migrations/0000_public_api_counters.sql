CREATE TABLE IF NOT EXISTS public.api_counters (
  key text PRIMARY KEY,
  count bigint NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.api_counters_meta (
  key text PRIMARY KEY,
  value timestamptz NOT NULL
);
GRANT SELECT ON public.api_counters TO anon, service_role;
GRANT ALL ON public.api_counters TO service_role;
GRANT SELECT ON public.api_counters_meta TO anon, service_role;
GRANT ALL ON public.api_counters_meta TO service_role;
ALTER TABLE public.api_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_counters_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public can read served-work counters" ON public.api_counters;
CREATE POLICY "public can read served-work counters" ON public.api_counters FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "public can read counters activation time" ON public.api_counters_meta;
CREATE POLICY "public can read counters activation time" ON public.api_counters_meta FOR SELECT TO anon USING (true);
CREATE OR REPLACE FUNCTION public.increment_api_counter(p_key text)
RETURNS bigint LANGUAGE sql VOLATILE SET search_path = public AS $$
  INSERT INTO public.api_counters_meta(key, value) VALUES ('counters_active_since', now()) ON CONFLICT (key) DO NOTHING;
  INSERT INTO public.api_counters(key, count) VALUES (p_key, 1)
  ON CONFLICT (key) DO UPDATE SET count = public.api_counters.count + 1, updated_at = now()
  RETURNING count;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_api_counter(text) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.increment_api_counter(text) TO service_role;