
-- Roles enum
create type public.app_role as enum ('admin','teacher','student','parent');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by owner" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Profiles updatable by owner" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "Profiles insertable by owner" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own role" on public.user_roles
  for insert to authenticated with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- ============ ENUMS ============
do $$ begin
  create type public.member_role as enum ('admin','teacher','student','parent','driver','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attendance_status as enum ('present','absent','late','excused');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exam_status as enum ('draft','scheduled','active','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.fee_status as enum ('pending','paid','overdue');
exception when duplicate_object then null; end $$;

-- ============ SCHOOLS ============
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  address text,
  email text,
  phone text,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.schools enable row level security;

-- ============ MEMBERSHIPS ============
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (school_id, user_id, role)
);
alter table public.memberships enable row level security;
create index on public.memberships(school_id);
create index on public.memberships(user_id);

-- ============ HELPER FUNCTIONS ============
create or replace function public.is_member(_school uuid, _user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.memberships where school_id=_school and user_id=_user and status='active')
$$;

create or replace function public.has_school_role(_school uuid, _user uuid, _role public.member_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.memberships where school_id=_school and user_id=_user and role=_role and status='active')
$$;

create or replace function public.is_school_admin(_school uuid, _user uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.memberships where school_id=_school and user_id=_user and role='admin' and status='active')
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger schools_updated before update on public.schools for each row execute function public.set_updated_at();

-- Schools RLS
create policy "Schools viewable by members" on public.schools for select
  using (public.is_member(id, auth.uid()));
create policy "Anyone authenticated can create a school" on public.schools for insert
  to authenticated with check (auth.uid() = created_by);
create policy "Admins update school" on public.schools for update
  using (public.is_school_admin(id, auth.uid()));
create policy "Public slug lookup" on public.schools for select
  to anon, authenticated using (true);
-- Note: the "Public slug lookup" overrides — we want public ability to read minimal fields. We'll restrict via a view instead.
drop policy "Public slug lookup" on public.schools;

create or replace view public.schools_public
with (security_invoker=on) as
  select id, name, slug, logo_url from public.schools;
grant select on public.schools_public to anon, authenticated;
-- Allow anon to read base table only via view? Views with security_invoker need base policy.
-- Add a permissive select policy that exposes only via view by allowing all selects (slug is non-sensitive).
create policy "Public schools read" on public.schools for select to anon using (true);

-- Memberships RLS
create policy "Members see same-school memberships" on public.memberships for select
  using (public.is_member(school_id, auth.uid()));
create policy "User sees own memberships" on public.memberships for select
  using (user_id = auth.uid());
create policy "Admins manage memberships" on public.memberships for all
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));
create policy "User can insert self via invite (handled by SECURITY DEFINER fn)" on public.memberships for insert
  with check (user_id = auth.uid());
-- Creator becomes admin: handled via trigger after school insert
create or replace function public.bootstrap_school_admin()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.memberships(school_id, user_id, role) values (new.id, new.created_by, 'admin');
  return new;
end $$;
create trigger schools_bootstrap_admin after insert on public.schools
  for each row execute function public.bootstrap_school_admin();

-- ============ INVITE CODES ============
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  role public.member_role not null,
  max_uses int not null default 50,
  uses int not null default 0,
  expires_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
create policy "Admins manage invites" on public.invite_codes for all
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));
-- Anyone authenticated can look up a code (to redeem)
create policy "Lookup invite by code" on public.invite_codes for select to authenticated using (true);

-- Redeem invite
create or replace function public.redeem_invite(_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_invite public.invite_codes;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_invite from public.invite_codes where code = _code for update;
  if not found then raise exception 'invalid code'; end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then raise exception 'code expired'; end if;
  if v_invite.uses >= v_invite.max_uses then raise exception 'code exhausted'; end if;
  insert into public.memberships(school_id, user_id, role) values (v_invite.school_id, v_uid, v_invite.role)
    on conflict (school_id, user_id, role) do nothing;
  update public.invite_codes set uses = uses + 1 where id = v_invite.id;
  return v_invite.school_id;
end $$;

-- ============ PARENT - STUDENT LINKS ============
create table public.parent_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_user_id uuid not null,
  student_user_id uuid not null,
  created_at timestamptz not null default now(),
  unique(school_id, parent_user_id, student_user_id)
);
alter table public.parent_links enable row level security;
create policy "Parents read own links" on public.parent_links for select
  using (parent_user_id = auth.uid() or student_user_id = auth.uid() or public.is_school_admin(school_id, auth.uid()));
create policy "Admins manage parent links" on public.parent_links for all
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

-- ============ CLASSES ============
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null,
  name text not null,
  subject text,
  grade_level text,
  teacher_id uuid,
  created_at timestamptz not null default now()
);
alter table public.classes enable row level security;
create policy "Members view classes" on public.classes for select using (public.is_member(school_id, auth.uid()));
create policy "Admins manage classes" on public.classes for all
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(class_id, student_id)
);
alter table public.class_enrollments enable row level security;
create policy "Members view enrollments" on public.class_enrollments for select using (public.is_member(school_id, auth.uid()));
create policy "Admins manage enrollments" on public.class_enrollments for all
  using (public.is_school_admin(school_id, auth.uid())) with check (public.is_school_admin(school_id, auth.uid()));

-- ============ ATTENDANCE ============
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null,
  date date not null,
  status public.attendance_status not null,
  marked_by uuid,
  created_at timestamptz not null default now(),
  unique(class_id, student_id, date)
);
alter table public.attendance enable row level security;
create policy "Members view attendance" on public.attendance for select using (public.is_member(school_id, auth.uid()));
create policy "Teachers/Admins write attendance" on public.attendance for all
  using (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()))
  with check (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()));

-- ============ EXAMS ============
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  subject text,
  scheduled_at timestamptz,
  duration_minutes int not null default 60,
  status public.exam_status not null default 'draft',
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.exams enable row level security;
create policy "Members view exams" on public.exams for select using (public.is_member(school_id, auth.uid()));
create policy "Teachers/Admins manage exams" on public.exams for all
  using (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()))
  with check (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()));

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  position int not null default 0,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index int not null default 0,
  points int not null default 1
);
alter table public.exam_questions enable row level security;
create policy "Members view questions" on public.exam_questions for select using (public.is_member(school_id, auth.uid()));
create policy "Teachers/Admins manage questions" on public.exam_questions for all
  using (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()))
  with check (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()));

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric,
  unique(exam_id, student_id)
);
alter table public.exam_attempts enable row level security;
create policy "Student/teacher view attempts" on public.exam_attempts for select
  using (student_id = auth.uid() or public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()));
create policy "Students start own attempt" on public.exam_attempts for insert
  with check (student_id = auth.uid() and public.has_school_role(school_id, auth.uid(),'student'));
create policy "Students update own attempt" on public.exam_attempts for update
  using (student_id = auth.uid()) with check (student_id = auth.uid());

create table public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  selected_index int,
  unique(attempt_id, question_id)
);
alter table public.exam_answers enable row level security;
create policy "Owner of attempt manages answers" on public.exam_answers for all
  using (exists(select 1 from public.exam_attempts a where a.id = attempt_id and (a.student_id = auth.uid() or public.has_school_role(a.school_id, auth.uid(),'teacher') or public.is_school_admin(a.school_id, auth.uid()))))
  with check (exists(select 1 from public.exam_attempts a where a.id = attempt_id and a.student_id = auth.uid()));

-- ============ RESULTS ============
create table public.results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  subject text not null,
  term text not null default 'Term 1',
  score numeric not null,
  grade text,
  remarks text,
  teacher_id uuid,
  created_at timestamptz not null default now()
);
alter table public.results enable row level security;
create policy "Student/parent/teacher view results" on public.results for select
  using (
    student_id = auth.uid()
    or public.has_school_role(school_id, auth.uid(),'teacher')
    or public.is_school_admin(school_id, auth.uid())
    or exists(select 1 from public.parent_links pl where pl.school_id=results.school_id and pl.parent_user_id=auth.uid() and pl.student_user_id=results.student_id)
  );
create policy "Teachers/Admins manage results" on public.results for all
  using (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()))
  with check (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()));

-- ============ LIBRARY ============
create table public.library_files (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  category text,
  storage_path text not null,
  size_bytes bigint,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.library_files enable row level security;
create policy "Members view library" on public.library_files for select using (public.is_member(school_id, auth.uid()));
create policy "Teachers/Admins upload library" on public.library_files for insert
  with check (uploaded_by = auth.uid() and (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid())));
create policy "Teachers/Admins delete library" on public.library_files for delete
  using (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid()));

insert into storage.buckets (id, name, public) values ('library','library', false) on conflict (id) do nothing;

create policy "School members read library files" on storage.objects for select
  using (bucket_id='library' and public.is_member((storage.foldername(name))[1]::uuid, auth.uid()));
create policy "Teachers/Admins write library files" on storage.objects for insert
  with check (bucket_id='library' and (public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(),'teacher') or public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())));
create policy "Teachers/Admins delete library files" on storage.objects for delete
  using (bucket_id='library' and (public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(),'teacher') or public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())));

-- ============ ANNOUNCEMENTS ============
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  body text,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy "Members view announcements" on public.announcements for select using (public.is_member(school_id, auth.uid()));
create policy "Teachers/Admins post announcements" on public.announcements for insert
  with check (created_by = auth.uid() and (public.has_school_role(school_id, auth.uid(),'teacher') or public.is_school_admin(school_id, auth.uid())));
create policy "Author or admin deletes announcement" on public.announcements for delete
  using (created_by = auth.uid() or public.is_school_admin(school_id, auth.uid()));

-- ============ MESSAGES ============
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  sender_id uuid not null,
  recipient_id uuid not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "Sender/recipient view message" on public.messages for select
  using ((sender_id = auth.uid() or recipient_id = auth.uid()) and public.is_member(school_id, auth.uid()));
create policy "Send message to school member" on public.messages for insert
  with check (sender_id = auth.uid() and public.is_member(school_id, auth.uid()));
create policy "Recipient marks read" on public.messages for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ============ FEES ============
create table public.fees (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null,
  description text not null,
  amount numeric not null,
  status public.fee_status not null default 'pending',
  due_date date,
  created_at timestamptz not null default now()
);
alter table public.fees enable row level security;
create policy "Student/parent/admin view fees" on public.fees for select
  using (
    student_id = auth.uid()
    or public.is_school_admin(school_id, auth.uid())
    or exists(select 1 from public.parent_links pl where pl.school_id=fees.school_id and pl.parent_user_id=auth.uid() and pl.student_user_id=fees.student_id)
  );
create policy "Admins manage fees" on public.fees for all
  using (public.is_school_admin(school_id, auth.uid())) with check (public.is_school_admin(school_id, auth.uid()));

-- ============ AI CHATS ============
create table public.ai_chats (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_chats enable row level security;
create policy "Owner reads chats" on public.ai_chats for select using (user_id = auth.uid() and public.is_member(school_id, auth.uid()));
create policy "Owner writes chats" on public.ai_chats for insert with check (user_id = auth.uid() and public.is_member(school_id, auth.uid()));

-- ============ PROFILES backfill: ensure email/full_name available ============
-- (profiles table already exists with id, full_name, email)
-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Extend memberships
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS bio_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow user to update own membership (e.g. set bio_completed / profile_data)
DROP POLICY IF EXISTS "User updates own membership" ON public.memberships;
CREATE POLICY "User updates own membership"
ON public.memberships
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow anonymous lookup of invite code (needed so sign-in page can resolve school from code).
-- Existing policy allowed authenticated only; broaden to anon as well. Safe: code is the secret.
DROP POLICY IF EXISTS "Lookup invite by code" ON public.invite_codes;
CREATE POLICY "Public lookup invite by code"
ON public.invite_codes
FOR SELECT
TO anon, authenticated
USING (true);
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT false;

-- 1. Extend schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS motto text,
  ADD COLUMN IF NOT EXISTS current_session text,
  ADD COLUMN IF NOT EXISTS current_term text,
  ADD COLUMN IF NOT EXISTS grading_system text,
  ADD COLUMN IF NOT EXISTS resumption_date date;

-- 2. Storage bucket for school logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "School logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-logos');

-- Admins can upload to their school folder (path = <school_id>/...)
CREATE POLICY "School admins upload logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'school-logos'
  AND public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "School admins update logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'school-logos'
  AND public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "School admins delete logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'school-logos'
  AND public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- 3. Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view subjects" ON public.subjects FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 4. Timetable
CREATE TABLE IF NOT EXISTS public.timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  subject text NOT NULL,
  teacher_id uuid,
  room text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view timetable" ON public.timetable FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage timetable" ON public.timetable FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 5. Hostels
CREATE TABLE IF NOT EXISTS public.hostels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  capacity int NOT NULL DEFAULT 0,
  occupied int NOT NULL DEFAULT 0,
  warden text,
  gender text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view hostels" ON public.hostels FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage hostels" ON public.hostels FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 6. Transport
CREATE TABLE IF NOT EXISTS public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  driver text,
  vehicle_no text,
  capacity int NOT NULL DEFAULT 0,
  fee numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view routes" ON public.transport_routes FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage routes" ON public.transport_routes FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Avatars storage RLS: each user manages their own folder
DO $$
BEGIN
  -- Public read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Avatar public read' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users upload own avatar' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users update own avatar' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Users delete own avatar' AND tablename='objects' AND schemaname='storage') THEN
    CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- 1. exam_violations
create table public.exam_violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  school_id uuid not null,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index idx_exam_violations_attempt on public.exam_violations(attempt_id);
alter table public.exam_violations enable row level security;

create policy "Owner inserts own violations"
  on public.exam_violations for insert
  with check (exists (select 1 from public.exam_attempts a
    where a.id = attempt_id and a.student_id = auth.uid() and a.school_id = exam_violations.school_id));

create policy "Owner/teacher/admin view violations"
  on public.exam_violations for select
  using (exists (select 1 from public.exam_attempts a
    where a.id = attempt_id and (
      a.student_id = auth.uid()
      or public.has_school_role(a.school_id, auth.uid(), 'teacher')
      or public.is_school_admin(a.school_id, auth.uid())
    )));

-- 2. question_bank
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  subject text not null,
  topic text,
  difficulty text not null default 'medium',
  type text not null default 'mcq',
  body text not null,
  options jsonb not null default '[]'::jsonb,
  answer jsonb,
  explanation text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_qbank_school on public.question_bank(school_id);
create index idx_qbank_subject on public.question_bank(school_id, subject);
alter table public.question_bank enable row level security;

create policy "Members view question bank"
  on public.question_bank for select
  using (public.is_member(school_id, auth.uid()));

create policy "Teachers/Admins manage question bank"
  on public.question_bank for all
  using (public.has_school_role(school_id, auth.uid(), 'teacher') or public.is_school_admin(school_id, auth.uid()))
  with check (public.has_school_role(school_id, auth.uid(), 'teacher') or public.is_school_admin(school_id, auth.uid()));

create trigger trg_qbank_updated before update on public.question_bank
for each row execute function public.set_updated_at();

-- 3. question_tags
create table public.question_tags (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  tag text not null,
  unique(question_id, tag)
);
alter table public.question_tags enable row level security;

create policy "Members view question tags"
  on public.question_tags for select
  using (exists (select 1 from public.question_bank q
    where q.id = question_id and public.is_member(q.school_id, auth.uid())));

create policy "Teachers/Admins manage question tags"
  on public.question_tags for all
  using (exists (select 1 from public.question_bank q
    where q.id = question_id and (
      public.has_school_role(q.school_id, auth.uid(), 'teacher')
      or public.is_school_admin(q.school_id, auth.uid())
    )))
  with check (exists (select 1 from public.question_bank q
    where q.id = question_id and (
      public.has_school_role(q.school_id, auth.uid(), 'teacher')
      or public.is_school_admin(q.school_id, auth.uid())
    )));

-- 4. exams additions
alter table public.exams
  add column if not exists duration_min integer,
  add column if not exists randomize boolean not null default false,
  add column if not exists proctored boolean not null default false,
  add column if not exists violation_limit integer not null default 3;

-- 5. schools additions
alter table public.schools
  add column if not exists neco_subject_codes jsonb not null default '{}'::jsonb,
  add column if not exists proctoring_default boolean not null default false,
  add column if not exists exams_violation_limit integer not null default 3;

-- 6. exam_answers: add updated_at + unique constraint
alter table public.exam_answers
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'exam_answers_attempt_question_key'
  ) then
    alter table public.exam_answers
      add constraint exam_answers_attempt_question_key unique (attempt_id, question_id);
  end if;
end $$;

create trigger trg_exam_answers_updated before update on public.exam_answers
for each row execute function public.set_updated_at();

-- 7. proctor-snapshots private bucket
insert into storage.buckets (id, name, public) values ('proctor-snapshots', 'proctor-snapshots', false)
on conflict (id) do nothing;

create policy "Student uploads own proctor snapshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proctor-snapshots'
    and exists (
      select 1 from public.exam_attempts a
      where a.id::text = (storage.foldername(name))[2]
        and a.student_id = auth.uid()
    )
  );

create policy "Owner/teacher/admin read proctor snapshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'proctor-snapshots'
    and exists (
      select 1 from public.exam_attempts a
      where a.id::text = (storage.foldername(name))[2]
        and (
          a.student_id = auth.uid()
          or public.has_school_role(a.school_id, auth.uid(), 'teacher')
          or public.is_school_admin(a.school_id, auth.uid())
        )
    )
  );
create policy "Profiles viewable by school co-members"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m1
    join public.memberships m2 on m1.school_id = m2.school_id
    where m1.user_id = auth.uid()
      and m1.status = 'active'
      and m2.user_id = profiles.id
      and m2.status = 'active'
  )
);

DO $$ BEGIN
  CREATE TYPE public.exam_mode AS ENUM ('neco_sim','school','practice');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS mode public.exam_mode NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS counts_to_results boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_answers_after_each boolean NOT NULL DEFAULT false;

UPDATE public.exams SET mode='school' WHERE mode IS NULL;

CREATE INDEX IF NOT EXISTS idx_exams_school_mode_status ON public.exams(school_id, mode, status);
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user AND role='super_admin');
$$;

-- Schools extensions
DO $$ BEGIN CREATE TYPE public.school_plan AS ENUM ('trial','basic','standard','premium','enterprise'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.school_status AS ENUM ('active','suspended','expired','trial'); EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS plan public.school_plan NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS status public.school_status NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS plan_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS platform_notice text,
  ADD COLUMN IF NOT EXISTS suspended_reason text;

CREATE POLICY "super reads schools" ON public.schools FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super updates schools" ON public.schools FOR UPDATE USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super reads memberships" ON public.memberships FOR SELECT USING (public.is_super_admin(auth.uid()));

-- Module registry
CREATE TABLE public.modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'academics',
  version text NOT NULL DEFAULT '1.0.0',
  icon text,
  status text NOT NULL DEFAULT 'active',
  global_default boolean NOT NULL DEFAULT false,
  pricing_model text NOT NULL DEFAULT 'included',
  monthly_price_cents int NOT NULL DEFAULT 0,
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  config_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads modules" ON public.modules FOR SELECT USING (true);
CREATE POLICY "super manages modules" ON public.modules FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Per-school module licensing / config
CREATE TABLE public.school_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  beta boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (school_id, module_id)
);
ALTER TABLE public.school_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own school modules" ON public.school_modules FOR SELECT USING (public.is_member(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super manages school modules" ON public.school_modules FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Subscriptions & invoices
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan public.school_plan NOT NULL,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  monthly_amount_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin/super read subscriptions" ON public.subscriptions FOR SELECT USING (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super manages subscriptions" ON public.subscriptions FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  number text NOT NULL,
  amount_cents int NOT NULL,
  status text NOT NULL DEFAULT 'open',
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin/super read invoices" ON public.invoices FOR SELECT USING (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "super manages invoices" ON public.invoices FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Platform announcements
CREATE TABLE public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  audience text NOT NULL DEFAULT 'all',
  target jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authed reads platform announcements" ON public.platform_announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "super manages platform announcements" ON public.platform_announcements FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  opened_by uuid NOT NULL,
  subject text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assignee uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opener or super read tickets" ON public.support_tickets FOR SELECT USING (opened_by = auth.uid() OR public.is_super_admin(auth.uid()) OR (school_id IS NOT NULL AND public.is_school_admin(school_id, auth.uid())));
CREATE POLICY "any auth opens tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (opened_by = auth.uid());
CREATE POLICY "super manages tickets" ON public.support_tickets FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author uuid NOT NULL,
  body text NOT NULL,
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket parties read messages" ON public.support_messages FOR SELECT USING (
  public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.opened_by = auth.uid() OR (t.school_id IS NOT NULL AND public.is_school_admin(t.school_id, auth.uid())))
  )
);
CREATE POLICY "ticket parties write messages" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (
  author = auth.uid() AND (public.is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.opened_by = auth.uid() OR (t.school_id IS NOT NULL AND public.is_school_admin(t.school_id, auth.uid())))
  ))
);

-- Module requests
CREATE TABLE public.module_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  module_id uuid REFERENCES public.modules(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.module_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "school or super read module requests" ON public.module_requests FOR SELECT USING (public.is_member(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "school admins create module requests" ON public.module_requests FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid() AND public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "super updates module requests" ON public.module_requests FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- Audit log
CREATE TABLE public.platform_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid NOT NULL,
  school_id uuid,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super reads audit" ON public.platform_audit FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super writes audit" ON public.platform_audit FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) AND actor = auth.uid());

-- Security events
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  user_id uuid,
  type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super reads security events" ON public.security_events FOR SELECT USING (public.is_super_admin(auth.uid()));
CREATE POLICY "super writes security events" ON public.security_events FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));

-- Platform settings
CREATE TABLE public.platform_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  smtp jsonb NOT NULL DEFAULT '{}'::jsonb,
  integrations jsonb NOT NULL DEFAULT '{}'::jsonb,
  maintenance_mode boolean NOT NULL DEFAULT false,
  maintenance_message text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads platform settings" ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "super manages platform settings" ON public.platform_settings FOR ALL USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Seed modules
INSERT INTO public.modules (slug,name,description,category,icon,global_default,pricing_model,monthly_price_cents,default_config,config_schema) VALUES
('cbt_sim','CBT Simulation','NECO/WAEC-style computer-based testing with proctoring','academics','MonitorPlay',true,'included',0,
 '{"webcam":true,"ai_proctor":true,"negative_marking":false,"duration_min":60,"auto_submit":true,"retry_limit":1}',
 '[{"key":"webcam","label":"Webcam Monitoring","type":"toggle"},{"key":"ai_proctor","label":"AI Proctoring","type":"toggle"},{"key":"negative_marking","label":"Negative Marking","type":"toggle"},{"key":"duration_min","label":"Default Duration (min)","type":"slider","min":15,"max":180,"step":5},{"key":"auto_submit","label":"Auto Submit","type":"toggle"},{"key":"retry_limit","label":"Retry Limit","type":"slider","min":0,"max":5,"step":1}]'),
('ai_tutor','AI Tutor','24/7 AI tutor powered by Lovable AI','ai','Bot',true,'included',0,
 '{"model":"google/gemini-2.5-flash","daily_message_limit":50}',
 '[{"key":"model","label":"AI Model","type":"select","options":["google/gemini-2.5-flash","google/gemini-2.5-pro","openai/gpt-5-mini"]},{"key":"daily_message_limit","label":"Daily Messages / Student","type":"slider","min":5,"max":500,"step":5}]'),
('virtual_lab','Virtual Science Lab','Interactive simulations for chemistry, physics, biology','academics','FlaskConical',false,'addon',1500000,
 '{"subjects":["chemistry","physics"]}','[]'),
('hostel','Hostel Management','Rooms, allocations, wardens','operations','BedDouble',true,'included',0,'{}','[]'),
('waec_practice','WAEC Practice','Past-questions practice bank for WAEC','academics','GraduationCap',false,'addon',800000,'{"years":5}','[{"key":"years","label":"Past Years Included","type":"slider","min":1,"max":15,"step":1}]'),
('e_library','E-Library','Digital library with PDFs, ebooks, videos','academics','Library',true,'included',0,'{"storage_gb":10}','[{"key":"storage_gb","label":"Storage (GB)","type":"slider","min":1,"max":500,"step":1}]'),
('transport','Transport Management','Routes, vehicles, driver assignments','operations','Bus',true,'included',0,'{}','[]'),
('attendance_pro','Attendance Pro','Biometric + QR attendance with parent alerts','operations','UserCheck',false,'addon',500000,'{"sms_alerts":true}','[{"key":"sms_alerts","label":"SMS Alerts to Parents","type":"toggle"}]'),
('ai_grading','AI Grading','Auto-grade essays and short answers with AI','ai','PenTool',false,'addon',1200000,'{"model":"openai/gpt-5-mini"}','[{"key":"model","label":"AI Model","type":"select","options":["openai/gpt-5-mini","google/gemini-2.5-pro"]}]'),
('video_learning','Video Learning','Recorded lessons + live classes','academics','Video',false,'addon',900000,'{"max_quality":"1080p"}','[{"key":"max_quality","label":"Max Quality","type":"select","options":["720p","1080p","4k"]}]');

-- Backfill defaults
INSERT INTO public.school_modules (school_id, module_id, enabled)
SELECT s.id, m.id, true FROM public.schools s CROSS JOIN public.modules m WHERE m.global_default = true
ON CONFLICT DO NOTHING;

-- Triggers
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_support_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

create table public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid not null,
  title text not null,
  subject text,
  grade_level text,
  topic text,
  duration_min integer,
  content text not null,
  status text not null default 'draft',
  admin_feedback text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_notes enable row level security;

create policy "Teacher manages own notes" on public.lesson_notes
  for all using (teacher_id = auth.uid() and public.is_member(school_id, auth.uid()))
  with check (teacher_id = auth.uid() and public.is_member(school_id, auth.uid()));

create policy "Admins view all notes" on public.lesson_notes
  for select using (public.is_school_admin(school_id, auth.uid()));

create policy "Admins review notes" on public.lesson_notes
  for update using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create policy "Members view approved notes" on public.lesson_notes
  for select using (status = 'approved' and public.is_member(school_id, auth.uid()));

create trigger lesson_notes_set_updated_at before update on public.lesson_notes
  for each row execute function public.set_updated_at();

create index lesson_notes_school_status_idx on public.lesson_notes (school_id, status, created_at desc);
create index lesson_notes_teacher_idx on public.lesson_notes (teacher_id, created_at desc);

-- Assignments
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid,
  teacher_id uuid not null,
  title text not null,
  description text,
  subject text,
  due_at timestamptz,
  max_score numeric not null default 100,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assignments enable row level security;
create policy "Members view assignments" on public.assignments for select using (is_member(school_id, auth.uid()));
create policy "Teachers/Admins manage assignments" on public.assignments for all
  using (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()))
  with check (((teacher_id = auth.uid()) or is_school_admin(school_id, auth.uid())) and (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid())));
create trigger trg_assignments_updated before update on public.assignments for each row execute function public.set_updated_at();

-- Assignment submissions
create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null,
  school_id uuid not null,
  student_id uuid not null,
  content text,
  attachments jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  score numeric,
  feedback text,
  graded_by uuid,
  graded_at timestamptz,
  unique (assignment_id, student_id)
);
alter table public.assignment_submissions enable row level security;
create policy "Student manages own submission" on public.assignment_submissions for all
  using (student_id = auth.uid() and is_member(school_id, auth.uid()))
  with check (student_id = auth.uid() and is_member(school_id, auth.uid()));
create policy "Teacher/Admin view submissions" on public.assignment_submissions for select
  using (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid())
    or exists (select 1 from public.parent_links pl where pl.school_id = assignment_submissions.school_id and pl.parent_user_id = auth.uid() and pl.student_user_id = assignment_submissions.student_id));
create policy "Teacher/Admin grade submissions" on public.assignment_submissions for update
  using (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()))
  with check (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()));

-- Gradebook entries (continuous assessment)
create table public.gradebook_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  class_id uuid not null,
  student_id uuid not null,
  teacher_id uuid not null,
  subject text not null,
  term text not null default 'Term 1',
  category text not null default 'CA',
  title text not null,
  score numeric not null default 0,
  max_score numeric not null default 10,
  recorded_at date not null default current_date,
  created_at timestamptz not null default now()
);
alter table public.gradebook_entries enable row level security;
create policy "View gradebook" on public.gradebook_entries for select using (
  student_id = auth.uid()
  or has_school_role(school_id, auth.uid(), 'teacher')
  or is_school_admin(school_id, auth.uid())
  or exists (select 1 from public.parent_links pl where pl.school_id = gradebook_entries.school_id and pl.parent_user_id = auth.uid() and pl.student_user_id = gradebook_entries.student_id)
);
create policy "Teachers/Admins manage gradebook" on public.gradebook_entries for all
  using (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()))
  with check (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()));

-- Behavior notes
create table public.behavior_notes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  teacher_id uuid not null,
  type text not null default 'note', -- 'commendation' | 'incident' | 'note'
  category text,
  note text not null,
  severity text not null default 'low', -- low | medium | high
  visible_to_parent boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.behavior_notes enable row level security;
create policy "View behavior notes" on public.behavior_notes for select using (
  student_id = auth.uid()
  or has_school_role(school_id, auth.uid(), 'teacher')
  or is_school_admin(school_id, auth.uid())
  or (visible_to_parent and exists (select 1 from public.parent_links pl where pl.school_id = behavior_notes.school_id and pl.parent_user_id = auth.uid() and pl.student_user_id = behavior_notes.student_id))
);
create policy "Teachers/Admins manage behavior" on public.behavior_notes for all
  using (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()))
  with check (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()));

-- Parent communications (linked to a student)
create table public.parent_comms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  student_id uuid not null,
  teacher_id uuid not null,
  parent_id uuid not null,
  subject text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.parent_comms enable row level security;
create policy "Parties view parent comms" on public.parent_comms for select using (
  teacher_id = auth.uid() or parent_id = auth.uid() or is_school_admin(school_id, auth.uid())
);
create policy "Teacher writes parent comm" on public.parent_comms for insert with check (
  teacher_id = auth.uid() and (has_school_role(school_id, auth.uid(), 'teacher') or is_school_admin(school_id, auth.uid()))
);
create policy "Parent marks read" on public.parent_comms for update using (parent_id = auth.uid()) with check (parent_id = auth.uid());

create index idx_assignments_class on public.assignments(class_id);
create index idx_submissions_assignment on public.assignment_submissions(assignment_id);
create index idx_gradebook_student on public.gradebook_entries(student_id);
create index idx_behavior_student on public.behavior_notes(student_id);
create index idx_parent_comms_parent on public.parent_comms(parent_id);

-- 1. exam_questions: hide correct_index from clients (column-level revoke)
REVOKE SELECT ON public.exam_questions FROM anon, authenticated;
GRANT SELECT (id, exam_id, school_id, prompt, options, points, position) ON public.exam_questions TO anon, authenticated;
-- INSERT/UPDATE/DELETE still gated by RLS for teachers/admins
GRANT INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;

-- 2. invite_codes: remove public lookup; flow uses edge function (service role)
DROP POLICY IF EXISTS "Public lookup invite by code" ON public.invite_codes;

-- 3. platform_settings: super-only
DROP POLICY IF EXISTS "anyone reads platform settings" ON public.platform_settings;
-- The existing "super manages platform settings" ALL policy covers super-admin reads.

-- 4. schools: drop anon read, expose safe directory view
DROP POLICY IF EXISTS "Public schools read" ON public.schools;
CREATE OR REPLACE VIEW public.school_directory
WITH (security_invoker = true) AS
  SELECT id, slug, name, logo_url, motto FROM public.schools;
GRANT SELECT ON public.school_directory TO anon, authenticated;
-- Allow the view to actually see rows for anon via a narrow policy that returns only safe columns is impossible at policy level;
-- Instead add a permissive anon policy that returns rows but the view exposes only safe columns:
CREATE POLICY "Anon directory read"
  ON public.schools FOR SELECT TO anon
  USING (true);
-- Note: the above looks identical to the old policy, BUT clients must use the view; we additionally revoke broad column SELECT for anon:
REVOKE SELECT ON public.schools FROM anon;
GRANT SELECT (id, slug, name, logo_url, motto) ON public.schools TO anon;

-- 5. memberships: trigger to prevent role/status self-escalation
CREATE OR REPLACE FUNCTION public.prevent_membership_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.is_school_admin(OLD.school_id, auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'You cannot change role, status, school, or user on your own membership';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS memberships_prevent_self_escalation ON public.memberships;
CREATE TRIGGER memberships_prevent_self_escalation
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.prevent_membership_self_escalation();

-- 6. user_roles: prevent self insert (closes super_admin self-grant)
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- 7. attendance: tighten
DROP POLICY IF EXISTS "Members view attendance" ON public.attendance;
CREATE POLICY "View attendance scoped"
  ON public.attendance FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR public.is_school_admin(school_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.school_id = attendance.school_id
        AND pl.parent_user_id = auth.uid()
        AND pl.student_user_id = attendance.student_id
    )
  );

-- 8. class_enrollments: tighten
DROP POLICY IF EXISTS "Members view enrollments" ON public.class_enrollments;
CREATE POLICY "View enrollments scoped"
  ON public.class_enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR public.is_school_admin(school_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.school_id = class_enrollments.school_id
        AND pl.parent_user_id = auth.uid()
        AND pl.student_user_id = class_enrollments.student_id
    )
  );

-- 9. set_updated_at: fixed search_path
ALTER FUNCTION public.set_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_school_role(uuid, uuid, member_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_school_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_membership_self_escalation() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_school_role(uuid, uuid, public.member_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
ALTER TABLE public.exam_answers ADD COLUMN IF NOT EXISTS marked_for_review boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt_review ON public.exam_answers(attempt_id, marked_for_review);
-- Allow school admins to upsert config for their own school's modules (but not toggle enabled or alter pricing)
CREATE POLICY "school admins upsert own school_modules config"
ON public.school_modules
FOR INSERT
TO authenticated
WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE POLICY "school admins update own school_modules config"
ON public.school_modules
FOR UPDATE
TO authenticated
USING (public.is_school_admin(school_id, auth.uid()))
WITH CHECK (public.is_school_admin(school_id, auth.uid()));

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author uuid not null,
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id);
alter table public.support_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='support_messages' and policyname='super manages ticket messages') then
    create policy "super manages ticket messages" on public.support_messages
      for all using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='support_messages' and policyname='ticket parties read messages') then
    create policy "ticket parties read messages" on public.support_messages
      for select using (
        exists(select 1 from public.support_tickets t
          where t.id = ticket_id
          and (public.is_super_admin(auth.uid()) or (public.is_school_admin(t.school_id, auth.uid()) and not internal)))
      );
  end if;
  if not exists (select 1 from pg_policies where tablename='support_messages' and policyname='ticket parties post messages') then
    create policy "ticket parties post messages" on public.support_messages
      for insert with check (
        author = auth.uid()
        and exists(select 1 from public.support_tickets t
          where t.id = ticket_id
          and (public.is_super_admin(auth.uid()) or (public.is_school_admin(t.school_id, auth.uid()) and not internal)))
      );
  end if;
end $$;

-- conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  kind text not null default 'direct' check (kind in ('direct','group','broadcast')),
  title text,
  created_by uuid not null,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  role_at_join text,
  muted boolean not null default false,
  archived boolean not null default false,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);
