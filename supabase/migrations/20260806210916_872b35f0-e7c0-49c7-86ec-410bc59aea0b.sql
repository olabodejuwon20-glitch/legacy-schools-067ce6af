DROP POLICY IF EXISTS "Members read buses" ON public.transport_buses;

CREATE POLICY "Scoped read buses"
ON public.transport_buses
FOR SELECT
TO authenticated
USING (
  driver_user_id = auth.uid()
  OR public.is_school_admin(school_id, auth.uid())
  OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
  OR public.has_school_role(school_id, auth.uid(), 'staff'::public.member_role)
  OR EXISTS (
    SELECT 1 FROM public.transport_student_stops s
    WHERE s.bus_id = transport_buses.id
      AND (
        s.student_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.parent_links pl
          WHERE pl.parent_user_id = auth.uid()
            AND pl.student_user_id = s.student_id
        )
      )
  )
);