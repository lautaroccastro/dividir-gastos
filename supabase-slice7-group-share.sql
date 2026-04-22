-- Slice 7: public read-only share link per group (run in Supabase SQL Editor).

alter table public.groups
  add column if not exists share_enabled boolean not null default false;

alter table public.groups
  add column if not exists share_token text null;

create unique index if not exists idx_groups_share_token_unique
  on public.groups (share_token)
  where share_token is not null;