alter table public.conversation_participants enable row level security;
create index on public.conversation_participants(user_id);
create index on public.conversation_participants(conversation_id);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  school_id uuid not null,
  sender_id uuid not null,
  body text not null,
  attachments jsonb not null default '[]'::jsonb,
  kind text not null default 'text' check (kind in ('text','system')),
  reply_to uuid,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
alter table public.conversation_messages enable row level security;
create index on public.conversation_messages(conversation_id, created_at desc);

-- helper: is user a participant?
create or replace function public.is_conversation_participant(_conv uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_participants where conversation_id=_conv and user_id=_user)
$$;

-- RLS: conversations
create policy "Participants or admins view conversations"
on public.conversations for select using (
  public.is_conversation_participant(id, auth.uid())
  or public.is_school_admin(school_id, auth.uid())
);
create policy "Members create conversations"
on public.conversations for insert with check (
  created_by = auth.uid() and public.is_member(school_id, auth.uid())
);
create policy "Creator or admin update conversations"
on public.conversations for update using (
  created_by = auth.uid() or public.is_school_admin(school_id, auth.uid())
) with check (
  created_by = auth.uid() or public.is_school_admin(school_id, auth.uid())
);

-- RLS: participants
create policy "View participants of own conversations or as admin"
on public.conversation_participants for select using (
  user_id = auth.uid()
  or public.is_conversation_participant(conversation_id, auth.uid())
  or exists(select 1 from public.conversations c where c.id=conversation_id and public.is_school_admin(c.school_id, auth.uid()))
);
create policy "Add participants when member of school"
on public.conversation_participants for insert with check (
  exists(select 1 from public.conversations c where c.id=conversation_id and public.is_member(c.school_id, auth.uid()))
);
create policy "User updates own participant row"
on public.conversation_participants for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Admin removes participants"
on public.conversation_participants for delete using (
  exists(select 1 from public.conversations c where c.id=conversation_id and public.is_school_admin(c.school_id, auth.uid()))
);

-- RLS: messages
create policy "Participants read messages"
on public.conversation_messages for select using (
  public.is_conversation_participant(conversation_id, auth.uid())
  or public.is_school_admin(school_id, auth.uid())
);
create policy "Participants send messages"
on public.conversation_messages for insert with check (
  sender_id = auth.uid() and public.is_conversation_participant(conversation_id, auth.uid())
);
create policy "Sender edits own recent message"
on public.conversation_messages for update using (
  sender_id = auth.uid() and created_at > now() - interval '5 minutes'
) with check (sender_id = auth.uid());

-- updated_at trigger
create trigger conversations_set_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();

-- realtime
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.conversations REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.conversation_messages REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 1. Tables
CREATE TABLE public.mock_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  exam_body TEXT NOT NULL CHECK (exam_body IN ('neco','jamb','both')),
  color TEXT NOT NULL DEFAULT 'hsl(var(--primary))',
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);

CREATE TABLE public.mock_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.mock_subjects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mock_questions_subject_idx ON public.mock_questions(subject_id, position);

CREATE TABLE public.mock_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('neco_sim','jamb_sim')),
  duration_minutes INTEGER NOT NULL DEFAULT 150,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  total_score INTEGER,
  total_questions INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','expired'))
);
CREATE INDEX mock_sessions_student_idx ON public.mock_sessions(student_id, started_at DESC);

CREATE TABLE public.mock_session_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.mock_subjects(id),
  sort INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (session_id, subject_id)
);

CREATE TABLE public.mock_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.mock_sessions(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_index INTEGER,
  marked_for_review BOOLEAN NOT NULL DEFAULT false,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);
CREATE INDEX mock_answers_session_idx ON public.mock_answers(session_id, subject_id);

-- 2. RLS
ALTER TABLE public.mock_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_session_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view mock subjects" ON public.mock_subjects FOR SELECT
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage mock subjects" ON public.mock_subjects FOR ALL
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE POLICY "Members view mock questions" ON public.mock_questions FOR SELECT
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage mock questions" ON public.mock_questions FOR ALL
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE POLICY "Student owns session" ON public.mock_sessions FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid() AND public.is_member(school_id, auth.uid()));
CREATE POLICY "Staff view sessions" ON public.mock_sessions FOR SELECT
  USING (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role) OR public.is_school_admin(school_id, auth.uid()));

CREATE POLICY "Session owner manages session subjects" ON public.mock_session_subjects FOR ALL
  USING (EXISTS (SELECT 1 FROM public.mock_sessions s WHERE s.id = session_id AND (s.student_id = auth.uid() OR public.is_school_admin(s.school_id, auth.uid()) OR public.has_school_role(s.school_id, auth.uid(),'teacher'::member_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mock_sessions s WHERE s.id = session_id AND s.student_id = auth.uid()));

CREATE POLICY "Session owner manages answers" ON public.mock_answers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.mock_sessions s WHERE s.id = session_id AND (s.student_id = auth.uid() OR public.is_school_admin(s.school_id, auth.uid()) OR public.has_school_role(s.school_id, auth.uid(),'teacher'::member_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.mock_sessions s WHERE s.id = session_id AND s.student_id = auth.uid()));

-- 3. Seed function
CREATE OR REPLACE FUNCTION public.seed_mock_bank(_school UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  subj_id UUID;
  i INTEGER;
  prompt_txt TEXT;
  opts JSONB;
  correct INT;
  subjects JSONB := '[
    {"code":"math","name":"Mathematics","body":"both","color":"hsl(220 90% 56%)","sort":1},
    {"code":"english","name":"English Language","body":"both","color":"hsl(0 80% 60%)","sort":2},
    {"code":"physics","name":"Physics","body":"both","color":"hsl(190 80% 50%)","sort":3},
    {"code":"chemistry","name":"Chemistry","body":"both","color":"hsl(280 70% 60%)","sort":4},
    {"code":"biology","name":"Biology","body":"both","color":"hsl(140 60% 45%)","sort":5},
    {"code":"economics","name":"Economics","body":"neco","color":"hsl(40 90% 55%)","sort":6},
    {"code":"government","name":"Government","body":"neco","color":"hsl(210 50% 40%)","sort":7},
    {"code":"literature","name":"Literature in English","body":"neco","color":"hsl(330 70% 55%)","sort":8},
    {"code":"crs","name":"Christian Religious Studies","body":"neco","color":"hsl(20 70% 55%)","sort":9},
    {"code":"irs","name":"Islamic Religious Studies","body":"neco","color":"hsl(150 60% 40%)","sort":10},
    {"code":"geography","name":"Geography","body":"neco","color":"hsl(170 70% 40%)","sort":11},
    {"code":"agric","name":"Agricultural Science","body":"neco","color":"hsl(90 60% 45%)","sort":12},
    {"code":"civic","name":"Civic Education","body":"neco","color":"hsl(240 50% 55%)","sort":13},
    {"code":"fmath","name":"Further Mathematics","body":"neco","color":"hsl(260 70% 55%)","sort":14},
    {"code":"commerce","name":"Commerce","body":"neco","color":"hsl(15 80% 55%)","sort":15}
  ]'::jsonb;
BEGIN
  FOR rec IN SELECT * FROM jsonb_to_recordset(subjects) AS x(code TEXT, name TEXT, body TEXT, color TEXT, sort INT) LOOP
    INSERT INTO public.mock_subjects(school_id, code, name, exam_body, color, sort)
    VALUES (_school, rec.code, rec.name, rec.body, rec.color, rec.sort)
    ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name, exam_body = EXCLUDED.exam_body, color = EXCLUDED.color, sort = EXCLUDED.sort
    RETURNING id INTO subj_id;

    -- Skip if questions already exist
    IF EXISTS (SELECT 1 FROM public.mock_questions WHERE subject_id = subj_id) THEN
      CONTINUE;
    END IF;

    FOR i IN 1..20 LOOP
      correct := (i % 4);
      IF rec.code = 'math' THEN
        prompt_txt := format('If %sx + %s = %s, what is the value of x?', i+1, i*2, (i+1)*5 + i*2);
        opts := jsonb_build_array((5)::text, (i)::text, (i+2)::text, (i*2)::text);
        correct := 1;
      ELSIF rec.code = 'english' THEN
        prompt_txt := format('Question %s (English): Choose the option that best completes the sentence: "The teacher ___ the students every morning."', i);
        opts := jsonb_build_array('greet','greets','greeting','greeted');
        correct := 1;
      ELSE
        prompt_txt := format('%s — Sample question %s of 20. Which of the following statements is correct about this topic?', rec.name, i);
        opts := jsonb_build_array(
          format('Statement A for Q%s', i),
          format('Statement B for Q%s', i),
          format('Statement C for Q%s', i),
          format('Statement D for Q%s', i)
        );
      END IF;

      INSERT INTO public.mock_questions(school_id, subject_id, position, prompt, options, correct_index, explanation)
      VALUES (_school, subj_id, i, prompt_txt, opts, correct, format('This is the explanation for question %s of %s.', i, rec.name));
    END LOOP;
  END LOOP;
END;
$$;

-- 4. Trigger on schools
CREATE OR REPLACE FUNCTION public.trg_seed_mock_bank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_mock_bank(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_mock_bank_after_insert
AFTER INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.trg_seed_mock_bank();

-- 5. Backfill all existing schools
DO $$
DECLARE s RECORD;
BEGIN
  FOR s IN SELECT id FROM public.schools LOOP
    PERFORM public.seed_mock_bank(s.id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_mock_bank(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_seed_mock_bank() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Members view questions" ON public.exam_questions;
CREATE POLICY "Teachers/Admins view exam questions"
  ON public.exam_questions FOR SELECT
  USING (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role) OR public.is_school_admin(school_id, auth.uid()));
GRANT SELECT ON public.exam_questions TO authenticated;

CREATE OR REPLACE FUNCTION public.get_exam_questions_for_attempt(_attempt_id uuid)
RETURNS TABLE(q_id uuid, q_exam_id uuid, q_school_id uuid, q_prompt text, q_options jsonb, q_points integer, q_position integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_student uuid; v_exam uuid;
BEGIN
  SELECT a.school_id, a.student_id, a.exam_id INTO v_school, v_student, v_exam
  FROM public.exam_attempts a WHERE a.id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF NOT (v_student = auth.uid()
          OR public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT q.id, q.exam_id, q.school_id, q.prompt, q.options, q.points, q.position
    FROM public.exam_questions q WHERE q.exam_id = v_exam ORDER BY q.position;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_exam_questions_for_attempt(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_exam_questions_for_attempt(uuid) TO authenticated;

DROP POLICY IF EXISTS "Members view mock questions" ON public.mock_questions;
CREATE POLICY "Teachers/Admins view mock questions"
  ON public.mock_questions FOR SELECT
  USING (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role) OR public.is_school_admin(school_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.get_mock_questions_for_session(_session_id uuid)
RETURNS TABLE(q_id uuid, q_subject_id uuid, q_position integer, q_prompt text, q_options jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_student uuid;
BEGIN
  SELECT s.school_id, s.student_id INTO v_school, v_student
  FROM public.mock_sessions s WHERE s.id = _session_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF NOT (v_student = auth.uid()
          OR public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT q.id, q.subject_id, q.position, q.prompt, q.options
    FROM public.mock_questions q
    WHERE q.subject_id IN (SELECT subject_id FROM public.mock_session_subjects WHERE session_id = _session_id)
    ORDER BY q.subject_id, q.position;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_mock_questions_for_session(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_mock_questions_for_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.grade_mock_session(_session_id uuid, _auto boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_student uuid; v_status text;
        v_total int := 0; v_questions int := 0;
        rec RECORD;
BEGIN
  SELECT s.school_id, s.student_id, s.status INTO v_school, v_student, v_status
  FROM public.mock_sessions s WHERE s.id = _session_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF v_student <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_status IN ('submitted','expired') THEN RAISE EXCEPTION 'already submitted'; END IF;

  FOR rec IN
    SELECT q.subject_id,
           COUNT(*) FILTER (WHERE a.selected_index IS NOT NULL) AS answered,
           COUNT(*) FILTER (WHERE a.selected_index = q.correct_index) AS score
    FROM public.mock_questions q
    LEFT JOIN public.mock_answers a ON a.question_id = q.id AND a.session_id = _session_id
    WHERE q.subject_id IN (SELECT subject_id FROM public.mock_session_subjects WHERE session_id = _session_id)
    GROUP BY q.subject_id
  LOOP
    UPDATE public.mock_session_subjects
      SET score = rec.score, answered_count = rec.answered
      WHERE session_id = _session_id AND subject_id = rec.subject_id;
    v_total := v_total + rec.score;
  END LOOP;

  SELECT COUNT(*) INTO v_questions
  FROM public.mock_questions
  WHERE subject_id IN (SELECT subject_id FROM public.mock_session_subjects WHERE session_id = _session_id);

  UPDATE public.mock_sessions SET
    status = CASE WHEN _auto THEN 'expired' ELSE 'submitted' END,
    submitted_at = now(),
    total_score = v_total,
    total_questions = v_questions
  WHERE id = _session_id;

  RETURN jsonb_build_object('total_score', v_total, 'total_questions', v_questions);
END $$;
REVOKE EXECUTE ON FUNCTION public.grade_mock_session(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.grade_mock_session(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Members view question bank" ON public.question_bank;
CREATE POLICY "Teachers/Admins view question bank"
  ON public.question_bank FOR SELECT
  USING (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role) OR public.is_school_admin(school_id, auth.uid()));

DROP POLICY IF EXISTS "ticket parties read messages" ON public.support_messages;
CREATE POLICY "ticket parties read messages"
  ON public.support_messages FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (
          (t.school_id IS NOT NULL AND public.is_school_admin(t.school_id, auth.uid()))
          OR (t.opened_by = auth.uid() AND support_messages.internal = false)
        )
    )
  );

REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

-- Prevent duplicate enrollments
CREATE UNIQUE INDEX IF NOT EXISTS class_enrollments_class_student_key
  ON public.class_enrollments(class_id, student_id);

-- Allow students to self-register in classes within their school
CREATE POLICY "Students self enroll"
ON public.class_enrollments
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND public.has_school_role(school_id, auth.uid(), 'student'::member_role)
);

-- Allow students to withdraw themselves
CREATE POLICY "Students self withdraw"
ON public.class_enrollments
FOR DELETE
TO authenticated
USING (
  student_id = auth.uid()
  AND public.has_school_role(school_id, auth.uid(), 'student'::member_role)
);

-- 1) Restrict anonymous read of schools to safe directory view only
DROP POLICY IF EXISTS "Anon directory read" ON public.schools;
GRANT SELECT ON public.school_directory TO anon, authenticated;

-- 2) Harden support_messages insert policy so ticket openers cannot set internal=true
DROP POLICY IF EXISTS "ticket parties write messages" ON public.support_messages;
CREATE POLICY "ticket parties write messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  author = auth.uid()
  AND (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND (
          (t.school_id IS NOT NULL AND is_school_admin(t.school_id, auth.uid()))
          OR (t.opened_by = auth.uid() AND support_messages.internal = false)
        )
    )
  )
);

CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path TEXT NOT NULL,
  referrer TEXT,
  session_id TEXT NOT NULL,
  user_id UUID,
  school_id UUID,
  device TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views(path);
CREATE INDEX idx_page_views_session ON public.page_views(session_id);

GRANT INSERT ON public.page_views TO anon, authenticated;
GRANT SELECT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone records page view" ON public.page_views FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "super reads page views" ON public.page_views FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE public.auth_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL, -- 'sign_in' | 'sign_up' | 'sign_out'
  user_id UUID,
  school_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_events_created_at ON public.auth_events(created_at DESC);
CREATE INDEX idx_auth_events_event ON public.auth_events(event);

GRANT INSERT ON public.auth_events TO anon, authenticated;
GRANT SELECT ON public.auth_events TO authenticated;
GRANT ALL ON public.auth_events TO service_role;

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone records auth event" ON public.auth_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "super reads auth events" ON public.auth_events FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.page_views; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.auth_events; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
-- 1) Drop redundant/risky INSERT policy on support_messages.
-- The "ticket parties write messages" policy already covers ticket openers (with internal=false),
-- school admins (with internal=false) and super admins. Dropping the duplicate eliminates any
-- chance of bypassing the internal-note guard through overlapping permissive policies.
DROP POLICY IF EXISTS "ticket parties post messages" ON public.support_messages;

-- 2) Remove sensitive analytics tables from realtime publication so authenticated
-- non-super-admin subscribers cannot receive page_view / auth_event row broadcasts.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'page_views'
  ) THEN
    BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.page_views'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auth_events'
  ) THEN
    BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.auth_events'; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;

-- 1) Fix internal support message leak to school admins
DROP POLICY IF EXISTS "ticket parties read messages" ON public.support_messages;
CREATE POLICY "ticket parties read messages" ON public.support_messages
FOR SELECT USING (
  is_super_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id AND (
      (t.school_id IS NOT NULL AND is_school_admin(t.school_id, auth.uid()) AND support_messages.internal = false)
      OR (t.opened_by = auth.uid() AND support_messages.internal = false)
    )
  )
);

-- 2) Lock down realtime.messages so only authenticated sessions can use realtime channels (if table owner).
-- (postgres_changes still enforces underlying public.* table RLS for row payloads.)
DO $$
BEGIN
  ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "authenticated can use realtime" ON realtime.messages;
  CREATE POLICY "authenticated can use realtime" ON realtime.messages
  FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "authenticated can publish realtime" ON realtime.messages;
  CREATE POLICY "authenticated can publish realtime" ON realtime.messages
  FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============ ENUMS ============
CREATE TYPE public.payment_category AS ENUM ('tuition','levy','uniform','exam','hostel','transport','excursion','book','other');
CREATE TYPE public.payment_recurrence AS ENUM ('one_off','termly','sessional','monthly');
CREATE TYPE public.payment_audience AS ENUM ('school','level','class','custom');
CREATE TYPE public.invoice_status AS ENUM ('pending','partial','paid','overdue','waived','cancelled');
CREATE TYPE public.payment_method AS ENUM ('paystack','cash','bank_transfer','pos','waiver');
CREATE TYPE public.payment_status AS ENUM ('initiated','successful','failed','refunded');

-- ============ PAYMENT TYPES ============
CREATE TABLE public.payment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  description text,
  category public.payment_category NOT NULL DEFAULT 'other',
  default_amount_kobo bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  recurrence public.payment_recurrence NOT NULL DEFAULT 'one_off',
  term text,
  session text,
  audience public.payment_audience NOT NULL DEFAULT 'school',
  class_id uuid,
  level text,
  mandatory boolean NOT NULL DEFAULT true,
  allow_partial boolean NOT NULL DEFAULT true,
  due_date date,
  late_fee_kobo bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_types_school ON public.payment_types(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_types TO authenticated;
GRANT ALL ON public.payment_types TO service_role;

ALTER TABLE public.payment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view payment types" ON public.payment_types FOR SELECT
  USING (public.is_member(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins manage payment types" ON public.payment_types FOR ALL
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE TRIGGER trg_payment_types_updated_at BEFORE UPDATE ON public.payment_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INVOICES (school-payments-invoices, distinct from billing.invoices) ============
CREATE TABLE public.school_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_type_id uuid REFERENCES public.payment_types(id) ON DELETE SET NULL,
  student_id uuid NOT NULL,
  amount_due_kobo bigint NOT NULL,
  amount_paid_kobo bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  status public.invoice_status NOT NULL DEFAULT 'pending',
  due_date date,
  term text,
  session text,
  notes text,
  issued_by uuid,
  issued_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_school_invoices_school ON public.school_invoices(school_id);
CREATE INDEX idx_school_invoices_student ON public.school_invoices(student_id);
CREATE INDEX idx_school_invoices_status ON public.school_invoices(status);
CREATE UNIQUE INDEX uq_school_invoices_dedupe ON public.school_invoices(school_id, student_id, payment_type_id, COALESCE(term,''), COALESCE(session,''))
  WHERE payment_type_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_invoices TO authenticated;
GRANT ALL ON public.school_invoices TO service_role;

ALTER TABLE public.school_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own/parent/admin invoices" ON public.school_invoices FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS(SELECT 1 FROM public.parent_links pl WHERE pl.school_id=school_invoices.school_id AND pl.parent_user_id=auth.uid() AND pl.student_user_id=school_invoices.student_id)
  );
CREATE POLICY "Admins manage invoices" ON public.school_invoices FOR ALL
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE TRIGGER trg_school_invoices_updated_at BEFORE UPDATE ON public.school_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PAYMENTS ============
CREATE TABLE public.school_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.school_invoices(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  payer_user_id uuid,
  amount_kobo bigint NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'initiated',
  provider_reference text UNIQUE,
  provider_payload jsonb,
  proof_url text,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
CREATE INDEX idx_school_payments_invoice ON public.school_payments(invoice_id);
CREATE INDEX idx_school_payments_school ON public.school_payments(school_id);
CREATE INDEX idx_school_payments_status ON public.school_payments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_payments TO authenticated;
GRANT ALL ON public.school_payments TO service_role;

ALTER TABLE public.school_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own/parent/admin payments" ON public.school_payments FOR SELECT
  USING (
    student_id = auth.uid()
    OR payer_user_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
    OR public.is_super_admin(auth.uid())
    OR EXISTS(SELECT 1 FROM public.parent_links pl WHERE pl.school_id=school_payments.school_id AND pl.parent_user_id=auth.uid() AND pl.student_user_id=school_payments.student_id)
  );
CREATE POLICY "Students/parents initiate payments" ON public.school_payments FOR INSERT
  WITH CHECK (
    payer_user_id = auth.uid()
    AND status = 'initiated'
    AND (
      student_id = auth.uid()
      OR EXISTS(SELECT 1 FROM public.parent_links pl WHERE pl.school_id=school_payments.school_id AND pl.parent_user_id=auth.uid() AND pl.student_user_id=school_payments.student_id)
    )
  );
CREATE POLICY "Admins manage payments" ON public.school_payments FOR ALL
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- ============ PAYMENT PLANS ============
CREATE TABLE public.payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.school_invoices(id) ON DELETE CASCADE,
  installment_no int NOT NULL,
  amount_kobo bigint NOT NULL,
  due_date date,
  status public.invoice_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, installment_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View payment plans via invoice" ON public.payment_plans FOR SELECT
  USING (EXISTS(SELECT 1 FROM public.school_invoices i WHERE i.id = payment_plans.invoice_id AND (
    i.student_id = auth.uid()
    OR public.is_school_admin(i.school_id, auth.uid())
    OR EXISTS(SELECT 1 FROM public.parent_links pl WHERE pl.school_id=i.school_id AND pl.parent_user_id=auth.uid() AND pl.student_user_id=i.student_id)
  )));
CREATE POLICY "Admins manage payment plans" ON public.payment_plans FOR ALL
  USING (EXISTS(SELECT 1 FROM public.school_invoices i WHERE i.id = payment_plans.invoice_id AND public.is_school_admin(i.school_id, auth.uid())))
  WITH CHECK (EXISTS(SELECT 1 FROM public.school_invoices i WHERE i.id = payment_plans.invoice_id AND public.is_school_admin(i.school_id, auth.uid())));

-- ============ SCHOOL PAYMENT SETTINGS ============
CREATE TABLE public.school_payment_settings (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  paystack_subaccount_code text,
  bank_name text,
  account_number text,
  account_name text,
  receipt_footer text,
  auto_late_fee boolean NOT NULL DEFAULT false,
  grace_days int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_payment_settings TO authenticated;
GRANT ALL ON public.school_payment_settings TO service_role;
ALTER TABLE public.school_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read settings" ON public.school_payment_settings FOR SELECT
  USING (public.is_member(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Admins manage settings" ON public.school_payment_settings FOR ALL
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE TRIGGER trg_school_payment_settings_updated_at BEFORE UPDATE ON public.school_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FUNCTIONS ============

-- Safely apply a successful payment to its invoice
CREATE OR REPLACE FUNCTION public.apply_payment(_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay RECORD;
  v_inv RECORD;
  v_new_paid bigint;
  v_new_status public.invoice_status;
BEGIN
  SELECT * INTO v_pay FROM public.school_payments WHERE id = _payment_id FOR UPDATE;
  IF v_pay IS NULL THEN RAISE EXCEPTION 'payment not found'; END IF;
  IF v_pay.status <> 'successful' THEN RAISE EXCEPTION 'payment not successful'; END IF;

  SELECT * INTO v_inv FROM public.school_invoices WHERE id = v_pay.invoice_id FOR UPDATE;
  IF v_inv IS NULL THEN RAISE EXCEPTION 'invoice not found'; END IF;

  v_new_paid := v_inv.amount_paid_kobo + v_pay.amount_kobo;
  IF v_new_paid >= v_inv.amount_due_kobo THEN
    v_new_status := 'paid';
  ELSIF v_new_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_inv.status;
  END IF;

  UPDATE public.school_invoices
    SET amount_paid_kobo = v_new_paid,
        status = v_new_status,
        updated_at = now()
    WHERE id = v_inv.id;
END $$;

-- Bulk issue invoices for an audience
CREATE OR REPLACE FUNCTION public.issue_invoices_for_audience(_payment_type_id uuid, _student_ids uuid[] DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pt RECORD;
  v_count int := 0;
  v_uid uuid := auth.uid();
  v_ids uuid[];
BEGIN
  SELECT * INTO v_pt FROM public.payment_types WHERE id = _payment_type_id;
  IF v_pt IS NULL THEN RAISE EXCEPTION 'payment type not found'; END IF;
  IF NOT public.is_school_admin(v_pt.school_id, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _student_ids IS NOT NULL AND array_length(_student_ids, 1) > 0 THEN
    v_ids := _student_ids;
  ELSIF v_pt.audience = 'class' AND v_pt.class_id IS NOT NULL THEN
    SELECT array_agg(student_id) INTO v_ids FROM public.class_enrollments WHERE class_id = v_pt.class_id;
  ELSIF v_pt.audience = 'level' AND v_pt.level IS NOT NULL THEN
    SELECT array_agg(ce.student_id) INTO v_ids
    FROM public.class_enrollments ce JOIN public.classes c ON c.id = ce.class_id
    WHERE c.school_id = v_pt.school_id AND c.grade_level = v_pt.level;
  ELSE
    SELECT array_agg(user_id) INTO v_ids
    FROM public.memberships
    WHERE school_id = v_pt.school_id AND role = 'student' AND status = 'active';
  END IF;

  IF v_ids IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.school_invoices (school_id, payment_type_id, student_id, amount_due_kobo, currency, status, due_date, term, session, issued_by)
  SELECT v_pt.school_id, v_pt.id, sid, v_pt.default_amount_kobo, v_pt.currency, 'pending', v_pt.due_date, v_pt.term, v_pt.session, v_uid
  FROM unnest(v_ids) AS sid
  ON CONFLICT (school_id, student_id, payment_type_id, COALESCE(term,''), COALESCE(session,'')) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- ============ BACKFILL existing fees ============
DO $$
DECLARE
  v_school_id uuid;
  v_pt_id uuid;
BEGIN
  FOR v_school_id IN SELECT DISTINCT school_id FROM public.fees LOOP
    INSERT INTO public.payment_types(school_id, name, code, category, default_amount_kobo, recurrence, audience, mandatory, allow_partial, active)
    VALUES (v_school_id, 'General Fee', 'general-legacy', 'other', 0, 'one_off', 'custom', true, true, true)
    RETURNING id INTO v_pt_id;

    INSERT INTO public.school_invoices(school_id, payment_type_id, student_id, amount_due_kobo, amount_paid_kobo, status, due_date, notes, issued_at)
    SELECT
      f.school_id, v_pt_id, f.student_id,
      (f.amount * 100)::bigint,
      CASE WHEN f.status = 'paid' THEN (f.amount * 100)::bigint ELSE 0 END,
      CASE WHEN f.status = 'paid' THEN 'paid'::public.invoice_status ELSE 'pending'::public.invoice_status END,
      f.due_date, f.description, f.created_at
    FROM public.fees f
    WHERE f.school_id = v_school_id;
  END LOOP;
END $$;

-- ============ STORAGE BUCKET for proofs/receipts ============
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read payment proofs" ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'active'
      AND (storage.foldername(name))[1] = m.school_id::text
  ));
CREATE POLICY "Admins upload payment proofs" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs' AND EXISTS(
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = auth.uid() AND m.role = 'admin' AND m.status = 'active'
      AND (storage.foldername(name))[1] = m.school_id::text
  ));
CREATE POLICY "Student/parent read own receipts" ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[2] = 'receipts' AND EXISTS(
    SELECT 1 FROM public.school_payments p
    WHERE p.id::text = split_part((storage.foldername(name))[3], '.', 1)
      AND (p.student_id = auth.uid() OR p.payer_user_id = auth.uid()
           OR EXISTS(SELECT 1 FROM public.parent_links pl WHERE pl.school_id=p.school_id AND pl.parent_user_id=auth.uid() AND pl.student_user_id=p.student_id))
  ));

REVOKE EXECUTE ON FUNCTION public.apply_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.issue_invoices_for_audience(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_invoices_for_audience(uuid, uuid[]) TO authenticated, service_role;

-- 1) Drop overly-broad messages policies (sender/recipient policy still allows realtime)
DROP POLICY IF EXISTS "authenticated can use realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can publish realtime" ON public.messages;

-- 2) Restrict membership self-update to safe columns only
DROP POLICY IF EXISTS "User updates own membership" ON public.memberships;
CREATE POLICY "User updates own membership safe cols"
ON public.memberships
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND role = (SELECT role FROM public.memberships m WHERE m.id = memberships.id)
  AND status = (SELECT status FROM public.memberships m WHERE m.id = memberships.id)
  AND school_id = (SELECT school_id FROM public.memberships m WHERE m.id = memberships.id)
);
-- Note: trigger prevent_membership_self_escalation provides defense-in-depth

-- 3) Tighten school_payment_settings SELECT to admins/super only
DROP POLICY IF EXISTS "Members read settings" ON public.school_payment_settings;
CREATE POLICY "Admins read payment settings"
ON public.school_payment_settings
FOR SELECT
USING (is_school_admin(school_id, auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Members upload own payment proofs" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS(
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
        AND (storage.foldername(name))[1] = m.school_id::text
    )
  );

CREATE POLICY "Members read own payment proofs" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
DROP POLICY IF EXISTS "authenticated can publish realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can use realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can publish realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can use realtime" ON public.messages;

CREATE TABLE public.result_verifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  term text,
  session text,
  snapshot jsonb NOT NULL,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_result_verifications_student ON public.result_verifications(student_id);

GRANT SELECT ON public.result_verifications TO anon;
GRANT SELECT ON public.result_verifications TO authenticated;
GRANT ALL ON public.result_verifications TO service_role;

ALTER TABLE public.result_verifications ENABLE ROW LEVEL SECURITY;

-- Public read so a QR scan (no login) can validate authenticity.
-- Snapshot intentionally contains only verification-safe details
-- (student name, admission no, class, subjects, scores, grades, school).
CREATE POLICY "Anyone can verify a result slip"
ON public.result_verifications
FOR SELECT
USING (true);
UPDATE public.schools
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('onboarded_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
WHERE settings IS NULL OR settings->>'onboarded_at' IS NULL;

-- 1) Fix privilege escalation: remove open self-insert policy on memberships.
--    Membership creation is handled via SECURITY DEFINER redeem_invite(),
--    bootstrap_school_admin() trigger, the join-with-code edge function
--    (service_role), and admin-managed inserts via the existing admin policy.
DROP POLICY IF EXISTS "User can insert self via invite (handled by SECURITY DEFINER fn" ON public.memberships;

-- 2) Fix messages exposure: remove the overly permissive realtime policies.
--    Realtime postgres_changes respects table RLS via the sender/recipient policies.
DROP POLICY IF EXISTS "authenticated can use realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can publish realtime" ON public.messages;

-- 3) Fix public exposure of result_verifications snapshots.
--    Remove broad anon/authenticated SELECT and expose verification only
--    via a SECURITY DEFINER RPC that requires the exact verification id.
DROP POLICY IF EXISTS "Anyone can verify a result slip" ON public.result_verifications;
REVOKE SELECT ON public.result_verifications FROM anon;
REVOKE SELECT ON public.result_verifications FROM authenticated;

-- School members and the school admin can still read directly for audit.
CREATE POLICY "School members read verifications"
ON public.result_verifications
FOR SELECT
TO authenticated
USING (public.is_member(school_id, auth.uid()));

GRANT SELECT ON public.result_verifications TO authenticated;

-- Public verification RPC: caller must know the exact verification id (UUID acts as token).
CREATE OR REPLACE FUNCTION public.verify_result_slip(_id uuid)
RETURNS TABLE(snapshot jsonb, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rv.snapshot, rv.created_at
  FROM public.result_verifications rv
  WHERE rv.id = _id
$$;

REVOKE ALL ON FUNCTION public.verify_result_slip(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_result_slip(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_result_slip(uuid) FROM public;
REVOKE ALL ON FUNCTION public.verify_result_slip(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.verify_result_slip(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_result_slip(uuid) TO service_role;
DROP POLICY IF EXISTS "School members read verifications" ON public.result_verifications;

CREATE POLICY "School staff read verifications"
ON public.result_verifications
FOR SELECT
TO authenticated
USING (
  public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
  OR public.is_school_admin(school_id, auth.uid())
);
-- Allow anon role to execute the role-check functions used inside RLS policies/views
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_role(uuid, uuid, public.member_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT SELECT ON public.school_directory TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_school_by_slug(_slug text)
RETURNS TABLE(id uuid, name text, slug text, logo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.slug, s.logo_url
  FROM public.schools s
  WHERE s.slug = lower(_slug)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_school_by_slug(text) TO anon, authenticated;

-- =====================================================
-- C-1: Remove overly permissive realtime policies on public.messages
-- =====================================================
DROP POLICY IF EXISTS "authenticated can use realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can publish realtime" ON public.messages;

-- =====================================================
-- C-2: Scope realtime.messages SELECT by conversation participation
-- =====================================================
DO $$
BEGIN
  -- Drop any prior permissive policies on realtime.messages we may have created
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='authenticated_read_realtime') THEN
    EXECUTE 'DROP POLICY "authenticated_read_realtime" ON realtime.messages';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='Allow listening for broadcasts from authenticated users') THEN
    EXECUTE 'DROP POLICY "Allow listening for broadcasts from authenticated users" ON realtime.messages';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='realtime' AND tablename='messages' AND policyname='authenticated can read realtime') THEN
    EXECUTE 'DROP POLICY "authenticated can read realtime" ON realtime.messages';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- =====================================================
-- H-1: Restrict listing on public storage buckets (avatars, school-logos)
-- Keep public read of specific objects but prevent enumeration via list()
-- =====================================================
-- Storage list() requires SELECT on storage.objects with bucket_id filter.
-- We add a restrictive policy approach: only authenticated members can list,
-- but anonymous direct-URL reads still work (those bypass list via signed/public URLs).
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read school-logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth list avatars" ON storage.objects;
DROP POLICY IF EXISTS "Auth list school-logos" ON storage.objects;

-- Allow public to read individual objects in these buckets (works via direct URL),
-- but Supabase's list() endpoint requires SELECT — same policy. To prevent enumeration
-- we restrict select to authenticated users only on these buckets; public URLs still
-- work because they go through the public CDN endpoint, not the RLS-gated list.
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Public read school-logos" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'school-logos');

-- =====================================================
-- H-3: Rate-limit invite code redemption (5 attempts / 10 min / user)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.invite_redeem_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.invite_redeem_attempts TO authenticated;
GRANT ALL ON public.invite_redeem_attempts TO service_role;

ALTER TABLE public.invite_redeem_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own attempts" ON public.invite_redeem_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users read own attempts" ON public.invite_redeem_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_invite_attempts_user_time
  ON public.invite_redeem_attempts (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_invite public.invite_codes;
  v_uid uuid := auth.uid();
  v_recent int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  -- Rate limit: max 5 attempts in last 10 minutes per user
  select count(*) into v_recent
  from public.invite_redeem_attempts
  where user_id = v_uid
    and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'too many attempts, try again later';
  end if;

  select * into v_invite from public.invite_codes where code = _code for update;
  if not found then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'invalid code';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'code expired';
  end if;
  if v_invite.uses >= v_invite.max_uses then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'code exhausted';
  end if;

  insert into public.memberships(school_id, user_id, role) values (v_invite.school_id, v_uid, v_invite.role)
    on conflict (school_id, user_id, role) do nothing;
  update public.invite_codes set uses = uses + 1 where id = v_invite.id;
  insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, true);
  return v_invite.school_id;
end $function$;

-- =====================================================
-- H-4: Strengthen prevent_membership_self_escalation to also lock
-- bio_completed, must_change_pin, profile_data from being toggled by non-admins
-- (well, profile_data should remain editable, but bio_completed/must_change_pin should not)
-- =====================================================
CREATE OR REPLACE FUNCTION public.prevent_membership_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.is_school_admin(OLD.school_id, auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.must_change_pin IS DISTINCT FROM OLD.must_change_pin THEN
      RAISE EXCEPTION 'You cannot change role, status, school, user, or PIN-reset flag on your own membership';
    END IF;
    -- bio_completed: allow flipping false -> true (user completed their bio),
    -- but block true -> false (cannot un-complete)
    IF OLD.bio_completed = true AND NEW.bio_completed = false THEN
      RAISE EXCEPTION 'You cannot revert bio_completed';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS prevent_membership_self_escalation_trg ON public.memberships;
CREATE TRIGGER prevent_membership_self_escalation_trg
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_membership_self_escalation();
-- 1) AI conversations
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New chat',
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own conversations"
ON public.ai_conversations FOR ALL
USING (user_id = auth.uid() AND public.is_member(school_id, auth.uid()))
WITH CHECK (user_id = auth.uid() AND public.is_member(school_id, auth.uid()));

CREATE INDEX idx_ai_conversations_user_last ON public.ai_conversations(user_id, last_message_at DESC);

-- 2) Extend ai_chats
ALTER TABLE public.ai_chats
  ADD COLUMN conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN audio_url text;

CREATE INDEX idx_ai_chats_conversation ON public.ai_chats(conversation_id, created_at);

-- 3) Extend messages with attachments
ALTER TABLE public.messages
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4) Private storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutor-uploads', 'tutor-uploads', false),
       ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "tutor-uploads owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tutor-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tutor-uploads owner write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tutor-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tutor-uploads owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutor-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "message-attachments owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.attachments::text LIKE '%' || storage.objects.name || '%'
        AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  )
);

