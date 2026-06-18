REVOKE EXECUTE ON FUNCTION public.complete_admin_onboarding(uuid, jsonb, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_admin_onboarding(uuid, jsonb, jsonb, text[]) TO authenticated;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY school_id, lower(btrim(name))
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.classes
)
DELETE FROM public.classes c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS classes_school_trimmed_name_unique
  ON public.classes (school_id, lower(btrim(name)));

CREATE OR REPLACE FUNCTION public.complete_admin_onboarding(
  _school_id uuid,
  _profile jsonb,
  _classes jsonb,
  _default_subjects text[] DEFAULT ARRAY[]::text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_settings jsonb := '{}'::jsonb;
  v_logo_url text;
  v_class jsonb;
  v_name text;
  v_code text;
  v_subject text;
  v_grade text;
  v_existing_id uuid;
  v_created int := 0;
  v_reused int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT public.is_school_admin(_school_id, v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT settings INTO v_existing_settings
  FROM public.schools
  WHERE id = _school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'school not found';
  END IF;

  v_logo_url := NULLIF(btrim(COALESCE(_profile->>'logo_url', '')), '');

  UPDATE public.schools
  SET
    name = NULLIF(btrim(COALESCE(_profile->>'name', '')), ''),
    motto = NULLIF(btrim(COALESCE(_profile->>'motto', '')), ''),
    address = NULLIF(btrim(COALESCE(_profile->>'address', '')), ''),
    phone = NULLIF(btrim(COALESCE(_profile->>'phone', '')), ''),
    email = NULLIF(btrim(COALESCE(_profile->>'email', '')), ''),
    current_session = NULLIF(btrim(COALESCE(_profile->>'current_session', '')), ''),
    current_term = NULLIF(btrim(COALESCE(_profile->>'current_term', '')), ''),
    logo_url = COALESCE(v_logo_url, logo_url)
  WHERE id = _school_id;

  FOR v_class IN SELECT * FROM jsonb_array_elements(COALESCE(_classes, '[]'::jsonb)) LOOP
    v_name := NULLIF(btrim(COALESCE(v_class->>'name', '')), '');
    IF v_name IS NULL THEN
      CONTINUE;
    END IF;

    v_code := NULLIF(btrim(COALESCE(v_class->>'code', '')), '');
    v_subject := NULLIF(btrim(COALESCE(v_class->>'subject', '')), '');
    v_grade := NULLIF(btrim(COALESCE(v_class->>'grade_level', '')), '');

    SELECT id INTO v_existing_id
    FROM public.classes
    WHERE school_id = _school_id AND lower(btrim(name)) = lower(btrim(v_name))
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.classes (school_id, name, code, subject, grade_level)
      VALUES (_school_id, v_name, COALESCE(v_code, upper(regexp_replace(v_name, '\s+', '', 'g'))), v_subject, COALESCE(v_grade, v_name));
      v_created := v_created + 1;
    ELSE
      UPDATE public.classes
      SET
        code = COALESCE(v_code, code),
        subject = COALESCE(v_subject, subject),
        grade_level = COALESCE(v_grade, grade_level)
      WHERE id = v_existing_id;
      v_reused := v_reused + 1;
    END IF;

    v_existing_id := NULL;
  END LOOP;

  UPDATE public.schools
  SET settings = COALESCE(v_existing_settings, '{}'::jsonb)
    || jsonb_build_object(
      'onboarded_at', now(),
      'default_subjects', COALESCE(to_jsonb(_default_subjects), '[]'::jsonb)
    )
  WHERE id = _school_id;

  RETURN jsonb_build_object('ok', true, 'created', v_created, 'reused', v_reused);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_admin_onboarding(uuid, jsonb, jsonb, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_admin_onboarding(uuid, jsonb, jsonb, text[]) TO authenticated;