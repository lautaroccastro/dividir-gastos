-- Stress test: 1 grupo, 50 participantes (máximo app), 100 gastos variados.
-- Ejecutar en Supabase → SQL Editor (rol con bypass de RLS, p. ej. postgres).
--
-- Antes de correr: reemplazá OWNER_USER_ID si hace falta (debe existir en auth.users).
-- Limpieza al terminar de probar:
--   delete from public.groups where id = '<id del grupo>';  -- cascade borra participantes y gastos
--
-- O buscá por nombre:
--   delete from public.groups where name like 'Stress test %';

DO $$
DECLARE
  owner_user_id uuid := '354f3a41-89c2-4356-a00d-edebecc7fa3c'::uuid;
  v_group_id uuid;
  v_participant_ids uuid[];  -- índice 1..50 en orden sort_order
  i int;
  j int;
  e_id uuid;
  v_payer uuid;
  v_amount numeric(12, 2);
  v_title text;
  v_date date;
  split_count int;
  p_idx int;
BEGIN
  INSERT INTO public.groups (user_id, name, currency, transfers_suggested_ui)
  VALUES (
    owner_user_id,
    'Stress test ' || to_char(now(), 'YYYY-MM-DD_HH24MISS'),
    'ARS',
    false
  )
  RETURNING id INTO v_group_id;

  -- 50 participantes: uno es "Yo" (self), nombres únicos P01..P49
  FOR i IN 0..49 LOOP
    INSERT INTO public.participants (group_id, display_name, is_self, sort_order)
    VALUES (
      v_group_id,
      CASE WHEN i = 0 THEN 'Yo' ELSE 'P' || lpad(i::text, 2, '0') END,
      i = 0,
      i
    );
  END LOOP;

  SELECT array_agg(id ORDER BY sort_order)
  INTO v_participant_ids
  FROM public.participants
  WHERE group_id = v_group_id;

  IF v_participant_ids IS NULL OR array_length(v_participant_ids, 1) <> 50 THEN
    RAISE EXCEPTION 'Se esperaban 50 participantes, obtuve %', coalesce(array_length(v_participant_ids, 1), 0);
  END IF;

  FOR i IN 1..100 LOOP
    -- Montos variados (determinísticos): ~ desde centenas hasta ~ 80k
    v_amount := round(
      (15000 + (i * 104729 + i * i * 17) % 7950000)::numeric / 100,
      2
    );

    v_title := left('Gasto test ' || i::text || ' desc', 50);
    v_date := (current_date - ((i * 11) % 200))::date;

    -- Pagador distinto por gasto (rota entre los 50)
    v_payer := v_participant_ids[1 + ((i - 1) % 50)];

    INSERT INTO public.expenses (
      group_id,
      title,
      amount,
      paid_by_participant_id,
      expense_date
    )
    VALUES (
      v_group_id,
      v_title,
      v_amount,
      v_payer,
      v_date
    )
    RETURNING id INTO e_id;

    -- Reparto: entre 2 y 50 personas; el patrón cambia con i (primeros N del orden)
    split_count := 2 + ((i * 13 + i * i) % 49);

    FOR j IN 1..split_count LOOP
      INSERT INTO public.expense_split_participants (expense_id, participant_id)
      VALUES (e_id, v_participant_ids[j]);
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Grupo creado: % (50 participantes, 100 gastos)', v_group_id;
END $$;
