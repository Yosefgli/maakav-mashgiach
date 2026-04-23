create extension if not exists pgcrypto;

-- ── Tables ────────────────────────────────────────

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('mashgiach', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  qr_code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mashgiach_locations (
  id uuid primary key default gen_random_uuid(),
  mashgiach_user_id uuid not null references public.profiles (user_id) on delete cascade,
  location_id uuid not null references public.locations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mashgiach_user_id, location_id)
);

create table if not exists public.visit_logs (
  id uuid primary key default gen_random_uuid(),
  mashgiach_user_id uuid not null references public.profiles (user_id) on delete cascade,
  location_id uuid references public.locations (id) on delete set null,
  occurred_at timestamptz not null default now(),
  occurred_date date not null,
  occurred_time time not null,
  mashgiach_display_name text not null,
  location_display_name text,
  city text,
  status text not null check (status in ('success', 'unauthorized', 'invalid_location', 'error')),
  message text not null
);

-- ── Indexes ───────────────────────────────────────

create index if not exists idx_visit_logs_occurred_at on public.visit_logs (occurred_at desc);
create index if not exists idx_visit_logs_occurred_date on public.visit_logs (occurred_date);
create index if not exists idx_visit_logs_mashgiach_name on public.visit_logs (mashgiach_display_name);
create index if not exists idx_visit_logs_location_name on public.visit_logs (location_display_name);
create index if not exists idx_visit_logs_city on public.visit_logs (city);

-- ── RLS ───────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.mashgiach_locations enable row level security;
alter table public.visit_logs enable row level security;

-- Helper: returns current user's role
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

-- profiles
create policy "profiles: own or admin select"
  on public.profiles for select
  using (auth.uid() = user_id or public.current_user_role() = 'admin');

create policy "profiles: admin update"
  on public.profiles for update
  using (public.current_user_role() = 'admin');

-- Note: profile INSERT is handled by the server-side API route using the service role key.

-- locations
create policy "locations: authenticated select"
  on public.locations for select
  using (auth.role() = 'authenticated');

create policy "locations: admin insert"
  on public.locations for insert
  with check (public.current_user_role() = 'admin');

create policy "locations: admin update"
  on public.locations for update
  using (public.current_user_role() = 'admin');

create policy "locations: admin delete"
  on public.locations for delete
  using (public.current_user_role() = 'admin');

-- mashgiach_locations
create policy "mappings: own or admin select"
  on public.mashgiach_locations for select
  using (mashgiach_user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "mappings: admin insert"
  on public.mashgiach_locations for insert
  with check (public.current_user_role() = 'admin');

create policy "mappings: admin delete"
  on public.mashgiach_locations for delete
  using (public.current_user_role() = 'admin');

-- visit_logs
create policy "logs: own or admin select"
  on public.visit_logs for select
  using (mashgiach_user_id = auth.uid() or public.current_user_role() = 'admin');

create policy "logs: admin delete"
  on public.visit_logs for delete
  using (public.current_user_role() = 'admin');

-- ── register_visit_by_qr function ────────────────

create or replace function public.register_visit_by_qr(p_qr_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_location public.locations%rowtype;
  v_is_allowed boolean;
  v_now timestamptz := now();
  v_status text;
  v_message text;
begin
  select * into v_profile from public.profiles where user_id = auth.uid();
  if not found then raise exception 'No profile found for current user'; end if;
  if v_profile.role <> 'mashgiach' then raise exception 'Only mashgiach users can register visits'; end if;

  select * into v_location from public.locations where qr_code = p_qr_code and is_active = true;

  if not found then
    v_status := 'invalid_location';
    v_message := 'הקוד שנסרק אינו משויך למקום פעיל.';
    insert into public.visit_logs (mashgiach_user_id, occurred_at, occurred_date, occurred_time, mashgiach_display_name, status, message)
    values (v_profile.user_id, v_now, v_now::date, v_now::time, v_profile.full_name, v_status, v_message);
    return jsonb_build_object('status', v_status, 'message', v_message);
  end if;

  select exists (
    select 1 from public.mashgiach_locations
    where mashgiach_user_id = v_profile.user_id and location_id = v_location.id
  ) into v_is_allowed;

  if not v_is_allowed then
    v_status := 'unauthorized';
    v_message := 'אין הרשאה לבצע כניסה למקום זה.';
  else
    v_status := 'success';
    v_message := 'הכניסה בוצעה בהצלחה.';
  end if;

  insert into public.visit_logs (mashgiach_user_id, location_id, occurred_at, occurred_date, occurred_time, mashgiach_display_name, location_display_name, city, status, message)
  values (v_profile.user_id, v_location.id, v_now, v_now::date, v_now::time, v_profile.full_name, v_location.name, v_location.city, v_status, v_message);

  return jsonb_build_object('status', v_status, 'message', v_message, 'location_name', v_location.name, 'city', v_location.city);
end;
$$;

grant execute on function public.register_visit_by_qr(text) to authenticated;
