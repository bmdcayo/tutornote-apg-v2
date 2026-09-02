import { SupabaseClient } from '@supabase/supabase-js';
import { Class, ClassGroup } from '../types';

export interface CreateClassParams {
  name: string;
  yearSemester: string;
  semesterId: string;
  soiId: string;
  responsibleTeacher?: string;
  userId?: string;
}

export interface CreateClassResult {
  success: boolean;
  class?: Class;
  groups?: ClassGroup[];
  error?: string;
  mesasPending?: boolean;
}

export interface ActiveSemester {
  id: string;
  nome: string;
  data_inicio?: string;
  data_fim?: string;
  ativo?: boolean;
}

/**
  * Traduz erros retornados do Supabase/PostgreSQL para mensagens em português amigáveis.
  */
export function translateSupabaseError(error: any): string {
  if (!error) return 'Erro ao cadastrar a turma no Supabase. Operação rejeitada pelo banco de dados.';

  const msg = (error.message || '').toLowerCase();
  const details = (error.details || '').toLowerCase();
  const code = error.code || '';

  if (
    msg.includes('turmas_semestre_id_fkey') ||
    details.includes('turmas_semestre_id_fkey') ||
    (code === '23503' && (msg.includes('semestre') || details.includes('semestre')))
  ) {
    return 'O semestre selecionado não existe mais. Atualize a página e selecione um semestre válido.';
  }

  if (
    msg.includes('turmas_professor_id_fkey') ||
    details.includes('turmas_professor_id_fkey') ||
    (code === '23503' && (msg.includes('professor') || details.includes('professor') || msg.includes('user')))
  ) {
    return 'O perfil do docente responsável não foi encontrado.';
  }

  if (
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('not authorized')
  ) {
    return 'Você não possui autorização para cadastrar esta turma.';
  }

  return error.message || 'Erro ao cadastrar a turma no Supabase. Operação rejeitada pelo banco de dados.';
}

/**
 * Consulta todos os semestres cadastrados no Supabase ordenados por data_inicio.
 */
export async function fetchActiveSemesters(client: SupabaseClient): Promise<{
  semestres: ActiveSemester[];
  error?: string;
}> {
  try {
    const { data, error } = await client
      .from('semestres')
      .select('id, nome, data_inicio, data_fim, ativo')
      .eq('ativo', true)
      .order('data_inicio', { ascending: true });

    if (error) {
      console.error('[Supabase fetchSemesters Error]', error.message);
      return { semestres: [], error: translateSupabaseError(error) };
    }

    return { semestres: data || [] };
  } catch (err: any) {
    console.error('[Supabase fetchSemesters Exception]', err);
    return { semestres: [], error: err.message || 'Erro ao carregar semestres do banco de dados.' };
  }
}

export const fetchAllSemesters = fetchActiveSemesters;

/**
 * Seleciona automaticamente o semestre mais próximo da data atual
 */
export function findClosestSemester(semestres: ActiveSemester[]): ActiveSemester | undefined {
  if (!semestres || semestres.length === 0) return undefined;

  const now = new Date().getTime();
  let closest = semestres[0];
  let minDiff = Infinity;

  for (const sem of semestres) {
    if (sem.data_inicio && sem.data_fim) {
      const start = new Date(sem.data_inicio).getTime();
      const end = new Date(sem.data_fim).getTime();
      if (now >= start && now <= end) {
        return sem;
      }
      const diffStart = Math.abs(now - start);
      const diffEnd = Math.abs(now - end);
      const localMin = Math.min(diffStart, diffEnd);
      if (localMin < minDiff) {
        minDiff = localMin;
        closest = sem;
      }
    }
  }

  return closest;
}

/**
 * Insere uma nova turma na tabela public.turmas do Supabase e consulta
 * as 3 mesas criadas automaticamente pelo trigger do banco de dados (public.mesas).
 */
