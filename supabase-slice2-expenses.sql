-- Slice 2: expenses + split participants (run in Supabase SQL Editor after slice 1)
-- Amount is in the group's currency (single currency per group). Split is equal shares;
-- the last participant in stable order absorbs rounding remainder (computed in app).

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_by_participant_id uuid not null references public.participants (id) on delete restrict,
  expense_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_title_length check (
    char_length(trim(title)) >= 1 and char_length(title) <= 50
  )
);

create index idx_expenses_group_date on public.expenses (
  group_id,
  expense_date desc,
  created_at desc
);

create table public.expense_split_participants (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete restrict,
  primary key (expense_id, participant_id)
);

create index idx_expense_split_participant on public.expense_split_participants (participant_id);

alter table public.expenses enable row level security;
alter table public.expense_split_participants enable row level security;

create policy "expenses_select_via_group"
  on public.expenses for select
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = expenses.group_id and g.user_id = auth.uid()
    )
  );

create policy "expenses_insert_via_group"
  on public.expenses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.groups g
      where g.id = expenses.group_id and g.user_id = auth.uid()
    )
  );

create policy "expenses_update_via_group"
  on public.expenses for update
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = expenses.group_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id = expenses.group_id and g.user_id = auth.uid()
    )
  );

create policy "expenses_delete_via_group"
  on public.expenses for delete
  to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = expenses.group_id and g.user_id = auth.uid()
    )
  );

create policy "expense_split_select_via_expense"
  on public.expense_split_participants for select
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      join public.groups g on g.id = e.group_id
      where e.id = expense_split_participants.expense_id and g.user_id = auth.uid()
    )
  );

create policy "expense_split_insert_via_expense"
  on public.expense_split_participants for insert
  to authenticated
  with check (
    exists (
      select 1 from public.expenses e
      join public.groups g on g.id = e.group_id
      where e.id = expense_split_participants.expense_id and g.user_id = auth.uid()
    )
  );

create policy "expense_split_delete_via_expense"
  on public.expense_split_participants for delete
  to authenticated
  using (
    exists (
      select 1 from public.expenses e
      join public.groups g on g.id = e.group_id
      where e.id = expense_split_participants.expense_id and g.user_id = auth.uid()
    )
  );
