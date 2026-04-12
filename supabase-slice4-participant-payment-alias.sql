-- Slice 4: optional payment alias per participant (how they receive money). Run once in Supabase SQL Editor.

alter table public.participants
  add column if not exists payment_alias text null;

alter table public.participants
  add constraint participants_payment_alias_length
  check (payment_alias is null or char_length(payment_alias) <= 50);