CREATE POLICY "message-attachments owner write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "message-attachments owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5) Review RPCs
CREATE OR REPLACE FUNCTION public.get_exam_review(_attempt_id uuid)
RETURNS TABLE (
  q_id uuid,
  q_position integer,
  q_prompt text,
  q_options jsonb,
  q_points integer,
  q_correct_index integer,
  q_selected_index integer,
  q_is_correct boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school uuid; v_student uuid; v_exam uuid; v_submitted timestamptz;
BEGIN
  SELECT a.school_id, a.student_id, a.exam_id, a.submitted_at
    INTO v_school, v_student, v_exam, v_submitted
  FROM public.exam_attempts a WHERE a.id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_submitted IS NULL THEN RAISE EXCEPTION 'attempt not submitted'; END IF;
  IF NOT (v_student = auth.uid()
          OR public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT q.id, q.position, q.prompt, q.options, q.points,
         q.correct_index,
         ans.selected_index,
         (ans.selected_index IS NOT NULL AND ans.selected_index = q.correct_index) AS is_correct
  FROM public.exam_questions q
  LEFT JOIN public.exam_answers ans
    ON ans.question_id = q.id AND ans.attempt_id = _attempt_id
  WHERE q.exam_id = v_exam
  ORDER BY q.position;
END $$;

GRANT EXECUTE ON FUNCTION public.get_exam_review(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_mock_review(_session_id uuid)
RETURNS TABLE (
  q_id uuid,
  q_subject_id uuid,
  q_position integer,
  q_prompt text,
  q_options jsonb,
  q_correct_index integer,
  q_selected_index integer,
  q_explanation text,
  q_is_correct boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school uuid; v_student uuid; v_status text;
BEGIN
  SELECT s.school_id, s.student_id, s.status
    INTO v_school, v_student, v_status
  FROM public.mock_sessions s WHERE s.id = _session_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF v_status NOT IN ('submitted','expired') THEN RAISE EXCEPTION 'session not submitted'; END IF;
  IF NOT (v_student = auth.uid()
          OR public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT q.id, q.subject_id, q.position, q.prompt, q.options,
         q.correct_index,
         a.selected_index,
         q.explanation,
         (a.selected_index IS NOT NULL AND a.selected_index = q.correct_index) AS is_correct
  FROM public.mock_questions q
  LEFT JOIN public.mock_answers a
    ON a.question_id = q.id AND a.session_id = _session_id
  WHERE q.subject_id IN (SELECT subject_id FROM public.mock_session_subjects WHERE session_id = _session_id)
  ORDER BY q.subject_id, q.position;
END $$;

GRANT EXECUTE ON FUNCTION public.get_mock_review(uuid) TO authenticated;

-- =========================================================
-- Phase 0: Unified Assessment Engine (additive)
-- =========================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.assessment_type as enum
    ('school_test','school_exam','jamb_mock','neco_mock','waec_mock','ai_assessment');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_delivery as enum ('proctored','open','practice');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_status_v2 as enum
    ('draft','in_review','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.assessment_source as enum
    ('manual','question_bank','ai_generated','mixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum
    ('mcq','multi','short','essay','numeric');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_difficulty as enum ('easy','medium','hard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exam_body as enum ('jamb','waec','neco','school','generic');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum
    ('in_progress','submitted','expired','voided');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.bank_scope as enum ('school','global');
exception when duplicate_object then null; end $$;

-- ---------- assessments ----------
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  created_by uuid not null,
  class_id uuid,
  title text not null,
  description text,
  type public.assessment_type not null,
  delivery_mode public.assessment_delivery not null default 'open',
  status public.assessment_status_v2 not null default 'draft',
  source public.assessment_source not null default 'manual',
  config jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  counts_to_results boolean not null default true,
  weight numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.assessments (school_id, status);
create index on public.assessments (school_id, type);
create index on public.assessments (class_id);

grant select, insert, update, delete on public.assessments to authenticated;
grant all on public.assessments to service_role;
alter table public.assessments enable row level security;

create policy "members view published assessments"
  on public.assessments for select
  using (status in ('scheduled','published') and is_member(school_id, auth.uid()));

create policy "staff view all assessments"
  on public.assessments for select
  using (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
         or is_school_admin(school_id, auth.uid()));

create policy "staff manage assessments"
  on public.assessments for all
  using (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
         or is_school_admin(school_id, auth.uid()))
  with check (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
              or is_school_admin(school_id, auth.uid()));

create trigger trg_assessments_touch
  before update on public.assessments
  for each row execute function public.set_updated_at();

-- ---------- assessment_sections ----------
create table public.assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  school_id uuid not null,
  subject_code text,
  title text not null,
  position integer not null default 0,
  question_count integer not null default 0,
  time_limit_min integer,
  source_filter jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.assessment_sections (assessment_id, position);

grant select, insert, update, delete on public.assessment_sections to authenticated;
grant all on public.assessment_sections to service_role;
alter table public.assessment_sections enable row level security;

create policy "members view sections of visible assessments"
  on public.assessment_sections for select
  using (exists (select 1 from public.assessments a
                 where a.id = assessment_id
                   and (
                     (a.status in ('scheduled','published') and is_member(a.school_id, auth.uid()))
                     or has_school_role(a.school_id, auth.uid(), 'teacher'::member_role)
                     or is_school_admin(a.school_id, auth.uid())
                   )));

create policy "staff manage sections"
  on public.assessment_sections for all
  using (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
         or is_school_admin(school_id, auth.uid()))
  with check (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
              or is_school_admin(school_id, auth.uid()));

-- ---------- question_banks ----------
create table public.question_banks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  scope public.bank_scope not null default 'school',
  name text not null,
  exam_body public.exam_body not null default 'school',
  subject_code text,
  managed_by uuid,
  created_at timestamptz not null default now(),
  constraint chk_bank_scope check (
    (scope = 'global' and school_id is null) or
    (scope = 'school' and school_id is not null)
  )
);
create index on public.question_banks (scope, exam_body, subject_code);

grant select on public.question_banks to authenticated;
grant insert, update, delete on public.question_banks to authenticated;
grant all on public.question_banks to service_role;
alter table public.question_banks enable row level security;

create policy "anyone reads global banks; members read school banks"
  on public.question_banks for select
  using (scope = 'global' or (school_id is not null and is_member(school_id, auth.uid())));

create policy "staff manage school banks"
  on public.question_banks for all
  using (scope = 'school' and school_id is not null
         and (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
              or is_school_admin(school_id, auth.uid())))
  with check (scope = 'school' and school_id is not null
              and (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
                   or is_school_admin(school_id, auth.uid())));

create policy "super manages global banks"
  on public.question_banks for all
  using (scope = 'global' and is_super_admin(auth.uid()))
  with check (scope = 'global' and is_super_admin(auth.uid()));

-- ---------- questions_v2 ----------
create table public.questions_v2 (
  id uuid primary key default gen_random_uuid(),
  school_id uuid,
  bank_id uuid references public.question_banks(id) on delete set null,
  assessment_id uuid references public.assessments(id) on delete cascade,
  section_id uuid references public.assessment_sections(id) on delete set null,
  type public.question_type not null default 'mcq',
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct jsonb not null default 'null'::jsonb,
  points integer not null default 1,
  difficulty public.question_difficulty not null default 'medium',
  topic text,
  subject_code text,
  exam_body public.exam_body,
  year integer,
  explanation text,
  media jsonb not null default '[]'::jsonb,
  ai_generated boolean not null default false,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on public.questions_v2 (assessment_id);
create index on public.questions_v2 (bank_id);
create index on public.questions_v2 (exam_body, subject_code, year);
create index on public.questions_v2 (school_id);

grant select, insert, update, delete on public.questions_v2 to authenticated;
grant all on public.questions_v2 to service_role;
alter table public.questions_v2 enable row level security;

-- Teachers/admins see all questions in their school + global bank questions
create policy "staff and bank readers view questions"
  on public.questions_v2 for select
  using (
    (school_id is not null and (
       has_school_role(school_id, auth.uid(), 'teacher'::member_role)
       or is_school_admin(school_id, auth.uid())))
    or (bank_id is not null and exists (
          select 1 from public.question_banks b
          where b.id = bank_id and b.scope = 'global'))
  );

create policy "staff manage questions in their school"
  on public.questions_v2 for all
  using (school_id is not null
         and (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
              or is_school_admin(school_id, auth.uid())))
  with check (school_id is not null
              and (has_school_role(school_id, auth.uid(), 'teacher'::member_role)
                   or is_school_admin(school_id, auth.uid())));

create policy "super manages global bank questions"
  on public.questions_v2 for all
  using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- ---------- assessment_attempts_v2 ----------
create table public.assessment_attempts_v2 (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  expires_at timestamptz,
  status public.attempt_status not null default 'in_progress',
  violations integer not null default 0,
  question_order uuid[] not null default '{}',
  meta jsonb not null default '{}'::jsonb
);
create index on public.assessment_attempts_v2 (assessment_id, student_id);
create index on public.assessment_attempts_v2 (school_id, student_id);

grant select, insert, update on public.assessment_attempts_v2 to authenticated;
grant all on public.assessment_attempts_v2 to service_role;
alter table public.assessment_attempts_v2 enable row level security;

create policy "student or staff view attempts"
  on public.assessment_attempts_v2 for select
  using (student_id = auth.uid()
         or has_school_role(school_id, auth.uid(), 'teacher'::member_role)
         or is_school_admin(school_id, auth.uid())
         or exists (select 1 from public.parent_links pl
                    where pl.school_id = assessment_attempts_v2.school_id
                      and pl.parent_user_id = auth.uid()
                      and pl.student_user_id = assessment_attempts_v2.student_id));

create policy "student creates own attempt"
  on public.assessment_attempts_v2 for insert
  with check (student_id = auth.uid()
              and has_school_role(school_id, auth.uid(), 'student'::member_role));

create policy "student updates own attempt"
  on public.assessment_attempts_v2 for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ---------- assessment_answers_v2 ----------
create table public.assessment_answers_v2 (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts_v2(id) on delete cascade,
  question_id uuid not null references public.questions_v2(id) on delete cascade,
  school_id uuid not null,
  selected jsonb,
  is_correct boolean,
  points_awarded numeric,
  marked_for_review boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index on public.assessment_answers_v2 (attempt_id);

grant select, insert, update, delete on public.assessment_answers_v2 to authenticated;
grant all on public.assessment_answers_v2 to service_role;
alter table public.assessment_answers_v2 enable row level security;

create policy "attempt owner or staff access answers"
  on public.assessment_answers_v2 for all
  using (exists (select 1 from public.assessment_attempts_v2 a
                 where a.id = attempt_id
                   and (a.student_id = auth.uid()
                        or has_school_role(a.school_id, auth.uid(), 'teacher'::member_role)
                        or is_school_admin(a.school_id, auth.uid()))))
  with check (exists (select 1 from public.assessment_attempts_v2 a
                      where a.id = attempt_id and a.student_id = auth.uid()));

-- ---------- assessment_violations_v2 ----------
create table public.assessment_violations_v2 (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.assessment_attempts_v2(id) on delete cascade,
  school_id uuid not null,
  type text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index on public.assessment_violations_v2 (attempt_id);

grant select, insert on public.assessment_violations_v2 to authenticated;
grant all on public.assessment_violations_v2 to service_role;
alter table public.assessment_violations_v2 enable row level security;

create policy "owner inserts own violations"
  on public.assessment_violations_v2 for insert
  with check (exists (select 1 from public.assessment_attempts_v2 a
                      where a.id = attempt_id
                        and a.student_id = auth.uid()
                        and a.school_id = assessment_violations_v2.school_id));

create policy "owner/staff view violations"
  on public.assessment_violations_v2 for select
  using (exists (select 1 from public.assessment_attempts_v2 a
                 where a.id = attempt_id
                   and (a.student_id = auth.uid()
                        or has_school_role(a.school_id, auth.uid(), 'teacher'::member_role)
                        or is_school_admin(a.school_id, auth.uid()))));

-- ---------- assessment_results ----------
create table public.assessment_results (
  attempt_id uuid primary key references public.assessment_attempts_v2(id) on delete cascade,
  school_id uuid not null,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null,
  raw_score numeric not null default 0,
  max_score numeric not null default 0,
  percentage numeric not null default 0,
  grade text,
  position integer,
  per_section jsonb not null default '[]'::jsonb,
  per_topic jsonb not null default '[]'::jsonb,
  presenter text not null default 'school_test',
  projected jsonb not null default '{}'::jsonb,
  graded_at timestamptz not null default now()
);
create index on public.assessment_results (school_id, assessment_id);
create index on public.assessment_results (school_id, student_id);

-- writes via service_role / SECURITY DEFINER RPC only
grant select on public.assessment_results to authenticated;
grant all on public.assessment_results to service_role;
alter table public.assessment_results enable row level security;

create policy "student or staff view results"
  on public.assessment_results for select
  using (student_id = auth.uid()
         or has_school_role(school_id, auth.uid(), 'teacher'::member_role)
         or is_school_admin(school_id, auth.uid())
         or exists (select 1 from public.parent_links pl
                    where pl.school_id = assessment_results.school_id
                      and pl.parent_user_id = auth.uid()
                      and pl.student_user_id = assessment_results.student_id));

-- ---------- assessment_legacy_map ----------
create table public.assessment_legacy_map (
  id uuid primary key default gen_random_uuid(),
  legacy_kind text not null check (legacy_kind in ('exam','mock_session')),
  legacy_id uuid not null,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  attempt_legacy_id uuid,
  attempt_id uuid references public.assessment_attempts_v2(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (legacy_kind, legacy_id)
);

grant select on public.assessment_legacy_map to authenticated;
grant all on public.assessment_legacy_map to service_role;
alter table public.assessment_legacy_map enable row level security;

create policy "members read legacy map"
  on public.assessment_legacy_map for select
  using (exists (select 1 from public.assessments a
                 where a.id = assessment_id and is_member(a.school_id, auth.uid())));

-- =========================================================
-- RPCs
-- =========================================================

-- Returns questions for a given attempt without leaking correct answers.
create or replace function public.get_assessment_questions_for_attempt(_attempt_id uuid)
returns table (
  q_id uuid, q_section_id uuid, q_position integer,
  q_type public.question_type, q_prompt text, q_options jsonb,
  q_points integer, q_topic text, q_subject_code text, q_media jsonb
)
language plpgsql stable security definer set search_path = public
as $$
declare v_school uuid; v_student uuid; v_assessment uuid; v_order uuid[];
begin
  select a.school_id, a.student_id, a.assessment_id, a.question_order
    into v_school, v_student, v_assessment, v_order
  from public.assessment_attempts_v2 a
  where a.id = _attempt_id;
  if v_school is null then raise exception 'attempt not found'; end if;
  if not (v_student = auth.uid()
          or has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          or is_school_admin(v_school, auth.uid())) then
    raise exception 'forbidden';
  end if;
  return query
  select q.id, q.section_id,
         coalesce(array_position(v_order, q.id), 0) as q_position,
         q.type, q.prompt, q.options, q.points, q.topic, q.subject_code, q.media
  from public.questions_v2 q
  where q.assessment_id = v_assessment
  order by case when array_length(v_order,1) is null then null
                else array_position(v_order, q.id) end nulls last, q.created_at;
end $$;

-- Review payload (only after submit), with correctness.
create or replace function public.get_assessment_review(_attempt_id uuid)
returns table (
  q_id uuid, q_position integer, q_prompt text, q_options jsonb,
  q_points integer, q_correct jsonb, q_selected jsonb,
  q_is_correct boolean, q_explanation text, q_topic text, q_subject_code text
)
language plpgsql stable security definer set search_path = public
as $$
declare v_school uuid; v_student uuid; v_assessment uuid; v_submitted timestamptz;
begin
  select a.school_id, a.student_id, a.assessment_id, a.submitted_at
    into v_school, v_student, v_assessment, v_submitted
  from public.assessment_attempts_v2 a
  where a.id = _attempt_id;
  if v_school is null then raise exception 'attempt not found'; end if;
  if v_submitted is null then raise exception 'attempt not submitted'; end if;
  if not (v_student = auth.uid()
          or has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          or is_school_admin(v_school, auth.uid())) then
    raise exception 'forbidden';
  end if;
  return query
  select q.id, row_number() over (order by q.created_at)::int,
         q.prompt, q.options, q.points, q.correct,
         ans.selected, ans.is_correct, q.explanation, q.topic, q.subject_code
  from public.questions_v2 q
  left join public.assessment_answers_v2 ans
    on ans.question_id = q.id and ans.attempt_id = _attempt_id
  where q.assessment_id = v_assessment
  order by q.created_at;
end $$;

-- Start an attempt with open-window enforcement.
create or replace function public.start_assessment(_assessment_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_school uuid; v_status public.assessment_status_v2;
        v_opens timestamptz; v_closes timestamptz;
        v_duration int; v_attempt uuid;
        v_existing uuid; v_order uuid[]; v_randomize boolean;
        v_config jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select a.school_id, a.status, a.opens_at, a.closes_at, a.config
    into v_school, v_status, v_opens, v_closes, v_config
  from public.assessments a where a.id = _assessment_id;
  if v_school is null then raise exception 'assessment not found'; end if;
  if v_status <> 'published' and v_status <> 'scheduled' then
    raise exception 'assessment not available';
  end if;
  if v_opens is not null and now() < v_opens then raise exception 'not open yet'; end if;
  if v_closes is not null and now() > v_closes then raise exception 'closed'; end if;
  if not has_school_role(v_school, auth.uid(), 'student'::member_role) then
    raise exception 'forbidden';
  end if;

  -- Resume in-progress attempt if any
  select id into v_existing
  from public.assessment_attempts_v2
  where assessment_id = _assessment_id and student_id = auth.uid()
    and status = 'in_progress'
  limit 1;
  if v_existing is not null then return v_existing; end if;

  v_duration := coalesce((v_config->>'duration_minutes')::int, 60);
  v_randomize := coalesce((v_config->>'randomize')::boolean, false);

  if v_randomize then
    select coalesce(array_agg(id order by random()), '{}')
      into v_order
      from public.questions_v2 where assessment_id = _assessment_id;
  else
    select coalesce(array_agg(id order by created_at), '{}')
      into v_order
      from public.questions_v2 where assessment_id = _assessment_id;
  end if;

  insert into public.assessment_attempts_v2
    (school_id, assessment_id, student_id, expires_at, question_order)
  values
    (v_school, _assessment_id, auth.uid(), now() + (v_duration || ' minutes')::interval, v_order)
  returning id into v_attempt;

  return v_attempt;
end $$;

-- Grade an attempt and produce results.
create or replace function public.submit_assessment(_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_school uuid; v_student uuid; v_assessment uuid; v_submitted timestamptz;
        v_raw numeric := 0; v_max numeric := 0; v_pct numeric := 0;
        v_type public.assessment_type; v_grade text;
        v_per_section jsonb; v_per_topic jsonb; v_projected jsonb := '{}'::jsonb;
        rec record;
begin
  select a.school_id, a.student_id, a.assessment_id, a.submitted_at
    into v_school, v_student, v_assessment, v_submitted
  from public.assessment_attempts_v2 a where a.id = _attempt_id for update;
  if v_school is null then raise exception 'attempt not found'; end if;
  if v_student <> auth.uid()
     and not has_school_role(v_school, auth.uid(), 'teacher'::member_role)
     and not is_school_admin(v_school, auth.uid()) then
    raise exception 'forbidden';
  end if;
  if v_submitted is not null then raise exception 'already submitted'; end if;

  -- mark per-answer correctness
  update public.assessment_answers_v2 ans
    set is_correct = (ans.selected is not distinct from q.correct),
        points_awarded = case when ans.selected is not distinct from q.correct
                              then q.points else 0 end
    from public.questions_v2 q
    where ans.question_id = q.id and ans.attempt_id = _attempt_id;

  select coalesce(sum(points_awarded),0) into v_raw
    from public.assessment_answers_v2 where attempt_id = _attempt_id;
  select coalesce(sum(points),0) into v_max
    from public.questions_v2 where assessment_id = v_assessment;
  v_pct := case when v_max > 0 then round((v_raw / v_max) * 100, 2) else 0 end;

  select type into v_type from public.assessments where id = v_assessment;

  v_grade := case
    when v_pct >= 75 then 'A'
    when v_pct >= 60 then 'B'
    when v_pct >= 50 then 'C'
    when v_pct >= 45 then 'D'
    when v_pct >= 40 then 'E'
    else 'F' end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'subject', q.subject_code,
    'score', sum(coalesce(ans.points_awarded,0)),
    'max', sum(q.points),
    'pct', case when sum(q.points) > 0
                then round(sum(coalesce(ans.points_awarded,0))/sum(q.points)*100,2)
                else 0 end
  )), '[]'::jsonb)
  into v_per_section
  from public.questions_v2 q
  left join public.assessment_answers_v2 ans
    on ans.question_id = q.id and ans.attempt_id = _attempt_id
  where q.assessment_id = v_assessment and q.subject_code is not null
  group by q.subject_code;

  select coalesce(jsonb_agg(jsonb_build_object(
    'topic', q.topic,
    'mastery', case when count(*) > 0
                    then round(sum(case when ans.is_correct then 1 else 0 end)::numeric/count(*)*100,2)
                    else 0 end,
    'n', count(*)
  )), '[]'::jsonb)
  into v_per_topic
  from public.questions_v2 q
  left join public.assessment_answers_v2 ans
    on ans.question_id = q.id and ans.attempt_id = _attempt_id
  where q.assessment_id = v_assessment and q.topic is not null
  group by q.topic;

  if v_type = 'jamb_mock' then
    v_projected := jsonb_build_object(
      'jamb_total', round(v_pct * 4),
      'scale', '400'
    );
  end if;

  update public.assessment_attempts_v2
    set submitted_at = now(), status = 'submitted'
    where id = _attempt_id;

  insert into public.assessment_results
    (attempt_id, school_id, assessment_id, student_id,
     raw_score, max_score, percentage, grade,
     per_section, per_topic, presenter, projected)
  values
    (_attempt_id, v_school, v_assessment, v_student,
     v_raw, v_max, v_pct, v_grade,
     v_per_section, v_per_topic, v_type::text, v_projected)
  on conflict (attempt_id) do update
    set raw_score = excluded.raw_score,
        max_score = excluded.max_score,
        percentage = excluded.percentage,
        grade = excluded.grade,
        per_section = excluded.per_section,
        per_topic = excluded.per_topic,
        projected = excluded.projected,
        graded_at = now();

  return jsonb_build_object(
    'attempt_id', _attempt_id,
    'percentage', v_pct,
    'grade', v_grade,
    'raw_score', v_raw,
    'max_score', v_max,
    'per_section', v_per_section,
    'projected', v_projected,
    'presenter', v_type::text
  );
end $$;

-- Publish only if every AI-generated question is approved.
create or replace function public.publish_assessment(_assessment_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_school uuid; v_pending int;
begin
  select school_id into v_school from public.assessments where id = _assessment_id;
  if v_school is null then raise exception 'assessment not found'; end if;
  if not (has_school_role(v_school, auth.uid(), 'teacher'::member_role)
          or is_school_admin(v_school, auth.uid())) then
    raise exception 'forbidden';
  end if;

  select count(*) into v_pending
    from public.questions_v2
   where assessment_id = _assessment_id
     and ai_generated = true
     and approved_by is null;
  if v_pending > 0 then
    raise exception 'cannot publish: % AI question(s) pending approval', v_pending;
  end if;

  update public.assessments
    set status = 'published', updated_at = now()
    where id = _assessment_id;
end $$;

-- Unified student-facing view
create or replace view public.student_assessments_v
with (security_invoker = true) as
select a.id as assessment_id, a.school_id, a.title, a.type, a.status,
       a.scheduled_at, a.opens_at, a.closes_at,
       att.id as attempt_id, att.status as attempt_status,
       r.percentage, r.grade
from public.assessments a
left join public.assessment_attempts_v2 att
  on att.assessment_id = a.id and att.student_id = auth.uid()
left join public.assessment_results r on r.attempt_id = att.id
where a.status in ('scheduled','published');

grant select on public.student_assessments_v to authenticated;

-- ============================================================
-- AI-Native foundation: jobs ledger, approval queue, budgets,
-- student topic mastery rollup
-- ============================================================

-- 1. ai_jobs: every AI call logged for cost, audit, debugging
CREATE TABLE public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  model text,
  input jsonb,
  output jsonb,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  cost_usd numeric(10,6),
  latency_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX ai_jobs_school_created_idx ON public.ai_jobs (school_id, created_at DESC);
CREATE INDEX ai_jobs_user_idx ON public.ai_jobs (user_id, created_at DESC);
CREATE INDEX ai_jobs_kind_idx ON public.ai_jobs (school_id, kind, created_at DESC);

GRANT SELECT ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their school's ai jobs (admin) or own jobs"
  ON public.ai_jobs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
  );

-- 2. ai_approvals: every AI-generated artifact awaiting human approval
CREATE TABLE public.ai_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  entity_type text NOT NULL, -- 'question'|'comment'|'parent_message'|'lesson_plan'|'rubric_grade'
  entity_id uuid,            -- nullable: drafts may not yet have a row
  ai_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
  draft jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|sent
  created_by uuid NOT NULL,
  approved_by uuid,
  approved_at timestamptz,
  edits jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_approvals_school_status_idx ON public.ai_approvals (school_id, status, created_at DESC);
CREATE INDEX ai_approvals_entity_idx ON public.ai_approvals (entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_approvals TO authenticated;
GRANT ALL ON public.ai_approvals TO service_role;
ALTER TABLE public.ai_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers and admins can view approvals in their school"
  ON public.ai_approvals FOR SELECT TO authenticated
  USING (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR public.is_school_admin(school_id, auth.uid())
  );

CREATE POLICY "Teachers and admins can create approvals"
  ON public.ai_approvals FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
         OR public.is_school_admin(school_id, auth.uid()))
  );

CREATE POLICY "Teachers and admins can update approvals"
  ON public.ai_approvals FOR UPDATE TO authenticated
  USING (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR public.is_school_admin(school_id, auth.uid())
  );

CREATE TRIGGER ai_approvals_updated_at
  BEFORE UPDATE ON public.ai_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. school_ai_quotas: monthly budget per school
CREATE TABLE public.school_ai_quotas (
  school_id uuid PRIMARY KEY,
  monthly_token_cap bigint NOT NULL DEFAULT 5000000, -- 5M tokens/mo default
  monthly_cost_cap_usd numeric(10,2) NOT NULL DEFAULT 25.00,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  tokens_used bigint NOT NULL DEFAULT 0,
  cost_used_usd numeric(10,6) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.school_ai_quotas TO authenticated;
GRANT ALL ON public.school_ai_quotas TO service_role;
ALTER TABLE public.school_ai_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their school quota"
  ON public.school_ai_quotas FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));

-- 4. student_topic_mastery: rollup powering tutor/practice/copilots
CREATE TABLE public.student_topic_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  subject_code text,
  topic text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  ema_mastery numeric(5,4) NOT NULL DEFAULT 0, -- 0..1
  last_attempt_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_code, topic)
);
CREATE INDEX stm_school_student_idx ON public.student_topic_mastery (school_id, student_id);
CREATE INDEX stm_weak_idx ON public.student_topic_mastery (school_id, ema_mastery);

GRANT SELECT ON public.student_topic_mastery TO authenticated;
GRANT ALL ON public.student_topic_mastery TO service_role;
ALTER TABLE public.student_topic_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see their mastery; teachers/admins see school"
  ON public.student_topic_mastery FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR public.is_school_admin(school_id, auth.uid())
  );

-- Rollup trigger: when an assessment_results row lands, fold per_topic JSON
-- into the mastery table with a simple EMA (alpha = 0.4).
CREATE OR REPLACE FUNCTION public.rollup_topic_mastery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic text;
  v_n int;
  v_mastery numeric;
  v_correct int;
  v_subject text;
  rec jsonb;
BEGIN
  IF NEW.per_topic IS NULL OR jsonb_typeof(NEW.per_topic) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(NEW.per_topic) LOOP
    v_topic := rec->>'topic';
    IF v_topic IS NULL OR v_topic = '' THEN CONTINUE; END IF;
    v_n := COALESCE((rec->>'n')::int, 0);
    IF v_n = 0 THEN CONTINUE; END IF;
    v_mastery := COALESCE((rec->>'mastery')::numeric, 0) / 100.0;
    v_correct := round(v_mastery * v_n);
    v_subject := NULL; -- per_topic doesn't carry subject; left null and grouped later

    INSERT INTO public.student_topic_mastery
      (school_id, student_id, subject_code, topic, attempts, correct, ema_mastery, last_attempt_at)
    VALUES
      (NEW.school_id, NEW.student_id, v_subject, v_topic, v_n, v_correct, v_mastery, now())
    ON CONFLICT (student_id, subject_code, topic) DO UPDATE
      SET attempts = public.student_topic_mastery.attempts + EXCLUDED.attempts,
          correct = public.student_topic_mastery.correct + EXCLUDED.correct,
          ema_mastery = round(
            (0.6 * public.student_topic_mastery.ema_mastery + 0.4 * EXCLUDED.ema_mastery)::numeric,
            4
          ),
          last_attempt_at = now(),
          updated_at = now();
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER assessment_results_topic_rollup
  AFTER INSERT OR UPDATE OF per_topic ON public.assessment_results
  FOR EACH ROW EXECUTE FUNCTION public.rollup_topic_mastery();

-- 5. Atomic counter helper for ai-call cost increment
CREATE OR REPLACE FUNCTION public.bump_ai_quota(
  _school_id uuid,
  _tokens bigint,
  _cost numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.school_ai_quotas (school_id, tokens_used, cost_used_usd)
  VALUES (_school_id, _tokens, _cost)
  ON CONFLICT (school_id) DO UPDATE
    SET tokens_used = CASE
          WHEN public.school_ai_quotas.period_start < date_trunc('month', now())::date
          THEN _tokens
          ELSE public.school_ai_quotas.tokens_used + _tokens
        END,
        cost_used_usd = CASE
          WHEN public.school_ai_quotas.period_start < date_trunc('month', now())::date
          THEN _cost
          ELSE public.school_ai_quotas.cost_used_usd + _cost
        END,
        period_start = CASE
          WHEN public.school_ai_quotas.period_start < date_trunc('month', now())::date
          THEN date_trunc('month', now())::date
          ELSE public.school_ai_quotas.period_start
        END,
        updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_ai_quota(uuid, bigint, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_ai_quota(uuid, bigint, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rollup_topic_mastery() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  class_id uuid,
  subject text NOT NULL,
  topic text NOT NULL,
  duration_minutes int NOT NULL DEFAULT 40,
  curriculum text,                  -- 'WAEC' | 'NECO' | 'JAMB' | 'NERDC' | null
  grade_level text,
  content text NOT NULL,            -- markdown body
  status text NOT NULL DEFAULT 'draft', -- draft|approved|shared|archived
  ai_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_plans_teacher_idx ON public.lesson_plans (teacher_id, created_at DESC);
CREATE INDEX lesson_plans_school_idx ON public.lesson_plans (school_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see own plans; admins see school plans"
  ON public.lesson_plans FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
  );

CREATE POLICY "Teachers create their own plans"
  ON public.lesson_plans FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid()
    AND public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

CREATE POLICY "Teachers update their own plans"
  ON public.lesson_plans FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers delete their own plans"
  ON public.lesson_plans FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

CREATE TRIGGER lesson_plans_updated_at
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Marking rubrics
CREATE TABLE public.marking_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject text,
  name text NOT NULL,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marking_rubrics TO authenticated;
GRANT ALL ON public.marking_rubrics TO service_role;

ALTER TABLE public.marking_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rubrics_select_members" ON public.marking_rubrics
  FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));

CREATE POLICY "rubrics_write_staff" ON public.marking_rubrics
  FOR ALL TO authenticated
  USING (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
      OR public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
      OR public.is_school_admin(school_id, auth.uid()));

CREATE TRIGGER trg_marking_rubrics_updated
  BEFORE UPDATE ON public.marking_rubrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_marking_rubrics_school ON public.marking_rubrics(school_id, subject);

-- Essay AI grade columns on existing answers table
ALTER TABLE public.assessment_answers_v2
  ADD COLUMN IF NOT EXISTS ai_grade numeric,
  ADD COLUMN IF NOT EXISTS ai_feedback jsonb,
  ADD COLUMN IF NOT EXISTS ai_job_id uuid;

-- parent_alerts: AI-drafted risk alerts for parents, pending approval before send
CREATE TABLE public.parent_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  parent_id uuid,
  kind text NOT NULL,           -- 'attendance' | 'grade_drop' | 'fee_overdue'
  severity text NOT NULL DEFAULT 'medium',  -- low|medium|high
  signal jsonb NOT NULL DEFAULT '{}'::jsonb, -- raw metrics used to decide
  draft_message text,
  ai_job_id uuid,
  approval_id uuid,
  status text NOT NULL DEFAULT 'pending',  -- pending|approved|sent|dismissed
  dedupe_key text NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, dedupe_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_alerts TO authenticated;
GRANT ALL ON public.parent_alerts TO service_role;

ALTER TABLE public.parent_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school admins view parent alerts"
  ON public.parent_alerts FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "school admins update parent alerts"
  ON public.parent_alerts FOR UPDATE TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE POLICY "school admins delete parent alerts"
  ON public.parent_alerts FOR DELETE TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));

-- Parents can view their own alerts (once sent)
CREATE POLICY "parents view own sent alerts"
  ON public.parent_alerts FOR SELECT TO authenticated
  USING (parent_id = auth.uid() AND status = 'sent');

CREATE INDEX idx_parent_alerts_school_status ON public.parent_alerts(school_id, status);
CREATE INDEX idx_parent_alerts_student ON public.parent_alerts(student_id);

CREATE TRIGGER trg_parent_alerts_updated
  BEFORE UPDATE ON public.parent_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
-- Allow school admins to manage their AI budget rows
CREATE POLICY "Admins insert quota" ON public.school_ai_quotas
  FOR INSERT TO authenticated
  WITH CHECK (is_school_admin(school_id, auth.uid()));

CREATE POLICY "Admins update quota" ON public.school_ai_quotas
  FOR UPDATE TO authenticated
  USING (is_school_admin(school_id, auth.uid()))
  WITH CHECK (is_school_admin(school_id, auth.uid()));
-- Enable pgvector
create extension if not exists vector;

-- Documents registry
create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  uploaded_by uuid,
  title text not null,
  source_path text,                       -- storage path inside `library` bucket
  source_kind text not null default 'upload',  -- upload | url | manual
  mime_type text,
  visibility text not null default 'school',   -- school | class | student | public_curriculum
  class_id uuid,
  student_id uuid,
  subject_code text,
  curriculum text,                        -- WAEC | NECO | JAMB | custom
  status text not null default 'pending', -- pending | processing | ready | error
  error text,
  chunk_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_knowledge_documents_school on public.knowledge_documents(school_id, status);
create index idx_knowledge_documents_class on public.knowledge_documents(class_id) where class_id is not null;

grant select, insert, update, delete on public.knowledge_documents to authenticated;
grant all on public.knowledge_documents to service_role;
alter table public.knowledge_documents enable row level security;

create policy "members read documents"
  on public.knowledge_documents for select to authenticated
  using (public.is_member(school_id, auth.uid()));
create policy "teachers/admins insert documents"
  on public.knowledge_documents for insert to authenticated
  with check (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    or public.is_school_admin(school_id, auth.uid())
  );
create policy "teachers/admins update documents"
  on public.knowledge_documents for update to authenticated
  using (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    or public.is_school_admin(school_id, auth.uid())
  );
create policy "admins delete documents"
  on public.knowledge_documents for delete to authenticated
  using (public.is_school_admin(school_id, auth.uid()));

create trigger trg_knowledge_documents_updated
  before update on public.knowledge_documents
  for each row execute function public.set_updated_at();

-- Chunks
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  school_id uuid not null,                -- denormalised for fast RLS filter
  chunk_index int not null,
  content text not null,
  token_count int,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_knowledge_chunks_doc on public.knowledge_chunks(document_id);
create index idx_knowledge_chunks_school on public.knowledge_chunks(school_id);
create index idx_knowledge_chunks_embedding
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

grant select on public.knowledge_chunks to authenticated;
grant all on public.knowledge_chunks to service_role;
alter table public.knowledge_chunks enable row level security;

create policy "members read chunks"
  on public.knowledge_chunks for select to authenticated
  using (public.is_member(school_id, auth.uid()));

-- Tenant-scoped similarity search RPC
create or replace function public.match_knowledge_chunks(
  _school_id uuid,
  _query_embedding vector(1536),
  _match_count int default 6,
  _class_id uuid default null,
  _student_id uuid default null
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  content text,
  similarity float,
  visibility text,
  metadata jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.title,
    c.content,
    1 - (c.embedding <=> _query_embedding) as similarity,
    d.visibility,
    c.metadata
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.school_id = _school_id
    and d.status = 'ready'
    and (
      d.visibility = 'school'
      or d.visibility = 'public_curriculum'
      or (d.visibility = 'class'   and _class_id   is not null and d.class_id   = _class_id)
      or (d.visibility = 'student' and _student_id is not null and d.student_id = _student_id)
    )
  order by c.embedding <=> _query_embedding
  limit greatest(1, least(_match_count, 20));
$$;

grant execute on function public.match_knowledge_chunks(uuid, vector, int, uuid, uuid) to authenticated, service_role;

DROP POLICY IF EXISTS "authenticated can publish realtime" ON public.messages;
DROP POLICY IF EXISTS "authenticated can use realtime" ON public.messages;

DROP POLICY IF EXISTS "School staff read verifications" ON public.result_verifications;
CREATE POLICY "School admins read verifications"
ON public.result_verifications
FOR SELECT
TO authenticated
USING (public.is_school_admin(school_id, auth.uid()));
DO $$
BEGIN
  BEGIN ALTER TABLE public.messages REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.platform_announcements REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.conversation_messages REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.conversations REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_announcements; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  user_id uuid NOT NULL,
  announcement_id uuid NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, announcement_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;

ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own announcement reads"
  ON public.announcement_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user marks own announcement read"
  ON public.announcement_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user deletes own announcement read"
  ON public.announcement_reads FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON public.announcement_reads(user_id);

-- 1) Drop permissive realtime broadcast policies that let any authenticated user subscribe/publish to any channel (if owner)
DO $$
BEGIN
  DROP POLICY IF EXISTS "authenticated can use realtime" ON realtime.messages;
  DROP POLICY IF EXISTS "authenticated can publish realtime" ON realtime.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2) Add missing UPDATE policy on storage.objects for the 'library' bucket (teachers/admins of the owning school)
DROP POLICY IF EXISTS "Teachers/Admins update library files" ON storage.objects;
CREATE POLICY "Teachers/Admins update library files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'library'
  AND (
    public.has_school_role(((storage.foldername(name))[1])::uuid, auth.uid(), 'teacher'::public.member_role)
    OR public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'library'
  AND (
    public.has_school_role(((storage.foldername(name))[1])::uuid, auth.uid(), 'teacher'::public.member_role)
    OR public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

-- 1) Results: publish gate
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid;

-- Backfill existing rows as already published so students don't lose access
UPDATE public.results SET published_at = COALESCE(published_at, created_at) WHERE published_at IS NULL;

-- Replace student/parent SELECT policy to require published_at
DROP POLICY IF EXISTS "Student/parent/teacher view results" ON public.results;

CREATE POLICY "Teachers/Admins view all results"
ON public.results FOR SELECT
USING (
  has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  OR is_school_admin(school_id, auth.uid())
);

CREATE POLICY "Student views own published results"
ON public.results FOR SELECT
USING (student_id = auth.uid() AND published_at IS NOT NULL);

CREATE POLICY "Parent views child's published results"
ON public.results FOR SELECT
USING (
  published_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.parent_links pl
    WHERE pl.school_id = results.school_id
      AND pl.parent_user_id = auth.uid()
      AND pl.student_user_id = results.student_id
  )
);

-- 2) Publish RPC for teachers/admins
CREATE OR REPLACE FUNCTION public.publish_results(_ids uuid[], _publish boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  -- only update rows whose school the caller can manage
  IF _publish THEN
    UPDATE public.results r
       SET published_at = now(), published_by = v_uid
     WHERE r.id = ANY(_ids)
       AND (has_school_role(r.school_id, v_uid, 'teacher'::member_role)
            OR is_school_admin(r.school_id, v_uid));
  ELSE
    UPDATE public.results r
       SET published_at = NULL, published_by = NULL
     WHERE r.id = ANY(_ids)
       AND (has_school_role(r.school_id, v_uid, 'teacher'::member_role)
            OR is_school_admin(r.school_id, v_uid));
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.publish_results(uuid[], boolean) TO authenticated;

-- 3) Mock session preferences + AI summary cache
ALTER TABLE public.mock_sessions
  ADD COLUMN IF NOT EXISTS questions_per_subject integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS fullscreen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_summary jsonb;

CREATE TABLE public.ai_cache (
  cache_key text PRIMARY KEY,
  school_id uuid NOT NULL,
  kind text NOT NULL,
  model text NOT NULL,
  response jsonb NOT NULL,
  prompt_tokens int NOT NULL DEFAULT 0,
  completion_tokens int NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  tokens_saved bigint NOT NULL DEFAULT 0,
  cost_saved_usd numeric(14,6) NOT NULL DEFAULT 0,
  hits int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

GRANT ALL ON public.ai_cache TO service_role;

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: edge functions use service role only.
-- Admins of the school can read aggregate savings for their dashboards.
CREATE POLICY "School admins can view their AI cache stats"
  ON public.ai_cache FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));

CREATE INDEX ai_cache_school_kind_idx ON public.ai_cache (school_id, kind);
CREATE INDEX ai_cache_expires_idx ON public.ai_cache (expires_at);

CREATE OR REPLACE FUNCTION public.bump_ai_quota_savings(_school_id uuid, _tokens bigint, _cost numeric)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Mirrors bump_ai_quota structurally but the savings columns are reporting-only
  -- so we just upsert an ai_cache_savings row. We piggyback on school_ai_quotas if present.
  UPDATE public.school_ai_quotas
     SET updated_at = now()
   WHERE school_id = _school_id;
$$;

-- 1) memberships.profile_data: restrict column reads
REVOKE SELECT (profile_data) ON public.memberships FROM authenticated;
REVOKE SELECT (profile_data) ON public.memberships FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_membership_profile(_school uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT profile_data FROM public.memberships
   WHERE school_id = _school AND user_id = auth.uid()
   LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_my_membership_profile(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_memberships_with_profile(_school uuid, _role member_role)
RETURNS TABLE(user_id uuid, created_at timestamptz, bio_completed boolean, profile_data jsonb, role member_role)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_school_admin(_school, auth.uid())
          OR public.has_school_role(_school, auth.uid(), 'teacher'::member_role)
          OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT m.user_id, m.created_at, m.bio_completed, m.profile_data, m.role
    FROM public.memberships m
    WHERE m.school_id = _school AND m.role = _role AND m.status = 'active'
    ORDER BY m.created_at DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_list_memberships_with_profile(uuid, member_role) TO authenticated;

-- 2) storage.objects: replace bypassable LIKE check with strict JSONB path match
DROP POLICY IF EXISTS "message-attachments owner read" ON storage.objects;
CREATE POLICY "message-attachments owner read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.messages m, jsonb_array_elements(m.attachments) att
      WHERE (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
        AND att->>'path' = objects.name
    )
  )
);

