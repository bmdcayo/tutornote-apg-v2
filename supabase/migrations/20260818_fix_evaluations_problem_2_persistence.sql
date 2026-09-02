-- ==============================================================================
-- TutorNote APG - Migração para Persistência Total do Problema 2 (Caso 2)
-- ==============================================================================

begin;

-- 1. Desativar / Remover triggers conflitantes que bloqueavam salvamento por mesa
drop trigger if exists trg_validar_aluno_avaliacao on public.avaliacoes cascade;
drop trigger if exists validar_aluno_avaliacao_trg on public.avaliacoes cascade;
drop trigger if exists check_aluno_avaliacao on public.avaliacoes cascade;
drop function if exists public.validar_aluno_avaliacao() cascade;

-- 2. Adicionar coluna numero_problema na tabela de avaliações (1 = Problema 1, 2 = Problema 2)
alter table public.avaliacoes
  add column if not exists numero_problema smallint not null default 1;

alter table public.avaliacoes
  add column if not exists ajuste numeric default 0;

alter table public.avaliacoes
  add column if not exists motivo_ajuste text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'avaliacoes_numero_problema_check'
  ) then
    alter table public.avaliacoes
      add constraint avaliacoes_numero_problema_check
      check (numero_problema in (1, 2));
  end if;
end $$;

-- 3. Atualizar registros existentes com base nos dados de casos e metadados JSONB
update public.avaliacoes a
set numero_problema = 2
from public.casos_apg c
where a.caso_id = c.id
  and c.numero = 2;

update public.avaliacoes
set numero_problema = 2
where (pontuacoes_criterios->>'problemNumber') = '2'
  and numero_problema <> 2;

-- 4. Remover índices e restrições únicas legadas que bloqueavam a 2ª nota na mesma semana
alter table public.avaliacoes drop constraint if exists avaliacoes_aluno_id_semana_key cascade;
alter table public.avaliacoes drop constraint if exists avaliacoes_aluno_semana_key cascade;
alter table public.avaliacoes drop constraint if exists avaliacoes_aluno_id_semana_unidade_key cascade;
alter table public.avaliacoes drop constraint if exists avaliacoes_aluno_semana_unidade_key cascade;
alter table public.avaliacoes drop constraint if exists avaliacoes_aluno_semana_problema_key cascade;
drop index if exists public.avaliacoes_aluno_semana_uidx;
drop index if exists public.avaliacoes_aluno_semana_unidade_uidx;
drop index if exists public.avaliacoes_aluno_semana_problema_uidx;

-- 5. Deduplicar caso existam registros duplicados idênticos antes de criar o índice/constraint
with ranked as (
  select id,
         row_number() over (
           partition by aluno_id, semana, numero_problema
           order by updated_at desc nulls last, created_at desc nulls last, id desc
         ) as rn
  from public.avaliacoes
  where semana is not null
)
delete from public.avaliacoes
where id in (select id from ranked where rn > 1);

-- 6. Criar restrição UNIQUE definitiva suportada nativamente pelo Upsert do PostgREST / Supabase
alter table public.avaliacoes
  add constraint avaliacoes_aluno_semana_problema_key
  unique (aluno_id, semana, numero_problema);

-- 7. Atualizar Políticas de Segurança (RLS) para permitir gravação total sem bloqueios
alter table public.avaliacoes enable row level security;
drop policy if exists avaliacoes_owner_all on public.avaliacoes;
create policy avaliacoes_owner_all on public.avaliacoes
  for all to authenticated
  using (
    professor_id = auth.uid()
    or professor_id is null
    or public.current_user_is_admin()
  )
  with check (
    professor_id = auth.uid()
    or professor_id is null
    or public.current_user_is_admin()
  );

commit;

-- 8. Notificar a API do Supabase para recarregar o schema imediatamente
notify pgrst, 'reload schema';
