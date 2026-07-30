-- TutorNote APG - update v5: persistência de casos SxxP1/SxxP2
-- Execute uma vez no SQL Editor do mesmo projeto Supabase.

alter table public.casos_apg
  add column if not exists turma_id uuid references public.turmas(id) on delete cascade,
  add column if not exists numero integer not null default 1,
  add column if not exists semana integer not null default 1,
  add column if not exists titulo text not null default '',
  add column if not exists tema text,
  add column if not exists descricao text,
  add column if not exists objetivos jsonb not null default '[]'::jsonb,
  add column if not exists instrucoes_tutor text,
  add column if not exists data date,
  add column if not exists hora_inicio time without time zone,
  add column if not exists sala text,
  add column if not exists status text not null default 'planejado',
  add column if not exists created_at timestamp with time zone not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.casos_apg'::regclass
      and conname = 'casos_apg_numero_check'
  ) then
    alter table public.casos_apg
      add constraint casos_apg_numero_check check (numero in (1, 2));
  end if;
end $$;

create unique index if not exists casos_apg_turma_semana_problema_uidx
  on public.casos_apg (turma_id, semana, numero);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(papel, '')) in ('administrador', 'admin')
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
    select 1
    from public.turmas
    where id = target_turma
      and (professor_id = auth.uid() or public.current_user_is_admin())
  );
$$;

grant select, insert, update, delete on public.casos_apg to authenticated;
alter table public.casos_apg enable row level security;

drop policy if exists casos_owner_all on public.casos_apg;
create policy casos_owner_all
  on public.casos_apg
  for all
  to authenticated
  using (public.current_user_owns_turma(turma_id))
  with check (public.current_user_owns_turma(turma_id));

notify pgrst, 'reload schema';

-- Verificação: deve retornar rls_ativo=true e quantidade_politicas=1.
select
  c.relrowsecurity as rls_ativo,
  count(p.policyname) as quantidade_politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public' and c.relname = 'casos_apg'
group by c.relrowsecurity;
