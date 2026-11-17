-- Run after marketplace-admin.sql and financeiro-locacoes.sql.
-- This migration locks down beds, finance data, finance RPCs, and photo listing.

-- Only administrators can read bed records. The application uses these records
-- only to show the bed count in the authenticated accommodation manager.
alter table public.leitos enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leitos'
  loop
    execute format('drop policy %I on public.leitos', policy_row.policyname);
  end loop;
end
$$;

create policy "Administrators manage beds"
  on public.leitos for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

revoke all on public.leitos from anon, authenticated;
grant select on public.leitos to authenticated;

-- Rebuild the private-data policies so there are no older permissive policies
-- that could expose tenant, occupancy, or finance records.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('inquilinos', 'despesas', 'locacoes', 'recebimentos')
  loop
    execute format('drop policy %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end
$$;

alter table public.inquilinos enable row level security;
alter table public.despesas enable row level security;
alter table public.locacoes enable row level security;
alter table public.recebimentos enable row level security;

create policy "Administrators manage tenants"
  on public.inquilinos for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

create policy "Administrators manage expenses"
  on public.despesas for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

create policy "Administrators manage occupancies"
  on public.locacoes for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

create policy "Administrators manage receipts"
  on public.recebimentos for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

-- The browser only needs reads, payment-status updates, and the operations
-- performed by the three finance RPCs. RLS still requires an admin claim.
revoke all on public.inquilinos, public.despesas, public.locacoes, public.recebimentos
  from anon, authenticated;
grant select on public.inquilinos, public.despesas, public.locacoes, public.recebimentos
  to authenticated;
grant insert on public.inquilinos, public.despesas, public.locacoes, public.recebimentos
  to authenticated;
grant update (status, data_pagamento, atualizado_em) on public.despesas, public.recebimentos
  to authenticated;
grant update (status, encerrada_em) on public.locacoes to authenticated;

-- Authenticated administrators remain covered by their separate FOR ALL policy;
-- ordinary authenticated users must not read internal room rates.
alter policy "Public can read available rooms" on public.quartos to anon;

-- Invoker rights make the table grants and administrator-only RLS policies
-- apply to RPC calls instead of bypassing them with SECURITY DEFINER.
alter function public.criar_locacao_financeira(jsonb, jsonb) security invoker;
alter function public.registrar_despesa_financeira(jsonb) security invoker;
alter function public.encerrar_locacao_financeira(bigint, date) security invoker;

revoke all on function public.criar_locacao_financeira(jsonb, jsonb) from public, anon;
revoke all on function public.registrar_despesa_financeira(jsonb) from public, anon;
revoke all on function public.encerrar_locacao_financeira(bigint, date) from public, anon;
grant execute on function public.criar_locacao_financeira(jsonb, jsonb) to authenticated;
grant execute on function public.registrar_despesa_financeira(jsonb) to authenticated;
grant execute on function public.encerrar_locacao_financeira(bigint, date) to authenticated;

-- Invoker-rights inserts need permission to use the generated identity sequences.
do $$
declare
  table_name text;
  sequence_name text;
begin
  foreach table_name in array array['inquilinos', 'despesas', 'locacoes', 'recebimentos']
  loop
    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    if sequence_name is not null then
      execute format('grant usage, select on sequence %s to authenticated', sequence_name);
    end if;
  end loop;
end
$$;

-- Public bucket URLs remain readable, but object listing is administrator-only.
drop policy if exists "Public can view pensionato photos" on storage.objects;
drop policy if exists "Administrators view pensionato photos" on storage.objects;
create policy "Administrators view pensionato photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pensionato-uploads'
    and public.is_pensionato_admin()
  );

-- Supabase Dashboard setting (cannot be configured by SQL):
-- Authentication > Settings > Password Security > enable leaked password protection.
