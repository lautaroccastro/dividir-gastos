-- Slice 6: per-user profile (global nickname). Run in Supabase SQL Editor after prior slices.
-- Nickname rules match participant display_name length (25) at application layer; DB allows NULL until onboarding.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_length check (
    nickname is null
    or (char_length(trim(nickname)) >= 1 and char_length(nickname) <= 25)
  )
);

create index idx_profiles_id on public.profiles (id);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- New auth users get an empty profile row (nickname filled later in onboarding).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (NEW.id);
  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users that already existed before this migration (no trigger fired for them).
insert into public.profiles (id)
select u.id
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
