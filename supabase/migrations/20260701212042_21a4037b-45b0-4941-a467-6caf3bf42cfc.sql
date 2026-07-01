CREATE OR REPLACE FUNCTION public.memberships_prevent_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_school_admin(OLD.school_id, auth.uid())
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid() THEN
    NEW.role       := OLD.role;
    NEW.status     := OLD.status;
    NEW.school_id  := OLD.school_id;
    NEW.user_id    := OLD.user_id;
    NEW.admin_slot := OLD.admin_slot;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to update this membership';
END;
$$;