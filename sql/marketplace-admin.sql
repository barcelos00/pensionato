-- Run this migration in Supabase SQL Editor.
-- Existing houses and rooms become unavailable until an administrator reviews them.

alter table public.casas
  add column if not exists disponivel boolean not null default false;

alter table public.quartos
  add column if not exists disponivel boolean not null default false;

create table if not exists public.configuracoes_publicas (
  id integer primary key check (id = 1),
  whatsapp_numero text not null default '',
  atualizado_em timestamptz not null default now()
);

insert into public.configuracoes_publicas (id, whatsapp_numero)
values (1, '')
on conflict (id) do nothing;

create or replace function public.is_pensionato_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

revoke all on function public.is_pensionato_admin() from public, anon;
grant execute on function public.is_pensionato_admin() to authenticated;

alter table public.casas enable row level security;
alter table public.quartos enable row level security;
alter table public.configuracoes_publicas enable row level security;

drop policy if exists "Public can read available houses" on public.casas;
create policy "Public can read available houses"
  on public.casas for select
  to anon, authenticated
  using (disponivel = true);

drop policy if exists "Administrators manage houses" on public.casas;
create policy "Administrators manage houses"
  on public.casas for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

drop policy if exists "Public can read available rooms" on public.quartos;
create policy "Public can read available rooms"
  on public.quartos for select
  to anon, authenticated
  using (
    disponivel = true
    and exists (
      select 1
      from public.casas
      where casas.id = quartos.casa_id
        and casas.disponivel = true
    )
  );

drop policy if exists "Administrators manage rooms" on public.quartos;
create policy "Administrators manage rooms"
  on public.quartos for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

drop policy if exists "Public can read contact settings" on public.configuracoes_publicas;
create policy "Public can read contact settings"
  on public.configuracoes_publicas for select
  to anon, authenticated
  using (id = 1);

drop policy if exists "Administrators manage contact settings" on public.configuracoes_publicas;
create policy "Administrators manage contact settings"
  on public.configuracoes_publicas for all
  to authenticated
  using (public.is_pensionato_admin())
  with check (public.is_pensionato_admin());

grant select on public.casas, public.quartos, public.configuracoes_publicas to anon, authenticated;
grant insert, update, delete on public.casas, public.quartos, public.configuracoes_publicas to authenticated;

-- Public visitors see only the neighborhood and listing fields, never the full address.
revoke all on public.casas, public.quartos, public.configuracoes_publicas from anon;
grant select (id, nome, bairro, foto_url, disponivel)
  on public.casas to anon;
grant select (id, casa_id, numero, andar, tipo_mobilia, valor_base, foto_url, features, disponivel)
  on public.quartos to anon;
grant select on public.configuracoes_publicas to anon;

-- A public bucket lets visitors see published house photos; only admins can upload or delete.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pensionato-uploads',
  'pensionato-uploads',
  true,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/bmp'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view pensionato photos" on storage.objects;
create policy "Public can view pensionato photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'pensionato-uploads');

drop policy if exists "Administrators upload pensionato photos" on storage.objects;
create policy "Administrators upload pensionato photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pensionato-uploads'
    and public.is_pensionato_admin()
  );

drop policy if exists "Administrators update pensionato photos" on storage.objects;
create policy "Administrators update pensionato photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'pensionato-uploads'
    and public.is_pensionato_admin()
  )
  with check (
    bucket_id = 'pensionato-uploads'
    and public.is_pensionato_admin()
  );

drop policy if exists "Administrators delete pensionato photos" on storage.objects;
create policy "Administrators delete pensionato photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'pensionato-uploads'
    and public.is_pensionato_admin()
  );

-- Create the administrator in Supabase Auth, then set app_metadata to:
-- {"role":"admin"}
-- Do this in the Supabase Dashboard; never put the service_role key in this website.
-- Disable public sign-ups in Supabase Auth if only administrators should have accounts.
--
-- Review any older permissive Storage policies: Storage policies are additive. Remove
-- previous anonymous upload/delete policies for this bucket so only the admin policies apply.
