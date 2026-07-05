
-- 1. Add deleted_at where missing
ALTER TABLE public.memberships     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.broadcast_jobs  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.client_errors   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS memberships_deleted_at_idx     ON public.memberships (deleted_at);
CREATE INDEX IF NOT EXISTS broadcast_jobs_deleted_at_idx  ON public.broadcast_jobs (deleted_at);
CREATE INDEX IF NOT EXISTS support_tickets_deleted_at_idx ON public.support_tickets (deleted_at);
CREATE INDEX IF NOT EXISTS client_errors_deleted_at_idx   ON public.client_errors (deleted_at);

-- 2. Helper: super-admin-gated soft delete / restore / hard purge
CREATE OR REPLACE FUNCTION public.super_soft_delete(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _table NOT IN ('schools','memberships','announcements','platform_announcements','broadcast_jobs','support_tickets','client_errors') THEN
    RAISE EXCEPTION 'invalid_table: %', _table;
  END IF;
  EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL', _table) USING _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_restore_deleted(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _table NOT IN ('schools','memberships','announcements','platform_announcements','broadcast_jobs','support_tickets','client_errors') THEN
    RAISE EXCEPTION 'invalid_table: %', _table;
  END IF;
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL WHERE id = $1', _table) USING _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_purge_now(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _table NOT IN ('schools','memberships','announcements','platform_announcements','broadcast_jobs','support_tickets','client_errors') THEN
    RAISE EXCEPTION 'invalid_table: %', _table;
  END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', _table) USING _id;
END;
$$;

REVOKE ALL ON FUNCTION public.super_soft_delete(text, uuid)     FROM public;
REVOKE ALL ON FUNCTION public.super_restore_deleted(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.super_purge_now(text, uuid)       FROM public;
GRANT EXECUTE ON FUNCTION public.super_soft_delete(text, uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_restore_deleted(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_purge_now(text, uuid)       TO authenticated;

-- 3. Nightly maintenance: purge 30-day trash + auto-resolve stale errors
CREATE OR REPLACE FUNCTION public.trash_and_errors_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cutoff timestamptz := now() - interval '30 days';
BEGIN
  DELETE FROM public.schools                WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.memberships            WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.announcements          WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.platform_announcements WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.broadcast_jobs         WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.support_tickets        WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;
  DELETE FROM public.client_errors          WHERE deleted_at IS NOT NULL AND deleted_at < cutoff;

  -- Auto-resolve stale open errors (no recurrence in 7 days)
  UPDATE public.client_errors
     SET resolution_status = 'resolved',
         resolved_at       = now(),
         resolution_note   = COALESCE(NULLIF(resolution_note, ''), 'auto-resolved: no recurrence for 7 days')
   WHERE resolution_status IN ('open','investigating')
     AND last_seen_at < now() - interval '7 days'
     AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_and_errors_maintenance() FROM public;
GRANT EXECUTE ON FUNCTION public.trash_and_errors_maintenance() TO service_role;

-- 4. Schedule the maintenance job
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('trash-errors-maintenance');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'trash-errors-maintenance',
  '15 3 * * *',
  $$ SELECT public.trash_and_errors_maintenance(); $$
);
