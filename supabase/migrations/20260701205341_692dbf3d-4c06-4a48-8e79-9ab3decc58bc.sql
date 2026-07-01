
-- 1) academic_templates: require authentication (not fully public)
DROP POLICY IF EXISTS "templates readable by anyone" ON public.academic_templates;
CREATE POLICY "templates readable by authenticated"
  ON public.academic_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) client_errors: remove from realtime publication to prevent broadcast of stack traces / user_ids
ALTER PUBLICATION supabase_realtime DROP TABLE public.client_errors;

-- 3) memberships: replace broken self-referential WITH CHECK with a BEFORE UPDATE trigger
--    that prevents non-admins from mutating protected columns.
DROP POLICY IF EXISTS "User updates own membership safe cols" ON public.memberships;

CREATE POLICY "User updates own membership safe cols"
  ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.memberships_prevent_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins of the school (or super admins) may change any column.
  IF public.is_school_admin(OLD.school_id, auth.uid())
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admins updating their own row: freeze privileged columns to OLD values.
  IF OLD.user_id = auth.uid() THEN
    NEW.role      := OLD.role;
    NEW.status    := OLD.status;
    NEW.school_id := OLD.school_id;
    NEW.user_id   := OLD.user_id;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to update this membership';
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_prevent_self_escalation ON public.memberships;
CREATE TRIGGER trg_memberships_prevent_self_escalation
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.memberships_prevent_self_escalation();
