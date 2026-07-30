-- TutorNote APG — hierarquia Semestre > SOI > Turma > Mesa
-- Migração incremental e idempotente. Execute uma vez no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.sois (
  id uuid primary key default gen_random_uuid(),
  semestre_id uuid not null references public.semestres(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  nome text not null,
  codigo text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semestre_id, professor_id, codigo)
);

alter table public.turmas add column if not exists soi_id uuid;
alter table public.casos_apg add column if not exists soi_id uuid;

-- Cria um SOI para cada combinação já existente de semestre, professor e
-- identificação encontrada no nome da turma. Nomes sem SOI recebem um grupo
-- provisório explícito, sem perda de dados.
with source_classes as (
  select distinct
    t.semestre_id,
    t.professor_id,
    case
      when substring(upper(t.nome) from 'SOI[[:space:]-]*[IVX]+') is null
        then 'SOI NÃO DEFINIDO'
      else 'SOI ' || regexp_replace(
        substring(upper(t.nome) from 'SOI[[:space:]-]*[IVX]+'),
        '^SOI[[:space:]-]*',
        ''
      )
    end as soi_nome
  from public.turmas t
)
insert into public.sois (semestre_id, professor_id, nome, codigo)
select
  semestre_id,
  professor_id,
  soi_nome,
  regexp_replace(upper(soi_nome), '[^A-Z0-9]+', '-', 'g')
from source_classes
on conflict (semestre_id, professor_id, codigo) do nothing;

update public.turmas t
set soi_id = s.id
from public.sois s
where s.semestre_id = t.semestre_id
  and s.professor_id = t.professor_id
  and s.codigo = regexp_replace(
    upper(
      case
        when substring(upper(t.nome) from 'SOI[[:space:]-]*[IVX]+') is null
          then 'SOI NÃO DEFINIDO'
        else 'SOI ' || regexp_replace(
          substring(upper(t.nome) from 'SOI[[:space:]-]*[IVX]+'),
          '^SOI[[:space:]-]*',
          ''
        )
      end
    ),
    '[^A-Z0-9]+',
    '-',
    'g'
  )
  and t.soi_id is null;

update public.casos_apg c
set soi_id = t.soi_id
from public.turmas t
where c.turma_id = t.id
  and c.soi_id is null;

-- Consolida eventuais cópias do mesmo caso que antes pertenciam a turmas
-- diferentes do mesmo SOI, preservando avaliações e anotações.
-- Cada operação calcula seu próprio mapa de duplicatas. Não são utilizadas
-- tabelas temporárias ou auxiliares, garantindo compatibilidade com o pool
-- de conexões do SQL Editor do Supabase.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'avaliacoes'
      and column_name = 'caso_id'
  ) then
    with merge as (
      select id as duplicate_id, canonical_id
      from (
        select
          id,
          first_value(id) over (
            partition by soi_id, semana, numero
            order by created_at, id
          ) as canonical_id,
          row_number() over (
            partition by soi_id, semana, numero
            order by created_at, id
          ) as position
        from public.casos_apg
        where soi_id is not null
      ) ranked
      where position > 1
    )
    update public.avaliacoes a
    set caso_id = merge.canonical_id
    from merge
    where a.caso_id = merge.duplicate_id;
  end if;
end $$;

do $$
begin
  if to_regclass('public.anotacoes_mesa') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'anotacoes_mesa'
         and column_name = 'caso_id'
     ) then
    with merge as (
      select id as duplicate_id, canonical_id
      from (
        select
          id,
          first_value(id) over (
            partition by soi_id, semana, numero
            order by created_at, id
          ) as canonical_id,
          row_number() over (
            partition by soi_id, semana, numero
            order by created_at, id
          ) as position
        from public.casos_apg
        where soi_id is not null
      ) ranked
      where position > 1
    )
    update public.anotacoes_mesa notes
    set caso_id = merge.canonical_id
    from merge
    where notes.caso_id = merge.duplicate_id;
  end if;

  if to_regclass('public.sessoes') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'sessoes'
         and column_name = 'caso_id'
     ) then
    with merge as (
      select id as duplicate_id, canonical_id
      from (
        select
          id,
          first_value(id) over (
            partition by soi_id, semana, numero
            order by created_at, id
          ) as canonical_id,
          row_number() over (
            partition by soi_id, semana, numero
            order by created_at, id
          ) as position
        from public.casos_apg
        where soi_id is not null
      ) ranked
      where position > 1
    )
    update public.sessoes session_row
    set caso_id = merge.canonical_id
    from merge
    where session_row.caso_id = merge.duplicate_id;
  end if;
