-- TutorNote APG — catálogo compartilhado de casos entre professores
-- Leitura: todos os usuários autenticados.
-- Escrita/exclusão: autor do caso ou administrador.
-- Alunos, turmas, mesas e avaliações continuam protegidos pelas RLS próprias.

begin;

alter table public.casos_apg
  add column if not exists created_by uuid,
  add column if not exists semestre_id uuid,
  add column if not exists soi_codigo text,
  add column if not exists soi_nome text;

update public.casos_apg c
set
  created_by = coalesce(c.created_by, s.professor_id),
  semestre_id = coalesce(c.semestre_id, s.semestre_id),
  soi_codigo = coalesce(nullif(c.soi_codigo, ''), s.codigo),
  soi_nome = coalesce(nullif(c.soi_nome, ''), s.nome)
from public.sois s
where s.id = c.soi_id
  and (
    c.created_by is null
    or c.semestre_id is null
    or c.soi_codigo is null
    or c.soi_codigo = ''
    or c.soi_nome is null
    or c.soi_nome = ''
  );

alter table public.casos_apg
  alter column created_by set default auth.uid();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'casos_apg_created_by_fkey'
      and conrelid = 'public.casos_apg'::regclass
  ) then
    alter table public.casos_apg
      add constraint casos_apg_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'casos_apg_semestre_id_fkey'
      and conrelid = 'public.casos_apg'::regclass
  ) then
    alter table public.casos_apg
      add constraint casos_apg_semestre_id_fkey
      foreign key (semestre_id) references public.semestres(id) on delete restrict;
  end if;
end $$;

create or replace function public.preencher_catalogo_caso_apg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  soi_row public.sois%rowtype;
begin
  select *
  into soi_row
  from public.sois
  where id = new.soi_id;

  if soi_row.id is null then
    raise exception 'SOI informado para o caso APG não existe.';
  end if;

  new.created_by := coalesce(new.created_by, auth.uid(), soi_row.professor_id);
  new.semestre_id := soi_row.semestre_id;
  new.soi_codigo := soi_row.codigo;
  new.soi_nome := soi_row.nome;
  return new;
end;
$$;

drop trigger if exists trg_preencher_catalogo_caso_apg on public.casos_apg;
create trigger trg_preencher_catalogo_caso_apg
  before insert or update of soi_id on public.casos_apg
  for each row execute function public.preencher_catalogo_caso_apg();

create index if not exists casos_apg_catalogo_idx
  on public.casos_apg (semestre_id, soi_codigo, semana, numero);
create index if not exists casos_apg_created_by_idx
  on public.casos_apg (created_by);

grant select, insert, update, delete on public.casos_apg to authenticated;
alter table public.casos_apg enable row level security;

drop policy if exists casos_owner_all on public.casos_apg;
drop policy if exists casos_authenticated_select on public.casos_apg;
drop policy if exists casos_owner_insert on public.casos_apg;
drop policy if exists casos_owner_update on public.casos_apg;
drop policy if exists casos_owner_delete on public.casos_apg;
drop policy if exists casos_insert on public.casos_apg;
drop policy if exists casos_select on public.casos_apg;
drop policy if exists casos_update on public.casos_apg;
drop policy if exists casos_delete on public.casos_apg;

create policy casos_authenticated_select
  on public.casos_apg
  for select
  to authenticated
  using (true);

create policy casos_owner_insert
  on public.casos_apg
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and public.current_user_owns_soi(soi_id)
  );

create policy casos_owner_update
  on public.casos_apg
  for update
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_user_is_admin()
  )
  with check (
    (created_by = auth.uid() or public.current_user_is_admin())
    and public.current_user_owns_soi(soi_id)
  );

create policy casos_owner_delete
  on public.casos_apg
  for delete
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_user_is_admin()
  );

notify pgrst, 'reload schema';

commit;

-- Verificação somente leitura:
select
  count(*) as total_casos,
  count(*) filter (
    where created_by is null
      or semestre_id is null
      or soi_codigo is null
      or soi_nome is null
  ) as casos_sem_metadados,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'casos_apg'
  ) as politicas_casos,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'casos_apg'
      and policyname = 'casos_authenticated_select'
  ) as leitura_compartilhada_ativa
from public.casos_apg;
