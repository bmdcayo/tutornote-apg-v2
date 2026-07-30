import { SupabaseClient } from '@supabase/supabase-js';
import { APGCase, AppSettings, Evaluation } from '../types';
import { isValidUuid } from './studentService';

type ServiceResult<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

const friendlyError = (error: any, fallback: string): string => {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  if (error?.code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Você não possui autorização para realizar esta operação.';
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Não foi possível comunicar-se com o banco de dados.';
  }
  return message || fallback;
};

export async function saveCaseInSupabase(
  client: SupabaseClient,
  apgCase: APGCase
): Promise<ServiceResult<APGCase>> {
  if (!apgCase.soiId || !isValidUuid(apgCase.soiId)) {
    return { success: false, error: 'Selecione um SOI válido para o caso.' };
  }
  const problemNumber = apgCase.problemNumber || apgCase.caseNumber || 1;
  if (![1, 2].includes(problemNumber)) {
    return { success: false, error: 'O problema deve ser P1 ou P2.' };
  }

  const payload: any = {
    soi_id: apgCase.soiId,
    numero: problemNumber,
    semana: apgCase.week,
    titulo: apgCase.title.trim(),
    tema: apgCase.theme || null,
    descricao: apgCase.description || null,
    objetivos: apgCase.learningObjectives || [],
    instrucoes_tutor: apgCase.teacherInstructions || null,
    data: apgCase.date || null,
    hora_inicio: apgCase.time || null,
    sala: apgCase.room || null,
    status: apgCase.status,
  };

  if (isValidUuid(apgCase.id)) {
    payload.id = apgCase.id;
  }

  try {
    const { data, error } = await client
      .from('casos_apg')
      .upsert(payload, { onConflict: 'soi_id,semana,numero' })
      .select('id, soi_id, turma_id, numero, semana, titulo, tema, descricao, objetivos, instrucoes_tutor, data, hora_inicio, sala, status')
      .single();

    if (error || !data) {
      return { success: false, error: friendlyError(error, 'Não foi possível salvar o caso APG.') };
    }

    return {
      success: true,
      data: {
        id: data.id,
        soiId: data.soi_id,
        classId: data.turma_id || undefined,
        problemNumber: Number(data.numero) === 2 ? 2 : 1,
        caseNumber: Number(data.numero) === 2 ? 2 : 1,
        week: Number(data.semana),
        unit: Number(data.semana) <= 8 ? 1 : 2,
        title: data.titulo,
        theme: data.tema || '',
        date: data.data || '',
        time: data.hora_inicio || '',
        room: data.sala || '',
        description: data.descricao || '',
        learningObjectives: Array.isArray(data.objetivos) ? data.objetivos : [],
        teacherInstructions: data.instrucoes_tutor || '',
        status: data.status || 'planejado',
      },
    };
  } catch (error) {
    return { success: false, error: friendlyError(error, 'Não foi possível salvar o caso APG.') };
  }
}

