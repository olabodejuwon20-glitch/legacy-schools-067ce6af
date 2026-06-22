
-- Expand slot range 1..3 -> 1..10
ALTER TABLE public.admin_role_slots DROP CONSTRAINT IF EXISTS admin_role_slots_slot_check;
ALTER TABLE public.admin_role_slots ADD CONSTRAINT admin_role_slots_slot_check CHECK (slot BETWEEN 1 AND 10);

ALTER TABLE public.invite_codes DROP CONSTRAINT IF EXISTS invite_codes_admin_slot_check;
ALTER TABLE public.invite_codes ADD CONSTRAINT invite_codes_admin_slot_check CHECK (admin_slot IS NULL OR admin_slot BETWEEN 1 AND 10);

ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_admin_slot_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_admin_slot_check CHECK (admin_slot IS NULL OR admin_slot BETWEEN 1 AND 10);

-- Seed default slot names for every existing school (only if missing)
INSERT INTO public.admin_role_slots (school_id, slot, name, enabled, permissions)
SELECT s.id, v.slot, v.name, false, '[]'::jsonb
FROM public.schools s
CROSS JOIN (VALUES
  (1, 'Vice Principal'),
  (2, 'HOD'),
  (3, 'Exam Committee')
) AS v(slot, name)
ON CONFLICT (school_id, slot) DO NOTHING;