end $$;

with merge as (
  select id as duplicate_id
  from (
    select
      id,
      row_number() over (
        partition by soi_id, semana, numero
        order by created_at, id
      ) as position
    from public.casos_apg
    where soi_id is not null
  ) ranked
  where position > 1
)
delete from public.casos_apg c
using merge
where c.id = merge.duplicate_id;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'turmas_soi_id_fkey'
      and conrelid = 'public.turmas'::regclass
  ) then
    alter table public.turmas
      add constraint turmas_soi_id_fkey
      foreign key (soi_id) references public.sois(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'casos_apg_soi_id_fkey'
      and conrelid = 'public.casos_apg'::regclass
  ) then
    alter table public.casos_apg
      add constraint casos_apg_soi_id_fkey
      foreign key (soi_id) references public.sois(id) on delete cascade;
  end if;
end $$;

alter table public.turmas alter column soi_id set not null;
alter table public.casos_apg alter column soi_id set not null;
alter table public.casos_apg alter column turma_id drop not null;

drop index if exists public.casos_apg_turma_semana_problema_uidx;
create unique index if not exists casos_apg_soi_semana_problema_uidx
  on public.casos_apg (soi_id, semana, numero);
create index if not exists turmas_soi_id_idx on public.turmas (soi_id);
create index if not exists casos_apg_soi_id_idx on public.casos_apg (soi_id);

-- Mantém os campos técnicos S02P1/S02P2 consistentes.
create or replace function public.preencher_campos_caso_apg()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.numero := coalesce(new.numero, new.problema, 1);
  new.problema := new.numero;
  new.unidade := case when new.semana <= 8 then 1 else 2 end;
  new.codigo := 'S' || lpad(new.semana::text, 2, '0') || 'P' || new.numero::text;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_preencher_campos_caso_apg on public.casos_apg;
create trigger trg_preencher_campos_caso_apg
  before insert or update on public.casos_apg
  for each row execute function public.preencher_campos_caso_apg();

create or replace function public.current_user_owns_soi(target_soi uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sois
    where id = target_soi
      and (professor_id = auth.uid() or public.current_user_is_admin())
  );
$$;

grant select, insert, update, delete on public.sois to authenticated;
grant select, insert, update, delete on public.turmas to authenticated;
grant select, insert, update, delete on public.casos_apg to authenticated;

alter table public.sois enable row level security;
drop policy if exists sois_owner_all on public.sois;
create policy sois_owner_all on public.sois
  for all to authenticated
  using (professor_id = auth.uid() or public.current_user_is_admin())
  with check (professor_id = auth.uid() or public.current_user_is_admin());

drop policy if exists turmas_owner_all on public.turmas;
create policy turmas_owner_all on public.turmas
  for all to authenticated
  using (
    (professor_id = auth.uid() or public.current_user_is_admin())
    and public.current_user_owns_soi(soi_id)
  )
  with check (
    (professor_id = auth.uid() or public.current_user_is_admin())
    and public.current_user_owns_soi(soi_id)
  );

alter table public.casos_apg enable row level security;
drop policy if exists casos_owner_all on public.casos_apg;
drop policy if exists casos_insert on public.casos_apg;
drop policy if exists casos_select on public.casos_apg;
drop policy if exists casos_update on public.casos_apg;
drop policy if exists casos_delete on public.casos_apg;
create policy casos_owner_all on public.casos_apg
  for all to authenticated
  using (public.current_user_owns_soi(soi_id))
  with check (public.current_user_owns_soi(soi_id));

notify pgrst, 'reload schema';

-- Verificação: não altera dados. O resultado deve mostrar SOIs, turmas e casos
-- sem vínculos nulos.
select
  (select count(*) from public.sois) as total_sois,
  (select count(*) from public.turmas where soi_id is null) as turmas_sem_soi,
  (select count(*) from public.casos_apg where soi_id is null) as casos_sem_soi,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'sois') as politicas_sois;
