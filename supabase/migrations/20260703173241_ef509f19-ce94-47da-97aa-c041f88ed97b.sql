DROP POLICY IF EXISTS "User updates own membership safe cols" ON public.memberships;

CREATE POLICY "User updates own membership safe cols"
  ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND role       = (SELECT m.role       FROM public.memberships m WHERE m.id = memberships.id)
    AND status     = (SELECT m.status     FROM public.memberships m WHERE m.id = memberships.id)
    AND school_id  = (SELECT m.school_id  FROM public.memberships m WHERE m.id = memberships.id)
    AND admin_slot IS NOT DISTINCT FROM (SELECT m.admin_slot FROM public.memberships m WHERE m.id = memberships.id)
  );