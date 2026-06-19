
-- 1. Schools: add pilot fields
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS pilot_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pilot_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS pilot_alerts_sent jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pilot_converted_at timestamptz;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_pilot_status_chk
  CHECK (pilot_status IN ('none','active','expired','converted'))
  NOT VALID;
-- existing rows default to 'none', so constraint can be validated
ALTER TABLE public.schools VALIDATE CONSTRAINT schools_pilot_status_chk;

CREATE INDEX IF NOT EXISTS schools_pilot_status_idx ON public.schools (pilot_status);
CREATE INDEX IF NOT EXISTS schools_pilot_ends_at_idx ON public.schools (pilot_ends_at);

-- 2. Trigger: when a new school row is created with plan='trial' (default), enroll into pilot
CREATE OR REPLACE FUNCTION public.tg_schools_start_pilot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan = 'trial'::school_plan AND COALESCE(NEW.pilot_status,'none') = 'none' THEN
    NEW.pilot_status := 'active';
    NEW.pilot_started_at := COALESCE(NEW.pilot_started_at, now());
    NEW.pilot_ends_at := COALESCE(NEW.pilot_ends_at, now() + interval '60 days');
    NEW.pilot_premium_until := COALESCE(NEW.pilot_premium_until, now() + interval '14 days');
    NEW.plan_expires_at := COALESCE(NEW.plan_expires_at, NEW.pilot_ends_at);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS schools_start_pilot ON public.schools;
CREATE TRIGGER schools_start_pilot
BEFORE INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.tg_schools_start_pilot();

-- 3. Patch apply_subscription_payment to flip pilot → converted on first paid sub
CREATE OR REPLACE FUNCTION public.apply_subscription_payment(_invoice_id uuid, _reference text, _method text DEFAULT 'paystack'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_inv RECORD; v_school RECORD;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF v_inv.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  UPDATE public.invoices
     SET status = 'paid', paid_at = now(),
         paystack_reference = COALESCE(_reference, paystack_reference),
         paid_method = _method
   WHERE id = _invoice_id;

  IF v_inv.kind = 'subscription' AND v_inv.plan IS NOT NULL THEN
    SELECT * INTO v_school FROM public.schools WHERE id = v_inv.school_id;
    UPDATE public.schools
       SET plan = v_inv.plan::school_plan,
           status = 'active'::school_status,
           plan_started_at = COALESCE(v_inv.period_start::timestamptz, now()),
           plan_expires_at = GREATEST(COALESCE(plan_expires_at, now()), v_inv.period_end::timestamptz),
           term_ends_at = v_inv.period_end,
           pilot_status = CASE
             WHEN pilot_status IN ('active','expired') THEN 'converted'
             ELSE pilot_status END,
           pilot_converted_at = CASE
             WHEN pilot_status IN ('active','expired') AND pilot_converted_at IS NULL THEN now()
             ELSE pilot_converted_at END
     WHERE id = v_inv.school_id;

    INSERT INTO public.subscriptions(
      school_id, plan, status, started_at, current_period_end,
      monthly_amount_cents, paystack_reference, last_invoice_id, period_start
    ) VALUES (
      v_inv.school_id, v_inv.plan::school_plan, 'active',
      now(), v_inv.period_end::timestamptz,
      v_inv.amount_kobo, _reference, v_inv.id, v_inv.period_start::timestamptz
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'invoice_id', _invoice_id);
END $function$;

-- 4. Read-only guard for expired pilots
CREATE OR REPLACE FUNCTION public.school_is_pilot_writable(_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = _school_id
      AND s.pilot_status = 'expired'
      AND s.plan = 'trial'::school_plan
  );
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_pilot_writable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_school uuid;
BEGIN
  v_school := NEW.school_id;
  IF v_school IS NULL THEN RETURN NEW; END IF;
  IF NOT public.school_is_pilot_writable(v_school) THEN
    RAISE EXCEPTION 'Pilot program expired. Upgrade your school subscription to add new records.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_pilot_writable_classes ON public.classes;
CREATE TRIGGER enforce_pilot_writable_classes
BEFORE INSERT ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_pilot_writable();

DROP TRIGGER IF EXISTS enforce_pilot_writable_exams ON public.exams;
CREATE TRIGGER enforce_pilot_writable_exams
BEFORE INSERT ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_pilot_writable();

DROP TRIGGER IF EXISTS enforce_pilot_writable_attendance ON public.attendance;
CREATE TRIGGER enforce_pilot_writable_attendance
BEFORE INSERT ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_pilot_writable();

DROP TRIGGER IF EXISTS enforce_pilot_writable_memberships ON public.memberships;
CREATE TRIGGER enforce_pilot_writable_memberships
BEFORE INSERT ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_pilot_writable();

-- 5. Admin-facing: read my pilot
CREATE OR REPLACE FUNCTION public.pilot_my_status(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s RECORD; v_days int;
BEGIN
  IF NOT public.is_member(_school_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT id, pilot_status, pilot_started_at, pilot_ends_at, pilot_premium_until,
         pilot_converted_at, plan::text AS plan, status::text AS status
    INTO s FROM public.schools WHERE id = _school_id;
  IF s IS NULL THEN RAISE EXCEPTION 'school not found'; END IF;
  v_days := CASE WHEN s.pilot_ends_at IS NULL THEN NULL
                 ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.pilot_ends_at - now()))/86400)::int) END;
  RETURN jsonb_build_object(
    'pilot_status', s.pilot_status,
    'pilot_started_at', s.pilot_started_at,
    'pilot_ends_at', s.pilot_ends_at,
    'pilot_premium_until', s.pilot_premium_until,
    'pilot_converted_at', s.pilot_converted_at,
    'days_remaining', v_days,
    'premium_unlocked', (s.pilot_premium_until IS NOT NULL AND s.pilot_premium_until > now())
                       OR s.pilot_status = 'converted'
                       OR (s.plan <> 'trial' AND s.status = 'active'),
    'read_only', s.pilot_status = 'expired' AND s.plan = 'trial',
    'plan', s.plan,
    'status', s.status
  );