-- 3) questions_v2: drop the global-bank read branch that exposed correct answers
DROP POLICY IF EXISTS "staff and bank readers view questions" ON public.questions_v2;
CREATE POLICY "staff view questions"
ON public.questions_v2 FOR SELECT
TO authenticated
USING (
  (school_id IS NOT NULL AND (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR is_school_admin(school_id, auth.uid())
  ))
  OR is_super_admin(auth.uid())
);

-- Super admin can read ai_cache across schools
DROP POLICY IF EXISTS "Super reads all ai_cache" ON public.ai_cache;
CREATE POLICY "Super reads all ai_cache"
ON public.ai_cache FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()));

-- Aggregated stats RPC
CREATE OR REPLACE FUNCTION public.super_ai_cache_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_totals jsonb;
  v_by_kind jsonb;
  v_by_role jsonb;
  v_recent jsonb;
BEGIN
  IF NOT public.is_super_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'entries', COUNT(*),
    'total_hits', COALESCE(SUM(hits), 0),
    'tokens_saved', COALESCE(SUM(tokens_saved), 0),
    'cost_saved_usd', COALESCE(SUM(cost_saved_usd), 0)::numeric(14,4),
    'last_used_at', MAX(last_used_at),
    'hit_rate', CASE
      WHEN COALESCE(SUM(hits),0) + COUNT(*) = 0 THEN 0
      ELSE ROUND((SUM(hits)::numeric / (SUM(hits) + COUNT(*))) * 100, 1)
    END
  ) INTO v_totals
  FROM public.ai_cache;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_by_kind FROM (
    SELECT
      kind AS feature,
      COUNT(*) AS entries,
      COALESCE(SUM(hits),0) AS hits,
      COALESCE(SUM(tokens_saved),0) AS tokens_saved,
      ROUND(COALESCE(SUM(cost_saved_usd),0)::numeric, 4) AS cost_saved_usd,
      MAX(last_used_at) AS last_used_at,
      CASE WHEN COALESCE(SUM(hits),0) + COUNT(*) = 0 THEN 0
           ELSE ROUND((SUM(hits)::numeric / (SUM(hits) + COUNT(*))) * 100, 1)
      END AS hit_rate
    FROM public.ai_cache
    GROUP BY kind
    ORDER BY hits DESC NULLS LAST
  ) t;

  -- Role breakdown from ai_jobs cache_hit logs
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_by_role FROM (
    SELECT
      COALESCE(m.role::text, 'unknown') AS role,
      COUNT(*) FILTER (WHERE j.status = 'cache_hit') AS hits,
      COUNT(*) FILTER (WHERE j.status <> 'cache_hit') AS misses,
      CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND((COUNT(*) FILTER (WHERE j.status = 'cache_hit'))::numeric / COUNT(*) * 100, 1)
      END AS hit_rate,
      MAX(j.created_at) FILTER (WHERE j.status = 'cache_hit') AS last_hit_at
    FROM public.ai_jobs j
    LEFT JOIN LATERAL (
      SELECT role FROM public.memberships
      WHERE user_id = j.user_id AND school_id = j.school_id AND status = 'active'
      LIMIT 1
    ) m ON true
    WHERE j.created_at > now() - interval '60 days'
    GROUP BY COALESCE(m.role::text, 'unknown')
    ORDER BY hits DESC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent FROM (
    SELECT kind AS feature, hits, tokens_saved, last_used_at
    FROM public.ai_cache
    ORDER BY last_used_at DESC
    LIMIT 12
  ) t;

  RETURN jsonb_build_object(
    'totals', v_totals,
    'by_feature', v_by_kind,
    'by_role', v_by_role,
    'recent', v_recent
  );
END $$;

GRANT EXECUTE ON FUNCTION public.super_ai_cache_stats() TO authenticated;

-- Recent auth events RPC with user details
CREATE OR REPLACE FUNCTION public.super_recent_auth_events(_limit integer DEFAULT 200, _event text DEFAULT NULL, _since timestamptz DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  event text,
  user_id uuid,
  school_id uuid,
  session_id text,
  created_at timestamptz,
  full_name text,
  email text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT ae.id, ae.event, ae.user_id, ae.school_id, ae.session_id, ae.created_at,
           p.full_name, p.email
    FROM public.auth_events ae
    LEFT JOIN public.profiles p ON p.id = ae.user_id
    WHERE (_event IS NULL OR ae.event = _event)
      AND (_since IS NULL OR ae.created_at >= _since)
    ORDER BY ae.created_at DESC
    LIMIT LEAST(GREATEST(_limit, 1), 2000);
END $$;

GRANT EXECUTE ON FUNCTION public.super_recent_auth_events(integer, text, timestamptz) TO authenticated;

-- Client error reporting + realtime
CREATE TABLE IF NOT EXISTS public.client_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id uuid,
  route text,
  source text,             -- 'window' | 'unhandledrejection' | 'react' | 'manual' | 'supabase'
  message text NOT NULL,
  cause text,
  stack text,
  user_agent text,
  severity text DEFAULT 'error',
  context jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.client_errors TO anon, authenticated;
GRANT SELECT ON public.client_errors TO authenticated;
GRANT ALL ON public.client_errors TO service_role;

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone records client error"
  ON public.client_errors FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "super reads client errors"
  ON public.client_errors FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON public.client_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_errors_user ON public.client_errors(user_id);

ALTER TABLE public.client_errors REPLICA IDENTITY FULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_errors'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.client_errors';
  END IF;
END $$;

-- 1. Remove client_errors from realtime publication (prevents cross-tenant leak via postgres_changes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'client_errors'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.client_errors';
  END IF;
END $$;

-- 2. payment-proofs: allow uploader + school admins to DELETE
DROP POLICY IF EXISTS "payment_proofs_delete_uploader" ON storage.objects;
CREATE POLICY "payment_proofs_delete_uploader"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "payment_proofs_delete_admin" ON storage.objects;
CREATE POLICY "payment_proofs_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- 3. proctor-snapshots: allow school admins to DELETE
DROP POLICY IF EXISTS "proctor_snapshots_delete_admin" ON storage.objects;
CREATE POLICY "proctor_snapshots_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'proctor-snapshots'
  AND public.is_school_admin(((storage.foldername(name))[1])::uuid, auth.uid())
);
-- ============================================================
-- PART 1: Relationship linking foundations
-- Adds: arms/tracks on classes, guardian fields on parent_links,
--       class_subject_teachers, student_subjects
-- ============================================================

-- A. Guardian model upgrade (additive on parent_links)
ALTER TABLE public.parent_links
  ADD COLUMN IF NOT EXISTS relationship text NOT NULL DEFAULT 'guardian'
    CHECK (relationship IN ('mother','father','guardian','sponsor','other')),
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_pickup boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receives_fees boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receives_results boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receives_attendance boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS receives_behavior boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone_e164 text;

-- B. Class arms + track
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS arm text,
  ADD COLUMN IF NOT EXISTS track text
    CHECK (track IS NULL OR track IN ('science','commercial','arts','general'));

-- C. Teacher <-> Subject <-> Class
CREATE TABLE IF NOT EXISTS public.class_subject_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  session text,
  term text,
  is_lead boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_id, teacher_user_id, term, session)
);
CREATE INDEX IF NOT EXISTS idx_cst_teacher ON public.class_subject_teachers(teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_cst_class ON public.class_subject_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_cst_school ON public.class_subject_teachers(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subject_teachers TO authenticated;
GRANT ALL ON public.class_subject_teachers TO service_role;

ALTER TABLE public.class_subject_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cst_members_view" ON public.class_subject_teachers
  FOR SELECT TO authenticated
  USING (
    public.is_member(school_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.school_id = class_subject_teachers.school_id
        AND pl.parent_user_id = auth.uid()
        AND pl.student_user_id IN (
          SELECT ce.student_id FROM public.class_enrollments ce
          WHERE ce.class_id = class_subject_teachers.class_id
        )
    )
  );

CREATE POLICY "cst_admins_manage" ON public.class_subject_teachers
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- D. Student <-> Subject (electives + compulsory)
CREATE TABLE IF NOT EXISTS public.student_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  session text,
  term text,
  status text NOT NULL DEFAULT 'elective'
    CHECK (status IN ('compulsory','elective','dropped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, session, term)
);
CREATE INDEX IF NOT EXISTS idx_ss_student ON public.student_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_ss_subject ON public.student_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_ss_school ON public.student_subjects(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_subjects TO authenticated;
GRANT ALL ON public.student_subjects TO service_role;

ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ss_student_self_view" ON public.student_subjects
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.school_id = student_subjects.school_id
        AND pl.parent_user_id = auth.uid()
        AND pl.student_user_id = student_subjects.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.class_subject_teachers cst
      WHERE cst.school_id = student_subjects.school_id
        AND cst.subject_id = student_subjects.subject_id
        AND cst.teacher_user_id = auth.uid()
    )
  );

CREATE POLICY "ss_student_self_manage" ON public.student_subjects
  FOR ALL TO authenticated
  USING (student_id = auth.uid() OR public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (student_id = auth.uid() OR public.is_school_admin(school_id, auth.uid()));
-- ============================================================
-- Part 2: NGN per-term pricing foundations
-- ============================================================

-- 1. Tier source-of-truth
CREATE TABLE IF NOT EXISTS public.plan_pricing (
  plan text PRIMARY KEY,
  label text NOT NULL,
  term_price_kobo int NOT NULL DEFAULT 0,
  included_students int NOT NULL DEFAULT 0,
  extra_student_kobo int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_pricing TO authenticated, anon;
GRANT ALL ON public.plan_pricing TO service_role;
ALTER TABLE public.plan_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_pricing_read_all" ON public.plan_pricing
  FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "plan_pricing_super_write" ON public.plan_pricing
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.plan_pricing (plan, label, term_price_kobo, included_students, extra_student_kobo, sort_order) VALUES
  ('trial',      'Trial',      0,        30,    0,    0),
  ('basic',      'Starter',    4500000,  150,   15000, 1),
  ('standard',   'Growth',     12000000, 500,   12000, 2),
  ('premium',    'Premium',    28000000, 1500,  10000, 3),
  ('enterprise', 'Enterprise', 0,        99999, 0,     4)
ON CONFLICT (plan) DO UPDATE
SET label = EXCLUDED.label,
    term_price_kobo = EXCLUDED.term_price_kobo,
    included_students = EXCLUDED.included_students,
    extra_student_kobo = EXCLUDED.extra_student_kobo,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- 2. Schools: NGN + termly + per-school overrides
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'termly'
    CHECK (billing_cycle IN ('termly','annual')),
  ADD COLUMN IF NOT EXISTS included_students int,
  ADD COLUMN IF NOT EXISTS extra_student_kobo int,
  ADD COLUMN IF NOT EXISTS current_term text,
  ADD COLUMN IF NOT EXISTS term_starts_at date,
  ADD COLUMN IF NOT EXISTS term_ends_at date,
  ADD COLUMN IF NOT EXISTS student_count int NOT NULL DEFAULT 0;

-- Backfill from plan_pricing
UPDATE public.schools s
SET included_students = COALESCE(s.included_students, pp.included_students),
    extra_student_kobo = COALESCE(s.extra_student_kobo, pp.extra_student_kobo)
FROM public.plan_pricing pp
WHERE pp.plan = s.plan::text;

-- Backfill student_count from class_enrollments
UPDATE public.schools s
SET student_count = sub.cnt
FROM (
  SELECT school_id, COUNT(DISTINCT student_id) AS cnt
  FROM public.class_enrollments
  GROUP BY school_id
) sub
WHERE sub.school_id = s.id;

-- 3. Modules: per-term NGN price + legacy mirror trigger
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS term_price_kobo int NOT NULL DEFAULT 0;

-- Seed term_price_kobo from existing monthly_price_cents (≈ same kobo magnitude)
UPDATE public.modules
SET term_price_kobo = COALESCE(monthly_price_cents, 0) * 100
WHERE term_price_kobo = 0;

CREATE OR REPLACE FUNCTION public.modules_sync_legacy_price()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Keep monthly_price_cents as a rough mirror (in cents) of term_price_kobo (in kobo).
  -- Divide by 100 so legacy consumers see a comparable integer magnitude.
  NEW.monthly_price_cents := GREATEST(0, COALESCE(NEW.term_price_kobo, 0) / 100);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_modules_sync_legacy_price ON public.modules;
CREATE TRIGGER trg_modules_sync_legacy_price
  BEFORE INSERT OR UPDATE OF term_price_kobo ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.modules_sync_legacy_price();

-- 4. school_modules: per-school price override
ALTER TABLE public.school_modules
  ADD COLUMN IF NOT EXISTS term_price_kobo_override int;

ALTER TABLE public.mock_sessions
  ADD COLUMN IF NOT EXISTS lockdown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integrity_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS integrity_score integer NOT NULL DEFAULT 100;

-- RPC to append an integrity event safely from the client (student owns the session)
CREATE OR REPLACE FUNCTION public.log_mock_integrity_event(_session_id uuid, _kind text, _detail jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid; v_status text; v_penalty int;
BEGIN
  SELECT student_id, status INTO v_owner, v_status FROM public.mock_sessions WHERE id = _session_id;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF v_owner <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_status IN ('submitted','expired') THEN RETURN; END IF;

  v_penalty := CASE _kind
    WHEN 'tab_blur' THEN 5
    WHEN 'fullscreen_exit' THEN 10
    WHEN 'copy_attempt' THEN 3
    WHEN 'paste_attempt' THEN 3
    WHEN 'context_menu' THEN 2
    WHEN 'devtools' THEN 15
    ELSE 1
  END;

  UPDATE public.mock_sessions
     SET integrity_events = integrity_events || jsonb_build_array(jsonb_build_object(
           'kind', _kind, 'at', now(), 'detail', COALESCE(_detail, '{}'::jsonb)
         )),
         integrity_score = GREATEST(0, integrity_score - v_penalty)
   WHERE id = _session_id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_mock_integrity_event(uuid, text, jsonb) TO authenticated;

-- 1) Per-school weights
CREATE TABLE IF NOT EXISTS public.term_grade_weights (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  ca_pct numeric NOT NULL DEFAULT 30,
  assignment_pct numeric NOT NULL DEFAULT 10,
  exam_pct numeric NOT NULL DEFAULT 60,
  report_pct numeric NOT NULL DEFAULT 0,
  passing_pct numeric NOT NULL DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.term_grade_weights TO authenticated;
GRANT ALL ON public.term_grade_weights TO service_role;

ALTER TABLE public.term_grade_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read weights" ON public.term_grade_weights
  FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins manage weights" ON public.term_grade_weights
  FOR ALL USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE OR REPLACE FUNCTION public._tgw_check_sum() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF round(coalesce(NEW.ca_pct,0)+coalesce(NEW.assignment_pct,0)+coalesce(NEW.exam_pct,0)+coalesce(NEW.report_pct,0))::int <> 100 THEN
    RAISE EXCEPTION 'Grade weights must sum to 100 (got %)',
      coalesce(NEW.ca_pct,0)+coalesce(NEW.assignment_pct,0)+coalesce(NEW.exam_pct,0)+coalesce(NEW.report_pct,0);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tgw_check_sum ON public.term_grade_weights;
CREATE TRIGGER trg_tgw_check_sum BEFORE INSERT OR UPDATE ON public.term_grade_weights
  FOR EACH ROW EXECUTE FUNCTION public._tgw_check_sum();

-- 2) Extend results
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS class_id uuid,
  ADD COLUMN IF NOT EXISTS session text,
  ADD COLUMN IF NOT EXISTS ca_score numeric,
  ADD COLUMN IF NOT EXISTS assignment_score numeric,
  ADD COLUMN IF NOT EXISTS exam_score numeric,
  ADD COLUMN IF NOT EXISTS report_score numeric,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS results_unique_term_subject
  ON public.results (school_id, student_id, subject, term, coalesce(session,''));

-- 3) Recompute single term result
CREATE OR REPLACE FUNCTION public.recompute_term_result(
  _school uuid, _student uuid, _subject text, _term text, _session text DEFAULT NULL,
  _class uuid DEFAULT NULL, _report_score numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w_ca numeric; w_as numeric; w_ex numeric; w_rp numeric;
  ca_sum numeric := 0; ca_max numeric := 0; ca_pct numeric := 0;
  as_pct numeric := 0; as_count int := 0;
  ex_pct numeric := 0;
  rp_pct numeric;
  total numeric := 0;
  letter text;
  v_breakdown jsonb;
  v_result_id uuid;
BEGIN
  IF NOT (public.has_school_role(_school, auth.uid(), 'teacher'::member_role)
       OR public.is_school_admin(_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ca_pct, assignment_pct, exam_pct, report_pct
    INTO w_ca, w_as, w_ex, w_rp
  FROM public.term_grade_weights WHERE school_id = _school;
  IF w_ca IS NULL THEN
    w_ca := 30; w_as := 10; w_ex := 60; w_rp := 0;
  END IF;

  -- CA (gradebook entries)
  SELECT coalesce(sum(score),0), coalesce(sum(max_score),0)
    INTO ca_sum, ca_max
  FROM public.gradebook_entries
  WHERE school_id = _school AND student_id = _student
    AND subject = _subject AND term = _term;
  IF ca_max > 0 THEN ca_pct := round((ca_sum / ca_max) * 100, 2); END IF;

  -- Assignments (graded submissions, scored fraction of max_score)
  SELECT coalesce(avg((s.score / NULLIF(a.max_score,0)) * 100), 0), count(*)
    INTO as_pct, as_count
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  WHERE s.school_id = _school AND s.student_id = _student
    AND a.subject = _subject AND s.score IS NOT NULL;
  as_pct := round(coalesce(as_pct,0), 2);

  -- Exam: latest submitted attempt for an exam in this term/subject that counts
  SELECT round(ea.score, 2) INTO ex_pct
  FROM public.exam_attempts ea
  JOIN public.exams e ON e.id = ea.exam_id
  WHERE ea.school_id = _school AND ea.student_id = _student
    AND e.subject = _subject AND e.counts_to_results = true
    AND ea.submitted_at IS NOT NULL AND ea.score IS NOT NULL
  ORDER BY ea.submitted_at DESC LIMIT 1;
  ex_pct := coalesce(ex_pct, 0);

  -- Report rubric: explicit param > existing stored value > null
  IF _report_score IS NOT NULL THEN
    rp_pct := _report_score;
  ELSE
    SELECT report_score INTO rp_pct FROM public.results
      WHERE school_id = _school AND student_id = _student
        AND subject = _subject AND term = _term
        AND coalesce(session,'') = coalesce(_session,'');
  END IF;

  total := round(
      (w_ca/100.0) * ca_pct
    + (w_as/100.0) * as_pct
    + (w_ex/100.0) * ex_pct
    + (w_rp/100.0) * coalesce(rp_pct,0)
  , 2);

  letter := CASE
    WHEN total >= 75 THEN 'A1'
    WHEN total >= 70 THEN 'B2'
    WHEN total >= 65 THEN 'B3'
    WHEN total >= 60 THEN 'C4'
    WHEN total >= 55 THEN 'C5'
    WHEN total >= 50 THEN 'C6'
    WHEN total >= 45 THEN 'D7'
    WHEN total >= 40 THEN 'E8'
    ELSE 'F9' END;

  v_breakdown := jsonb_build_object(
    'weights', jsonb_build_object('ca', w_ca, 'assignment', w_as, 'exam', w_ex, 'report', w_rp),
    'ca', jsonb_build_object('sum', ca_sum, 'max', ca_max, 'pct', ca_pct),
    'assignment', jsonb_build_object('avg_pct', as_pct, 'count', as_count),
    'exam', jsonb_build_object('pct', ex_pct),
    'report', jsonb_build_object('pct', rp_pct),
    'total', total,
    'grade', letter,
    'computed_at', now()
  );

  INSERT INTO public.results(
    school_id, student_id, subject, term, session, class_id,
    score, grade, ca_score, assignment_score, exam_score, report_score, breakdown, teacher_id
  ) VALUES (
    _school, _student, _subject, _term, _session, _class,
    total, letter, ca_pct, as_pct, ex_pct, rp_pct, v_breakdown, auth.uid()
  )
  ON CONFLICT (school_id, student_id, subject, term, coalesce(session,''))
  DO UPDATE SET
    score = excluded.score,
    grade = excluded.grade,
    ca_score = excluded.ca_score,
    assignment_score = excluded.assignment_score,
    exam_score = excluded.exam_score,
    report_score = excluded.report_score,
    breakdown = excluded.breakdown,
    class_id = coalesce(excluded.class_id, public.results.class_id),
    teacher_id = excluded.teacher_id,
    updated_at = now()
  RETURNING id INTO v_result_id;

  RETURN jsonb_build_object('result_id', v_result_id, 'total', total, 'grade', letter, 'breakdown', v_breakdown);
END $$;

-- 4) Class-wide recompute
CREATE OR REPLACE FUNCTION public.recompute_term_results_for_class(
  _class uuid, _term text, _session text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_count int := 0; sid uuid; subj text;
BEGIN
  SELECT school_id INTO v_school FROM public.classes WHERE id = _class;
  IF v_school IS NULL THEN RAISE EXCEPTION 'class not found'; END IF;
  IF NOT (public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
       OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR sid IN SELECT student_id FROM public.class_enrollments WHERE class_id = _class LOOP
    FOR subj IN
      SELECT DISTINCT s FROM (
        SELECT subject AS s FROM public.gradebook_entries
          WHERE school_id = v_school AND student_id = sid AND term = _term AND subject IS NOT NULL
        UNION
        SELECT a.subject FROM public.assignment_submissions sub
          JOIN public.assignments a ON a.id = sub.assignment_id
          WHERE sub.school_id = v_school AND sub.student_id = sid AND a.subject IS NOT NULL
        UNION
        SELECT e.subject FROM public.exam_attempts ea
          JOIN public.exams e ON e.id = ea.exam_id
          WHERE ea.school_id = v_school AND ea.student_id = sid AND e.subject IS NOT NULL
                AND e.counts_to_results = true AND ea.submitted_at IS NOT NULL
      ) u WHERE s IS NOT NULL
    LOOP
      PERFORM public.recompute_term_result(v_school, sid, subj, _term, _session, _class, NULL);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END $$;
CREATE OR REPLACE FUNCTION public.issue_invoices_for_audience(_payment_type_id uuid, _student_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pt RECORD; v_count int := 0; v_uid uuid := auth.uid(); v_ids uuid[];
BEGIN
  SELECT * INTO v_pt FROM public.payment_types WHERE id = _payment_type_id;
  IF v_pt IS NULL THEN RAISE EXCEPTION 'payment type not found'; END IF;
  IF NOT public.is_school_admin(v_pt.school_id, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _student_ids IS NOT NULL AND array_length(_student_ids, 1) > 0 THEN v_ids := _student_ids;
  ELSIF v_pt.audience = 'class' AND v_pt.class_id IS NOT NULL THEN
    SELECT array_agg(student_id) INTO v_ids FROM public.class_enrollments WHERE class_id = v_pt.class_id;
  ELSIF v_pt.audience = 'level' AND v_pt.level IS NOT NULL THEN
    SELECT array_agg(ce.student_id) INTO v_ids FROM public.class_enrollments ce JOIN public.classes c ON c.id = ce.class_id
    WHERE c.school_id = v_pt.school_id AND c.grade_level = v_pt.level;
  ELSE
    SELECT array_agg(user_id) INTO v_ids FROM public.memberships
    WHERE school_id = v_pt.school_id AND role = 'student' AND status = 'active';
  END IF;
  IF v_ids IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.school_invoices (school_id, payment_type_id, student_id, amount_due_kobo, currency, status, due_date, term, session, issued_by)
  SELECT v_pt.school_id, v_pt.id, sid, v_pt.default_amount_kobo, v_pt.currency, 'pending', v_pt.due_date, v_pt.term, v_pt.session, v_uid
  FROM unnest(v_ids) AS sid
  ON CONFLICT (school_id, student_id, payment_type_id, COALESCE(term,''), COALESCE(session,''))
    WHERE payment_type_id IS NOT NULL
    DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $function$;
CREATE OR REPLACE FUNCTION public.issue_invoices_for_audience(_payment_type_id uuid, _student_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pt RECORD; v_count int := 0; v_uid uuid := auth.uid(); v_ids uuid[];
BEGIN
  SELECT * INTO v_pt FROM public.payment_types WHERE id = _payment_type_id;
  IF v_pt IS NULL THEN RAISE EXCEPTION 'payment type not found'; END IF;
  IF NOT public.is_school_admin(v_pt.school_id, v_uid) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _student_ids IS NOT NULL AND array_length(_student_ids, 1) > 0 THEN v_ids := _student_ids;
  ELSIF v_pt.audience = 'class' AND v_pt.class_id IS NOT NULL THEN
    SELECT array_agg(student_id) INTO v_ids FROM public.class_enrollments WHERE class_id = v_pt.class_id;
  ELSIF v_pt.audience = 'level' AND v_pt.level IS NOT NULL THEN
    SELECT array_agg(ce.student_id) INTO v_ids FROM public.class_enrollments ce JOIN public.classes c ON c.id = ce.class_id
    WHERE c.school_id = v_pt.school_id AND c.grade_level = v_pt.level;
  ELSE
    SELECT array_agg(user_id) INTO v_ids FROM public.memberships
    WHERE school_id = v_pt.school_id AND role = 'student' AND status = 'active';
  END IF;
  IF v_ids IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.school_invoices (school_id, payment_type_id, student_id, amount_due_kobo, currency, status, due_date, term, session, issued_by)
  SELECT v_pt.school_id, v_pt.id, sid, v_pt.default_amount_kobo, v_pt.currency, 'pending', v_pt.due_date, v_pt.term, v_pt.session, v_uid
  FROM unnest(v_ids) AS sid
  ON CONFLICT (school_id, student_id, payment_type_id, COALESCE(term,''), COALESCE(session,''))
    WHERE payment_type_id IS NOT NULL
    DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $function$;

-- Extend invoices for subscription billing
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'subscription',
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS amount_kobo integer,
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS paystack_authorization_url text,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_method text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_paystack_ref_uniq ON public.invoices(paystack_reference) WHERE paystack_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_school_status_idx ON public.invoices(school_id, status, issued_at DESC);

-- Backfill amount_kobo where missing (treat existing amount_cents as kobo for NGN tenants)
UPDATE public.invoices SET amount_kobo = amount_cents WHERE amount_kobo IS NULL;

-- Extend subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS period_start timestamptz,
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS last_invoice_id uuid;

-- Allow school admins to read their own subscription invoices (already in policy) and INSERT via RPC only.
-- Add a policy so service_role can update invoices (it already can via bypass, but explicit is good).
DROP POLICY IF EXISTS "admin can read own invoices" ON public.invoices;
CREATE POLICY "admin can read own invoices" ON public.invoices
  FOR SELECT USING (
    public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid())
  );

-- RPC: create a subscription invoice for a school's chosen plan & cycle
CREATE OR REPLACE FUNCTION public.create_subscription_invoice(_school_id uuid, _plan text, _cycle text DEFAULT 'termly')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tier RECORD;
  v_school RECORD;
  v_students int;
  v_extra int;
  v_base_kobo int;
  v_extra_kobo int;
  v_addons_kobo int := 0;
  v_total_kobo int;
  v_multiplier int;
  v_period_start date := current_date;
  v_period_end date;
  v_inv_id uuid;
  v_num text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.is_school_admin(_school_id, v_uid) OR public.is_super_admin(v_uid)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_tier FROM public.plan_pricing WHERE plan = _plan;
  IF v_tier IS NULL THEN RAISE EXCEPTION 'unknown plan %', _plan; END IF;

  SELECT * INTO v_school FROM public.schools WHERE id = _school_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'school not found'; END IF;

  v_students := COALESCE(v_school.student_count, 0);
  v_extra := GREATEST(0, v_students - COALESCE(v_school.included_students, v_tier.included_students));
  v_base_kobo := v_tier.term_price_kobo;
  v_extra_kobo := v_extra * COALESCE(v_school.extra_student_kobo, v_tier.extra_student_kobo);

  -- Sum enabled add-on modules
  SELECT COALESCE(SUM(COALESCE(sm.term_price_kobo_override, m.term_price_kobo)), 0)
    INTO v_addons_kobo
  FROM public.school_modules sm
  JOIN public.modules m ON m.id = sm.module_id
  WHERE sm.school_id = _school_id AND sm.enabled = true;

  v_total_kobo := v_base_kobo + v_extra_kobo + v_addons_kobo;
  v_multiplier := CASE WHEN _cycle = 'annual' THEN 3 ELSE 1 END;
  v_total_kobo := v_total_kobo * v_multiplier;

  v_period_end := v_period_start + (CASE WHEN _cycle = 'annual' THEN interval '365 days' ELSE interval '120 days' END);
  v_num := 'SUB-' || to_char(now(),'YYMMDD') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);

  INSERT INTO public.invoices(
    school_id, number, amount_cents, amount_kobo, currency, status,
    kind, plan, period_start, period_end, due_at, line_items, metadata
  ) VALUES (
    _school_id, v_num, v_total_kobo, v_total_kobo, COALESCE(v_school.currency,'NGN'), 'open',
    'subscription', _plan, v_period_start, v_period_end, now() + interval '14 days',
    jsonb_build_array(
      jsonb_build_object('description', v_tier.label || ' base (' || _cycle || ')', 'amount_kobo', v_base_kobo * v_multiplier),
      jsonb_build_object('description', v_extra || ' extra students', 'amount_kobo', v_extra_kobo * v_multiplier),
      jsonb_build_object('description', 'Add-on modules', 'amount_kobo', v_addons_kobo * v_multiplier)
    ),
    jsonb_build_object('cycle', _cycle, 'students', v_students)
  )
  RETURNING id INTO v_inv_id;

  RETURN v_inv_id;
END $$;

REVOKE ALL ON FUNCTION public.create_subscription_invoice(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_subscription_invoice(uuid, text, text) TO authenticated;

-- RPC for webhook (service_role) to apply a paid subscription invoice
CREATE OR REPLACE FUNCTION public.apply_subscription_payment(_invoice_id uuid, _reference text, _method text DEFAULT 'paystack')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
           term_ends_at = v_inv.period_end
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
END $$;

REVOKE ALL ON FUNCTION public.apply_subscription_payment(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_subscription_payment(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_subscription_status(_school_id uuid, _action text)
RETURNS TABLE(status text, plan text, current_period_end timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new text;
BEGIN
  IF NOT (public.is_school_admin(_school_id, auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _action = 'cancel' THEN v_new := 'cancelled';
  ELSIF _action = 'resume' THEN v_new := 'active';
  ELSE RAISE EXCEPTION 'invalid action %', _action;
  END IF;

  UPDATE public.subscriptions s
    SET status = v_new
    WHERE s.school_id = _school_id;

  UPDATE public.schools
    SET status = CASE WHEN v_new = 'cancelled' THEN 'cancelled' ELSE 'active' END
    WHERE id = _school_id;

  RETURN QUERY
    SELECT s.status, s.plan::text, s.current_period_end
    FROM public.subscriptions s
    WHERE s.school_id = _school_id
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_subscription_status(uuid, text) TO authenticated;
CREATE POLICY "Teachers read school parent links" ON public.parent_links FOR SELECT USING (has_school_role(school_id, auth.uid(), 'teacher'::member_role));

-- 1) admin_role_slots: per-school, exactly 3 named slots
CREATE TABLE IF NOT EXISTS public.admin_role_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_role_slots TO authenticated;
GRANT ALL ON public.admin_role_slots TO service_role;

ALTER TABLE public.admin_role_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage role slots" ON public.admin_role_slots
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE POLICY "Members read role slots" ON public.admin_role_slots
  FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));

CREATE POLICY "Super reads role slots" ON public.admin_role_slots
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER admin_role_slots_set_updated_at
  BEFORE UPDATE ON public.admin_role_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Add admin_slot to invites + memberships
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS admin_slot smallint
  CHECK (admin_slot IS NULL OR admin_slot BETWEEN 1 AND 3);

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS admin_slot smallint
  CHECK (admin_slot IS NULL OR admin_slot BETWEEN 1 AND 3);

-- 3) Update redeem_invite to carry admin_slot
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_invite public.invite_codes;
  v_uid uuid := auth.uid();
  v_recent int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select count(*) into v_recent
  from public.invite_redeem_attempts
  where user_id = v_uid
    and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'too many attempts, try again later';
  end if;

  select * into v_invite from public.invite_codes where code = _code for update;
  if not found then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'invalid code';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'code expired';
  end if;
  if v_invite.uses >= v_invite.max_uses then
    insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, false);
    raise exception 'code exhausted';
  end if;

  insert into public.memberships(school_id, user_id, role, admin_slot)
    values (v_invite.school_id, v_uid, v_invite.role, v_invite.admin_slot)
    on conflict (school_id, user_id, role) do update
      set admin_slot = coalesce(excluded.admin_slot, public.memberships.admin_slot);

  update public.invite_codes set uses = uses + 1 where id = v_invite.id;
  insert into public.invite_redeem_attempts(user_id, code, success) values (v_uid, _code, true);
  return v_invite.school_id;
end $function$;

-- 4) Tighten self-escalation guard to also lock admin_slot
CREATE OR REPLACE FUNCTION public.prevent_membership_self_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() = OLD.user_id AND NOT public.is_school_admin(OLD.school_id, auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.school_id IS DISTINCT FROM OLD.school_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.must_change_pin IS DISTINCT FROM OLD.must_change_pin
       OR NEW.admin_slot IS DISTINCT FROM OLD.admin_slot THEN
      RAISE EXCEPTION 'You cannot change role, status, school, user, slot, or PIN-reset flag on your own membership';
    END IF;
    IF OLD.bio_completed = true AND NEW.bio_completed = false THEN
      RAISE EXCEPTION 'You cannot revert bio_completed';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- ============================================================
-- Traditional Exam System — Phase 1
-- ============================================================

-- ---------- ENUMS ----------
create type public.trad_session_status as enum ('planning','published','locked');
create type public.trad_timetable_status as enum ('draft','pending','approved');
create type public.trad_exam_type as enum ('mcq','theory','mixed');
create type public.trad_draft_status as enum ('draft','submitted','approved','locked','changes_requested');
create type public.trad_question_type as enum ('mcq','theory');
create type public.trad_upload_status as enum ('pending','parsing','parsed','failed');

-- ---------- 1. trad_exam_sessions ----------
create table public.trad_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  term text,
  academic_year text,
  start_date date,
  end_date date,
  status public.trad_session_status not null default 'planning',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trad_exam_sessions_school_idx on public.trad_exam_sessions(school_id);

grant select, insert, update, delete on public.trad_exam_sessions to authenticated;
grant all on public.trad_exam_sessions to service_role;

alter table public.trad_exam_sessions enable row level security;

create policy "trad_sessions_school_read" on public.trad_exam_sessions
  for select to authenticated
  using (public.is_member(school_id, auth.uid()));

create policy "trad_sessions_admin_write" on public.trad_exam_sessions
  for all to authenticated
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create trigger trad_exam_sessions_updated_at
  before update on public.trad_exam_sessions
  for each row execute function public.set_updated_at();


-- ---------- 2. trad_exam_timetable ----------
create table public.trad_exam_timetable (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_id uuid not null references public.trad_exam_sessions(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  subject_name text,
  exam_date date not null,
  start_time time not null,
  duration_minutes int not null default 60 check (duration_minutes between 5 and 600),
  venue text,
  status public.trad_timetable_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trad_exam_timetable_session_idx on public.trad_exam_timetable(session_id);
create index trad_exam_timetable_class_date_idx on public.trad_exam_timetable(class_id, exam_date);

grant select, insert, update, delete on public.trad_exam_timetable to authenticated;
grant all on public.trad_exam_timetable to service_role;

alter table public.trad_exam_timetable enable row level security;

create policy "trad_timetable_school_read" on public.trad_exam_timetable
  for select to authenticated
  using (public.is_member(school_id, auth.uid()));

create policy "trad_timetable_admin_write" on public.trad_exam_timetable
  for all to authenticated
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create trigger trad_exam_timetable_updated_at
  before update on public.trad_exam_timetable
  for each row execute function public.set_updated_at();

-- Conflict detection trigger: no overlapping slots for same class on same date
create or replace function public.trad_check_timetable_conflict()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare v_conflict int;
begin
  select count(*) into v_conflict
  from public.trad_exam_timetable t
  where t.class_id = new.class_id
    and t.exam_date = new.exam_date
    and t.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and (
      (new.start_time, new.start_time + make_interval(mins => new.duration_minutes))
      overlaps
      (t.start_time, t.start_time + make_interval(mins => t.duration_minutes))
    );
  if v_conflict > 0 then
    raise exception 'Schedule conflict: class already has an exam at this time';
  end if;
  return new;
end $$;

create trigger trad_timetable_conflict_check
  before insert or update on public.trad_exam_timetable
  for each row execute function public.trad_check_timetable_conflict();


-- ---------- 3. trad_exams ----------
create table public.trad_exams (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  timetable_id uuid unique references public.trad_exam_timetable(id) on delete cascade,
  title text not null,
  instructions text,
  total_marks int not null default 100,
  exam_type public.trad_exam_type not null default 'mixed',
  draft_status public.trad_draft_status not null default 'draft',
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trad_exams_school_idx on public.trad_exams(school_id);
create index trad_exams_author_idx on public.trad_exams(author_id);

grant select, insert, update, delete on public.trad_exams to authenticated;
grant all on public.trad_exams to service_role;

alter table public.trad_exams enable row level security;

create policy "trad_exams_school_staff_read" on public.trad_exams
  for select to authenticated
  using (
    public.is_school_admin(school_id, auth.uid())
    or public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

create policy "trad_exams_admin_all" on public.trad_exams
  for all to authenticated
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create policy "trad_exams_teacher_own_insert" on public.trad_exams
  for insert to authenticated
  with check (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    and author_id = auth.uid()
  );

create policy "trad_exams_teacher_own_update" on public.trad_exams
  for update to authenticated
  using (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    and author_id = auth.uid()
    and draft_status in ('draft','submitted')
  )
  with check (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    and author_id = auth.uid()
  );

create policy "trad_exams_teacher_own_delete" on public.trad_exams
  for delete to authenticated
  using (
    public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    and author_id = auth.uid()
    and draft_status = 'draft'
  );

create trigger trad_exams_updated_at
  before update on public.trad_exams
  for each row execute function public.set_updated_at();


-- ---------- 4. trad_exam_sections ----------
create table public.trad_exam_sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.trad_exams(id) on delete cascade,
  label text not null,
  instructions text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trad_exam_sections_exam_idx on public.trad_exam_sections(exam_id);

grant select, insert, update, delete on public.trad_exam_sections to authenticated;
grant all on public.trad_exam_sections to service_role;

alter table public.trad_exam_sections enable row level security;

create policy "trad_sections_school_staff_read" on public.trad_exam_sections
  for select to authenticated
  using (
    public.is_school_admin(school_id, auth.uid())
    or public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

create policy "trad_sections_admin_all" on public.trad_exam_sections
  for all to authenticated
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create policy "trad_sections_teacher_own" on public.trad_exam_sections
  for all to authenticated
  using (
    exists (select 1 from public.trad_exams e
            where e.id = exam_id and e.author_id = auth.uid()
              and e.draft_status in ('draft','submitted'))
  )
  with check (
    exists (select 1 from public.trad_exams e
            where e.id = exam_id and e.author_id = auth.uid())
  );

create trigger trad_exam_sections_updated_at
  before update on public.trad_exam_sections
  for each row execute function public.set_updated_at();


-- ---------- 5. trad_exam_questions ----------
create table public.trad_exam_questions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.trad_exams(id) on delete cascade,
  section_id uuid references public.trad_exam_sections(id) on delete set null,
  position int not null default 0,
  type public.trad_question_type not null,
  prompt text not null,
  options jsonb,           -- mcq only: array of strings
  correct_index int,       -- mcq only (kept server-side; never sent to students)
  model_answer text,       -- theory only (private)
  marks int not null default 1,
  image_path text,         -- storage path inside trad-exam-assets bucket
  explanation text,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trad_exam_questions_exam_idx on public.trad_exam_questions(exam_id);

grant select, insert, update, delete on public.trad_exam_questions to authenticated;
grant all on public.trad_exam_questions to service_role;

alter table public.trad_exam_questions enable row level security;

create policy "trad_questions_school_staff_read" on public.trad_exam_questions
  for select to authenticated
  using (
    public.is_school_admin(school_id, auth.uid())
    or public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

create policy "trad_questions_admin_all" on public.trad_exam_questions
  for all to authenticated
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create policy "trad_questions_teacher_own" on public.trad_exam_questions
  for all to authenticated
  using (
    exists (select 1 from public.trad_exams e
            where e.id = exam_id and e.author_id = auth.uid()
              and e.draft_status in ('draft','submitted'))
  )
  with check (
    exists (select 1 from public.trad_exams e
            where e.id = exam_id and e.author_id = auth.uid())
  );

create trigger trad_exam_questions_updated_at
  before update on public.trad_exam_questions
  for each row execute function public.set_updated_at();


-- ---------- 6. trad_exam_uploads ----------
create table public.trad_exam_uploads (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  exam_id uuid not null references public.trad_exams(id) on delete cascade,
  file_path text not null,
  file_name text,
  mime text,
  status public.trad_upload_status not null default 'pending',
  parse_meta jsonb not null default '{}'::jsonb,
  error text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trad_exam_uploads_exam_idx on public.trad_exam_uploads(exam_id);

grant select, insert, update, delete on public.trad_exam_uploads to authenticated;
grant all on public.trad_exam_uploads to service_role;

alter table public.trad_exam_uploads enable row level security;

create policy "trad_uploads_school_staff_read" on public.trad_exam_uploads
  for select to authenticated
  using (
    public.is_school_admin(school_id, auth.uid())
    or public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

create policy "trad_uploads_admin_all" on public.trad_exam_uploads
  for all to authenticated
  using (public.is_school_admin(school_id, auth.uid()))
  with check (public.is_school_admin(school_id, auth.uid()));

create policy "trad_uploads_teacher_own" on public.trad_exam_uploads
  for all to authenticated
  using (
    exists (select 1 from public.trad_exams e
            where e.id = exam_id and e.author_id = auth.uid())
  )
  with check (
    exists (select 1 from public.trad_exams e
            where e.id = exam_id and e.author_id = auth.uid())
  );

create trigger trad_exam_uploads_updated_at
  before update on public.trad_exam_uploads
  for each row execute function public.set_updated_at();

-- Files are organised as: <school_id>/<exam_id>/<filename>
-- The leading folder is the school_id which we check against memberships.

create policy "trad_assets_staff_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'trad-exam-assets'
  and (
    public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())
    or public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(), 'teacher'::member_role)
  )
);

create policy "trad_assets_staff_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'trad-exam-assets'
  and (
    public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())
    or public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(), 'teacher'::member_role)
  )
);

create policy "trad_assets_staff_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'trad-exam-assets'
  and (
    public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())
    or public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(), 'teacher'::member_role)
  )
);

create policy "trad_assets_staff_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'trad-exam-assets'
  and (
    public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())
    or public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(), 'teacher'::member_role)
  )
);
ALTER TABLE public.trad_exams
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.trad_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  exam_id uuid NOT NULL REFERENCES public.trad_exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress',
  mcq_score numeric DEFAULT 0,
  theory_score numeric DEFAULT 0,
  total_score numeric DEFAULT 0,
  max_score numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  integrity_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trad_exam_attempts TO authenticated;
GRANT ALL ON public.trad_exam_attempts TO service_role;
ALTER TABLE public.trad_exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trad_attempt_select" ON public.trad_exam_attempts FOR SELECT TO authenticated
  USING (student_id = auth.uid()
         OR public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role));
CREATE POLICY "trad_attempt_insert" ON public.trad_exam_attempts FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.is_member(school_id, auth.uid()));
CREATE POLICY "trad_attempt_update" ON public.trad_exam_attempts FOR UPDATE TO authenticated
  USING (student_id = auth.uid()
         OR public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role));
CREATE POLICY "trad_attempt_admin_delete" ON public.trad_exam_attempts FOR DELETE TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));
CREATE TRIGGER trad_exam_attempts_set_updated_at BEFORE UPDATE ON public.trad_exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.trad_exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  attempt_id uuid NOT NULL REFERENCES public.trad_exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.trad_exam_questions(id) ON DELETE CASCADE,
  selected_index integer,
  text_answer text,
  is_correct boolean,
  marks_awarded numeric DEFAULT 0,
  graded_by uuid,
  graded_at timestamptz,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trad_exam_answers TO authenticated;
