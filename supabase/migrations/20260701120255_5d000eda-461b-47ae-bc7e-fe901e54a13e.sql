
-- 1. Extend client_errors
ALTER TABLE public.client_errors
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS affected_users UUID[] NOT NULL DEFAULT '{}';

-- unique fingerprint index for upsert-style grouping (nullable-safe: only enforced when fingerprint present)
CREATE UNIQUE INDEX IF NOT EXISTS client_errors_fingerprint_key
  ON public.client_errors (fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_errors_status_last_seen_idx
  ON public.client_errors (resolution_status, last_seen_at DESC);

-- 2. RPC to report an error (grouped by fingerprint)
CREATE OR REPLACE FUNCTION public.report_client_error(
  _message TEXT,
  _stack TEXT DEFAULT NULL,
  _source TEXT DEFAULT NULL,
  _route TEXT DEFAULT NULL,
  _role TEXT DEFAULT NULL,
  _browser TEXT DEFAULT NULL,
  _os TEXT DEFAULT NULL,
  _school_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fp TEXT;
  _first_stack_line TEXT;
  _uid UUID;
  _existing_id UUID;
BEGIN
  _uid := auth.uid();
  _first_stack_line := COALESCE(split_part(COALESCE(_stack, ''), E'\n', 1), '');
  _fp := encode(
    digest(
      COALESCE(_message, '') || '|' ||
      COALESCE(_source, '') || '|' ||
      _first_stack_line,
      'sha256'
    ),
    'hex'
  );

  SELECT id INTO _existing_id
  FROM public.client_errors
  WHERE fingerprint = _fp
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.client_errors
    SET occurrence_count = occurrence_count + 1,
        last_seen_at = now(),
        affected_users = CASE
          WHEN _uid IS NULL OR _uid = ANY(affected_users) THEN affected_users
          ELSE array_append(affected_users, _uid)
        END,
        resolution_status = CASE
          WHEN resolution_status = 'resolved' THEN 'open'
          ELSE resolution_status
        END,
        resolved_at = CASE
          WHEN resolution_status = 'resolved' THEN NULL
          ELSE resolved_at
        END
    WHERE id = _existing_id;
    RETURN _existing_id;
  END IF;

  INSERT INTO public.client_errors (
    message, stack, source, route, role, browser, os,
    school_id, user_id, fingerprint, metadata, affected_users
  )
  VALUES (
    _message, _stack, _source, _route, _role, _browser, _os,
    _school_id, _uid, _fp, COALESCE(_metadata, '{}'::jsonb),
    CASE WHEN _uid IS NULL THEN '{}'::uuid[] ELSE ARRAY[_uid] END
  )
  RETURNING id INTO _existing_id;

  RETURN _existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_client_error(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,JSONB)
  TO anon, authenticated;

-- 3. Super admin update policy for resolution
DROP POLICY IF EXISTS "Super admins can update client errors" ON public.client_errors;
CREATE POLICY "Super admins can update client errors"
  ON public.client_errors FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Enable realtime
ALTER TABLE public.client_errors REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_errors;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;
