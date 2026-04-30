-- Slice 7: persist "transferencias realizadas" marks for each group owner.
-- Run in Supabase SQL Editor after prior slices.

create table if not exists public.group_transfer_done (
  group_id uuid not null references public.groups (id) on delete cascade,
  transfer_key text not null,
  created_at timestamptz not null default now(),
  primary key (group_id, transfer_key)
);

create index if not exists idx_group_transfer_done_group
  on public.group_transfer_done (group_id);

alter table public.group_transfer_done enable row level security;

create policy "group_transfer_done_select_via_group"
  on public.group_transfer_done for select
  to authenticated
  using (
    exists (
      select 1
      from public.groups g
      where g.id = group_transfer_done.group_id
        and g.user_id = auth.uid()
    )
  );

create policy "group_transfer_done_insert_via_group"
  on public.group_transfer_done for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.groups g
      where g.id = group_transfer_done.group_id
        and g.user_id = auth.uid()
    )
  );

create policy "group_transfer_done_delete_via_group"
  on public.group_transfer_done for delete
  to authenticated
  using (
    exists (
      select 1
      from public.groups g
      where g.id = group_transfer_done.group_id
        and g.user_id = auth.uid()
    )
  );