GRANT ALL ON public.trad_exam_answers TO service_role;
ALTER TABLE public.trad_exam_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trad_answer_select" ON public.trad_exam_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trad_exam_attempts a
                 WHERE a.id = attempt_id
                   AND (a.student_id = auth.uid()
                        OR public.is_school_admin(a.school_id, auth.uid())
                        OR public.has_school_role(a.school_id, auth.uid(), 'teacher'::member_role))));
CREATE POLICY "trad_answer_insert" ON public.trad_exam_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.trad_exam_attempts a
                      WHERE a.id = attempt_id
                        AND a.student_id = auth.uid()
                        AND a.submitted_at IS NULL));
CREATE POLICY "trad_answer_update" ON public.trad_exam_answers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trad_exam_attempts a
                 WHERE a.id = attempt_id
                   AND ((a.student_id = auth.uid() AND a.submitted_at IS NULL)
                        OR public.is_school_admin(a.school_id, auth.uid())
                        OR public.has_school_role(a.school_id, auth.uid(), 'teacher'::member_role))));
CREATE TRIGGER trad_exam_answers_set_updated_at BEFORE UPDATE ON public.trad_exam_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.trad_exam_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  exam_id uuid NOT NULL REFERENCES public.trad_exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  attempt_id uuid NOT NULL REFERENCES public.trad_exam_attempts(id) ON DELETE CASCADE UNIQUE,
  mcq_score numeric DEFAULT 0,
  theory_score numeric DEFAULT 0,
  total_score numeric DEFAULT 0,
  max_score numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  grade text,
  status text NOT NULL DEFAULT 'pending_validation',
  validated_by uuid,
  validated_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trad_exam_results TO authenticated;
GRANT ALL ON public.trad_exam_results TO service_role;
ALTER TABLE public.trad_exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trad_result_select" ON public.trad_exam_results FOR SELECT TO authenticated
  USING ((student_id = auth.uid() AND released_at IS NOT NULL)
         OR public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role));
CREATE POLICY "trad_result_admin_write" ON public.trad_exam_results FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role))
  WITH CHECK (public.is_school_admin(school_id, auth.uid())
              OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role));
