-- Slice 1: groups + participants (run in Supabase SQL Editor)
-- One logged-in user owns groups; participants are display strings scoped to the group.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null default 'ARS' check (currency in ('ARS', 'USD')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(name) >= 1 and char_length(name) <= 50)
);

-- Case-insensitive uniqueness of group name per user (trimmed).
create unique index idx_groups_user_lower_name
  on public.groups (user_id, (lower(trim(name))));

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  display_name text not null,
  is_self boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint participants_name_length check (
    char_length(trim(display_name)) >= 1 and char_length(display_name) <= 25
  )
);

-- No duplicate participant labels in the same group (case-insensitive, trimmed).
create unique index idx_participants_group_lower_name
  on public.participants (group_id, (lower(trim(display_name))));

create index idx_participants_group_id on public.participants (group_id);

alter table public.groups enable row level security;
alter table public.participants enable row level security;

-- Only the owner can read their group rows: each SELECT must satisfy user_id = auth.uid().
create policy "groups_select_own"
  on public.groups for select
  to authenticated
  using (auth.uid() = user_id);

-- A new group row must belong to the current user: INSERT only allows user_id = auth.uid().
create policy "groups_insert_own"
  on public.groups for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Updates are allowed only on rows you already own, and the row must stay yours after the change.
create policy "groups_update_own"
  on public.groups for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deletes only affect rows where you are the owner.
create policy "groups_delete_own"
  on public.groups for delete
  to authenticated
  using (auth.uid() = user_id);

-- Participant rows do not store user_id; visibility is allowed if the participant belongs to a group owned by the current user.
create policy "participants_select_via_group"
  on public.participants for select
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = participants.group_id and g.user_id = auth.uid()
    )
  );

-- You may insert a participant only if the target group_id points to a group you own.
create policy "participants_insert_via_group"
  on public.participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.groups g
      where g.id = participants.group_id and g.user_id = auth.uid()
    )
  );

-- You may update a participant only if it belongs to your group; the new row must still reference your group.
create policy "participants_update_via_group"
  on public.participants for update
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = participants.group_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id = participants.group_id and g.user_id = auth.uid()
    )
  );

-- You may delete a participant only if it belongs to a group you own.
create policy "participants_delete_via_group"
  on public.participants for delete
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = participants.group_id and g.user_id = auth.uid()
    )
  );
