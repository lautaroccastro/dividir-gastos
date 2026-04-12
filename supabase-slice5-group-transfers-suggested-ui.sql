-- Slice 5: remember "transferencias sugeridas" UI open for a group (no stored suggestions). Run once in Supabase SQL Editor.

alter table public.groups
  add column if not exists transfers_suggested_ui boolean not null default false;

comment on column public.groups.transfers_suggested_ui is 'User left group detail in "suggested transfers" mode; expenses shown read-only until they go back to edit.';