export async function createClassInSupabase(
  client: SupabaseClient,
  params: CreateClassParams
): Promise<CreateClassResult> {
  const { name, yearSemester, semesterId, soiId, responsibleTeacher, userId } = params;

  // 1. Obter usuário autenticado no Supabase
  let activeUserId = userId;
  try {
    const { data: authData, error: authErr } = await client.auth.getUser();
    if (!authErr && authData?.user?.id) {
      activeUserId = authData.user.id;
    }
  } catch {
    // Ignore auth check warning
  }

  if (!activeUserId) {
    return {
      success: false,
      error: 'Seu perfil de professor não foi encontrado. Entre novamente ou procure o administrador.',
    };
  }

  // 2. Confirmar existência do perfil do professor em public.profiles (não bloqueante)
  try {
    await client
      .from('profiles')
      .select('id')
      .eq('id', activeUserId)
      .maybeSingle();
  } catch {
    // Ignore profile check warning
  }

  // 3. Validar semestre_id
  if (!semesterId) {
    return {
      success: false,
      error: 'Nenhum semestre letivo ativo foi encontrado. Cadastre ou ative um semestre antes de criar a turma.',
    };
  }

  if (!soiId) {
    return { success: false, error: 'Selecione o SOI ao qual a turma pertence.' };
  }

  // Confirmar que o semestre existe e está ativo em public.semestres
  const { data: semExist, error: semErr } = await client
    .from('semestres')
    .select('id, nome')
    .eq('id', semesterId)
    .eq('ativo', true)
    .maybeSingle();

  if (semErr || !semExist) {
    return {
      success: false,
      error: 'O semestre selecionado não existe mais. Atualize a página e selecione um semestre válido.',
    };
  }

  const { data: soiExist, error: soiErr } = await client
    .from('sois')
    .select('id')
    .eq('id', soiId)
    .eq('semestre_id', semesterId)
    .eq('ativo', true)
    .maybeSingle();

  if (soiErr || !soiExist) {
    return {
      success: false,
      error: 'O SOI selecionado não pertence ao semestre informado ou está inativo.',
    };
  }

  // 4. Inserir na tabela public.turmas
  const turmaPayload = {
    nome: name.trim(),
    semestre_id: semesterId,
    soi_id: soiId,
    professor_id: activeUserId,
  };

  const payloadKeys = Object.keys(turmaPayload);
  console.debug('[Cadastro Turma] Chaves enviadas:', payloadKeys);

  const allowedKeys = ['nome', 'semestre_id', 'soi_id', 'professor_id'];
  if (
    payloadKeys.length !== allowedKeys.length ||
    !payloadKeys.every((k) => allowedKeys.includes(k))
  ) {
    console.error('[Cadastro Turma] Bloqueado! Chaves enviadas inválidas:', payloadKeys);
    return {
      success: false,
      error: 'Erro de validação: payload de cadastro de turma contém campos inválidos.',
    };
  }

  const { data: createdTurma, error: insertError } = await client
    .from('turmas')
    .insert(turmaPayload)
    .select('id, nome, semestre_id, soi_id, professor_id, created_at')
    .single();

  if (insertError || !createdTurma) {
    console.error('[Supabase Turmas Insert Error]', insertError);
    return {
      success: false,
      error: translateSupabaseError(insertError),
    };
  }

  let profName = 'Docente não identificado';
  try {
    const { data: profData } = await client
      .from('profiles')
      .select('nome')
      .eq('id', activeUserId)
      .maybeSingle();
    if (profData?.nome) {
      profName = profData.nome;
    }
  } catch {
    // Ignore fetch profile error
  }

  // 5. Mapear turma criada
  const newClass: Class = {
    id: createdTurma.id,
    name: createdTurma.nome || name.trim(),
    semesterId: createdTurma.semestre_id || semesterId,
    soiId: createdTurma.soi_id || soiId,
    yearSemester: semExist.nome || yearSemester || '2026.1',
    responsibleTeacher: profName,
    professorId: activeUserId,
    createdBy: activeUserId,
  };

  // 6. Consultar public.mesas usando o turma_id (geradas pelo trigger)
  const turmaId = createdTurma.id;
  let fetchedMesas: any[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: mData } = await client
      .from('mesas')
      .select('*')
      .eq('turma_id', turmaId)
      .order('numero', { ascending: true });

    if (mData && mData.length >= 3) {
      fetchedMesas = mData;
      break;
    }
    if (mData && mData.length > 0) {
      fetchedMesas = mData;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const groups: ClassGroup[] = fetchedMesas.map((m: any) => ({
    id: m.id,
    name: m.nome || m.name || (m.numero ? `Mesa ${m.numero}` : 'Mesa'),
    classId: m.turma_id || turmaId,
    limitStudents: m.limite_alunos || m.limite || 10,
  }));

  if (groups.length >= 3) {
    return {
      success: true,
      class: newClass,
      groups,
    };
  }

  return {
    success: true,
    class: newClass,
    groups,
    mesasPending: true,
    error: 'A turma foi criada, mas as mesas ainda não foram carregadas.',
  };
}

/**
 * Re-consulta public.mesas para uma turma específica no Supabase.
 */
export async function fetchMesasForTurma(
  client: SupabaseClient,
  turmaId: string
): Promise<{ success: boolean; groups?: ClassGroup[]; error?: string }> {
  try {
    const { data: mData, error } = await client
      .from('mesas')
      .select('*')
      .eq('turma_id', turmaId)
      .order('numero', { ascending: true });

    if (error) {
      return { success: false, error: translateSupabaseError(error) };
    }

    if (mData && mData.length > 0) {
      const groups: ClassGroup[] = mData.map((m: any) => ({
        id: m.id,
        name: m.nome || m.name || (m.numero ? `Mesa ${m.numero}` : 'Mesa'),
        classId: m.turma_id || turmaId,
        limitStudents: m.limite_alunos || m.limite || 10,
      }));

      return { success: true, groups };
    }

    return {
      success: false,
      error: 'As mesas ainda não foram geradas no banco de dados. Tente novamente em instantes.',
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao consultar mesas no Supabase.' };
  }
}

export interface ClassLinkedCounts {
  alunosCount: number;
  mesasCount: number;
  casosCount: number;
  avaliacoesCount: number;
  isHasAcademicData: boolean;
}

/**
 * Consulta a quantidade de registros vinculados a uma turma antes de autorizar a exclusão.
 */
export async function fetchClassLinkedCounts(
  client: SupabaseClient,
  classId: string
): Promise<ClassLinkedCounts> {
  let alunosCount = 0;
  let mesasCount = 0;
  let casosCount = 0;
  let avaliacoesCount = 0;

  try {
    const { data: alocs } = await client
      .from('alocacoes_mesa')
      .select('aluno_id')
      .eq('turma_id', classId);
    if (alocs) {
      alunosCount = new Set(alocs.map((a: any) => a.aluno_id).filter(Boolean)).size;
    }
  } catch {
    // Ignore counts error
  }

  try {
    const { count: cMesas, error } = await client
      .from('mesas')
      .select('*', { count: 'exact', head: true })
      .eq('turma_id', classId);
    if (!error && cMesas !== null) mesasCount = cMesas;
  } catch {
    // Ignore counts error
  }

  try {
    const { count: cCasos, error } = await client
      .from('casos_apg')
      .select('*', { count: 'exact', head: true })
      .eq('turma_id', classId);
    if (!error && cCasos !== null) casosCount = cCasos;
  } catch {
    // Ignore counts error
  }

  try {
    const { count: cEvals, error } = await client
      .from('avaliacoes')
      .select('*', { count: 'exact', head: true })
      .eq('turma_id', classId);
    if (!error && cEvals !== null) avaliacoesCount = cEvals;
  } catch {
    // Ignore counts error
  }

  // As 3 mesas automáticas não são consideradas impedimento para excluir uma turma vazia
  const isHasAcademicData = alunosCount > 0 || casosCount > 0 || avaliacoesCount > 0;

  return {
    alunosCount,
    mesasCount,
    casosCount,
    avaliacoesCount,
    isHasAcademicData,
  };
}

/**
 * Executa o comando de exclusão da turma no Supabase e trata erros de RLS/FK.
 */
export async function deleteClassInSupabase(
  client: SupabaseClient,
  classId: string,
  isAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'Você não possui permissão para excluir esta turma. Usuário não autenticado.',
      };
    }

    let query = client.from('turmas').delete().eq('id', classId);

    if (!isAdmin) {
      query = query.eq('professor_id', user.id);
    }

    const { data: turmaExcluida, error: deleteError } = await query.select('id');

    if (deleteError) {
      // Registrar log limpo no console de desenvolvimento sem expor tokens ou chaves
      console.error('[Supabase Delete Turma Error]', {
        code: deleteError.code,
        message: deleteError.message,
        details: deleteError.details,
        hint: deleteError.hint,
      });

      const code = deleteError.code || '';
      const msg = (deleteError.message || '').toLowerCase();
      const details = (deleteError.details || '').toLowerCase();

      if (
        code === '23503' ||
        msg.includes('foreign key constraint') ||
        details.includes('foreign key constraint') ||
        msg.includes('violates foreign key')
      ) {
        return {
          success: false,
          error: 'Não foi possível excluir a turma porque existem registros vinculados sem regra de exclusão em cascata.',
        };
      }

      if (
        code === '42501' ||
        msg.includes('row-level security') ||
        msg.includes('permission denied') ||
        msg.includes('not authorized')
      ) {
        return {
          success: false,
          error: 'Você não possui permissão para excluir esta turma.',
        };
      }

      if (
        msg.includes('fetch failed') ||
        msg.includes('network') ||
        msg.includes('connection')
      ) {
        return {
          success: false,
          error: 'Não foi possível comunicar-se com o banco de dados. Tente novamente.',
        };
      }

      return {
        success: false,
        error: deleteError.message || 'Erro ao excluir a turma do banco de dados.',
      };
    }

    if (!turmaExcluida || turmaExcluida.length === 0) {
      return {
        success: false,
        error: 'A turma não foi excluída. Você não possui autorização ou o registro não foi encontrado.',
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Delete Exception]', {
      message: err?.message,
      name: err?.name,
    });
    return {
      success: false,
      error: 'Não foi possível comunicar-se com o banco de dados. Tente novamente.',
    };
  }
}

