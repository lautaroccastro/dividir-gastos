-- Run once in Supabase → SQL Editor after removing MVP notes from the app.
-- Drops RLS policies first, then the table.

drop policy if exists "Users read own notes" on public.mvp_notes;
drop policy if exists "Users insert own notes" on public.mvp_notes;

drop table if exists public.mvp_notes;
