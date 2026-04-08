-- Ejecutar en Supabase → SQL Editor → Run
-- Tabla de prueba del MVP (una fila por usuario)

create table if not exists public.mvp_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.mvp_notes enable row level security;

create policy "Users read own notes"
  on public.mvp_notes for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own notes"
  on public.mvp_notes for insert
  to authenticated
  with check (auth.uid() = user_id);
