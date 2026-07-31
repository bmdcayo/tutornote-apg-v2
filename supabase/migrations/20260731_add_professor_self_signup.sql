-- TutorNote APG — cadastro autônomo e seguro de professores
-- Execute no SQL Editor do mesmo projeto Supabase usado pelo aplicativo.
--
-- A configuração "Allow new users to sign up" deve estar habilitada em
-- Authentication > Providers > Email. A função abaixo nunca aceita papel
-- administrativo vindo do navegador: toda nova conta começa como professor.

alter table public.profiles
  add column if not exists ativo boolean not null default true;

update public.profiles
set email = lower(trim(email))
where email is not null
  and email <> lower(trim(email));

create unique index if not exists profiles_email_unique_lower_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
  profile_institution text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  profile_institution := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'institution'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'instituicao'), ''),
    'Faculdade de Medicina'
  );

  insert into public.profiles (
    id,
    nome,
    email,
    papel,
    instituicao,
    ativo
  )
  values (
    new.id,
    profile_name,
    lower(trim(new.email)),
    'professor',
    profile_institution,
    true
  )
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email,
        instituicao = excluded.instituicao;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.sync_user_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    nome = coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nome
    ),
    email = lower(trim(new.email)),
    instituicao = coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'institution'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'instituicao'), ''),
      instituicao
    )
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row
  execute function public.sync_user_profile_update();

notify pgrst, 'reload schema';

-- Verificação: todos os campos devem retornar true.
select
  to_regprocedure('public.handle_new_user()') is not null as funcao_cadastro_ativa,
  exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and not tgisinternal
  ) as gatilho_cadastro_ativo,
  exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_updated'
      and not tgisinternal
  ) as sincronizacao_perfil_ativa,
  to_regclass('public.profiles_email_unique_lower_idx') is not null
    as email_unico_ativo;