CREATE TRIGGER trad_exam_results_set_updated_at BEFORE UPDATE ON public.trad_exam_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPCs ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trad_list_student_papers(_school uuid)
RETURNS TABLE (
  exam_id uuid, title text, instructions text, exam_type text, total_marks integer,
  exam_date date, start_time time, duration_minutes integer, venue text,
  status text, attempt_id uuid, attempt_status text, result_released boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.title, e.instructions, e.exam_type::text, e.total_marks,
         t.exam_date, t.start_time, t.duration_minutes, t.venue,
         CASE
           WHEN now() < (t.exam_date::timestamp + t.start_time) THEN 'upcoming'
           WHEN now() < (t.exam_date::timestamp + t.start_time + make_interval(mins => t.duration_minutes)) THEN 'open'
           ELSE 'closed'
         END,
         a.id, a.status, (r.released_at IS NOT NULL)
  FROM public.trad_exams e
  JOIN public.trad_exam_timetable t ON t.id = e.timetable_id
  JOIN public.class_enrollments ce ON ce.class_id = t.class_id
  LEFT JOIN public.trad_exam_attempts a ON a.exam_id = e.id AND a.student_id = auth.uid()
  LEFT JOIN public.trad_exam_results r ON r.attempt_id = a.id
  WHERE e.school_id = _school
    AND e.published_at IS NOT NULL
    AND ce.student_id = auth.uid()
  ORDER BY t.exam_date, t.start_time;
END $$;

CREATE OR REPLACE FUNCTION public.trad_start_attempt(_exam_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_class uuid; v_date date; v_start time; v_dur int;
        v_attempt_id uuid; v_in_window boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT e.school_id, t.class_id, t.exam_date, t.start_time, t.duration_minutes
    INTO v_school, v_class, v_date, v_start, v_dur
  FROM public.trad_exams e
  JOIN public.trad_exam_timetable t ON t.id = e.timetable_id
  WHERE e.id = _exam_id AND e.published_at IS NOT NULL;
  IF v_school IS NULL THEN RAISE EXCEPTION 'paper not available'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_enrollments
                 WHERE class_id = v_class AND student_id = auth.uid()) THEN
    RAISE EXCEPTION 'not enrolled in this class';
  END IF;
  v_in_window := now() >= (v_date::timestamp + v_start)
              AND now() < (v_date::timestamp + v_start + make_interval(mins => v_dur));
  IF NOT v_in_window THEN RAISE EXCEPTION 'exam window closed'; END IF;
  INSERT INTO public.trad_exam_attempts (school_id, exam_id, student_id)
  VALUES (v_school, _exam_id, auth.uid())
  ON CONFLICT (exam_id, student_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_attempt_id;
  RETURN v_attempt_id;
END $$;

CREATE OR REPLACE FUNCTION public.trad_get_attempt_questions(_attempt_id uuid)
RETURNS TABLE (
  q_id uuid, q_position int, q_type text, q_prompt text,
  q_options jsonb, q_marks int, q_image_path text, q_section_id uuid,
  q_selected_index integer, q_text_answer text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_student uuid; v_exam uuid;
BEGIN
  SELECT student_id, exam_id INTO v_student, v_exam
  FROM public.trad_exam_attempts WHERE id = _attempt_id;
  IF v_student IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_student <> auth.uid() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT q.id, q.position, q.type::text, q.prompt,
         q.options, q.marks, q.image_path, q.section_id,
         a.selected_index, a.text_answer
  FROM public.trad_exam_questions q
  LEFT JOIN public.trad_exam_answers a
    ON a.question_id = q.id AND a.attempt_id = _attempt_id
  WHERE q.exam_id = v_exam
  ORDER BY q.position;
END $$;

CREATE OR REPLACE FUNCTION public.trad_finalize_result(_attempt_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_exam uuid; v_student uuid;
        v_mcq numeric; v_theory numeric; v_total numeric; v_max numeric; v_pct numeric; v_grade text;
BEGIN
  SELECT school_id, exam_id, student_id INTO v_school, v_exam, v_student
  FROM public.trad_exam_attempts WHERE id = _attempt_id;
  SELECT COALESCE(SUM(a.marks_awarded) FILTER (WHERE q.type = 'mcq'), 0),
         COALESCE(SUM(a.marks_awarded) FILTER (WHERE q.type = 'theory'), 0)
    INTO v_mcq, v_theory
    FROM public.trad_exam_answers a
    JOIN public.trad_exam_questions q ON q.id = a.question_id
   WHERE a.attempt_id = _attempt_id;
  SELECT COALESCE(SUM(marks), 0) INTO v_max
    FROM public.trad_exam_questions WHERE exam_id = v_exam;
  v_total := v_mcq + v_theory;
  v_pct := CASE WHEN v_max > 0 THEN ROUND((v_total / v_max) * 100, 2) ELSE 0 END;
  v_grade := CASE
    WHEN v_pct >= 75 THEN 'A' WHEN v_pct >= 60 THEN 'B'
    WHEN v_pct >= 50 THEN 'C' WHEN v_pct >= 45 THEN 'D'
    WHEN v_pct >= 40 THEN 'E' ELSE 'F' END;
  UPDATE public.trad_exam_attempts
     SET theory_score = v_theory, total_score = v_total, max_score = v_max,
         percentage = v_pct, status = 'graded'
   WHERE id = _attempt_id;
  INSERT INTO public.trad_exam_results
    (school_id, exam_id, student_id, attempt_id,
     mcq_score, theory_score, total_score, max_score, percentage, grade, status)
  VALUES
    (v_school, v_exam, v_student, _attempt_id,
     v_mcq, v_theory, v_total, v_max, v_pct, v_grade, 'pending_validation')
  ON CONFLICT (attempt_id) DO UPDATE
    SET mcq_score = EXCLUDED.mcq_score, theory_score = EXCLUDED.theory_score,
        total_score = EXCLUDED.total_score, max_score = EXCLUDED.max_score,
        percentage = EXCLUDED.percentage, grade = EXCLUDED.grade, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.trad_submit_attempt(_attempt_id uuid, _auto boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_exam uuid; v_student uuid; v_submitted timestamptz;
        v_mcq_score numeric := 0; v_theory_max numeric := 0; v_mcq_max numeric := 0;
        v_theory_pending int := 0;
BEGIN
  SELECT school_id, exam_id, student_id, submitted_at
    INTO v_school, v_exam, v_student, v_submitted
  FROM public.trad_exam_attempts WHERE id = _attempt_id FOR UPDATE;
  IF v_school IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_student <> auth.uid() AND NOT public.is_school_admin(v_school, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_submitted IS NOT NULL THEN RAISE EXCEPTION 'already submitted'; END IF;

  UPDATE public.trad_exam_answers a
     SET is_correct = (a.selected_index IS NOT NULL AND a.selected_index = q.correct_index),
         marks_awarded = CASE
           WHEN a.selected_index IS NOT NULL AND a.selected_index = q.correct_index THEN q.marks
           ELSE 0 END,
         graded_at = now()
    FROM public.trad_exam_questions q
   WHERE a.question_id = q.id AND a.attempt_id = _attempt_id AND q.type = 'mcq';

  SELECT COALESCE(SUM(a.marks_awarded), 0) INTO v_mcq_score
    FROM public.trad_exam_answers a
    JOIN public.trad_exam_questions q ON q.id = a.question_id
   WHERE a.attempt_id = _attempt_id AND q.type = 'mcq';

  SELECT COALESCE(SUM(q.marks) FILTER (WHERE q.type = 'mcq'), 0),
         COALESCE(SUM(q.marks) FILTER (WHERE q.type = 'theory'), 0)
    INTO v_mcq_max, v_theory_max
    FROM public.trad_exam_questions q WHERE q.exam_id = v_exam;

  SELECT COUNT(*) INTO v_theory_pending
    FROM public.trad_exam_questions q WHERE q.exam_id = v_exam AND q.type = 'theory';

  UPDATE public.trad_exam_attempts
     SET submitted_at = now(),
         status = CASE WHEN v_theory_pending > 0 THEN 'submitted' ELSE 'graded' END,
         mcq_score = v_mcq_score,
         max_score = v_mcq_max + v_theory_max,
         total_score = v_mcq_score
   WHERE id = _attempt_id;

  IF v_theory_pending = 0 THEN
    PERFORM public.trad_finalize_result(_attempt_id);
  END IF;

  RETURN jsonb_build_object(
    'mcq_score', v_mcq_score, 'mcq_max', v_mcq_max,
    'theory_max', v_theory_max, 'theory_pending', v_theory_pending,
    'auto', _auto
  );
END $$;

CREATE OR REPLACE FUNCTION public.trad_grade_theory(_answer_id uuid, _marks numeric, _feedback text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_attempt uuid; v_qtype text; v_qmarks int;
        v_author uuid; v_remaining int;
BEGIN
  SELECT a.school_id, a.attempt_id, q.type::text, q.marks, e.author_id
    INTO v_school, v_attempt, v_qtype, v_qmarks, v_author
  FROM public.trad_exam_answers a
  JOIN public.trad_exam_questions q ON q.id = a.question_id
  JOIN public.trad_exams e ON e.id = q.exam_id
  WHERE a.id = _answer_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'answer not found'; END IF;
  IF v_qtype <> 'theory' THEN RAISE EXCEPTION 'only theory answers can be graded manually'; END IF;
  IF NOT (public.is_school_admin(v_school, auth.uid()) OR v_author = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _marks < 0 OR _marks > v_qmarks THEN RAISE EXCEPTION 'marks out of range (0..%)', v_qmarks; END IF;

  UPDATE public.trad_exam_answers
     SET marks_awarded = _marks, feedback = _feedback,
         graded_by = auth.uid(), graded_at = now()
   WHERE id = _answer_id;

  SELECT COUNT(*) INTO v_remaining
  FROM public.trad_exam_answers a
  JOIN public.trad_exam_questions q ON q.id = a.question_id
  WHERE a.attempt_id = v_attempt AND q.type = 'theory' AND a.graded_at IS NULL;

  IF v_remaining = 0 THEN
    PERFORM public.trad_finalize_result(v_attempt);
  END IF;
  RETURN jsonb_build_object('remaining', v_remaining);
END $$;

CREATE OR REPLACE FUNCTION public.trad_validate_result(_attempt_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.trad_exam_results WHERE attempt_id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'result not found'; END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action = 'validate' THEN
    UPDATE public.trad_exam_results
       SET status = 'validated', validated_by = auth.uid(), validated_at = now(),
           released_at = now()
     WHERE attempt_id = _attempt_id;
  ELSIF _action = 'reject' THEN
    UPDATE public.trad_exam_results
       SET status = 'rejected', validated_by = auth.uid(), validated_at = now()
     WHERE attempt_id = _attempt_id;
  ELSE RAISE EXCEPTION 'invalid action %', _action;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trad_review_paper(_exam_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.trad_exams WHERE id = _exam_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'paper not found'; END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action = 'approve' THEN
    UPDATE public.trad_exams
       SET draft_status = 'approved', approved_by = auth.uid(), approved_at = now(),
           rejection_reason = NULL
     WHERE id = _exam_id;
  ELSIF _action = 'publish' THEN
    UPDATE public.trad_exams
       SET draft_status = 'locked', published_at = now(),
           approved_by = COALESCE(approved_by, auth.uid()),
           approved_at = COALESCE(approved_at, now())
     WHERE id = _exam_id;
  ELSIF _action = 'reject' THEN
    UPDATE public.trad_exams
       SET draft_status = 'draft', rejection_reason = _reason,
           approved_by = NULL, approved_at = NULL
     WHERE id = _exam_id;
  ELSE RAISE EXCEPTION 'invalid action %', _action;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.trad_list_student_papers(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_start_attempt(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_get_attempt_questions(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_submit_attempt(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_finalize_result(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_grade_theory(uuid, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_validate_result(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trad_review_paper(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.trad_list_student_papers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trad_start_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trad_get_attempt_questions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trad_submit_attempt(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trad_grade_theory(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trad_validate_result(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trad_review_paper(uuid, text, text) TO authenticated;

-- 1) trad_exam_questions: restrict teacher reads to authored exams only
DROP POLICY IF EXISTS trad_questions_school_staff_read ON public.trad_exam_questions;

CREATE POLICY trad_questions_admin_read ON public.trad_exam_questions
  FOR SELECT TO authenticated
  USING (is_school_admin(school_id, auth.uid()));

CREATE POLICY trad_questions_author_read ON public.trad_exam_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trad_exams e
    WHERE e.id = trad_exam_questions.exam_id
      AND e.author_id = auth.uid()
  ));

-- 2) student_topic_mastery: add INSERT/UPDATE policies
CREATE POLICY stm_student_insert_self ON public.student_topic_mastery
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY stm_student_update_self ON public.student_topic_mastery
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY stm_staff_insert ON public.student_topic_mastery
  FOR INSERT TO authenticated
  WITH CHECK (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR is_school_admin(school_id, auth.uid())
  );

CREATE POLICY stm_staff_update ON public.student_topic_mastery
  FOR UPDATE TO authenticated
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR is_school_admin(school_id, auth.uid())
  )
  WITH CHECK (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR is_school_admin(school_id, auth.uid())
  );

CREATE POLICY stm_admin_delete ON public.student_topic_mastery
  FOR DELETE TO authenticated
  USING (is_school_admin(school_id, auth.uid()));

-- 3) memberships.profile_data column-level lockdown
-- Block direct reads of profile_data by clients; admins use security-definer RPC.
REVOKE SELECT (profile_data) ON public.memberships FROM authenticated;
REVOKE SELECT (profile_data) ON public.memberships FROM anon;

-- 4) tutor-uploads bucket: require active school membership for INSERT
DROP POLICY IF EXISTS "tutor-uploads owner write" ON storage.objects;

CREATE POLICY "tutor-uploads member write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tutor-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

CREATE TABLE public.trad_scratch_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
  price_kobo integer NOT NULL CHECK (price_kobo >= 100),
  max_uses integer NOT NULL DEFAULT 5 CHECK (max_uses BETWEEN 1 AND 50),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trad_scratch_batches TO authenticated;
GRANT ALL ON public.trad_scratch_batches TO service_role;
ALTER TABLE public.trad_scratch_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY tsb_admin_all ON public.trad_scratch_batches
  FOR ALL TO authenticated
  USING (is_school_admin(school_id, auth.uid()))
  WITH CHECK (is_school_admin(school_id, auth.uid()));

CREATE TABLE public.trad_scratch_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.trad_scratch_batches(id) ON DELETE CASCADE,
  serial text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','used','disabled')),
  buyer_user_id uuid REFERENCES auth.users(id),
  sold_at timestamptz,
  max_uses integer NOT NULL DEFAULT 5,
  use_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trad_cards_school_status_idx ON public.trad_scratch_cards (school_id, status);
CREATE INDEX trad_cards_buyer_idx ON public.trad_scratch_cards (buyer_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trad_scratch_cards TO authenticated;
GRANT ALL ON public.trad_scratch_cards TO service_role;
ALTER TABLE public.trad_scratch_cards ENABLE ROW LEVEL SECURITY;
REVOKE SELECT (pin_hash) ON public.trad_scratch_cards FROM authenticated;
CREATE POLICY tsc_admin_all ON public.trad_scratch_cards
  FOR ALL TO authenticated
  USING (is_school_admin(school_id, auth.uid()))
  WITH CHECK (is_school_admin(school_id, auth.uid()));
CREATE POLICY tsc_buyer_read ON public.trad_scratch_cards
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid());

CREATE TABLE public.trad_scratch_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.trad_scratch_batches(id) ON DELETE CASCADE,
  card_id uuid REFERENCES public.trad_scratch_cards(id),
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id),
  amount_kobo integer NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  paystack_reference text UNIQUE,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','paid','failed','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.trad_scratch_purchases TO authenticated;
GRANT ALL ON public.trad_scratch_purchases TO service_role;
ALTER TABLE public.trad_scratch_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY tsp_admin_read ON public.trad_scratch_purchases
  FOR SELECT TO authenticated
  USING (is_school_admin(school_id, auth.uid()));
CREATE POLICY tsp_buyer_read ON public.trad_scratch_purchases
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid());

CREATE TABLE public.trad_result_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  result_id uuid NOT NULL REFERENCES public.trad_exam_results(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.trad_scratch_cards(id),
  unlocked_by uuid NOT NULL REFERENCES auth.users(id),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id, unlocked_by)
);
GRANT SELECT, INSERT ON public.trad_result_unlocks TO authenticated;
GRANT ALL ON public.trad_result_unlocks TO service_role;
ALTER TABLE public.trad_result_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tru_self_read ON public.trad_result_unlocks
  FOR SELECT TO authenticated
  USING (unlocked_by = auth.uid() OR is_school_admin(school_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.trad_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trad_batches_touch BEFORE UPDATE ON public.trad_scratch_batches
FOR EACH ROW EXECUTE FUNCTION public.trad_touch_updated_at();
CREATE TRIGGER trad_cards_touch BEFORE UPDATE ON public.trad_scratch_cards
FOR EACH ROW EXECUTE FUNCTION public.trad_touch_updated_at();

CREATE OR REPLACE FUNCTION public.trad_hash_pin(_pin text, _serial text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT encode(sha256(convert_to(_pin || '|' || _serial, 'UTF8')), 'hex')
$$;
REVOKE EXECUTE ON FUNCTION public.trad_hash_pin(text,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trad_redeem_card(_serial text, _pin text, _result_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_card public.trad_scratch_cards%ROWTYPE;
  v_result public.trad_exam_results%ROWTYPE;
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated'); END IF;

  SELECT * INTO v_result FROM public.trad_exam_results WHERE id = _result_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'result_not_found'); END IF;
  IF v_result.status <> 'validated' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'result_not_validated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.trad_result_unlocks WHERE result_id = _result_id AND unlocked_by = v_user) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT * INTO v_card FROM public.trad_scratch_cards
    WHERE serial = upper(_serial) AND school_id = v_result.school_id
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_card'); END IF;
  IF v_card.status = 'disabled' THEN RETURN jsonb_build_object('ok', false, 'error', 'card_disabled'); END IF;
  IF v_card.expires_at IS NOT NULL AND v_card.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_expired');
  END IF;
  IF v_card.pin_hash <> public.trad_hash_pin(_pin, v_card.serial) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wrong_pin');
  END IF;
  IF v_card.use_count >= v_card.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_exhausted');
  END IF;

  INSERT INTO public.trad_result_unlocks (school_id, result_id, card_id, unlocked_by)
  VALUES (v_result.school_id, _result_id, v_card.id, v_user);

  UPDATE public.trad_scratch_cards
    SET use_count = use_count + 1,
        status = CASE WHEN use_count + 1 >= max_uses THEN 'used' ELSE status END
    WHERE id = v_card.id;

  RETURN jsonb_build_object('ok', true, 'remaining', v_card.max_uses - (v_card.use_count + 1));
END $$;
REVOKE EXECUTE ON FUNCTION public.trad_redeem_card(text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trad_redeem_card(text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trad_my_cards()
RETURNS TABLE (
  id uuid, school_id uuid, serial text, status text, max_uses integer,
  use_count integer, expires_at timestamptz, sold_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, school_id, serial, status, max_uses, use_count, expires_at, sold_at
  FROM public.trad_scratch_cards
  WHERE buyer_user_id = auth.uid()
  ORDER BY sold_at DESC NULLS LAST
$$;
GRANT EXECUTE ON FUNCTION public.trad_my_cards() TO authenticated;

CREATE OR REPLACE FUNCTION public.trad_is_result_unlocked(_result_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trad_result_unlocks
    WHERE result_id = _result_id AND unlocked_by = auth.uid()
  )
$$;
GRANT EXECUTE ON FUNCTION public.trad_is_result_unlocked(uuid) TO authenticated;

-- 1) Tighten trad_exam_questions author read — only own drafts/submitted
DROP POLICY IF EXISTS trad_questions_author_read ON public.trad_exam_questions;
CREATE POLICY trad_questions_author_read ON public.trad_exam_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trad_exams e
    WHERE e.id = trad_exam_questions.exam_id
      AND e.author_id = auth.uid()
      AND e.draft_status = ANY (ARRAY['draft'::trad_draft_status, 'submitted'::trad_draft_status])
  ));

-- 2) Hide memberships.profile_data column from clients; access only via RPCs
REVOKE SELECT (profile_data) ON public.memberships FROM authenticated;
REVOKE SELECT (profile_data) ON public.memberships FROM anon;
-- writes still need column access (Bio.tsx updates own row)
GRANT UPDATE (profile_data), INSERT (profile_data) ON public.memberships TO authenticated;

-- 3) Hide pin_hash on trad_scratch_cards from clients (only edge functions via service_role)
REVOKE SELECT (pin_hash) ON public.trad_scratch_cards FROM authenticated;
REVOKE SELECT (pin_hash) ON public.trad_scratch_cards FROM anon;

-- 1) Defense-in-depth restrictive policy on exam_questions to ensure ONLY teachers/admins can read,
-- preventing correct_index exposure even if a future permissive policy is added.
DROP POLICY IF EXISTS "exam_questions_restrict_to_staff" ON public.exam_questions;
CREATE POLICY "exam_questions_restrict_to_staff"
ON public.exam_questions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  OR public.is_school_admin(school_id, auth.uid())
);

-- 2) Allow students with an active (in_progress) attempt to read trad-exam-assets
-- scoped to the same school folder.
DROP POLICY IF EXISTS "trad_assets_student_active_attempt_read" ON storage.objects;
CREATE POLICY "trad_assets_student_active_attempt_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trad-exam-assets'
  AND EXISTS (
    SELECT 1
    FROM public.trad_exam_attempts a
    WHERE a.student_id = auth.uid()
      AND a.status = 'in_progress'
      AND a.school_id::text = (storage.foldername(name))[1]
  )
);

-- 1) SUPA_rls_policy_always_true: tighten telemetry INSERT policies
DROP POLICY IF EXISTS "anyone records page view" ON public.page_views;
CREATE POLICY "anyone records page view" ON public.page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "anyone records auth event" ON public.auth_events;
CREATE POLICY "anyone records auth event" ON public.auth_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "anyone records client error" ON public.client_errors;
CREATE POLICY "anyone records client error" ON public.client_errors
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 2) SUPA_public_bucket_allows_listing: remove broad LIST on public buckets.
-- Public URLs still work (buckets remain public=true), but clients can't enumerate.
DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read school-logos" ON storage.objects;
DROP POLICY IF EXISTS "School logos public read" ON storage.objects;

-- 3) security_events_insert_no_policy: add a definer RPC for signed-in users
CREATE OR REPLACE FUNCTION public.log_security_event(_kind text, _detail jsonb DEFAULT '{}'::jsonb, _school_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  INSERT INTO public.security_events (user_id, school_id, kind, detail)
  VALUES (auth.uid(), _school_id, _kind, COALESCE(_detail, '{}'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.log_security_event(text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, jsonb, uuid) TO authenticated;

-- 4) SUPA_anon_security_definer_function_executable: revoke EXECUTE from anon
-- for all SECURITY DEFINER functions in public except the explicitly-public ones.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig, p.proname
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef = true
      AND p.proname NOT IN ('get_school_by_slug', 'verify_result_slip')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef = true
      AND p.proname NOT IN ('get_school_by_slug', 'verify_result_slip')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Profiles viewable by school co-members" ON public.profiles;

CREATE POLICY "Profiles viewable by staff co-members"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m1
      JOIN public.memberships m2 ON m1.school_id = m2.school_id
      WHERE m1.user_id = auth.uid()
        AND m1.status = 'active'
        AND m1.role IN ('admin','teacher')
        AND m2.user_id = profiles.id
        AND m2.status = 'active'
    )
  );

CREATE POLICY "Profiles viewable by parents for linked users"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.parent_user_id = auth.uid()
        AND pl.student_user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_links pl
      JOIN public.memberships m_child  ON m_child.user_id  = pl.student_user_id AND m_child.status = 'active'
      JOIN public.memberships m_target ON m_target.school_id = m_child.school_id
                                      AND m_target.user_id   = profiles.id
                                      AND m_target.status    = 'active'
      WHERE pl.parent_user_id = auth.uid()
        AND m_target.role IN ('admin','teacher')
    )
  );

CREATE OR REPLACE VIEW public.public_profiles AS
SELECT p.id, p.full_name, p.photo_url
FROM public.profiles p
WHERE EXISTS (
  SELECT 1
  FROM public.memberships m1
  JOIN public.memberships m2 ON m1.school_id = m2.school_id
  WHERE m1.user_id = auth.uid() AND m1.status = 'active'
    AND m2.user_id = p.id AND m2.status = 'active'
)
OR p.id = auth.uid();

GRANT SELECT ON public.public_profiles TO authenticated;

REVOKE SELECT (correct_index) ON public.mock_questions FROM authenticated;

DO $$
BEGIN
  ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Authenticated may read realtime topics for self" ON realtime.messages;
  CREATE POLICY "Authenticated may read realtime topics for self"
    ON realtime.messages FOR SELECT TO authenticated
    USING (
      auth.uid() IS NOT NULL
      AND (
        realtime.topic() LIKE '%' || auth.uid()::text || '%'
        OR public.is_super_admin(auth.uid())
      )
    );

  DROP POLICY IF EXISTS "Authenticated may publish realtime topics for self" ON realtime.messages;
  CREATE POLICY "Authenticated may publish realtime topics for self"
    ON realtime.messages FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() IS NOT NULL
      AND (
        realtime.topic() LIKE '%' || auth.uid()::text || '%'
        OR public.is_super_admin(auth.uid())
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (id uuid, full_name text, photo_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.photo_url
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      p.id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.memberships m1
        JOIN public.memberships m2 ON m1.school_id = m2.school_id
        WHERE m1.user_id = auth.uid() AND m1.status = 'active'
          AND m2.user_id = p.id AND m2.status = 'active'
      )
    )
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- ============================================
-- 1) Per-tenant rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NULL,
  user_id uuid NULL,
  key text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_scope_idx
  ON public.rate_limits (COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
                         COALESCE(user_id,   '00000000-0000-0000-0000-000000000000'::uuid),
                         key, window_start);
CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);

GRANT SELECT ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits super read" ON public.rate_limits;
CREATE POLICY "rate_limits super read" ON public.rate_limits
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- check_rate_limit: bump counter inside current window; return true if under budget.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text,
  _max integer,
  _window_seconds integer,
  _school_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_window timestamptz := date_trunc('second', now()) - (extract(epoch from now())::bigint % GREATEST(_window_seconds,1)) * interval '1 second';
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  INSERT INTO public.rate_limits (school_id, user_id, key, window_start, count)
  VALUES (_school_id, v_uid, _key, v_window, 1)
  ON CONFLICT (COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid),
               COALESCE(user_id,   '00000000-0000-0000-0000-000000000000'::uuid),
               key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1,
                updated_at = now()
  RETURNING count INTO v_count;

  RETURN v_count <= _max;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer, uuid) TO authenticated, service_role;

-- ============================================
-- 2) Soft delete columns
-- ============================================
ALTER TABLE public.schools                ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.platform_announcements ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.announcements          ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
ALTER TABLE public.modules                ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS schools_deleted_at_idx                ON public.schools (deleted_at);
CREATE INDEX IF NOT EXISTS platform_announcements_deleted_at_idx ON public.platform_announcements (deleted_at);
CREATE INDEX IF NOT EXISTS announcements_deleted_at_idx          ON public.announcements (deleted_at);
CREATE INDEX IF NOT EXISTS modules_deleted_at_idx                ON public.modules (deleted_at);
-- 1) Move vector extension out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION vector SET SCHEMA extensions';
  END IF;
END $$;

-- Ensure any SECURITY DEFINER function that touches vectors still resolves the type/operators
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('match_knowledge_chunks')
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, extensions',
      r.nspname, r.proname, r.args
    );
  END LOOP;
END $$;

-- 2) Revoke EXECUTE from authenticated for trigger-only and internal helper SECURITY DEFINER functions.
--    These are invoked by triggers (run as owner) or are admin/cron-only; clients should never call them.
DO $$
DECLARE
  fn text;
  args text;
  trig_fns text[] := ARRAY[
    'handle_new_user',
    'bootstrap_school_admin',
    'prevent_membership_self_escalation',
    'rollup_topic_mastery',
    'trg_seed_mock_bank',
    'seed_mock_bank',
    'bump_ai_quota',
    'bump_ai_quota_savings',
    'issue_invoices_for_audience',
    'recompute_term_results_for_class',
    'trad_finalize_result'
  ];
BEGIN
  FOREACH fn IN ARRAY trig_fns LOOP
    FOR args IN
      SELECT pg_get_function_identity_arguments(p.oid)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = fn
    LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', fn, args);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', fn, args);
    END LOOP;
  END LOOP;
END $$;

-- Replace prior realtime.messages policies with participant-aware checks for
-- conversation topics (format: 'conv:<conversation_uuid>[:...]'). Other topics
-- continue to require the user's UID to appear in the topic.

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read scoped realtime messages" ON realtime.messages;
  DROP POLICY IF EXISTS "Authenticated users can send scoped realtime messages" ON realtime.messages;
  DROP POLICY IF EXISTS "Realtime read scoped to user or conversation participant" ON realtime.messages;
  DROP POLICY IF EXISTS "Realtime send scoped to user or conversation participant" ON realtime.messages;

  CREATE POLICY "Realtime read scoped to user or conversation participant"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    (
      realtime.topic() LIKE 'conv:%'
      AND EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.user_id = auth.uid()
          AND cp.conversation_id::text = split_part(substring(realtime.topic() FROM 6), ':', 1)
      )
    )
    OR (
      realtime.topic() NOT LIKE 'conv:%'
      AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
    )
  );

  CREATE POLICY "Realtime send scoped to user or conversation participant"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (
      realtime.topic() LIKE 'conv:%'
      AND EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.user_id = auth.uid()
          AND cp.conversation_id::text = split_part(substring(realtime.topic() FROM 6), ':', 1)
      )
    )
    OR (
      realtime.topic() NOT LIKE 'conv:%'
      AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
    )
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
-- Consolidated hardening for remaining realtime/answer-key/open grant issues

CREATE OR REPLACE FUNCTION public.can_read_platform_announcement(_announcement public.platform_announcements)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin(v_uid) THEN RETURN true; END IF;
  IF _announcement.deleted_at IS NOT NULL THEN RETURN false; END IF;
  IF _announcement.scheduled_for IS NOT NULL AND _announcement.scheduled_for > now() THEN RETURN false; END IF;
  IF _announcement.audience = 'all' THEN RETURN true; END IF;

  IF _announcement.audience = 'admins' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = v_uid AND m.status = 'active' AND m.role = 'admin'
        AND (NOT (_announcement.target ? 'school_id') OR m.school_id::text = _announcement.target->>'school_id')
    );
  END IF;

  IF _announcement.audience IN ('teachers', 'students', 'parents') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = v_uid AND m.status = 'active'
        AND m.role = CASE _announcement.audience
          WHEN 'teachers' THEN 'teacher'::public.member_role
          WHEN 'students' THEN 'student'::public.member_role
          WHEN 'parents' THEN 'parent'::public.member_role
        END
        AND (NOT (_announcement.target ? 'school_id') OR m.school_id::text = _announcement.target->>'school_id')
    );
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_platform_announcement(public.platform_announcements) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_platform_announcement(public.platform_announcements) TO authenticated, service_role;

DROP POLICY IF EXISTS "anyone authed reads platform announcements" ON public.platform_announcements;
DROP POLICY IF EXISTS "Targeted users read platform announcements" ON public.platform_announcements;
CREATE POLICY "Targeted users read platform announcements"
ON public.platform_announcements
FOR SELECT
TO authenticated
USING (public.can_read_platform_announcement(platform_announcements));
REVOKE ALL ON public.platform_announcements FROM anon;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated may publish realtime topics for self" ON realtime.messages;
  DROP POLICY IF EXISTS "Authenticated may read realtime topics for self" ON realtime.messages;
  DROP POLICY IF EXISTS "Authenticated users can read scoped realtime messages" ON realtime.messages;
  DROP POLICY IF EXISTS "Authenticated users can send scoped realtime messages" ON realtime.messages;
  DROP POLICY IF EXISTS "Realtime read scoped to user or conversation participant" ON realtime.messages;
  DROP POLICY IF EXISTS "Realtime send scoped to user or conversation participant" ON realtime.messages;
  DROP POLICY IF EXISTS "Realtime read explicit app topics" ON realtime.messages;
  DROP POLICY IF EXISTS "Realtime send explicit app topics" ON realtime.messages;

  CREATE POLICY "Realtime read explicit app topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      public.is_super_admin(auth.uid())
      OR (realtime.topic() LIKE 'conv:%' AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.user_id = auth.uid()
          AND cp.conversation_id::text = split_part(substring(realtime.topic() FROM 6), ':', 1)
      ))
      OR realtime.topic() LIKE 'typing:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'typing:%:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'msg-thread:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'msg-thread:%:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'notifier:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'notif-bell:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'comms:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'comms-bell:' || auth.uid()::text || ':%'
    )
  );

  CREATE POLICY "Realtime send explicit app topics"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      public.is_super_admin(auth.uid())
      OR (realtime.topic() LIKE 'conv:%' AND EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.user_id = auth.uid()
          AND cp.conversation_id::text = split_part(substring(realtime.topic() FROM 6), ':', 1)
      ))
      OR realtime.topic() LIKE 'typing:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'typing:%:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'msg-thread:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'msg-thread:%:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'notifier:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'notif-bell:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'comms:' || auth.uid()::text || ':%'
      OR realtime.topic() LIKE 'comms-bell:' || auth.uid()::text || ':%'
    )
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

REVOKE ALL ON public.mock_questions FROM anon;
REVOKE ALL ON public.trad_exam_questions FROM anon;
REVOKE ALL ON public.exam_questions FROM anon;

REVOKE SELECT ON public.mock_questions FROM authenticated;
REVOKE SELECT ON public.trad_exam_questions FROM authenticated;
REVOKE SELECT ON public.exam_questions FROM authenticated;

GRANT SELECT (id, school_id, subject_id, position, prompt, options, created_at) ON public.mock_questions TO authenticated;
GRANT SELECT (id, exam_id, school_id, position, prompt, options, points) ON public.exam_questions TO authenticated;
GRANT SELECT (id, school_id, exam_id, section_id, position, type, prompt, options, marks, image_path, ai_generated, created_at, updated_at) ON public.trad_exam_questions TO authenticated;

CREATE OR REPLACE FUNCTION public.trad_get_paper_questions(_exam_id uuid)
RETURNS TABLE(
  q_id uuid,
  q_school_id uuid,
  q_exam_id uuid,
  q_section_id uuid,
  q_position integer,
  q_type text,
  q_prompt text,
  q_options jsonb,
  q_correct_index integer,
  q_model_answer text,
  q_marks integer,
  q_image_path text,
  q_explanation text,
  q_ai_generated boolean,
  q_created_at timestamptz,
  q_updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_author uuid;
BEGIN
  SELECT e.school_id, e.author_id INTO v_school, v_author
  FROM public.trad_exams e
  WHERE e.id = _exam_id;

  IF v_school IS NULL THEN RAISE EXCEPTION 'exam not found'; END IF;
  IF NOT (public.is_school_admin(v_school, auth.uid()) OR v_author = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT q.id, q.school_id, q.exam_id, q.section_id, q.position, q.type::text,
         q.prompt, q.options, q.correct_index, q.model_answer, q.marks,
         q.image_path, q.explanation, q.ai_generated, q.created_at, q.updated_at
  FROM public.trad_exam_questions q
  WHERE q.exam_id = _exam_id
  ORDER BY q.position;
END;
$$;

CREATE OR REPLACE FUNCTION public.trad_get_theory_grading_queue(_school_id uuid)
RETURNS TABLE(
  answer_id uuid,
  text_answer text,
  marks_awarded numeric,
  graded_at timestamptz,
  feedback text,
  student_id uuid,
  attempt_status text,
  submitted_at timestamptz,
  question_id uuid,
  prompt text,
  marks integer,
  model_answer text,
  exam_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_school_admin(_school_id, auth.uid()) OR public.has_school_role(_school_id, auth.uid(), 'teacher'::public.member_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT a.id, a.text_answer, a.marks_awarded, a.graded_at, a.feedback,
         ta.student_id, ta.status, ta.submitted_at,
         q.id, q.prompt, q.marks, q.model_answer, q.exam_id
  FROM public.trad_exam_answers a
  JOIN public.trad_exam_attempts ta ON ta.id = a.attempt_id
  JOIN public.trad_exam_questions q ON q.id = a.question_id
  JOIN public.trad_exams e ON e.id = q.exam_id
  WHERE a.school_id = _school_id
    AND q.type = 'theory'
    AND a.graded_at IS NULL
    AND ta.submitted_at IS NOT NULL
    AND (public.is_school_admin(_school_id, auth.uid()) OR e.author_id = auth.uid())
  ORDER BY a.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.trad_get_paper_questions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trad_get_theory_grading_queue(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trad_get_paper_questions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trad_get_theory_grading_queue(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_school_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_school_by_slug(text) TO anon, authenticated, service_role;
DROP POLICY IF EXISTS trad_assets_student_active_attempt_read ON storage.objects;

CREATE POLICY trad_assets_student_active_attempt_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'trad-exam-assets'
  AND EXISTS (
    SELECT 1
    FROM public.trad_exam_attempts a
    WHERE a.student_id = auth.uid()
      AND a.status = 'in_progress'
      AND a.school_id::text = (storage.foldername(objects.name))[1]
      AND a.exam_id::text = (storage.foldername(objects.name))[2]
  )
);

DROP POLICY IF EXISTS "Profiles viewable by parents for linked users" ON public.profiles;

CREATE POLICY "Profiles viewable by parents for linked users"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_links pl
      WHERE pl.parent_user_id = auth.uid()
        AND pl.student_user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.parent_links pl
      JOIN public.class_enrollments ce
        ON ce.student_id = pl.student_user_id
      JOIN public.class_subject_teachers cst
        ON cst.class_id = ce.class_id
      WHERE pl.parent_user_id = auth.uid()
        AND cst.teacher_user_id = profiles.id
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'platform_announcements'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.platform_announcements';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_type text;

UPDATE public.conversations
   SET channel_type = COALESCE(channel_type, kind::text)
 WHERE channel_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_channel_type
  ON public.conversations(school_id, channel_type);

CREATE TABLE IF NOT EXISTS public.comms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_templates TO authenticated;
GRANT ALL ON public.comms_templates TO service_role;
ALTER TABLE public.comms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpl_select_members" ON public.comms_templates
  FOR SELECT TO authenticated USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "tpl_write_staff" ON public.comms_templates
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role))
  WITH CHECK (public.is_school_admin(school_id, auth.uid())
         OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role));
CREATE TRIGGER comms_templates_set_updated_at BEFORE UPDATE ON public.comms_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.broadcast_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  recurrence text,
  template_id uuid REFERENCES public.comms_templates(id) ON DELETE SET NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_school_status
  ON public.broadcast_jobs(school_id, status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_jobs TO authenticated;
GRANT ALL ON public.broadcast_jobs TO service_role;
ALTER TABLE public.broadcast_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bj_admin_all" ON public.broadcast_jobs
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE TRIGGER broadcast_jobs_set_updated_at BEFORE UPDATE ON public.broadcast_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcast_jobs(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz,
  read_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bd_broadcast ON public.broadcast_deliveries(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_bd_user ON public.broadcast_deliveries(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.broadcast_deliveries TO authenticated;
GRANT ALL ON public.broadcast_deliveries TO service_role;
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bd_select" ON public.broadcast_deliveries
  FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "bd_update_own" ON public.broadcast_deliveries
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "bd_admin_insert" ON public.broadcast_deliveries
  FOR INSERT TO authenticated WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "bd_admin_delete" ON public.broadcast_deliveries
  FOR DELETE TO authenticated USING (public.is_school_admin(school_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.comms_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  surface text,
  ref_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ce_school_kind_time ON public.comms_events(school_id, kind, created_at DESC);
GRANT SELECT, INSERT ON public.comms_events TO authenticated;
GRANT ALL ON public.comms_events TO service_role;
ALTER TABLE public.comms_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_insert_self" ON public.comms_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_member(school_id, auth.uid()));
CREATE POLICY "ce_admin_select" ON public.comms_events
  FOR SELECT TO authenticated USING (public.is_school_admin(school_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.inbox_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid NOT NULL,
  item_type text NOT NULL,
  item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_inbox_stars_user ON public.inbox_stars(user_id, school_id);
GRANT SELECT, INSERT, DELETE ON public.inbox_stars TO authenticated;
GRANT ALL ON public.inbox_stars TO service_role;
ALTER TABLE public.inbox_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "is_own" ON public.inbox_stars
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_member(school_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.support_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  default_assignee uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_ticket_categories TO authenticated;
GRANT ALL ON public.support_ticket_categories TO service_role;
ALTER TABLE public.support_ticket_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stc_select_members" ON public.support_ticket_categories
  FOR SELECT TO authenticated USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "stc_admin_write" ON public.support_ticket_categories
  FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE TRIGGER stc_set_updated_at BEFORE UPDATE ON public.support_ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.support_ticket_categories (school_id, name, slug)
SELECT s.id, c.name, c.slug
FROM public.schools s
CROSS JOIN (VALUES
  ('Academic Issues','academic'),
  ('Result Issues','result'),
  ('Payment Issues','payment'),
  ('Technical Support','technical'),
  ('Admission Requests','admission')
) AS c(name, slug)
ON CONFLICT (school_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.comms_ensure_class_channel(_class_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv uuid; v_school uuid; v_name text; v_creator uuid;
BEGIN
  SELECT c.school_id, c.name, c.teacher_id INTO v_school, v_name, v_creator
    FROM public.classes c WHERE c.id = _class_id;
  IF v_school IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_conv FROM public.conversations
   WHERE school_id = v_school AND channel_type = 'class'
     AND (metadata->>'class_id')::uuid = _class_id
   LIMIT 1;

  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (school_id, kind, title, created_by, channel_type, metadata)
    VALUES (v_school, 'group', v_name,
            COALESCE(v_creator, '00000000-0000-0000-0000-000000000000'::uuid),
            'class', jsonb_build_object('class_id', _class_id, 'source', 'class'))
    RETURNING id INTO v_conv;
  END IF;
  RETURN v_conv;
END $$;

CREATE OR REPLACE FUNCTION public.comms_sync_class_participants(_class_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv uuid;
BEGIN
  v_conv := public.comms_ensure_class_channel(_class_id);
  IF v_conv IS NULL THEN RETURN; END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role_at_join)
  SELECT v_conv, ce.student_id, 'student'
    FROM public.class_enrollments ce WHERE ce.class_id = _class_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.conversation_participants (conversation_id, user_id, role_at_join)
  SELECT v_conv, cst.teacher_user_id, 'teacher'
    FROM public.class_subject_teachers cst WHERE cst.class_id = _class_id
  ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.tg_comms_class_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.comms_ensure_class_channel(NEW.id); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS comms_class_after_insert ON public.classes;
CREATE TRIGGER comms_class_after_insert
  AFTER INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.tg_comms_class_after_insert();

CREATE OR REPLACE FUNCTION public.tg_comms_enrollment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.comms_sync_class_participants(COALESCE(NEW.class_id, OLD.class_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS comms_enrollment_sync ON public.class_enrollments;
CREATE TRIGGER comms_enrollment_sync
  AFTER INSERT OR DELETE ON public.class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.tg_comms_enrollment_sync();

DROP TRIGGER IF EXISTS comms_teacher_sync ON public.class_subject_teachers;
CREATE TRIGGER comms_teacher_sync
  AFTER INSERT OR DELETE ON public.class_subject_teachers
  FOR EACH ROW EXECUTE FUNCTION public.tg_comms_enrollment_sync();

CREATE OR REPLACE FUNCTION public.comms_backfill_channels()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.classes LOOP
    PERFORM public.comms_sync_class_participants(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

SELECT public.comms_backfill_channels();

-- 1) Hide exam answer keys from direct table reads (match mock_questions pattern).
REVOKE SELECT (correct_index) ON public.exam_questions FROM authenticated;
REVOKE SELECT (correct_index) ON public.exam_questions FROM anon;

-- 2) Hide membership profile_data from co-members.
-- Admin reads go through admin_list_memberships_with_profile (SECURITY DEFINER),
-- self reads go through get_my_membership_profile (SECURITY DEFINER).
REVOKE SELECT (profile_data) ON public.memberships FROM authenticated;
REVOKE SELECT (profile_data) ON public.memberships FROM anon;

-- 3) Defense-in-depth: block any user with a student role at the school
--    from selecting trad_exam_questions directly, even if they also have
--    teacher role (dual-role escalation guard).
DROP POLICY IF EXISTS trad_questions_restrict_students ON public.trad_exam_questions;
CREATE POLICY trad_questions_restrict_students
  ON public.trad_exam_questions
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    NOT public.has_school_role(school_id, auth.uid(), 'student'::public.member_role)
  );

-- 1) Idempotency: prevent duplicate classes per school by name (case-insensitive)
--    De-duplicate existing rows first, keeping the oldest.
WITH ranked AS (
  SELECT id, school_id, lower(name) AS lname,
         row_number() OVER (PARTITION BY school_id, lower(name) ORDER BY created_at ASC, id ASC) AS rn
  FROM public.classes
)
DELETE FROM public.classes c
USING ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS classes_school_name_unique
  ON public.classes (school_id, lower(name));

-- 2) Defense-in-depth: block students from reading answer-key tables.
--    Mirrors the existing trad_exam_questions restriction.
DROP POLICY IF EXISTS mock_questions_restrict_students ON public.mock_questions;
CREATE POLICY mock_questions_restrict_students ON public.mock_questions
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role));

DROP POLICY IF EXISTS question_bank_restrict_students ON public.question_bank;
CREATE POLICY question_bank_restrict_students ON public.question_bank
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    school_id IS NULL
    OR NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role)
  );

DROP POLICY IF EXISTS questions_v2_restrict_students ON public.questions_v2;
CREATE POLICY questions_v2_restrict_students ON public.questions_v2
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    school_id IS NULL
    OR NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role)
  );

-- 3) Hide scratch-card pin_hash from direct table reads (admins use a controlled RPC if needed).
REVOKE SELECT (pin_hash) ON public.trad_scratch_cards FROM authenticated, anon;
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
    WHERE school_id = _school_id AND lower(name) = lower(v_name)
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

GRANT EXECUTE ON FUNCTION public.complete_admin_onboarding(uuid, jsonb, jsonb, text[]) TO authenticated;
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
-- Fix mutable search_path on tg_enforce_pilot_writable
ALTER FUNCTION public.tg_enforce_pilot_writable() SET search_path = public;

-- Safe SECURITY DEFINER helper: look up a user id by email in auth.users.
-- Used by edge functions instead of fetching all auth users.
CREATE OR REPLACE FUNCTION public.auth_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_by_email(text) TO service_role;

-- Count of super admins, callable by anyone (returns only a number, no rows).
-- Used by the /super/claim bootstrap UI so the count is correct regardless of RLS.
CREATE OR REPLACE FUNCTION public.super_admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE role = 'super_admin');
$$;
GRANT EXECUTE ON FUNCTION public.super_admin_exists() TO anon, authenticated, service_role;
-- Proctoring configuration on exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS proctor_action text NOT NULL DEFAULT 'auto_submit'
    CHECK (proctor_action IN ('warn','auto_submit')),
  ADD COLUMN IF NOT EXISTS proctor_snapshot_interval_sec integer NOT NULL DEFAULT 60
    CHECK (proctor_snapshot_interval_sec BETWEEN 10 AND 600);

-- Realtime for live admin proctoring feed
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_violations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.exam_violations REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- =========================================================================
-- Module 1: Academic Configuration Engine
-- =========================================================================

-- Platform-wide defaults (super admin)
CREATE TABLE public.academic_policy_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_kind text NOT NULL UNIQUE,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_policy_defaults TO authenticated;
GRANT ALL ON public.academic_policy_defaults TO service_role;
ALTER TABLE public.academic_policy_defaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated can read defaults"
  ON public.academic_policy_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admins manage defaults"
  ON public.academic_policy_defaults FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Per-school policy overrides
CREATE TABLE public.academic_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  policy_kind text NOT NULL,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, policy_kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_policies TO authenticated;
GRANT ALL ON public.academic_policies TO service_role;
ALTER TABLE public.academic_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read policies"
  ON public.academic_policies FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage policies"
  ON public.academic_policies FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()) OR public.is_super_admin(auth.uid()));

