begin;

create extension if not exists pgcrypto;

-- Uma única mesa é aplicada a cada combinação caso + turma.
create table if not exists public.aplicacoes_caso_turma (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references public.casos_apg(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aplicacoes_caso_turma_caso_turma_key unique (caso_id, turma_id)
);

create index if not exists aplicacoes_caso_turma_turma_idx
  on public.aplicacoes_caso_turma (turma_id);
create index if not exists aplicacoes_caso_turma_mesa_idx
  on public.aplicacoes_caso_turma (mesa_id);

create or replace function public.validar_aplicacao_caso_turma()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mesa_turma_id uuid;
  turma_soi_id uuid;
  caso_soi_id uuid;
begin
  select turma_id into mesa_turma_id
  from public.mesas
  where id = new.mesa_id;

  if mesa_turma_id is distinct from new.turma_id then
    raise exception 'A mesa selecionada não pertence à turma informada.';
  end if;

  select soi_id into turma_soi_id
  from public.turmas
  where id = new.turma_id;

  select soi_id into caso_soi_id
  from public.casos_apg
  where id = new.caso_id;

  if turma_soi_id is null or caso_soi_id is null or turma_soi_id <> caso_soi_id then
    raise exception 'O caso e a turma precisam pertencer ao mesmo SOI.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validar_aplicacao_caso_turma
  on public.aplicacoes_caso_turma;
create trigger trg_validar_aplicacao_caso_turma
  before insert or update on public.aplicacoes_caso_turma
  for each row execute function public.validar_aplicacao_caso_turma();

grant select, insert, update, delete
  on public.aplicacoes_caso_turma to authenticated;

alter table public.aplicacoes_caso_turma enable row level security;

drop policy if exists aplicacoes_caso_turma_owner_all
  on public.aplicacoes_caso_turma;
create policy aplicacoes_caso_turma_owner_all
  on public.aplicacoes_caso_turma
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.turmas t
      where t.id = aplicacoes_caso_turma.turma_id
        and (
          t.professor_id = auth.uid()
          or public.current_user_is_admin()
        )
    )
  )
  with check (
    exists (
      select 1
      from public.turmas t
      where t.id = aplicacoes_caso_turma.turma_id
        and (
          t.professor_id = auth.uid()
          or public.current_user_is_admin()
        )
    )
  );

-- Guarda exatamente quais itens da rubrica foram marcados.
alter table public.avaliacoes
  add column if not exists itens_rubrica jsonb not null default '{}'::jsonb;

-- Mantém o histórico já existente de atestado e segunda chamada.
alter table public.avaliacoes
  add column if not exists segunda_chamada_necessaria boolean not null default false;
alter table public.avaliacoes
  add column if not exists segunda_chamada_concluida boolean not null default false;
alter table public.avaliacoes
  add column if not exists data_falta_original date;
alter table public.avaliacoes
  add column if not exists data_segunda_chamada date;

-- A ausência zera somente o fechamento (crit_3 / coluna legada desempenho).
-- O atestado permanece sem nota até a avaliação de segunda chamada.
create or replace function public.calcular_nota_avaliacao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  presenca_normalizada text;
  status_normalizado text;
begin
  presenca_normalizada := lower(trim(coalesce(new.presenca, '')));
  status_normalizado := lower(trim(coalesce(new.status, '')));

  if presenca_normalizada = 'atestado'
     and not coalesce(new.segunda_chamada_concluida, false) then
    new.nota_bruta := null;

  elsif presenca_normalizada = 'ausente' then
    new.desempenho := 0;
    new.pontuacoes_criterios :=
      coalesce(new.pontuacoes_criterios, '{}'::jsonb)
      || jsonb_build_object('crit_3', 0);
    new.nota_bruta :=
      coalesce(new.abertura, 0)
      + coalesce(new.postura, 0)
      + coalesce(new.fechamento, 0);

  elsif status_normalizado in ('concluído', 'concluido', 'concluída', 'concluida') then
    if
      new.abertura is null
      or new.postura is null
      or new.desempenho is null
      or new.fechamento is null
    then
      raise exception
        'Todos os critérios devem ser preenchidos para concluir a avaliação.';
    end if;

    new.nota_bruta :=
      new.abertura
      + new.postura
      + new.desempenho
      + new.fechamento;

  elsif
    new.abertura is not null
    and new.postura is not null
    and new.desempenho is not null
    and new.fechamento is not null
  then
    new.nota_bruta :=
      new.abertura
      + new.postura
      + new.desempenho
      + new.fechamento;
  else
    new.nota_bruta := null;
  end if;

  return new;
end;
$$;

-- A nova rubrica é comum a todos os docentes.
update public.configuracoes
set
  barema_criterios = jsonb_build_array(
    jsonb_build_object(
      'id', 'crit_1',
      'name', 'Abertura de problema',
      'maxScore', 5,
      'description', 'Preparação, ética, colaboração e construção inicial do caso.'
    ),
    jsonb_build_object(
      'id', 'crit_2',
      'name', 'Postura e colaboração',
      'maxScore', 5,
      'description', 'Participação, relevância das contribuições e desempenho ético.'
    ),
    jsonb_build_object(
      'id', 'crit_3',
      'name', 'Fechamento de problema',
      'maxScore', 5,
      'description', 'Domínio, raciocínio, evidências e comunicação técnico-científica.'
    ),
    jsonb_build_object(
      'id', 'crit_4',
      'name', 'Assiduidade',
      'maxScore', 5,
      'description', 'Pontualidade e permanência durante as atividades.'
    )
  ),
  max_barema = 20,
  updated_at = now();

notify pgrst, 'reload schema';

commit;

-- Verificação. Deve retornar rls_ativo=true e uma política.
select
  c.relrowsecurity as rls_ativo,
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'aplicacoes_caso_turma'
  ) as quantidade_politicas,
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'avaliacoes'
      and column_name = 'itens_rubrica'
  ) as coluna_itens_rubrica
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'aplicacoes_caso_turma';