END $$;

-- 6. Super: extend
CREATE OR REPLACE FUNCTION public.pilot_extend_days(_school_id uuid, _days int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _days IS NULL OR _days = 0 THEN RAISE EXCEPTION 'days required'; END IF;
  UPDATE public.schools
     SET pilot_ends_at = COALESCE(pilot_ends_at, now()) + make_interval(days => _days),
         pilot_status = CASE WHEN pilot_status = 'expired' THEN 'active' ELSE pilot_status END,
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, now()), COALESCE(pilot_ends_at, now())) + make_interval(days => _days)
   WHERE id = _school_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 7. Super: manual convert (e.g. offline payment)
CREATE OR REPLACE FUNCTION public.pilot_convert_manual(_school_id uuid, _plan text DEFAULT 'standard')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.schools
     SET pilot_status = 'converted',
         pilot_converted_at = now(),
         plan = _plan::school_plan,
         status = 'active'::school_status,
         plan_started_at = now(),
         plan_expires_at = GREATEST(COALESCE(plan_expires_at, now()), now() + interval '90 days')
   WHERE id = _school_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- 8. Super: pilot overview (analytics + list)
CREATE OR REPLACE FUNCTION public.pilot_super_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_totals jsonb; v_list jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'total', COUNT(*) FILTER (WHERE pilot_status <> 'none'),
    'active', COUNT(*) FILTER (WHERE pilot_status = 'active'),
    'expired', COUNT(*) FILTER (WHERE pilot_status = 'expired'),
    'converted', COUNT(*) FILTER (WHERE pilot_status = 'converted'),
    'conversion_rate', CASE
      WHEN COUNT(*) FILTER (WHERE pilot_status IN ('active','expired','converted')) = 0 THEN 0
      ELSE ROUND((COUNT(*) FILTER (WHERE pilot_status = 'converted'))::numeric /
                 COUNT(*) FILTER (WHERE pilot_status IN ('active','expired','converted')) * 100, 1)
    END
  ) INTO v_totals FROM public.schools;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.pilot_ends_at), '[]'::jsonb) INTO v_list FROM (
    SELECT s.id, s.name, s.slug, s.plan::text AS plan, s.status::text AS status,
           s.pilot_status, s.pilot_started_at, s.pilot_ends_at, s.pilot_converted_at,
           CASE WHEN s.pilot_ends_at IS NULL THEN NULL
                ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.pilot_ends_at - now()))/86400)::int) END AS days_remaining,
           (SELECT COUNT(*) FROM public.memberships m WHERE m.school_id = s.id AND m.role = 'student' AND m.status = 'active') AS students,
           (SELECT COUNT(*) FROM public.memberships m WHERE m.school_id = s.id AND m.role = 'teacher' AND m.status = 'active') AS teachers
    FROM public.schools s
    WHERE s.pilot_status <> 'none'
  ) t;

  RETURN jsonb_build_object('totals', v_totals, 'schools', v_list);
END $$;