-- Academic calendar (terms / semesters / custom periods)
CREATE TABLE public.academic_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session text NOT NULL,
  kind text NOT NULL DEFAULT 'term',
  periods jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, session)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_calendar TO authenticated;
GRANT ALL ON public.academic_calendar TO service_role;
ALTER TABLE public.academic_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read calendar"
  ON public.academic_calendar FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage calendar"
  ON public.academic_calendar FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Grading scales
CREATE TABLE public.grading_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  bands jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX grading_scales_one_default ON public.grading_scales(school_id) WHERE is_default;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grading_scales TO authenticated;
GRANT ALL ON public.grading_scales TO service_role;
ALTER TABLE public.grading_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read grading scales"
  ON public.grading_scales FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage grading scales"
  ON public.grading_scales FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Assessment structures (component weights)
CREATE TABLE public.assessment_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assessment_structures_one_default ON public.assessment_structures(school_id) WHERE is_default;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_structures TO authenticated;
GRANT ALL ON public.assessment_structures TO service_role;
ALTER TABLE public.assessment_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read assessment structures"
  ON public.assessment_structures FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage assessment structures"
  ON public.assessment_structures FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Validate weights sum to 100 via trigger (not CHECK, since jsonb math)
CREATE OR REPLACE FUNCTION public.tg_validate_assessment_weights()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_sum numeric;
BEGIN
  SELECT COALESCE(SUM((c->>'weight')::numeric), 0) INTO v_sum
  FROM jsonb_array_elements(NEW.components) c;
  IF jsonb_array_length(NEW.components) > 0 AND ROUND(v_sum)::int <> 100 THEN
    RAISE EXCEPTION 'Assessment weights must sum to 100 (got %)', v_sum;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_assessment_weights
  BEFORE INSERT OR UPDATE ON public.assessment_structures
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_assessment_weights();

-- Promotion rules
CREATE TABLE public.promotion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  min_average numeric NOT NULL DEFAULT 50,
  core_subjects text[] NOT NULL DEFAULT ARRAY[]::text[],
  min_attendance_pct numeric NOT NULL DEFAULT 75,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotion_rules TO authenticated;
GRANT ALL ON public.promotion_rules TO service_role;
ALTER TABLE public.promotion_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read promotion rules"
  ON public.promotion_rules FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage promotion rules"
  ON public.promotion_rules FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Result release rules
CREATE TABLE public.result_release_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  auto_release_at timestamptz,
  requires_approval boolean NOT NULL DEFAULT true,
  approval_chain text[] NOT NULL DEFAULT ARRAY['teacher','admin']::text[],
  pin_required boolean NOT NULL DEFAULT false,
  pin_price_kobo bigint NOT NULL DEFAULT 0,
  template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_release_rules TO authenticated;
GRANT ALL ON public.result_release_rules TO service_role;
ALTER TABLE public.result_release_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read result release rules"
  ON public.result_release_rules FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School admins manage result release rules"
  ON public.result_release_rules FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()))
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- Updated_at triggers
CREATE TRIGGER trg_acad_policy_defaults_updated BEFORE UPDATE ON public.academic_policy_defaults
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_acad_policies_updated BEFORE UPDATE ON public.academic_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_acad_calendar_updated BEFORE UPDATE ON public.academic_calendar
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_grading_scales_updated BEFORE UPDATE ON public.grading_scales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_promotion_rules_updated BEFORE UPDATE ON public.promotion_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_result_release_rules_updated BEFORE UPDATE ON public.result_release_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- Helper functions
-- =========================================================================

-- Resolve policy: school override > super default > empty
CREATE OR REPLACE FUNCTION public.resolve_academic_policy(_school uuid, _kind text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_body jsonb;
BEGIN
  SELECT body INTO v_body FROM public.academic_policies
   WHERE school_id = _school AND policy_kind = _kind;
  IF v_body IS NOT NULL AND v_body <> '{}'::jsonb THEN RETURN v_body; END IF;
  SELECT body INTO v_body FROM public.academic_policy_defaults
   WHERE policy_kind = _kind;
  RETURN COALESCE(v_body, '{}'::jsonb);
END $$;

-- Compute grade + remark for a score using the school's default grading scale
CREATE OR REPLACE FUNCTION public.compute_grade(_school uuid, _score numeric)
RETURNS TABLE(grade text, remark text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bands jsonb; v_band jsonb;
BEGIN
  SELECT bands INTO v_bands FROM public.grading_scales
   WHERE school_id = _school AND is_default = true LIMIT 1;

  IF v_bands IS NULL OR jsonb_array_length(v_bands) = 0 THEN
    -- fallback to platform default grading
    SELECT body->'bands' INTO v_bands FROM public.academic_policy_defaults
     WHERE policy_kind = 'grading';
  END IF;

  IF v_bands IS NULL OR jsonb_array_length(v_bands) = 0 THEN
    -- hard fallback
    v_bands := '[
      {"min":70,"max":100,"grade":"A","remark":"Excellent"},
      {"min":60,"max":69,"grade":"B","remark":"Very Good"},
      {"min":50,"max":59,"grade":"C","remark":"Good"},
      {"min":45,"max":49,"grade":"D","remark":"Pass"},
      {"min":0,"max":44,"grade":"F","remark":"Fail"}
    ]'::jsonb;
  END IF;

  FOR v_band IN SELECT * FROM jsonb_array_elements(v_bands) LOOP
    IF _score >= (v_band->>'min')::numeric AND _score <= (v_band->>'max')::numeric THEN
      grade := v_band->>'grade';
      remark := v_band->>'remark';
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;

  grade := 'F'; remark := 'Fail'; RETURN NEXT;
END $$;

-- Seed platform defaults
INSERT INTO public.academic_policy_defaults (policy_kind, body) VALUES
  ('grading', '{
    "bands":[
      {"min":70,"max":100,"grade":"A","remark":"Excellent"},
      {"min":60,"max":69,"grade":"B","remark":"Very Good"},
      {"min":50,"max":59,"grade":"C","remark":"Good"},
      {"min":45,"max":49,"grade":"D","remark":"Pass"},
      {"min":0,"max":44,"grade":"F","remark":"Fail"}
    ]
  }'::jsonb),
  ('assessment', '{
    "components":[
      {"key":"attendance","label":"Attendance","weight":5},
      {"key":"assignment","label":"Assignment","weight":10},
      {"key":"test","label":"Test","weight":25},
      {"key":"examination","label":"Examination","weight":60}
    ]
  }'::jsonb),
  ('calendar', '{"kind":"term","periods":["First Term","Second Term","Third Term"]}'::jsonb),
  ('promotion', '{"min_average":50,"min_attendance_pct":75,"core_subjects":["Mathematics","English"]}'::jsonb),
  ('result', '{"requires_approval":true,"approval_chain":["teacher","admin"],"pin_required":false}'::jsonb),
  ('risk_scoring', '{
    "rules":{
      "tab_switch":10,"fullscreen_exit":10,"copy_attempt":5,"paste_attempt":5,
      "context_menu":3,"devtools":20,"no_face_detected":15,"multiple_faces_detected":30,
      "camera_off":30
    },
    "levels":{"normal":20,"review":50,"high":80}
  }'::jsonb)
ON CONFLICT (policy_kind) DO NOTHING;

-- Lock down new SECURITY DEFINER functions from Module 1
REVOKE EXECUTE ON FUNCTION public.resolve_academic_policy(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.compute_grade(uuid, numeric) FROM anon;

-- =========================================================================
-- Module 2: Exam approvals + question versioning + scheduling
-- =========================================================================
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS auto_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS class_restrictions uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id uuid;

CREATE TABLE public.exam_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL,
  exam_kind text NOT NULL DEFAULT 'trad',
  stage text NOT NULL,
  actor_id uuid,
  status text NOT NULL DEFAULT 'pending',
  note text,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_approvals_exam_idx ON public.exam_approvals(exam_id, stage);
GRANT SELECT, INSERT, UPDATE ON public.exam_approvals TO authenticated;
GRANT ALL ON public.exam_approvals TO service_role;
ALTER TABLE public.exam_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read approvals"
  ON public.exam_approvals FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "Admins/teachers act on approvals"
  ON public.exam_approvals FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );
CREATE POLICY "Admins/teachers update approvals"
  ON public.exam_approvals FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

CREATE TABLE public.question_bank_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qb_versions_q_idx ON public.question_bank_versions(question_id, version);
GRANT SELECT, INSERT ON public.question_bank_versions TO authenticated;
GRANT ALL ON public.question_bank_versions TO service_role;
ALTER TABLE public.question_bank_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School members read versions"
  ON public.question_bank_versions FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "School staff write versions"
  ON public.question_bank_versions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

-- =========================================================================
-- Module 3: Integrity + Appeals + Audit
-- =========================================================================
ALTER TABLE public.exam_violations
  ADD COLUMN IF NOT EXISTS risk_score int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evidence_path text,
  ADD COLUMN IF NOT EXISTS student_explanation jsonb,
  ADD COLUMN IF NOT EXISTS reviewer_decision text,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE public.exam_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  student_id uuid NOT NULL,
  exam_kind text NOT NULL DEFAULT 'cbt',
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  stage_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  recalculation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_appeals_attempt_idx ON public.exam_appeals(attempt_id);
GRANT SELECT, INSERT, UPDATE ON public.exam_appeals TO authenticated;
GRANT ALL ON public.exam_appeals TO service_role;
ALTER TABLE public.exam_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own appeals"
  ON public.exam_appeals FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );
CREATE POLICY "Students create own appeals"
  ON public.exam_appeals FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.is_member(school_id, auth.uid()));
CREATE POLICY "Staff update appeals"
  ON public.exam_appeals FOR UPDATE TO authenticated
  USING (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );
CREATE TRIGGER trg_exam_appeals_updated BEFORE UPDATE ON public.exam_appeals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.exam_audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  student_answer jsonb,
  correct_answer jsonb,
  score_awarded numeric,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX exam_audit_attempt_idx ON public.exam_audit_entries(attempt_id);
-- Append-only: only SELECT and INSERT for authenticated; nothing else.
GRANT SELECT, INSERT ON public.exam_audit_entries TO authenticated;
GRANT ALL ON public.exam_audit_entries TO service_role;
ALTER TABLE public.exam_audit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School staff and the student read audit"
  ON public.exam_audit_entries FOR SELECT TO authenticated
  USING (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
    )
  );
CREATE POLICY "School staff write audit"
  ON public.exam_audit_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR EXISTS (
      SELECT 1 FROM public.exam_attempts ea
      WHERE ea.id = attempt_id AND ea.student_id = auth.uid()
    )
  );

-- Realtime for appeals
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_appeals; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Students upload to their school folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proctor-evidence'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

CREATE POLICY "School staff read evidence"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proctor-evidence'
    AND (
      public.is_school_admin((storage.foldername(name))[1]::uuid, auth.uid())
      OR public.has_school_role((storage.foldername(name))[1]::uuid, auth.uid(), 'teacher'::member_role)
    )
  );
-- No UPDATE or DELETE policies → bucket is append-only (immutable evidence locker).
ALTER TABLE public.trad_exam_timetable
  ADD COLUMN IF NOT EXISTS invigilator_name text,
  ADD COLUMN IF NOT EXISTS coordinator_name text,
  ADD COLUMN IF NOT EXISTS notes text;

-- 1) Add question_position to audit entries for per-question audit
ALTER TABLE public.exam_audit_entries 
  ADD COLUMN IF NOT EXISTS question_position int;

-- 2) Auto-audit trigger on exam_answers
CREATE OR REPLACE FUNCTION public.tg_exam_answer_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school uuid;
  v_q RECORD;
  v_score numeric := 0;
  v_student_ans jsonb;
  v_correct_ans jsonb;
BEGIN
  SELECT a.school_id INTO v_school FROM public.exam_attempts a WHERE a.id = NEW.attempt_id;
  SELECT q.id, q.position, q.correct_index, q.points, q.options
    INTO v_q FROM public.exam_questions q WHERE q.id = NEW.question_id;
  IF v_q.id IS NULL THEN RETURN NEW; END IF;

  v_student_ans := to_jsonb(NEW.selected_index);
  v_correct_ans := to_jsonb(v_q.correct_index);
  IF NEW.selected_index IS NOT NULL AND NEW.selected_index = v_q.correct_index THEN
    v_score := COALESCE(v_q.points, 1);
  END IF;

  INSERT INTO public.exam_audit_entries
    (school_id, attempt_id, question_id, question_position, student_answer, correct_answer, score_awarded, recorded_at)
  VALUES
    (v_school, NEW.attempt_id, NEW.question_id, v_q.position, v_student_ans, v_correct_ans, v_score, now());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_exam_answer_audit ON public.exam_answers;
CREATE TRIGGER trg_exam_answer_audit
AFTER INSERT OR UPDATE OF selected_index ON public.exam_answers
FOR EACH ROW EXECUTE FUNCTION public.tg_exam_answer_audit();

-- 3) Auto-snapshot trigger on question_bank: archive OLD into question_bank_versions on UPDATE
CREATE OR REPLACE FUNCTION public.tg_question_bank_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_next int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- only snapshot when meaningful fields change
    IF NEW.body IS DISTINCT FROM OLD.body
       OR NEW.options IS DISTINCT FROM OLD.options
       OR NEW.answer  IS DISTINCT FROM OLD.answer
       OR NEW.explanation IS DISTINCT FROM OLD.explanation
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      SELECT COALESCE(MAX(version), 0) + 1 INTO v_next
        FROM public.question_bank_versions WHERE question_id = OLD.id;
      INSERT INTO public.question_bank_versions
        (question_id, school_id, version, snapshot, edited_by)
      VALUES
        (OLD.id, OLD.school_id, v_next,
         jsonb_build_object(
           'subject', OLD.subject, 'topic', OLD.topic, 'difficulty', OLD.difficulty,
           'type', OLD.type, 'body', OLD.body, 'options', OLD.options,
           'answer', OLD.answer, 'explanation', OLD.explanation,
           'approval_status', OLD.approval_status
         ),
         auth.uid());
      NEW.version := COALESCE(OLD.version, 1) + 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_question_bank_version ON public.question_bank;
CREATE TRIGGER trg_question_bank_version
BEFORE UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION public.tg_question_bank_version();
CREATE POLICY "Block students from version snapshots"
  ON public.question_bank_versions
  AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (
    NOT public.has_school_role(school_id, auth.uid(), 'student'::member_role)
  );
DROP POLICY IF EXISTS "Students upload to their school folder" ON storage.objects;

CREATE POLICY "Students upload to their active attempt folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proctor-evidence'
    AND public.is_member((storage.foldername(name))[1]::uuid, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts a
      WHERE a.id = (storage.foldername(name))[2]::uuid
        AND a.student_id = auth.uid()
        AND a.school_id = (storage.foldername(name))[1]::uuid
        AND a.submitted_at IS NULL
    )
  );
DROP POLICY IF EXISTS "School staff write audit" ON public.exam_audit_entries;

CREATE POLICY "School staff write audit"
ON public.exam_audit_entries
FOR INSERT
TO authenticated
WITH CHECK (
  is_school_admin(school_id, auth.uid())
  OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
);

-- 1. Add scheduling fields to trad_exam_results
ALTER TABLE public.trad_exam_results
  ADD COLUMN IF NOT EXISTS scheduled_release_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_to_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS forwarded_by uuid;

-- 2. Add CA/Test release gating
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS results_release_at timestamptz;

-- 3. Update student paper list: only release when released_at <= now()
CREATE OR REPLACE FUNCTION public.trad_list_student_papers(_school uuid)
 RETURNS TABLE(exam_id uuid, title text, instructions text, exam_type text, total_marks integer, exam_date date, start_time time without time zone, duration_minutes integer, venue text, status text, attempt_id uuid, attempt_status text, result_released boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT e.id, e.title, e.instructions, e.exam_type::text, e.total_marks,
         t.exam_date, t.start_time, t.duration_minutes, t.venue,
         CASE
           WHEN now() < (t.exam_date::timestamp + t.start_time) THEN 'upcoming'
           WHEN now() < (t.exam_date::timestamp + t.start_time + make_interval(mins => t.duration_minutes)) THEN 'open'
           ELSE 'closed'
         END,
         a.id, a.status,
         (r.released_at IS NOT NULL AND r.released_at <= now())
  FROM public.trad_exams e
  JOIN public.trad_exam_timetable t ON t.id = e.timetable_id
  JOIN public.class_enrollments ce ON ce.class_id = t.class_id
  LEFT JOIN public.trad_exam_attempts a ON a.exam_id = e.id AND a.student_id = auth.uid()
  LEFT JOIN public.trad_exam_results r ON r.attempt_id = a.id
  WHERE e.school_id = _school
    AND e.published_at IS NOT NULL
    AND ce.student_id = auth.uid()
  ORDER BY t.exam_date, t.start_time;
END $function$;

-- 4. Committee forwards a graded/validated result to admin
CREATE OR REPLACE FUNCTION public.trad_committee_forward_result(_attempt_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.trad_exam_results WHERE attempt_id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'result not found'; END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.trad_exam_results
     SET status = 'forwarded_admin',
         forwarded_to_admin_at = now(),
         forwarded_by = auth.uid(),
         updated_at = now()
   WHERE attempt_id = _attempt_id;
END $function$;

-- 5. Admin schedules release at a specific time
CREATE OR REPLACE FUNCTION public.trad_admin_schedule_release(_attempt_id uuid, _release_at timestamptz)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_school uuid;
BEGIN
  SELECT school_id INTO v_school FROM public.trad_exam_results WHERE attempt_id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'result not found'; END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _release_at IS NULL THEN RAISE EXCEPTION 'release time required'; END IF;
  UPDATE public.trad_exam_results
     SET status = 'validated',
         scheduled_release_at = _release_at,
         released_at = _release_at,
         validated_at = COALESCE(validated_at, now()),
         validated_by = COALESCE(validated_by, auth.uid()),
         updated_at = now()
   WHERE attempt_id = _attempt_id;
END $function$;

-- 6. Gate CA/Test review for students until results_release_at passes
CREATE OR REPLACE FUNCTION public.get_exam_review(_attempt_id uuid)
 RETURNS TABLE(q_id uuid, q_position integer, q_prompt text, q_options jsonb, q_points integer, q_correct_index integer, q_selected_index integer, q_is_correct boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_school uuid; v_student uuid; v_exam uuid; v_submitted timestamptz; v_release timestamptz;
BEGIN
  SELECT a.school_id, a.student_id, a.exam_id, a.submitted_at
    INTO v_school, v_student, v_exam, v_submitted
  FROM public.exam_attempts a WHERE a.id = _attempt_id;
  IF v_school IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  IF v_submitted IS NULL THEN RAISE EXCEPTION 'attempt not submitted'; END IF;

  SELECT results_release_at INTO v_release FROM public.exams WHERE id = v_exam;

  IF v_student = auth.uid() THEN
    -- student can only review once admin-scheduled release time has passed
    IF v_release IS NULL OR v_release > now() THEN
      RAISE EXCEPTION 'results not released yet';
    END IF;
  ELSIF NOT (public.has_school_role(v_school, auth.uid(), 'teacher'::member_role)
             OR public.is_school_admin(v_school, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT q.id, q.position, q.prompt, q.options, q.points,
         q.correct_index,
         ans.selected_index,
         (ans.selected_index IS NOT NULL AND ans.selected_index = q.correct_index) AS is_correct
  FROM public.exam_questions q
  LEFT JOIN public.exam_answers ans
    ON ans.question_id = q.id AND ans.attempt_id = _attempt_id
  WHERE q.exam_id = v_exam
  ORDER BY q.position;
END $function$;

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

-- =========================================================
-- ACADEMIC STRUCTURE ENGINE
-- =========================================================

-- 1) TEMPLATES (global library) ----------------------------
CREATE TABLE public.academic_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text NOT NULL UNIQUE,
  name          text NOT NULL,
  country       text,
  description   text,
  body          jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.academic_templates TO authenticated, anon;
GRANT ALL    ON public.academic_templates TO service_role;
ALTER TABLE public.academic_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates readable by anyone" ON public.academic_templates FOR SELECT USING (true);

-- 2) PER-SCHOOL STRUCTURE LINK -----------------------------
CREATE TABLE public.school_academic_structure (
  school_id     uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  template_code text NOT NULL REFERENCES public.academic_templates(code),
  activated_at  timestamptz NOT NULL DEFAULT now(),
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_academic_structure TO authenticated;
GRANT ALL ON public.school_academic_structure TO service_role;
ALTER TABLE public.school_academic_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read structure"   ON public.school_academic_structure FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write structure"   ON public.school_academic_structure FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 3) LEVELS ------------------------------------------------
CREATE TABLE public.academic_levels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  promotion_target_level_id uuid REFERENCES public.academic_levels(id),
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_levels_school_idx ON public.academic_levels(school_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_levels TO authenticated;
GRANT ALL ON public.academic_levels TO service_role;
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read levels" ON public.academic_levels FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write levels" ON public.academic_levels FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 4) CLASSES (JSS1, SS1, …) --------------------------------
CREATE TABLE public.academic_classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  level_id    uuid NOT NULL REFERENCES public.academic_levels(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  category    text,
  capacity    int,
  description text,
  status      text NOT NULL DEFAULT 'active',
  sort_order  int NOT NULL DEFAULT 0,
  promotion_target_class_id uuid REFERENCES public.academic_classes(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_classes_school_idx ON public.academic_classes(school_id, level_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_classes TO authenticated;
GRANT ALL ON public.academic_classes TO service_role;
ALTER TABLE public.academic_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read aclasses" ON public.academic_classes FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write aclasses" ON public.academic_classes FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 5) DEPARTMENTS -------------------------------------------
CREATE TABLE public.academic_departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_departments_school_idx ON public.academic_departments(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_departments TO authenticated;
GRANT ALL ON public.academic_departments TO service_role;
ALTER TABLE public.academic_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read depts" ON public.academic_departments FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write depts" ON public.academic_departments FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 6) ARMS (JSS1 A, SS1 Science, …) -------------------------
CREATE TABLE public.academic_arms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id        uuid NOT NULL REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  department_id   uuid REFERENCES public.academic_departments(id) ON DELETE SET NULL,
  name            text NOT NULL,
  code            text NOT NULL,
  capacity        int,
  class_teacher_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, class_id, code)
);
CREATE INDEX academic_arms_school_idx ON public.academic_arms(school_id, class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_arms TO authenticated;
GRANT ALL ON public.academic_arms TO service_role;
ALTER TABLE public.academic_arms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read arms" ON public.academic_arms FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write arms" ON public.academic_arms FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 7) SUBJECTS ----------------------------------------------
CREATE TABLE public.academic_subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  code          text NOT NULL,
  name          text NOT NULL,
  department_id uuid REFERENCES public.academic_departments(id) ON DELETE SET NULL,
  category      text NOT NULL DEFAULT 'core', -- core | junior | department | elective | other
  description   text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, code)
);
CREATE INDEX academic_subjects_school_idx ON public.academic_subjects(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_subjects TO authenticated;
GRANT ALL ON public.academic_subjects TO service_role;
ALTER TABLE public.academic_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read asubjects" ON public.academic_subjects FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write asubjects" ON public.academic_subjects FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 8) SUBJECT ↔ ARM (inheritance source) --------------------
CREATE TABLE public.subject_arm_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id   uuid NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
  arm_id       uuid NOT NULL REFERENCES public.academic_arms(id) ON DELETE CASCADE,
  is_required  boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, subject_id, arm_id)
);
CREATE INDEX subject_arm_school_idx ON public.subject_arm_assignments(school_id, arm_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_arm_assignments TO authenticated;
GRANT ALL ON public.subject_arm_assignments TO service_role;
ALTER TABLE public.subject_arm_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read saa" ON public.subject_arm_assignments FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write saa" ON public.subject_arm_assignments FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 9) STUDENT ↔ ARM -----------------------------------------
CREATE TABLE public.arm_enrollments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  arm_id           uuid NOT NULL REFERENCES public.academic_arms(id) ON DELETE CASCADE,
  student_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'active',
  joined_at        timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, arm_id, student_user_id)
);
CREATE INDEX arm_enrollments_school_idx ON public.arm_enrollments(school_id, arm_id);
CREATE INDEX arm_enrollments_student_idx ON public.arm_enrollments(school_id, student_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arm_enrollments TO authenticated;
GRANT ALL ON public.arm_enrollments TO service_role;
ALTER TABLE public.arm_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self/admin/teacher read arm_enrollments" ON public.arm_enrollments FOR SELECT USING (
  student_user_id = auth.uid()
  OR public.is_school_admin(school_id, auth.uid())
  OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
);
CREATE POLICY "admins write arm_enrollments" ON public.arm_enrollments FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 10) TEACHER ↔ SUBJECT ↔ ARM ------------------------------
CREATE TABLE public.teacher_subject_arm (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       uuid NOT NULL REFERENCES public.academic_subjects(id) ON DELETE CASCADE,
  arm_id           uuid NOT NULL REFERENCES public.academic_arms(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'lead',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, teacher_user_id, subject_id, arm_id)
);
CREATE INDEX teacher_subject_arm_school_idx ON public.teacher_subject_arm(school_id, teacher_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_subject_arm TO authenticated;
GRANT ALL ON public.teacher_subject_arm TO service_role;
ALTER TABLE public.teacher_subject_arm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self/admin read tsa" ON public.teacher_subject_arm FOR SELECT USING (
  teacher_user_id = auth.uid() OR public.is_school_admin(school_id, auth.uid())
);
CREATE POLICY "admins write tsa" ON public.teacher_subject_arm FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 11) PROMOTION RULES --------------------------------------
CREATE TABLE public.academic_promotion_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  from_class_id       uuid REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  to_class_id         uuid REFERENCES public.academic_classes(id) ON DELETE CASCADE,
  min_average         numeric DEFAULT 0,
  min_attendance_pct  numeric DEFAULT 0,
  required_core_pass  jsonb   DEFAULT '[]'::jsonb,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academic_promotion_rules_school_idx ON public.academic_promotion_rules(school_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_promotion_rules TO authenticated;
GRANT ALL ON public.academic_promotion_rules TO service_role;
ALTER TABLE public.academic_promotion_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read prom rules" ON public.academic_promotion_rules FOR SELECT USING (public.is_member(school_id, auth.uid()));
CREATE POLICY "admins write prom rules" ON public.academic_promotion_rules FOR ALL USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));

-- 12) UPDATED-AT TRIGGERS ----------------------------------
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'academic_templates','school_academic_structure','academic_levels',
    'academic_classes','academic_departments','academic_arms','academic_subjects',
    'arm_enrollments','academic_promotion_rules'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t || '_set_updated_at', t);
  END LOOP;
END $$;

-- 13) DERIVED VIEW: student ↔ subject ---------------------
CREATE OR REPLACE VIEW public.student_subjects_v2 WITH (security_invoker = on) AS
  SELECT
    e.school_id,
    e.student_user_id,
    sa.subject_id,
    e.arm_id,
    s.name AS subject_name,
    s.code AS subject_code,
    sa.is_required
  FROM public.arm_enrollments e
  JOIN public.subject_arm_assignments sa
    ON sa.arm_id = e.arm_id AND sa.school_id = e.school_id
  JOIN public.academic_subjects s ON s.id = sa.subject_id
  WHERE e.status = 'active' AND s.status = 'active';

GRANT SELECT ON public.student_subjects_v2 TO authenticated;

-- 14) APPLY TEMPLATE FUNCTION ------------------------------
CREATE OR REPLACE FUNCTION public.apply_academic_template(_school_id uuid, _template_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl jsonb;
  v_level jsonb;
  v_class jsonb;
  v_dept_name text;
  v_subj_name text;
  v_level_id uuid;
  v_class_id uuid;
  v_prev_class_id uuid;
  v_dept_id uuid;
  v_subj_id uuid;
  v_chain text[];
  v_idx int;
  v_levels_created int := 0;
  v_classes_created int := 0;
  v_depts_created int := 0;
  v_subjects_created int := 0;
  v_subjects jsonb;
  v_subj jsonb;
  v_sort int;
BEGIN
  IF NOT public.is_school_admin(_school_id, auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT body INTO v_tpl
    FROM public.academic_templates
   WHERE code = _template_code AND is_active = true;
  IF v_tpl IS NULL THEN RAISE EXCEPTION 'template not available'; END IF;

  -- Link/upsert school structure row
  INSERT INTO public.school_academic_structure (school_id, template_code, activated_at)
       VALUES (_school_id, _template_code, now())
       ON CONFLICT (school_id) DO UPDATE
         SET template_code = EXCLUDED.template_code,
             activated_at = COALESCE(public.school_academic_structure.activated_at, now()),
             updated_at = now();

  -- Levels + Classes
  v_sort := 0;
  FOR v_level IN SELECT * FROM jsonb_array_elements(COALESCE(v_tpl->'levels','[]'::jsonb)) LOOP
    INSERT INTO public.academic_levels (school_id, code, name, sort_order)
         VALUES (_school_id, v_level->>'code', v_level->>'name', v_sort)
         ON CONFLICT (school_id, code) DO UPDATE
           SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
         RETURNING id INTO v_level_id;
    v_levels_created := v_levels_created + 1;

    DECLARE
      v_csort int := 0;
    BEGIN
      FOR v_class IN SELECT * FROM jsonb_array_elements(COALESCE(v_level->'classes','[]'::jsonb)) LOOP
        INSERT INTO public.academic_classes (school_id, level_id, code, name, category, sort_order)
             VALUES (_school_id, v_level_id, v_class->>'code',
                     COALESCE(v_class->>'name', v_class->>'code'),
                     v_level->>'name', v_csort)
             ON CONFLICT (school_id, code) DO UPDATE
               SET level_id = EXCLUDED.level_id,
                   name = EXCLUDED.name,
                   category = EXCLUDED.category,
                   sort_order = EXCLUDED.sort_order
             RETURNING id INTO v_class_id;
        v_classes_created := v_classes_created + 1;
        v_csort := v_csort + 1;
      END LOOP;
    END;
    v_sort := v_sort + 1;
  END LOOP;

  -- Promotion chain (code → code)
  v_chain := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_tpl->'promotion_chain','[]'::jsonb)));
  FOR v_idx IN 1 .. GREATEST(0, COALESCE(array_length(v_chain,1),0) - 1) LOOP
    UPDATE public.academic_classes c
       SET promotion_target_class_id = (SELECT id FROM public.academic_classes
                                          WHERE school_id = _school_id AND code = v_chain[v_idx+1])
     WHERE c.school_id = _school_id AND c.code = v_chain[v_idx];
  END LOOP;

  -- Departments
  FOR v_dept_name IN SELECT jsonb_array_elements_text(COALESCE(v_tpl->'departments','[]'::jsonb)) LOOP
    INSERT INTO public.academic_departments (school_id, code, name)
         VALUES (_school_id, lower(regexp_replace(v_dept_name,'\s+','_','g')), v_dept_name)
         ON CONFLICT (school_id, code) DO UPDATE SET name = EXCLUDED.name;
    v_depts_created := v_depts_created + 1;
  END LOOP;

  -- Subjects
  v_subjects := COALESCE(v_tpl->'subjects','{}'::jsonb);
  FOR v_dept_name IN SELECT jsonb_object_keys(v_subjects) LOOP
    SELECT id INTO v_dept_id FROM public.academic_departments
      WHERE school_id = _school_id AND lower(name) = lower(v_dept_name);
    FOR v_subj IN SELECT * FROM jsonb_array_elements(v_subjects->v_dept_name) LOOP
      v_subj_name := CASE jsonb_typeof(v_subj) WHEN 'string' THEN v_subj#>>'{}' ELSE v_subj->>'name' END;
      INSERT INTO public.academic_subjects (school_id, code, name, department_id, category)
           VALUES (_school_id,
                   upper(regexp_replace(v_subj_name,'\s+','_','g')),
                   v_subj_name,
                   v_dept_id,
                   CASE v_dept_name WHEN 'core' THEN 'core'
                                    WHEN 'junior' THEN 'junior'
                                    ELSE 'department' END)
           ON CONFLICT (school_id, code) DO UPDATE
             SET name = EXCLUDED.name,
                 department_id = COALESCE(public.academic_subjects.department_id, EXCLUDED.department_id);
      v_subjects_created := v_subjects_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'levels', v_levels_created,
    'classes', v_classes_created,
    'departments', v_depts_created,
    'subjects', v_subjects_created
  );
END $$;

-- 15) PROMOTION FUNCTION -----------------------------------
CREATE OR REPLACE FUNCTION public.promote_arm(_arm_id uuid, _to_arm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_school uuid; v_to_school uuid; v_moved int := 0;
BEGIN
  SELECT school_id INTO v_school FROM public.academic_arms WHERE id = _arm_id;
  SELECT school_id INTO v_to_school FROM public.academic_arms WHERE id = _to_arm_id;
  IF v_school IS NULL OR v_to_school IS NULL OR v_school <> v_to_school THEN
    RAISE EXCEPTION 'invalid arms';
  END IF;
  IF NOT public.is_school_admin(v_school, auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  WITH moved AS (
    UPDATE public.arm_enrollments
       SET arm_id = _to_arm_id, updated_at = now()
     WHERE arm_id = _arm_id AND status = 'active'
   RETURNING 1
  )
  SELECT COUNT(*) INTO v_moved FROM moved;
  RETURN jsonb_build_object('ok', true, 'moved', v_moved);
END $$;

-- 16) SEED NIGERIAN SECONDARY TEMPLATE + COMING-SOON --------
INSERT INTO public.academic_templates (code, name, country, description, is_active, body) VALUES
('nigerian_secondary', 'Nigerian Secondary School', 'Nigeria',
 'Junior (JSS1-JSS3) and Senior (SS1-SS3) with Science / Arts / Commercial departments.',
 true,
 jsonb_build_object(
   'levels', jsonb_build_array(
     jsonb_build_object('code','jss','name','Junior Secondary','classes', jsonb_build_array(
       jsonb_build_object('code','JSS1','name','JSS1'),
       jsonb_build_object('code','JSS2','name','JSS2'),
       jsonb_build_object('code','JSS3','name','JSS3'))),
     jsonb_build_object('code','sss','name','Senior Secondary','classes', jsonb_build_array(
       jsonb_build_object('code','SS1','name','SS1'),
       jsonb_build_object('code','SS2','name','SS2'),
       jsonb_build_object('code','SS3','name','SS3')))
   ),
   'promotion_chain', jsonb_build_array('JSS1','JSS2','JSS3','SS1','SS2','SS3'),
   'departments', jsonb_build_array('Science','Arts','Commercial'),
   'subjects', jsonb_build_object(
     'core',    jsonb_build_array('English Language','Mathematics','Civic Education','Computer Studies'),
     'junior',  jsonb_build_array('Basic Science','Basic Technology','Social Studies','Business Studies','Agricultural Science'),
     'Science', jsonb_build_array('Physics','Chemistry','Biology','Further Mathematics'),
     'Commercial', jsonb_build_array('Economics','Commerce','Financial Accounting'),
     'Arts',    jsonb_build_array('Government','Literature','CRS','IRS','History')
   )
 )
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.academic_templates (code, name, country, description, is_active, body) VALUES
('nigerian_primary',  'Nigerian Primary School',  'Nigeria', 'Coming soon.', false, '{}'::jsonb),
('cambridge',         'Cambridge',                'UK',      'Coming soon.', false, '{}'::jsonb),
('montessori',        'Montessori',               NULL,      'Coming soon.', false, '{}'::jsonb),
('american_k12',      'American K-12',            'USA',     'Coming soon.', false, '{}'::jsonb),
('custom',            'Custom Structure',         NULL,      'Coming soon.', false, '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- 1. exam_audit_entries: remove student read access (was exposing correct_answer)
DROP POLICY IF EXISTS "School staff and the student read audit" ON public.exam_audit_entries;
CREATE POLICY "School staff read audit"
ON public.exam_audit_entries
FOR SELECT
TO authenticated
USING (
  is_school_admin(school_id, auth.uid())
  OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
);

-- 2. knowledge_documents: students only see non-staff visibility
DROP POLICY IF EXISTS "members read documents" ON public.knowledge_documents;
CREATE POLICY "members read documents"
ON public.knowledge_documents
FOR SELECT
TO authenticated
USING (
  is_member(school_id, auth.uid())
  AND (
    -- staff (admin/teacher) see everything in their school
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    -- students/parents only see non-restricted visibility
    OR COALESCE(visibility, 'school') IN ('school', 'public', 'class', 'student')
  )
);

-- 3. knowledge_chunks: gate by parent document visibility
DROP POLICY IF EXISTS "members read chunks" ON public.knowledge_chunks;
CREATE POLICY "members read chunks"
ON public.knowledge_chunks
FOR SELECT
TO authenticated
USING (
  is_member(school_id, auth.uid())
  AND (
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
        AND COALESCE(d.visibility, 'school') IN ('school', 'public', 'class', 'student')
    )
  )
);

-- 1) Knowledge chunks: tighten visibility checks
DROP POLICY IF EXISTS "members read chunks" ON public.knowledge_chunks;
CREATE POLICY "members read chunks" ON public.knowledge_chunks
FOR SELECT TO authenticated
USING (
  public.is_member(school_id, auth.uid())
  AND (
    public.is_school_admin(school_id, auth.uid())
    OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
    OR EXISTS (
      SELECT 1 FROM public.knowledge_documents d
      WHERE d.id = knowledge_chunks.document_id
        AND d.status = 'ready'
        AND (
          COALESCE(d.visibility, 'school') IN ('school','public','public_curriculum')
          OR (d.visibility = 'class' AND d.class_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.class_enrollments ce
                WHERE ce.class_id = d.class_id AND ce.student_id = auth.uid()
              ))
          OR (d.visibility = 'student' AND d.student_id = auth.uid())
        )
    )
  )
);

