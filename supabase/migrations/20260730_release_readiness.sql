-- TutorNote APG — migração de preparação funcional
-- Execute uma única vez no SQL Editor do Supabase antes de usar esta versão.

create extension if not exists pgcrypto;

-- Perfis e cadastro de novos professores
alter table public.profiles add column if not exists ativo boolean not null default true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email, papel, instituicao, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    'professor',
    coalesce(nullif(new.raw_user_meta_data ->> 'institution', ''), 'Faculdade de Medicina'),
    true
  )
  on conflict (id) do update
    set nome = excluded.nome,
        email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garantir perfis para contas que já existiam antes do trigger
insert into public.profiles (id, nome, email, papel, instituicao, ativo)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1)),
  u.email,
  'professor',
  'Faculdade de Medicina',
  true
from auth.users u
on conflict (id) do nothing;

-- Modelo de casos SxxP1/SxxP2
alter table public.casos_apg add column if not exists numero integer not null default 1;
alter table public.casos_apg add column if not exists turma_id uuid references public.turmas(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'casos_apg_numero_check'
  ) then
    alter table public.casos_apg
      add constraint casos_apg_numero_check check (numero in (1, 2));
  end if;
end $$;

create unique index if not exists casos_apg_turma_semana_problema_uidx
  on public.casos_apg (turma_id, semana, numero);

-- Avaliações persistentes e distinguíveis por caso
alter table public.avaliacoes add column if not exists caso_id uuid references public.casos_apg(id) on delete cascade;
alter table public.avaliacoes add column if not exists turma_id uuid references public.turmas(id) on delete cascade;
alter table public.avaliacoes add column if not exists mesa_id uuid references public.mesas(id) on delete restrict;
alter table public.avaliacoes add column if not exists semana integer;
alter table public.avaliacoes add column if not exists unidade smallint;
alter table public.avaliacoes add column if not exists pontuacoes_criterios jsonb not null default '{}'::jsonb;
alter table public.avaliacoes add column if not exists segunda_chamada_necessaria boolean not null default false;
alter table public.avaliacoes add column if not exists segunda_chamada_concluida boolean not null default false;
alter table public.avaliacoes add column if not exists data_falta_original date;
alter table public.avaliacoes add column if not exists data_segunda_chamada date;

-- A versão anterior dependia da tabela legada sessoes. A nova versão usa caso_id.
alter table public.avaliacoes alter column sessao_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'avaliacoes_unidade_check'
  ) then
    alter table public.avaliacoes
      add constraint avaliacoes_unidade_check check (unidade in (1, 2));
  end if;
end $$;

create unique index if not exists avaliacoes_aluno_caso_uidx
  on public.avaliacoes (aluno_id, caso_id)
  where caso_id is not null;

-- Bloco de notas da mesa e contribuições atribuídas aos estudantes
create table if not exists public.anotacoes_mesa (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  caso_id uuid not null references public.casos_apg(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  observacoes text not null default '',
  contribuicoes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (turma_id, caso_id, mesa_id)
);

-- Configurações do barema
alter table public.configuracoes add column if not exists barema_criterios jsonb not null default '[]'::jsonb;
create unique index if not exists configuracoes_professor_uidx
  on public.configuracoes (professor_id);

-- Propriedade de estudantes para isolamento entre docentes
alter table public.alunos add column if not exists created_by uuid references public.profiles(id) default auth.uid();

-- Funções auxiliares de autorização sem recursão de RLS
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and lower(papel) in ('administrador', 'admin')
  );
$$;

create or replace function public.current_user_owns_turma(target_turma uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.turmas
    where id = target_turma
      and (professor_id = auth.uid() or public.current_user_is_admin())
  );
$$;

-- RLS: perfis
alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.current_user_is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.current_user_is_admin())
  with check (id = auth.uid() or public.current_user_is_admin());

-- RLS: turmas, mesas e casos
alter table public.turmas enable row level security;
drop policy if exists turmas_owner_all on public.turmas;
create policy turmas_owner_all on public.turmas
  for all to authenticated
  using (professor_id = auth.uid() or public.current_user_is_admin())
  with check (professor_id = auth.uid() or public.current_user_is_admin());

alter table public.mesas enable row level security;
drop policy if exists mesas_owner_all on public.mesas;
create policy mesas_owner_all on public.mesas
  for all to authenticated
  using (public.current_user_owns_turma(turma_id))
  with check (public.current_user_owns_turma(turma_id));

alter table public.casos_apg enable row level security;
drop policy if exists casos_owner_all on public.casos_apg;
create policy casos_owner_all on public.casos_apg
  for all to authenticated
  using (public.current_user_owns_turma(turma_id))
  with check (public.current_user_owns_turma(turma_id));

-- RLS: estudantes e alocações
alter table public.alunos enable row level security;
drop policy if exists alunos_owner_all on public.alunos;
create policy alunos_owner_all on public.alunos
  for all to authenticated
  using (created_by = auth.uid() or public.current_user_is_admin())
  with check (created_by = auth.uid() or public.current_user_is_admin());

alter table public.alocacoes_mesa enable row level security;
drop policy if exists alocacoes_owner_all on public.alocacoes_mesa;
create policy alocacoes_owner_all on public.alocacoes_mesa
  for all to authenticated
  using (public.current_user_owns_turma(turma_id))
  with check (public.current_user_owns_turma(turma_id));

-- RLS: avaliações, anotações e configurações
alter table public.avaliacoes enable row level security;
drop policy if exists avaliacoes_owner_all on public.avaliacoes;
create policy avaliacoes_owner_all on public.avaliacoes
  for all to authenticated
  using (professor_id = auth.uid() or public.current_user_is_admin())
  with check (professor_id = auth.uid() or public.current_user_is_admin());

alter table public.anotacoes_mesa enable row level security;
drop policy if exists anotacoes_owner_all on public.anotacoes_mesa;
create policy anotacoes_owner_all on public.anotacoes_mesa
  for all to authenticated
  using (professor_id = auth.uid() or public.current_user_is_admin())
  with check (professor_id = auth.uid() or public.current_user_is_admin());

alter table public.configuracoes enable row level security;
drop policy if exists configuracoes_owner_all on public.configuracoes;
create policy configuracoes_owner_all on public.configuracoes
  for all to authenticated
  using (professor_id = auth.uid() or public.current_user_is_admin())
  with check (professor_id = auth.uid() or public.current_user_is_admin());

notify pgrst, 'reload schema';
