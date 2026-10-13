-- Modular Pricing & Add-on Marketplace Migration

-- 1. Create pricing_brackets table
CREATE TABLE IF NOT EXISTS public.pricing_brackets (
  slug text PRIMARY KEY,
  name text NOT NULL,
  max_students int NOT NULL,
  term_price_kobo bigint NOT NULL,
  storage_gb int NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_brackets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read pricing_brackets" ON public.pricing_brackets FOR SELECT USING (true);
CREATE POLICY "super admin manages pricing_brackets" ON public.pricing_brackets FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed the official pricing brackets
INSERT INTO public.pricing_brackets (slug, name, max_students, term_price_kobo, storage_gb, sort_order)
VALUES
  ('up_to_100', 'Up to 100 students', 100, 2500000, 10, 1),
  ('up_to_200', 'Up to 200 students', 200, 4500000, 15, 2),
  ('up_to_500', 'Up to 500 students', 500, 8000000, 20, 3),
  ('up_to_1000', 'Up to 1,000 students', 1000, 13000000, 30, 4)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  max_students = EXCLUDED.max_students,
  term_price_kobo = EXCLUDED.term_price_kobo,
  storage_gb = EXCLUDED.storage_gb,
  sort_order = EXCLUDED.sort_order;

-- 2. Update modules table
ALTER TABLE public.modules ADD COLUMN IF NOT EXISTS term_price_kobo bigint NOT NULL DEFAULT 0;

-- Ensure modules have the proper marketplace rows and status ('active' | 'coming_soon')
INSERT INTO public.modules (slug, name, description, category, status, term_price_kobo, global_default, pricing_model)
VALUES
  ('mod_virtual_lab', 'Virtual Science Lab', 'Interactive physics, chemistry, and biology virtual experiments.', 'academics', 'active', 3500000, false, 'paid'),
  ('mod_hostel', 'Hostel & Boarding', 'Room allocations, boarding attendance, roll calls, and incident logs.', 'operations', 'active', 2500000, false, 'paid'),
  ('mod_transport', 'Transport & Logistics', 'Bus route tracking, driver manifests, stop check-ins, and parent ETA alerts.', 'operations', 'active', 2000000, false, 'paid'),
  ('mod_messaging', 'Advanced Comm. (SMS)', 'Bulk SMS dispatch, emergency broadcasts, and direct parent SMS alerts.', 'communication', 'active', 1500000, false, 'paid'),
  ('mod_copilot_flow', 'Copilot Flow (Advanced)', 'Workflow automations, smart timetable adjustments, and attendance follow-ups.', 'intelligence', 'active', 2500000, false, 'paid'),
  ('mod_copilot_auto', 'Copilot Auto (Beast)', 'Autonomous school agent, AI-driven report comments, and proactive alerts.', 'intelligence', 'active', 5000000, false, 'paid'),
  ('mod_canteen', 'Smart Canteen & Cashless', 'Cashless student wallets, meal plans, and POS terminal reconciliation.', 'operations', 'coming_soon', 1500000, false, 'paid'),
  ('mod_biometric', 'Biometric Gate Attendance', 'Facial & fingerprint gate attendance turnstiles syncing in real-time.', 'operations', 'coming_soon', 3000000, false, 'paid')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  term_price_kobo = EXCLUDED.term_price_kobo,
  pricing_model = EXCLUDED.pricing_model;

-- 3. Create billing_transactions table
CREATE TABLE IF NOT EXISTS public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  reference text UNIQUE NOT NULL,
  amount_kobo bigint NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending', -- pending, paid, failed, cancelled
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paystack_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin/super read billing_transactions" ON public.billing_transactions
  FOR SELECT USING (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super manages billing_transactions" ON public.billing_transactions
  FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Convenient active students view for capacity checking
CREATE OR REPLACE VIEW public.students AS
  SELECT
    m.id,
    m.school_id,
    m.user_id,
    'active'::text AS status,
    m.created_at
  FROM public.memberships m
  WHERE m.role = 'student';