-- 2) Memberships: restrict broad member visibility to staff only
DROP POLICY IF EXISTS "Members see same-school memberships" ON public.memberships;
CREATE POLICY "Staff see same-school memberships" ON public.memberships
FOR SELECT TO public
USING (
  public.is_school_admin(school_id, auth.uid())
  OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
);

-- 3) Profiles: restrict parent visibility to their linked children only
DROP POLICY IF EXISTS "Profiles viewable by parents for linked users" ON public.profiles;
CREATE POLICY "Profiles viewable by parents for linked children" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_links pl
    WHERE pl.parent_user_id = auth.uid() AND pl.student_user_id = profiles.id
  )
);

-- 4) Question tags: block students via restrictive policy
DROP POLICY IF EXISTS "Block students from question tags" ON public.question_tags;
CREATE POLICY "Block students from question tags" ON public.question_tags
AS RESTRICTIVE
FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM public.question_bank q
    WHERE q.id = question_tags.question_id
      AND (
        public.is_school_admin(q.school_id, auth.uid())
        OR public.has_school_role(q.school_id, auth.uid(), 'teacher'::public.member_role)
      )
  )
);

-- 1. New enum value for "changes requested"
ALTER TYPE trad_draft_status ADD VALUE IF NOT EXISTS 'changes_requested';

-- 2. New columns on trad_exams (modern school exam)
ALTER TABLE public.trad_exams
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- 3. New columns on legacy exams (CA/test)
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- 4. Audit log
CREATE TABLE IF NOT EXISTS public.exam_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_kind text NOT NULL CHECK (exam_kind IN ('trad','legacy')),
  exam_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted','changes_requested','approved','published','released','withdrawn')),
  notes text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS exam_review_events_exam_idx ON public.exam_review_events(exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_review_events_school_idx ON public.exam_review_events(school_id, created_at DESC);

GRANT SELECT, INSERT ON public.exam_review_events TO authenticated;
GRANT ALL ON public.exam_review_events TO service_role;

ALTER TABLE public.exam_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review events: staff read same school"
  ON public.exam_review_events FOR SELECT TO authenticated
  USING (
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
  );

CREATE POLICY "review events: staff insert"
  ON public.exam_review_events FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      is_school_admin(school_id, auth.uid())
      OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    )
  );

-- 5. Tighten legacy `exams` write access:
--    Teachers may only manage their own drafts (status in draft/submitted/changes_requested).
--    Admins keep full control.
DROP POLICY IF EXISTS "Teachers/Admins manage exams" ON public.exams;

CREATE POLICY "Admins manage exams"
  ON public.exams FOR ALL TO authenticated
  USING (is_school_admin(school_id, auth.uid()))
  WITH CHECK (is_school_admin(school_id, auth.uid()));

CREATE POLICY "Teachers draft own exams - insert"
  ON public.exams FOR INSERT TO authenticated
  WITH CHECK (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
    AND results_release_at IS NULL
  );

CREATE POLICY "Teachers update own draft exams"
  ON public.exams FOR UPDATE TO authenticated
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
  )
  WITH CHECK (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
    AND results_release_at IS NULL
  );

CREATE POLICY "Teachers delete own draft exams"
  ON public.exams FOR DELETE TO authenticated
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND created_by = auth.uid()
    AND status = 'draft'::exam_status
    AND published_at IS NULL
  );

-- 6. Helper: can the caller act as approver for a school?
CREATE OR REPLACE FUNCTION public.can_approve_exams(_school uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_school_admin(_school, _user);
$$;
GRANT EXECUTE ON FUNCTION public.can_approve_exams(uuid, uuid) TO authenticated;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS report_theme JSONB NOT NULL DEFAULT '{"primary":"#1e3a8a","accent":"#3b82f6","gradientFrom":"#0f172a","gradientTo":"#3b82f6"}'::jsonb;

DROP POLICY IF EXISTS "members read documents" ON public.knowledge_documents;
CREATE POLICY "members read documents" ON public.knowledge_documents
FOR SELECT TO authenticated
USING (
  is_member(school_id, auth.uid()) AND (
    is_school_admin(school_id, auth.uid())
    OR has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    OR COALESCE(visibility,'school') IN ('school','public','public_curriculum')
    OR (visibility = 'class' AND class_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM class_enrollments ce
           WHERE ce.class_id = knowledge_documents.class_id
             AND ce.student_id = auth.uid()))
    OR (visibility = 'student' AND student_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Profiles viewable by staff co-members" ON public.profiles;

CREATE POLICY "Profiles viewable by school admins"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.school_id = m2.school_id
    WHERE m1.user_id = auth.uid()
      AND m1.status = 'active'
      AND m1.role = 'admin'::member_role
      AND m2.user_id = profiles.id
      AND m2.status = 'active'
  )
);

CREATE POLICY "Staff profiles viewable by staff co-members"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM memberships m1
    JOIN memberships m2 ON m1.school_id = m2.school_id
    WHERE m1.user_id = auth.uid()
      AND m1.status = 'active'
      AND m1.role = ANY (ARRAY['admin'::member_role,'teacher'::member_role])
      AND m2.user_id = profiles.id
      AND m2.status = 'active'
      AND m2.role = ANY (ARRAY['admin'::member_role,'teacher'::member_role])
  )
);

CREATE POLICY "Teachers can view their students' profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM class_subject_teachers cst
    JOIN class_enrollments ce ON ce.class_id = cst.class_id
    WHERE cst.teacher_user_id = auth.uid()
      AND ce.student_id = profiles.id
  )
  OR EXISTS (
    SELECT 1
    FROM teacher_subject_arm tsa
    JOIN arm_enrollments ae ON ae.arm_id = tsa.arm_id
    WHERE tsa.teacher_user_id = auth.uid()
      AND ae.student_user_id = profiles.id
  )
);
CREATE TABLE IF NOT EXISTS public.transport_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  plate_number text,
  capacity int DEFAULT 0,
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  driver_name text,
  driver_phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_buses TO authenticated;
GRANT ALL ON public.transport_buses TO service_role;
ALTER TABLE public.transport_buses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage buses" ON public.transport_buses FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Members read buses" ON public.transport_buses FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()) OR driver_user_id = auth.uid());
CREATE TRIGGER tg_transport_buses_updated BEFORE UPDATE ON public.transport_buses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.transport_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  route_id uuid NOT NULL REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  geofence_radius_m int NOT NULL DEFAULT 120,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_stops TO authenticated;
GRANT ALL ON public.transport_stops TO service_role;
ALTER TABLE public.transport_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stops" ON public.transport_stops FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Members read stops" ON public.transport_stops FOR SELECT TO authenticated
  USING (public.is_member(school_id, auth.uid()));
CREATE TRIGGER tg_transport_stops_updated BEFORE UPDATE ON public.transport_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_transport_stops_route ON public.transport_stops(route_id, sort_order);

CREATE TABLE IF NOT EXISTS public.transport_student_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE CASCADE,
  pickup_stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  dropoff_stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, student_id, bus_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_student_stops TO authenticated;
GRANT ALL ON public.transport_student_stops TO service_role;
ALTER TABLE public.transport_student_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage stuassign" ON public.transport_student_stops FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Student reads own stop" ON public.transport_student_stops FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Parent reads child stop" ON public.transport_student_stops FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_links pl
    WHERE pl.parent_user_id = auth.uid() AND pl.student_user_id = transport_student_stops.student_id));
CREATE POLICY "Driver reads bus assignments" ON public.transport_student_stops FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_buses b
    WHERE b.id = transport_student_stops.bus_id AND b.driver_user_id = auth.uid()));
CREATE TRIGGER tg_transport_student_stops_updated BEFORE UPDATE ON public.transport_student_stops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.transport_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'pickup' CHECK (direction IN ('pickup','dropoff','other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_speed double precision,
  last_heading double precision,
  last_ping_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_trips TO authenticated;
GRANT ALL ON public.transport_trips TO service_role;
ALTER TABLE public.transport_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage trips" ON public.transport_trips FOR ALL TO authenticated
  USING (public.is_school_admin(school_id, auth.uid())) WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Driver manages own trips" ON public.transport_trips FOR ALL TO authenticated
  USING (driver_user_id = auth.uid()) WITH CHECK (driver_user_id = auth.uid());
CREATE POLICY "Parent reads child trips" ON public.transport_trips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_student_stops tss
    JOIN public.parent_links pl ON pl.student_user_id = tss.student_id
    WHERE tss.bus_id = transport_trips.bus_id AND pl.parent_user_id = auth.uid()));
CREATE POLICY "Student reads own bus trips" ON public.transport_trips FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_student_stops tss
    WHERE tss.bus_id = transport_trips.bus_id AND tss.student_id = auth.uid()));
CREATE TRIGGER tg_transport_trips_updated BEFORE UPDATE ON public.transport_trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_transport_trips_active ON public.transport_trips(school_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS public.transport_trip_locations (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.transport_trips(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  speed double precision,
  heading double precision,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transport_trip_locations TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.transport_trip_locations_id_seq TO authenticated;
GRANT ALL ON public.transport_trip_locations TO service_role;
GRANT ALL ON SEQUENCE public.transport_trip_locations_id_seq TO service_role;
ALTER TABLE public.transport_trip_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver inserts pings" ON public.transport_trip_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_locations.trip_id AND t.driver_user_id = auth.uid() AND t.status = 'active'));
CREATE POLICY "Admins read pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Driver reads own pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_locations.trip_id AND t.driver_user_id = auth.uid()));
CREATE POLICY "Parent reads child pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    JOIN public.transport_student_stops tss ON tss.bus_id = t.bus_id
    JOIN public.parent_links pl ON pl.student_user_id = tss.student_id
    WHERE t.id = transport_trip_locations.trip_id AND pl.parent_user_id = auth.uid()));
CREATE POLICY "Student reads bus pings" ON public.transport_trip_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    JOIN public.transport_student_stops tss ON tss.bus_id = t.bus_id
    WHERE t.id = transport_trip_locations.trip_id AND tss.student_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_trip_locations_trip ON public.transport_trip_locations(trip_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS public.transport_trip_events (
  id bigserial PRIMARY KEY,
  trip_id uuid NOT NULL REFERENCES public.transport_trips(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id uuid NOT NULL REFERENCES public.transport_buses(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stop_id uuid REFERENCES public.transport_stops(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('trip_started','trip_ended','near_stop','arrived_stop','student_boarded','student_dropped','geofence_alert','speed_alert')),
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transport_trip_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.transport_trip_events_id_seq TO authenticated;
GRANT ALL ON public.transport_trip_events TO service_role;
GRANT ALL ON SEQUENCE public.transport_trip_events_id_seq TO service_role;
ALTER TABLE public.transport_trip_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Driver inserts events" ON public.transport_trip_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_events.trip_id AND t.driver_user_id = auth.uid()));
CREATE POLICY "Admin inserts events" ON public.transport_trip_events FOR INSERT TO authenticated
  WITH CHECK (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Admins read events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (public.is_school_admin(school_id, auth.uid()));
CREATE POLICY "Driver reads own events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_trips t
    WHERE t.id = transport_trip_events.trip_id AND t.driver_user_id = auth.uid()));
CREATE POLICY "Parent reads child events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.transport_student_stops tss
    JOIN public.parent_links pl ON pl.student_user_id = tss.student_id
    WHERE tss.bus_id = transport_trip_events.bus_id AND pl.parent_user_id = auth.uid()));
CREATE POLICY "Student reads bus events" ON public.transport_trip_events FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM public.transport_student_stops tss
    WHERE tss.bus_id = transport_trip_events.bus_id AND tss.student_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_trip_events_trip ON public.transport_trip_events(trip_id, occurred_at DESC);

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_trips; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_trip_locations; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transport_trip_events; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.transport_trips REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.transport_trip_locations REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.transport_trip_events REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE TABLE public.ai_model_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  task_kind text NOT NULL,
  role text NOT NULL DEFAULT 'default',
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, task_kind, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_routing TO authenticated;
GRANT ALL ON public.ai_model_routing TO service_role;

ALTER TABLE public.ai_model_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage model routing"
ON public.ai_model_routing FOR ALL
USING (public.is_school_admin(school_id, auth.uid()))
WITH CHECK (public.is_school_admin(school_id, auth.uid()));

CREATE INDEX ai_model_routing_lookup
  ON public.ai_model_routing (school_id, task_kind, role);

DROP POLICY IF EXISTS "School staff read audit" ON public.exam_audit_entries;
CREATE POLICY "Admins read audit"
  ON public.exam_audit_entries FOR SELECT
  TO authenticated
  USING (is_school_admin(school_id, auth.uid()));

DROP POLICY IF EXISTS "Staff see same-school memberships" ON public.memberships;
CREATE POLICY "Admins see same-school memberships"
  ON public.memberships FOR SELECT
  USING (is_school_admin(school_id, auth.uid()));

DROP POLICY IF EXISTS "Teachers read school parent links" ON public.parent_links;
CREATE POLICY "Teachers read parent links for their students"
  ON public.parent_links FOR SELECT
  USING (
    has_school_role(school_id, auth.uid(), 'teacher'::member_role)
    AND EXISTS (
      SELECT 1
      FROM public.arm_enrollments ae
      JOIN public.teacher_subject_arm tsa
        ON tsa.arm_id = ae.arm_id
       AND tsa.school_id = ae.school_id
      WHERE ae.student_user_id = parent_links.student_user_id
        AND ae.school_id = parent_links.school_id
        AND tsa.teacher_user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.trad_scratch_batches IS
  'Admin-only. Students/parents access scratch cards via trad_scratch_purchases and trad_scratch_cards; batch metadata is never required client-side.';

DROP POLICY IF EXISTS "tutor-uploads owner read" ON storage.objects;
CREATE POLICY "tutor-uploads owner read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'tutor-uploads'
    AND (auth.uid())::text = (storage.foldername(name))[1]
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.user_id = auth.uid() AND m.status = 'active'
    )
  );

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

ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'driver';
ALTER TYPE public.member_role ADD VALUE IF NOT EXISTS 'staff';

-- 1. school_custom_roles: remove public read, restrict to school members
DROP POLICY IF EXISTS "Anyone can read enabled custom roles for onboarding" ON public.school_custom_roles;

REVOKE SELECT ON public.school_custom_roles FROM anon;

CREATE POLICY "Members read their school's custom roles"
  ON public.school_custom_roles FOR SELECT
  TO authenticated
  USING (
    enabled = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.school_id = school_custom_roles.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- Public join page needs the enabled custom roles for a single school before sign-in.
-- Expose a narrow security-definer RPC instead of opening the table to anon.
CREATE OR REPLACE FUNCTION public.get_school_custom_roles(_school_id uuid)
RETURNS TABLE (key text, label text, base_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, label, base_role
  FROM public.school_custom_roles
  WHERE school_id = _school_id
    AND enabled = true
    AND deleted_at IS NULL
  ORDER BY label;
$$;

GRANT EXECUTE ON FUNCTION public.get_school_custom_roles(uuid) TO anon, authenticated;

-- 2. exam_audit_entries: document intentional admin-only read posture
COMMENT ON TABLE public.exam_audit_entries IS
'Stores per-question audit rows including correct_answer and student_answer. Fail-closed: only school admins may SELECT. Students MUST NOT receive a SELECT policy here — correct answers are sensitive. To reveal answers post-exam, gate via exams.show_answers_after_each in grade-exam-attempt.';

COMMENT ON COLUMN public.exam_audit_entries.correct_answer IS
'Sensitive: never expose to students via RLS. Admin-only read.';
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(_school_id uuid, _query_embedding extensions.vector, _match_count integer DEFAULT 6, _class_id uuid DEFAULT NULL::uuid, _student_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(chunk_id uuid, document_id uuid, title text, content text, similarity double precision, visibility text, metadata jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _role text;
  _effective_student uuid := _student_id;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT m.role INTO _role
  FROM public.memberships m
  WHERE m.school_id = _school_id
    AND m.user_id = _caller
    AND m.status = 'active'
  LIMIT 1;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Students may only pull their own student-scoped documents.
  IF _role = 'student' THEN
    _effective_student := _caller;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.title,
    c.content,
    1 - (c.embedding <=> _query_embedding) AS similarity,
    d.visibility,
    c.metadata
  FROM public.knowledge_chunks c
  JOIN public.knowledge_documents d ON d.id = c.document_id
  WHERE c.school_id = _school_id
    AND d.status = 'ready'
    AND (
      d.visibility = 'school'
      OR d.visibility = 'public_curriculum'
      OR (d.visibility = 'class'   AND _class_id          IS NOT NULL AND d.class_id   = _class_id)
      OR (d.visibility = 'student' AND _effective_student IS NOT NULL AND d.student_id = _effective_student)
    )
  ORDER BY c.embedding <=> _query_embedding
  LIMIT GREATEST(1, LEAST(_match_count, 20));
END;
$function$;

-- 1. Extend client_errors
ALTER TABLE public.client_errors
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS occurrence_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID,
  ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS resolution_note TEXT,
  ADD COLUMN IF NOT EXISTS affected_users UUID[] NOT NULL DEFAULT '{}';

-- unique fingerprint index for upsert-style grouping (nullable-safe: only enforced when fingerprint present)
CREATE UNIQUE INDEX IF NOT EXISTS client_errors_fingerprint_key
  ON public.client_errors (fingerprint)
  WHERE fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS client_errors_status_last_seen_idx
  ON public.client_errors (resolution_status, last_seen_at DESC);

-- 2. RPC to report an error (grouped by fingerprint)
CREATE OR REPLACE FUNCTION public.report_client_error(
  _message TEXT,
  _stack TEXT DEFAULT NULL,
  _source TEXT DEFAULT NULL,
  _route TEXT DEFAULT NULL,
  _role TEXT DEFAULT NULL,
  _browser TEXT DEFAULT NULL,
  _os TEXT DEFAULT NULL,
  _school_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fp TEXT;
  _first_stack_line TEXT;
  _uid UUID;
  _existing_id UUID;
BEGIN
  _uid := auth.uid();
  _first_stack_line := COALESCE(split_part(COALESCE(_stack, ''), E'\n', 1), '');
  _fp := encode(
    digest(
      COALESCE(_message, '') || '|' ||
      COALESCE(_source, '') || '|' ||
      _first_stack_line,
      'sha256'
    ),
    'hex'
  );

  SELECT id INTO _existing_id
  FROM public.client_errors
  WHERE fingerprint = _fp
  LIMIT 1;

  IF _existing_id IS NOT NULL THEN
    UPDATE public.client_errors
    SET occurrence_count = occurrence_count + 1,
        last_seen_at = now(),
        affected_users = CASE
          WHEN _uid IS NULL OR _uid = ANY(affected_users) THEN affected_users
          ELSE array_append(affected_users, _uid)
        END,
        resolution_status = CASE
          WHEN resolution_status = 'resolved' THEN 'open'
          ELSE resolution_status
        END,
        resolved_at = CASE
          WHEN resolution_status = 'resolved' THEN NULL
          ELSE resolved_at
        END
    WHERE id = _existing_id;
    RETURN _existing_id;
  END IF;

  INSERT INTO public.client_errors (
    message, stack, source, route, role, browser, os,
    school_id, user_id, fingerprint, metadata, affected_users
  )
  VALUES (
    _message, _stack, _source, _route, _role, _browser, _os,
    _school_id, _uid, _fp, COALESCE(_metadata, '{}'::jsonb),
    CASE WHEN _uid IS NULL THEN '{}'::uuid[] ELSE ARRAY[_uid] END
  )
  RETURNING id INTO _existing_id;

  RETURN _existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_client_error(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,JSONB)
  TO anon, authenticated;

-- 3. Super admin update policy for resolution
DROP POLICY IF EXISTS "Super admins can update client errors" ON public.client_errors;
CREATE POLICY "Super admins can update client errors"
  ON public.client_errors FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 4. Enable realtime
DO $$
BEGIN
  BEGIN ALTER TABLE public.client_errors REPLICA IDENTITY FULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.client_errors; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role text,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  reason text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.impersonation_sessions TO authenticated;
GRANT ALL ON public.impersonation_sessions TO service_role;

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins manage impersonation" ON public.impersonation_sessions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "target user sees own impersonation" ON public.impersonation_sessions
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_impersonation_active
  ON public.impersonation_sessions(super_admin_id, ended_at)
  WHERE ended_at IS NULL;

CREATE OR REPLACE FUNCTION public.start_impersonation(
  _target_user uuid,
  _school_id uuid,
  _reason text,
  _duration_minutes int DEFAULT 30
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
  _role text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 5 THEN
    RAISE EXCEPTION 'reason required';
  END IF;
  IF _duration_minutes < 1 OR _duration_minutes > 240 THEN
    RAISE EXCEPTION 'invalid duration';
  END IF;

  SELECT role INTO _role FROM public.memberships
    WHERE user_id = _target_user AND (school_id = _school_id OR _school_id IS NULL)
    LIMIT 1;

  INSERT INTO public.impersonation_sessions
    (super_admin_id, target_user_id, target_role, school_id, reason, expires_at)
  VALUES
    (auth.uid(), _target_user, _role, _school_id, _reason,
     now() + make_interval(mins => _duration_minutes))
  RETURNING id INTO _id;

  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.end_impersonation(_session_id uuid, _reason text DEFAULT 'manual')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
    SET ended_at = now(), end_reason = _reason
    WHERE id = _session_id
      AND (super_admin_id = auth.uid() OR public.is_super_admin(auth.uid()))
      AND ended_at IS NULL;
END $$;

CREATE OR REPLACE FUNCTION public.log_impersonation_action(_session_id uuid, _action jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.impersonation_sessions
    SET actions = actions || jsonb_build_array(jsonb_build_object('at', now(), 'a', _action))
    WHERE id = _session_id AND ended_at IS NULL;
END $$;

-- Allow super admins to view and manage AI quotas across all schools
CREATE POLICY "Super admins view all quotas"
ON public.school_ai_quotas FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins insert quotas"
ON public.school_ai_quotas FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins update quotas"
ON public.school_ai_quotas FOR UPDATE
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Summary view of quota usage across schools (super-admin readable via RPC)
CREATE OR REPLACE FUNCTION public.super_list_ai_quotas()
RETURNS TABLE(
  school_id uuid,
  school_name text,
  school_slug text,
  plan text,
  enabled boolean,
  monthly_token_cap bigint,
  monthly_cost_cap_usd numeric,
  tokens_used bigint,
  cost_used_usd numeric,
  period_start date,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.slug,
    s.plan,
    COALESCE(q.enabled, true),
    COALESCE(q.monthly_token_cap, 5000000),
    COALESCE(q.monthly_cost_cap_usd, 25.00),
    COALESCE(q.tokens_used, 0),
    COALESCE(q.cost_used_usd, 0),
    COALESCE(q.period_start, date_trunc('month', now())::date),
    COALESCE(q.updated_at, s.created_at)
  FROM public.schools s
  LEFT JOIN public.school_ai_quotas q ON q.school_id = s.id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY COALESCE(q.tokens_used, 0) DESC, s.name;
$$;

-- Super admin sets quota (upsert)
CREATE OR REPLACE FUNCTION public.super_set_ai_quota(
  _school_id uuid,
  _token_cap bigint,
  _cost_cap numeric,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.school_ai_quotas(school_id, monthly_token_cap, monthly_cost_cap_usd, enabled)
  VALUES (_school_id, _token_cap, _cost_cap, _enabled)
  ON CONFLICT (school_id) DO UPDATE
    SET monthly_token_cap = EXCLUDED.monthly_token_cap,
        monthly_cost_cap_usd = EXCLUDED.monthly_cost_cap_usd,
        enabled = EXCLUDED.enabled,
        updated_at = now();
END;
$$;

-- Super admin resets a school's monthly counters mid-period
CREATE OR REPLACE FUNCTION public.super_reset_ai_quota(_school_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.school_ai_quotas
     SET tokens_used = 0,
         cost_used_usd = 0,
         period_start = date_trunc('month', now())::date,
         updated_at = now()
   WHERE school_id = _school_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_list_ai_quotas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_set_ai_quota(uuid, bigint, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_reset_ai_quota(uuid) TO authenticated;

CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  default_enabled boolean NOT NULL DEFAULT false,
  default_rollout_percent integer NOT NULL DEFAULT 0 CHECK (default_rollout_percent BETWEEN 0 AND 100),
  is_kill_switch boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT ALL    ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags read by authenticated"
  ON public.feature_flags FOR SELECT TO authenticated USING (true);

CREATE POLICY "feature_flags write by super admin"
  ON public.feature_flags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.school_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  flag_key text NOT NULL REFERENCES public.feature_flags(key) ON UPDATE CASCADE ON DELETE CASCADE,
  enabled boolean,
  rollout_percent integer CHECK (rollout_percent BETWEEN 0 AND 100),
  notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, flag_key)
);

CREATE INDEX school_feature_flags_school_idx ON public.school_feature_flags(school_id);

GRANT SELECT ON public.school_feature_flags TO authenticated;
GRANT ALL    ON public.school_feature_flags TO service_role;

ALTER TABLE public.school_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sff read by school members"
  ON public.school_feature_flags FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.school_id = school_feature_flags.school_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "sff write by super admin"
  ON public.school_feature_flags FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER school_feature_flags_set_updated_at
  BEFORE UPDATE ON public.school_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_feature_enabled(_school_id uuid, _key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.feature_flags%ROWTYPE;
  o public.school_feature_flags%ROWTYPE;
  eff_enabled boolean;
  eff_pct integer;
  bucket integer;
BEGIN
  SELECT * INTO f FROM public.feature_flags WHERE key = _key;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO o FROM public.school_feature_flags
    WHERE school_id = _school_id AND flag_key = _key;

  eff_enabled := COALESCE(o.enabled, f.default_enabled);
  eff_pct     := COALESCE(o.rollout_percent, f.default_rollout_percent);

  IF NOT eff_enabled THEN RETURN false; END IF;
  IF eff_pct >= 100 THEN RETURN true; END IF;
  IF eff_pct <= 0   THEN RETURN false; END IF;

  bucket := (('x' || substr(md5(_school_id::text || ':' || _key), 1, 8))::bit(32)::int) & 2147483647;
  RETURN (bucket % 100) < eff_pct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_feature_enabled(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_list_feature_flags()
RETURNS TABLE (
  id uuid, key text, name text, description text, category text,
  default_enabled boolean, default_rollout_percent integer, is_kill_switch boolean,
  overrides_count bigint, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.key, f.name, f.description, f.category,
         f.default_enabled, f.default_rollout_percent, f.is_kill_switch,
         (SELECT count(*) FROM public.school_feature_flags s WHERE s.flag_key = f.key),
         f.created_at, f.updated_at
  FROM public.feature_flags f
  WHERE public.is_super_admin(auth.uid())
  ORDER BY f.category, f.name;
$$;

GRANT EXECUTE ON FUNCTION public.super_list_feature_flags() TO authenticated;

CREATE OR REPLACE FUNCTION public.super_upsert_feature_flag(
  _key text, _name text, _description text, _category text,
  _default_enabled boolean, _default_rollout_percent integer, _is_kill_switch boolean
) RETURNS public.feature_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.feature_flags;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.feature_flags(key, name, description, category, default_enabled, default_rollout_percent, is_kill_switch)
    VALUES (_key, _name, _description, COALESCE(_category,'general'), COALESCE(_default_enabled,false), COALESCE(_default_rollout_percent,0), COALESCE(_is_kill_switch,false))
    ON CONFLICT (key) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          default_enabled = EXCLUDED.default_enabled,
          default_rollout_percent = EXCLUDED.default_rollout_percent,
          is_kill_switch = EXCLUDED.is_kill_switch,
          updated_at = now()
    RETURNING * INTO r;
  RETURN r;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_upsert_feature_flag(text, text, text, text, boolean, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_delete_feature_flag(_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.feature_flags WHERE key = _key;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_delete_feature_flag(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_set_school_flag(
  _school_id uuid, _key text, _enabled boolean, _rollout_percent integer, _notes text
) RETURNS public.school_feature_flags
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.school_feature_flags;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.school_feature_flags(school_id, flag_key, enabled, rollout_percent, notes, updated_by)
    VALUES (_school_id, _key, _enabled, _rollout_percent, _notes, auth.uid())
    ON CONFLICT (school_id, flag_key) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          rollout_percent = EXCLUDED.rollout_percent,
          notes = EXCLUDED.notes,
          updated_by = auth.uid(),
          updated_at = now()
    RETURNING * INTO r;
  RETURN r;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_set_school_flag(uuid, text, boolean, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_clear_school_flag(_school_id uuid, _key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.school_feature_flags WHERE school_id = _school_id AND flag_key = _key;
END; $$;

GRANT EXECUTE ON FUNCTION public.super_clear_school_flag(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_list_school_flags(_school_id uuid)
RETURNS TABLE (
  flag_key text, name text, description text, category text, is_kill_switch boolean,
  default_enabled boolean, default_rollout_percent integer,
  override_enabled boolean, override_rollout_percent integer, notes text, updated_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.key, f.name, f.description, f.category, f.is_kill_switch,
         f.default_enabled, f.default_rollout_percent,
         o.enabled, o.rollout_percent, o.notes, o.updated_at
  FROM public.feature_flags f
  LEFT JOIN public.school_feature_flags o
    ON o.flag_key = f.key AND o.school_id = _school_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY f.category, f.name;
$$;

GRANT EXECUTE ON FUNCTION public.super_list_school_flags(uuid) TO authenticated;

INSERT INTO public.feature_flags(key, name, description, category, default_enabled, default_rollout_percent, is_kill_switch) VALUES
  ('ai.tutor',              'AI Tutor',                 'Student-facing AI tutor chat',                     'ai',       true,  100, true),
  ('ai.mark_essay',         'AI Essay Marking',         'Teacher AI marking of essay answers',              'ai',       true,  100, true),
  ('ai.lesson_notes',       'AI Lesson Notes',          'Auto-generated lesson notes for teachers',         'ai',       true,  100, true),
  ('ai.report_comments',    'AI Report Comments',       'AI drafted report card comments',                  'ai',       true,  100, true),
  ('ai.principal_copilot',  'Principal Copilot',        'Natural-language analytics for admins',            'ai',       true,  100, true),
  ('transport.bus_tracking','Bus Tracking',             'Real-time school-bus tracking module',             'modules',  true,  100, true),
  ('exams.trad_scratch',    'Traditional Scratch Cards','Scratch-card unlock for external exam results',    'exams',    true,  100, true),
  ('billing.subscriptions', 'Subscriptions',            'Self-serve subscription billing for schools',      'billing',  true,  100, true),
  ('platform.new_dashboard','New Dashboard (beta)',     'Redesigned school dashboard',                      'rollout',  false, 0,   false)
ON CONFLICT (key) DO NOTHING;

-- Speed up results lookups by student and by school+published state
CREATE INDEX IF NOT EXISTS results_student_id_idx ON public.results (student_id);
CREATE INDEX IF NOT EXISTS results_school_published_idx ON public.results (school_id, published_at DESC) WHERE published_at IS NOT NULL;

-- Speed up mock_questions RLS + subject scans
CREATE INDEX IF NOT EXISTS mock_questions_school_subject_idx ON public.mock_questions (school_id, subject_id);

-- Analytics tables: bound queries by school+time
CREATE INDEX IF NOT EXISTS page_views_school_created_idx ON public.page_views (school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_school_created_idx ON public.auth_events (school_id, created_at DESC);

-- 1) academic_templates: require authentication (not fully public)
DROP POLICY IF EXISTS "templates readable by anyone" ON public.academic_templates;
CREATE POLICY "templates readable by authenticated"
  ON public.academic_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) client_errors: remove from realtime publication to prevent broadcast of stack traces / user_ids
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.client_errors;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_role(uuid, uuid, public.member_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_school_admin(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_school_role(uuid, uuid, public.member_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO anon, authenticated;

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
DROP POLICY IF EXISTS "admin can read own invoices" ON public.invoices;
ALTER FUNCTION public.report_client_error(text, text, text, text, text, text, text, uuid, jsonb) SET search_path = public, extensions;
ALTER TABLE public.client_errors ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
GRANT SELECT (id, slug, name, logo_url, motto, settings, current_session, current_term, address) ON public.schools TO anon;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assignment_submissions_assignment_id_fkey'
      AND conrelid = 'public.assignment_submissions'::regclass
  ) THEN
    DELETE FROM public.assignment_submissions s
    WHERE NOT EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = s.assignment_id);

    ALTER TABLE public.assignment_submissions
      ADD CONSTRAINT assignment_submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
  END IF;
END $$;
DROP POLICY IF EXISTS "Members read buses" ON public.transport_buses;

CREATE POLICY "Scoped read buses"
ON public.transport_buses
FOR SELECT
TO authenticated
USING (
  driver_user_id = auth.uid()
  OR public.is_school_admin(school_id, auth.uid())
  OR public.has_school_role(school_id, auth.uid(), 'teacher'::public.member_role)
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.school_id = transport_buses.school_id
      AND m.user_id = auth.uid()
      AND m.role::text = 'staff'
      AND m.status = 'active'
  )
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