/**
 * Consulta todas as turmas e mesas cadastradas no Supabase incluindo o relacionamento com semestres.
 */
export async function fetchAllClassesAndMesas(client: SupabaseClient): Promise<{
  classes: Class[];
  groups: ClassGroup[];
}> {
  try {
    const { data: tData, error: tErr } = await client
      .from('turmas')
      .select(`
        id,
        nome,
        semestre_id,
        soi_id,
        professor_id,
        curso,
        modulo,
        created_at,
        semestres (
          id,
          nome,
          data_inicio,
          data_fim,
          ativo
        ),
        professor:profiles!turmas_professor_id_fkey (
          id,
          nome,
          email,
          papel
        )
      `)
      .order('created_at', { ascending: false });

    let finalTurmas = tData;

    if (tErr) {
      console.error('[Supabase Fetch Turmas Error]', tErr.message);
      const { data: fallbackTurmas } = await client
        .from('turmas')
        .select(`
          id,
          nome,
          semestre_id,
          soi_id,
          professor_id,
          curso,
          modulo,
          created_at,
          semestres (
            id,
            nome,
            data_inicio,
            data_fim,
            ativo
          ),
          professor:profiles (
            id,
            nome,
            email,
            papel
          )
        `)
        .order('created_at', { ascending: false });
      finalTurmas = fallbackTurmas;
    }

    const classes: Class[] = (finalTurmas || []).map((t: any) => {
      const semObj = Array.isArray(t.semestres) ? t.semestres[0] : t.semestres;
      const semesterName = semObj?.nome || '';

      const profObj = Array.isArray(t.professor) ? t.professor[0] : (t.professor || (Array.isArray(t.profiles) ? t.profiles[0] : t.profiles));
      const profName = profObj?.nome || 'Docente não identificado';

      return {
        id: t.id,
        name: t.nome || t.name || 'Turma APG',
        semesterId: t.semestre_id || t.semester_id || '',
        soiId: t.soi_id || '',
        yearSemester: semesterName,
        responsibleTeacher: profName,
        professorId: t.professor_id || profObj?.id || '',
        createdBy: t.professor_id || profObj?.id || '',
      };
    });

    const { data: mData } = await client
      .from('mesas')
      .select('*')
      .order('numero', { ascending: true });

    const groups: ClassGroup[] = (mData || []).map((m: any) => ({
      id: m.id,
      name: m.nome || m.name || (m.numero ? `Mesa ${m.numero}` : 'Mesa'),
      classId: m.turma_id || m.class_id,
      limitStudents: m.limite_alunos || m.limite || 10,
    }));

    return { classes, groups };
  } catch (err) {
    console.error('[Supabase Fetch All Error]', err);
    return { classes: [], groups: [] };
  }
}