export async function deleteCaseInSupabase(
  client: SupabaseClient,
  caseId: string
): Promise<ServiceResult> {
  if (!isValidUuid(caseId)) return { success: false, error: 'O caso ainda não foi salvo no banco de dados.' };

  try {
    const { data, error } = await client
      .from('casos_apg')
      .delete()
      .eq('id', caseId)
      .select('id');

    if (error) {
      return { success: false, error: error.message || 'Erro ao excluir o caso no banco de dados.' };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'O caso não foi excluído. Verifique sua permissão ou se o registro ainda existe.',
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao excluir o caso APG.' };
  }
}

export async function saveEvaluationInSupabase(
  client: SupabaseClient,
  evaluation: Evaluation
): Promise<ServiceResult<Evaluation>> {
  if (!isValidUuid(evaluation.studentId) || !isValidUuid(evaluation.caseId)) {
    return { success: false, error: 'Estudante ou caso APG inválido.' };
  }

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { success: false, error: 'Usuário não autenticado.' };

  const payload = {
    aluno_id: evaluation.studentId,
    professor_id: authData.user.id,
    caso_id: evaluation.caseId,
    turma_id: evaluation.classId,
    mesa_id: evaluation.groupId,
    semana: evaluation.week,
    unidade: evaluation.unit,
    presenca: evaluation.attendance,
    papel_sessao: evaluation.role,
    abertura: evaluation.criterionScores.crit_1 || 0,
    postura: evaluation.criterionScores.crit_2 || 0,
    desempenho: evaluation.criterionScores.crit_3 || 0,
    fechamento: evaluation.criterionScores.crit_4 || 0,
    pontuacoes_criterios: evaluation.criterionScores,
    nota_bruta: evaluation.totalGrossScore,
    tags: evaluation.performanceTags || [],
    observacao_professor: evaluation.teacherNotes || null,
    parecer_ia: evaluation.pedagogicalFeedback || null,
    status: evaluation.status,
    segunda_chamada_necessaria: Boolean(evaluation.makeupRequired),
    segunda_chamada_concluida: Boolean(evaluation.makeupCompleted),
    data_falta_original: evaluation.originalAbsenceDate || null,
    data_segunda_chamada: evaluation.makeupDate || null,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await client
      .from('avaliacoes')
      .upsert(payload, { onConflict: 'aluno_id,caso_id' })
      .select('id')
      .single();
    if (error || !data) {
      return { success: false, error: friendlyError(error, 'Não foi possível salvar a avaliação.') };
    }
    return { success: true, data: { ...evaluation, id: data.id } };
  } catch (error) {
    return { success: false, error: friendlyError(error, 'Não foi possível salvar a avaliação.') };
  }
}

export interface TableNotebook {
  id?: string;
  notes: string;
  contributions: Array<{ studentId: string; text: string }>;
}

export async function loadTableNotebook(
  client: SupabaseClient,
  classId: string,
  caseId: string,
  tableId: string
): Promise<ServiceResult<TableNotebook>> {
  if (![classId, caseId, tableId].every(isValidUuid)) {
    return { success: true, data: { notes: '', contributions: [] } };
  }
  const { data, error } = await client
    .from('anotacoes_mesa')
    .select('id, observacoes, contribuicoes')
    .eq('turma_id', classId)
    .eq('caso_id', caseId)
    .eq('mesa_id', tableId)
    .maybeSingle();
  if (error) return { success: false, error: friendlyError(error, 'Não foi possível carregar o bloco de notas.') };
  return {
    success: true,
    data: {
      id: data?.id,
      notes: data?.observacoes || '',
      contributions: Array.isArray(data?.contribuicoes) ? data.contribuicoes : [],
    },
  };
}

export async function saveTableNotebook(
  client: SupabaseClient,
  classId: string,
  caseId: string,
  tableId: string,
  notebook: TableNotebook
): Promise<ServiceResult<TableNotebook>> {
  if (![classId, caseId, tableId].every(isValidUuid)) {
    return { success: false, error: 'Selecione uma turma, um caso e uma mesa válidos.' };
  }
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return { success: false, error: 'Usuário não autenticado.' };

  const { data, error } = await client
    .from('anotacoes_mesa')
    .upsert(
      {
        turma_id: classId,
        caso_id: caseId,
        mesa_id: tableId,
        professor_id: authData.user.id,
        observacoes: notebook.notes,
        contribuicoes: notebook.contributions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'turma_id,caso_id,mesa_id' }
    )
    .select('id, observacoes, contribuicoes')
    .single();
  if (error || !data) return { success: false, error: friendlyError(error, 'Não foi possível salvar o bloco de notas.') };
  return {
    success: true,
    data: {
      id: data.id,
      notes: data.observacoes || '',
      contributions: Array.isArray(data.contribuicoes) ? data.contribuicoes : [],
    },
  };
}

export async function loadSettingsFromSupabase(
  client: SupabaseClient,
  fallback: AppSettings
): Promise<AppSettings> {
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return fallback;
  const { data, error } = await client
    .from('configuracoes')
    .select('max_barema, barema_criterios')
    .eq('professor_id', authData.user.id)
    .maybeSingle();
  if (error || !data) return fallback;
  const criteria = Array.isArray(data.barema_criterios) ? data.barema_criterios : fallback.baremaCriteria;
  return {
    ...fallback,
    baremaCriteria: criteria,
    maxBaremaScore: Number(data.max_barema || criteria.reduce((sum: number, item: any) => sum + Number(item.maxScore || 0), 0) || 20),
  };
}

export async function saveSettingsInSupabase(
  client: SupabaseClient,
  settings: AppSettings
): Promise<ServiceResult<AppSettings>> {
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return { success: false, error: 'Usuário não autenticado.' };
  const { error } = await client.from('configuracoes').upsert(
    {
      professor_id: authData.user.id,
      max_barema: settings.maxBaremaScore,
      max_primeira_unidade: 20,
      max_segunda_unidade: 15,
      max_nota_final: 35,
      barema_criterios: settings.baremaCriteria,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'professor_id' }
  );
  return error
    ? { success: false, error: friendlyError(error, 'Não foi possível salvar o barema.') }
    : { success: true, data: settings };
}
