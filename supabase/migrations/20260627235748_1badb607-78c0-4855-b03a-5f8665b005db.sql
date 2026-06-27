
-- Extend invite_codes for activation-code lifecycle
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invite_codes_school_role ON public.invite_codes(school_id, role, revoked_at);

-- school_custom_roles
CREATE TABLE IF NOT EXISTS public.school_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  base_role text NOT NULL CHECK (base_role IN ('teacher','staff','driver','parent','student')),
  enabled boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_custom_roles TO authenticated;
GRANT ALL ON public.school_custom_roles TO service_role;
GRANT SELECT ON public.school_custom_roles TO anon;

ALTER TABLE public.school_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read enabled custom roles for onboarding"
  ON public.school_custom_roles FOR SELECT
  USING (enabled = true AND deleted_at IS NULL);

CREATE POLICY "Admins manage their school's custom roles"
  ON public.school_custom_roles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.school_id = school_custom_roles.school_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.status = 'active'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.school_id = school_custom_roles.school_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.status = 'active'
  ));

CREATE INDEX IF NOT EXISTS idx_custom_roles_school ON public.school_custom_roles(school_id, enabled);

-- onboarding_events audit
CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text,
  event text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_events TO authenticated;
GRANT ALL ON public.onboarding_events TO service_role;

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read their school's onboarding events"
  ON public.onboarding_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.school_id = onboarding_events.school_id
      AND m.user_id = auth.uid()
      AND m.role = 'admin'
      AND m.status = 'active'
  ));

CREATE INDEX IF NOT EXISTS idx_onboarding_events_school_created ON public.onboarding_events(school_id, created_at DESC);

-- Auto-provision school_code in schools.settings.identity.school_code
CREATE OR REPLACE FUNCTION public.ensure_school_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  tries int := 0;
BEGIN
  IF NEW.settings IS NULL THEN NEW.settings := '{}'::jsonb; END IF;
  IF (NEW.settings->'identity'->>'school_code') IS NULL THEN
    LOOP
      code := upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.schools
        WHERE settings->'identity'->>'school_code' = code
      ) OR tries > 8;
      tries := tries + 1;
    END LOOP;
    NEW.settings := jsonb_set(
      NEW.settings,
      '{identity,school_code}',
      to_jsonb(code),
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_ensure_code ON public.schools;
CREATE TRIGGER trg_schools_ensure_code
  BEFORE INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.ensure_school_code();

-- Backfill existing schools
UPDATE public.schools s
SET settings = jsonb_set(
  COALESCE(settings,'{}'::jsonb),
  '{identity,school_code}',
  to_jsonb(upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6))),
  true
)
WHERE (settings->'identity'->>'school_code') IS NULL;
