import { SupabaseClient } from '@supabase/supabase-js';
import { APGCase, AppSettings, Evaluation, SOI } from '../types';
import { initialAPGCases } from './mockData';
import { isValidUuid } from './studentService';

export const mapAPGCaseRow = (row: any): APGCase => ({
  id: row.id,
  soiId: row.soi_id || '',
  semesterId: row.semestre_id || '',
  soiCode: row.soi_codigo || '',
  soiName: row.soi_nome || '',
  createdBy: row.created_by || '',
  classId: row.turma_id || '',
  problemNumber: Number(row.numero) === 2 ? 2 : 1,
  caseNumber: Number(row.numero) === 2 ? 2 : 1,
  week: Number(row.semana || 1),
  unit: Number(row.semana) <= 8 ? 1 : 2,
  title: row.titulo || row.title || '',
  theme: row.tema || row.theme || '',
  date: row.data || '',
  time: row.hora_inicio || '',
  room: row.sala || '',
  description: row.descricao || '',
  learningObjectives: Array.isArray(row.objetivos) ? row.objetivos : [],
  teacherInstructions: row.instrucoes_tutor || '',
  status: row.status || 'planejado',
});

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
      .select('*')
      .single();

    if (error || !data) {
      return { success: false, error: friendlyError(error, 'Não foi possível salvar o caso APG.') };
    }

    return {
      success: true,
      data: {
        id: data.id,
        soiId: data.soi_id,
        semesterId: data.semestre_id || undefined,
        soiCode: data.soi_codigo || undefined,
        soiName: data.soi_nome || undefined,
        createdBy: data.created_by || undefined,
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

export async function saveCasesInSupabaseBatch(
  client: SupabaseClient,
  casesList: APGCase[]
): Promise<ServiceResult<{ count: number }>> {
  if (casesList.length === 0) return { success: true, data: { count: 0 } };

  const validCases = casesList.filter((c) => c.soiId && isValidUuid(c.soiId));
  if (validCases.length === 0) {
    return { success: false, error: 'Nenhum dos casos possui um SOI válido selecionado.' };
  }

  const payloads = validCases.map((apgCase) => {
    const problemNumber = apgCase.problemNumber || apgCase.caseNumber || 1;
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
      status: apgCase.status || 'planejado',
    };

    if (isValidUuid(apgCase.id)) {
      payload.id = apgCase.id;
    }
    return payload;
  });

  try {
    const { data, error } = await client
      .from('casos_apg')
      .upsert(payloads, { onConflict: 'soi_id,semana,numero' })
      .select('id');

    if (error) {
      return { success: false, error: friendlyError(error, 'Não foi possível importar os casos APG.') };
    }

    return { success: true, data: { count: data?.length || payloads.length } };
  } catch (error: any) {
    return { success: false, error: friendlyError(error, 'Erro ao realizar a importação em lote dos casos APG.') };
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

export async function ensureAPGCasesInSupabase(
  client: SupabaseClient,
  sois: SOI[]
): Promise<APGCase[]> {
  try {
    // 1. Fetch current casos_apg from DB
    const { data: dbCases } = await client
      .from('casos_apg')
      .select('*')
      .order('semana', { ascending: true })
      .order('numero', { ascending: true });

    const currentRows = dbCases || [];

    // 2. Identify available SOIs
    let targetSois = sois.filter((s) => s.id && isValidUuid(s.id));
    if (targetSois.length === 0) {
      const { data: dbSois } = await client.from('sois').select('*').eq('ativo', true);
      if (dbSois && dbSois.length > 0) {
        targetSois = dbSois.map((r: any) => ({
          id: r.id,
          semesterId: r.semestre_id,
          name: r.nome || '',
          code: r.codigo || '',
          active: r.ativo !== false,
        }));
      }
    }

    // If still no SOI, map existing rows or fallback to initial cases
    if (targetSois.length === 0) {
      if (currentRows.length > 0) {
        return currentRows.map(mapAPGCaseRow);
      }
      return initialAPGCases;
    }

    // 3. For each SOI, check if all 20 weeks x 2 problems exist
    const casesToInsert: any[] = [];
    targetSois.forEach((soi) => {
      for (let w = 1; w <= 20; w++) {
        for (let num of [1, 2] as const) {
          const exists = currentRows.some(
            (r: any) => r.soi_id === soi.id && Number(r.semana) === w && Number(r.numero) === num
          );
          if (!exists) {
            const template = initialAPGCases.find(
              (init) => init.week === w && (init.problemNumber || init.caseNumber || 1) === num
            );
            casesToInsert.push({
              soi_id: soi.id,
              numero: num,
              semana: w,
              titulo: template?.title || `Problema ${num} - Semana ${w}`,
              tema: template?.theme || 'Tutoria APG',
              descricao: template?.description || null,
              objetivos: template?.learningObjectives || [],
              instrucoes_tutor: template?.teacherInstructions || null,
              data: template?.date || null,
              hora_inicio: template?.time || '08:00',
              sala: template?.room || 'Sala APG 101',
              status: template?.status || 'planejado',
            });
          }
        }
      }
    });

    if (casesToInsert.length > 0) {
      const { error: insertErr } = await client
        .from('casos_apg')
        .insert(casesToInsert);
      if (insertErr) {
        // If batch insert had duplicate keys, attempt single inserts safely
        for (const singleCase of casesToInsert) {
          try {
            await client.from('casos_apg').insert(singleCase);
          } catch {
            // Ignore single case collision
          }
        }
      }
    }

    // Re-fetch all cases to have accurate UUIDs
    const { data: finalData } = await client
      .from('casos_apg')
      .select('*')
      .order('semana', { ascending: true })
      .order('numero', { ascending: true });

    if (finalData && finalData.length > 0) {
      return finalData.map(mapAPGCaseRow);
    }
    return currentRows.length > 0 ? currentRows.map(mapAPGCaseRow) : initialAPGCases;
  } catch {
    return initialAPGCases;
  }
}

export async function saveEvaluationInSupabase(
  client: SupabaseClient,
  evaluation: Evaluation
): Promise<ServiceResult<Evaluation>> {
  if (!isValidUuid(evaluation.studentId)) {
    return { success: true, data: evaluation };
  }

  // Get current authenticated user if available
  let userId: string | null = null;
  try {
    const { data: authData } = await client.auth.getUser();
    if (authData?.user?.id && isValidUuid(authData.user.id)) {
      userId = authData.user.id;
    }
  } catch {
    // Auth check optional
  }

  // Determine target problem number (1 or 2)
  const caseIdLower = (evaluation.caseId || '').toLowerCase();
  let targetNumero: 1 | 2 = evaluation.problemNumber || 1;
  if (!evaluation.problemNumber) {
    if (
      caseIdLower.includes('_s2') ||
      caseIdLower.includes('_p2') ||
      caseIdLower.includes('caso_2') ||
      caseIdLower.includes('caso2') ||
      caseIdLower.includes('case2') ||
      caseIdLower.includes('c2') ||
      caseIdLower.includes('problema2') ||
      caseIdLower.includes('problema_2') ||
      caseIdLower.includes('p2') ||
      caseIdLower.endsWith('2')
    ) {
      targetNumero = 2;
    }
  }

  let resolvedCaseId: string | null = isValidUuid(evaluation.caseId) ? evaluation.caseId : null;
  let validTurmaId = isValidUuid(evaluation.classId) ? evaluation.classId : null;
  let validMesaId = isValidUuid(evaluation.groupId) ? evaluation.groupId : null;

  // If resolvedCaseId is a UUID, check its actual problem number in DB
  if (resolvedCaseId) {
    try {
      const { data: caseRow } = await client
        .from('casos_apg')
        .select('id, numero')
        .eq('id', resolvedCaseId)
        .maybeSingle();
      if (caseRow?.numero) {
        targetNumero = Number(caseRow.numero) === 2 ? 2 : 1;
      }
    } catch {
      // Ignore
    }
  }

  // If mesa or turma is missing or not a UUID, check student allocation in DB
  if ((!validTurmaId || !validMesaId) && evaluation.studentId) {
    try {
      const targetUnit = Number(evaluation.unit) || (Number(evaluation.week) > 8 ? 2 : 1);
      const { data: allocRow } = await client
        .from('alocacoes_mesa')
        .select('turma_id, mesa_id')
        .eq('aluno_id', evaluation.studentId)
        .eq('unidade', targetUnit)
        .maybeSingle();
      if (allocRow) {
        if (!validTurmaId && allocRow.turma_id && isValidUuid(allocRow.turma_id)) {
          validTurmaId = allocRow.turma_id;
        }
        if (!validMesaId && allocRow.mesa_id && isValidUuid(allocRow.mesa_id)) {
          validMesaId = allocRow.mesa_id;
        }
      }
    } catch {
      // Ignore allocation lookup failure
    }
  }

  // Resolve case in casos_apg to guarantee a persistent database UUID matching (week, targetNumero)
  if (!resolvedCaseId && evaluation.week) {
    try {
      const { data: matchedCases } = await client
        .from('casos_apg')
        .select('id, numero, semana, soi_id')
        .eq('semana', Number(evaluation.week))
        .eq('numero', targetNumero);

      if (matchedCases && matchedCases.length > 0) {
        resolvedCaseId = matchedCases[0].id;
      } else {
        // If not found in DB, find active SOI and create the case row
        const { data: soiRows } = await client.from('sois').select('id').eq('ativo', true).limit(1);
        const soiId = soiRows?.[0]?.id;
        if (soiId && isValidUuid(soiId)) {
          const template = initialAPGCases.find(
            (c) => c.week === Number(evaluation.week) && (c.problemNumber || c.caseNumber || 1) === targetNumero
          );
          const { data: newCase } = await client
            .from('casos_apg')
            .insert({
              soi_id: soiId,
              numero: targetNumero,
              semana: Number(evaluation.week),
              titulo: template?.title || `Problema ${targetNumero} - Semana ${evaluation.week}`,
              tema: template?.theme || 'Tutoria APG',
              descricao: template?.description || null,
              objetivos: template?.learningObjectives || [],
              instrucoes_tutor: template?.teacherInstructions || null,
              data: evaluation.date || template?.date || null,
              status: 'realizado',
            })
            .select('id')
            .single();

          if (newCase?.id && isValidUuid(newCase.id)) {
            resolvedCaseId = newCase.id;
          }
        }
      }
    } catch {
      // Case resolve fallback
    }
  }

  const currentProblemData = {
    problemNumber: targetNumero,
    criterionScores: evaluation.criterionScores || {},
    checkedCriteria: evaluation.checkedCriteria || {},
    adjustmentScore: evaluation.adjustmentScore ?? 0,
    adjustmentReason: evaluation.adjustmentReason || null,
    totalGrossScore: evaluation.totalGrossScore ?? 0,
    attendance: evaluation.attendance || 'Presente',
    role: evaluation.role || 'Membro',
    status: evaluation.status || 'Concluído',
    teacherNotes: evaluation.teacherNotes || null,
    pedagogicalFeedback: evaluation.pedagogicalFeedback || null,
    caseId: resolvedCaseId || evaluation.caseId || '',
    date: evaluation.date || null,
  };

  const payload: any = {
    aluno_id: evaluation.studentId,
    semana: Number(evaluation.week) || 1,
    unidade: Number(evaluation.unit) || (Number(evaluation.week) > 8 ? 2 : 1),
    numero_problema: targetNumero,
    presenca: evaluation.attendance || 'Presente',
    papel_sessao: evaluation.role || 'Membro',
    abertura: evaluation.criterionScores?.crit_1 ?? 0,
    postura: evaluation.criterionScores?.crit_2 ?? 0,
    desempenho: evaluation.criterionScores?.crit_3 ?? 0,
    fechamento: evaluation.criterionScores?.crit_4 ?? 0,
    pontuacoes_criterios: {
      ...(evaluation.criterionScores || {}),
      adjustmentScore: evaluation.adjustmentScore ?? 0,
      adjustmentReason: evaluation.adjustmentReason || '',
      problemNumber: targetNumero,
      checkedCriteria: evaluation.checkedCriteria || {},
      [`problem_${targetNumero}`]: currentProblemData,
    },
    nota_bruta: evaluation.totalGrossScore ?? 0,
    tags: Array.isArray(evaluation.performanceTags) ? evaluation.performanceTags : [],
    observacao_professor: evaluation.teacherNotes || null,
    parecer_ia: evaluation.pedagogicalFeedback || null,
    status: evaluation.status || 'Concluído',
    segunda_chamada_necessaria: Boolean(evaluation.makeupRequired),
    segunda_chamada_concluida: Boolean(evaluation.makeupCompleted),
    data_falta_original: evaluation.originalAbsenceDate || null,
    data_segunda_chamada: evaluation.makeupDate || null,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    payload.professor_id = userId;
  }
  if (resolvedCaseId) {
    payload.caso_id = resolvedCaseId;
  }
  if (validTurmaId) {
    payload.turma_id = validTurmaId;
  }
  if (validMesaId) {
    payload.mesa_id = validMesaId;
  }

  // Helper to safely execute database operations and auto-strip missing columns on PGRST204 errors
  const executeWithSchemaHealing = async (
    operation: (currentPayload: any) => PromiseLike<{ data: any; error: any }>,
    initialPayload: any
  ): Promise<{ data: any; error: any }> => {
    let currentPayload = { ...initialPayload };
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await operation(currentPayload);
      if (!res.error) {
        return res;
      }
      // Check for missing column error (PGRST204)
      if (res.error.code === 'PGRST204' || res.error.message?.includes('Could not find the')) {
        const colMatch = res.error.message.match(/Could not find the '([^']+)' column/i);
        if (colMatch && colMatch[1] && colMatch[1] in currentPayload) {
          delete currentPayload[colMatch[1]];
          continue;
        }
      }
      return res;
    }
    return await operation(currentPayload);
  };

  try {
    // 1. Try to find if an evaluation row already exists for this student, week and problem number
    let existingId: string | null = null;
    let existingRowData: any = null;

    if (isValidUuid(evaluation.id)) {
      const { data: byId } = await client
        .from('avaliacoes')
        .select('*')
        .eq('id', evaluation.id)
        .maybeSingle();
      if (byId?.id) {
        existingId = byId.id;
        existingRowData = byId;
      }
    }

    if (!existingId && resolvedCaseId) {
      const { data: byCase } = await client
        .from('avaliacoes')
        .select('*')
        .eq('aluno_id', evaluation.studentId)
        .eq('caso_id', resolvedCaseId)
        .maybeSingle();
      if (byCase?.id) {
        existingId = byCase.id;
        existingRowData = byCase;
      }
    }

    if (!existingId) {
      const { data: byWeekProbList } = await client
        .from('avaliacoes')
        .select('*')
        .eq('aluno_id', evaluation.studentId)
        .eq('semana', payload.semana);

      if (byWeekProbList && byWeekProbList.length > 0) {
        for (const row of byWeekProbList) {
          const rowProbNum =
            row.numero_problema ||
            row.pontuacoes_criterios?.problemNumber ||
            (row.caso_id && resolvedCaseId && row.caso_id === resolvedCaseId ? targetNumero : null);
          if (rowProbNum === targetNumero) {
            existingId = row.id;
            existingRowData = row;
            break;
          }
        }
        if (!existingId && byWeekProbList.length > 0) {
          // Retain for potential dual-problem JSON merge fallback
          existingRowData = byWeekProbList[0];
        }
      }
    }

    // 2. If existing row for this exact problem was found, UPDATE it
    if (existingId) {
      const { data: updatedData, error: updateError } = await executeWithSchemaHealing(
        (p) => client.from('avaliacoes').update(p).eq('id', existingId!).select('id').single(),
        payload
      );

      if (!updateError && updatedData?.id) {
        return {
          success: true,
          data: {
            ...evaluation,
            id: updatedData.id,
            problemNumber: targetNumero,
            caseId: resolvedCaseId || evaluation.caseId || '',
          },
        };
      }

      // Retry update without columns that might trigger errors (mesa_id)
      const safePayload = { ...payload };
      delete safePayload.mesa_id;
      const { data: retryData, error: retryError } = await executeWithSchemaHealing(
        (p) => client.from('avaliacoes').update(p).eq('id', existingId!).select('id').single(),
        safePayload
      );

      if (!retryError && retryData?.id) {
        return {
          success: true,
          data: {
            ...evaluation,
            id: retryData.id,
            problemNumber: targetNumero,
            caseId: resolvedCaseId || evaluation.caseId || '',
          },
        };
      }
    }

    // 3. Try standard INSERT for new problem row
    const { data: insertData, error: insertError } = await executeWithSchemaHealing(
      (p) => client.from('avaliacoes').insert(p).select('id').single(),
      payload
    );

    if (!insertError && insertData?.id) {
      return {
        success: true,
        data: {
          ...evaluation,
          id: insertData.id,
          problemNumber: targetNumero,
          caseId: resolvedCaseId || evaluation.caseId || '',
        },
      };
    }

    // 4. If insert failed (e.g. unique constraint on aluno_id + semana or trigger error)
    if (insertError) {
      // 4a. Try insert without mesa_id
      const noMesaPayload = { ...payload };
      delete noMesaPayload.mesa_id;
      const { data: retryNoMesa, error: retryNoMesaErr } = await executeWithSchemaHealing(
        (p) => client.from('avaliacoes').insert(p).select('id').single(),
        noMesaPayload
      );

      if (!retryNoMesaErr && retryNoMesa?.id) {
        return {
          success: true,
          data: {
            ...evaluation,
            id: retryNoMesa.id,
            problemNumber: targetNumero,
            caseId: resolvedCaseId || evaluation.caseId || '',
          },
        };
      }

      // 4b. If database has constraint (aluno_id, semana) that only permits 1 row per week:
      // Merge this problem's data into the existing week row's pontuacoes_criterios JSONB
      if (existingRowData?.id) {
        const oldCriteria = existingRowData.pontuacoes_criterios || {};
        const mergedCriteria = {
          ...oldCriteria,
          [`problem_${targetNumero}`]: currentProblemData,
        };

        const mergePayload: any = {
          pontuacoes_criterios: mergedCriteria,
          updated_at: new Date().toISOString(),
        };

        // If this is Problem 1, also update top-level columns on the legacy row
        if (targetNumero === 1) {
          mergePayload.presenca = payload.presenca;
          mergePayload.papel_sessao = payload.papel_sessao;
          mergePayload.abertura = payload.abertura;
          mergePayload.postura = payload.postura;
          mergePayload.desempenho = payload.desempenho;
          mergePayload.fechamento = payload.fechamento;
          mergePayload.nota_bruta = payload.nota_bruta;
          mergePayload.tags = payload.tags;
          mergePayload.status = payload.status;
        }

        const { data: mergeData, error: mergeErr } = await executeWithSchemaHealing(
          (p) => client.from('avaliacoes').update(p).eq('id', existingRowData.id).select('id').single(),
          mergePayload
        );

        if (!mergeErr && mergeData?.id) {
          return {
            success: true,
            data: {
              ...evaluation,
              id: `${mergeData.id}_p${targetNumero}`,
              problemNumber: targetNumero,
              caseId: resolvedCaseId || evaluation.caseId || '',
            },
          };
        }
      }

      // 4c. Try UPSERT with onConflict if constraint exists
      const { data: upsertData, error: upsertErr } = await executeWithSchemaHealing(
        (p) => client.from('avaliacoes').upsert(p, { onConflict: 'aluno_id,semana,numero_problema' }).select('id').single(),
        noMesaPayload
      );

      if (!upsertErr && upsertData?.id) {
        return {
          success: true,
          data: {
            ...evaluation,
            id: upsertData.id,
            problemNumber: targetNumero,
            caseId: resolvedCaseId || evaluation.caseId || '',
          },
        };
      }

      console.error('[Supabase Save Evaluation Error Details]', { insertError, retryNoMesaErr, upsertErr });
      return { success: false, error: friendlyError(insertError || upsertErr, 'Erro ao salvar avaliação no banco de dados.') };
    }

    return { success: true, data: { ...evaluation, problemNumber: targetNumero } };
  } catch (error: any) {
    console.error('[Supabase Save Evaluation Exception]', error);
    return { success: false, error: friendlyError(error, 'Erro inesperado ao salvar avaliação.') };
  }
}

export async function deleteEvaluationInSupabase(
  client: SupabaseClient,
  studentId: string,
  unit: number,
  week: number,
  caseId?: string
): Promise<ServiceResult<boolean>> {
  if (!isValidUuid(studentId)) {
    return { success: true, data: true };
  }

  try {
    let resolvedCaseId = (caseId && isValidUuid(caseId)) ? caseId : null;
    if (!resolvedCaseId && caseId && week) {
      const caseIdLower = caseId.toLowerCase();
      const isCase2 =
        caseIdLower.includes('_s2') ||
        caseIdLower.includes('_p2') ||
        caseIdLower.includes('caso_2') ||
        caseIdLower.includes('caso2') ||
        caseIdLower.includes('case2') ||
        caseIdLower.includes('c2') ||
        caseIdLower.includes('problema2');
      const targetNumero = isCase2 ? 2 : 1;

      const { data: matchedCase } = await client
        .from('casos_apg')
        .select('id')
        .eq('semana', week)
        .eq('numero', targetNumero)
        .maybeSingle();

      if (matchedCase?.id && isValidUuid(matchedCase.id)) {
        resolvedCaseId = matchedCase.id;
      }
    }

    let query = client.from('avaliacoes').delete().eq('aluno_id', studentId);
    if (resolvedCaseId) {
      query = query.eq('caso_id', resolvedCaseId);
    } else {
      query = query.eq('semana', week).eq('unidade', unit);
    }

    await query;
    return { success: true, data: true };
  } catch {
    return { success: true, data: true };
  }
}

export interface TableNotebook {
  id?: string;
  notes: string;
  contributions: Array<{ studentId: string; text: string }>;
}

async function resolveIdsForNotebook(
  client: SupabaseClient,
  classId: string,
  caseId: string,
  tableId: string,
  week?: number,
  problemNumber?: number
): Promise<{ classId: string | null; caseId: string | null; tableId: string | null }> {
  let resolvedClassId = isValidUuid(classId) ? classId : null;
  let resolvedCaseId = isValidUuid(caseId) ? caseId : null;
  let resolvedTableId = isValidUuid(tableId) ? tableId : null;

  try {
    // 1. Resolve Class
    if (!resolvedClassId) {
      const { data: firstClass } = await client.from('turmas').select('id').limit(1).maybeSingle();
      if (firstClass?.id) resolvedClassId = firstClass.id;
    }

    // 2. Resolve Table (Mesa)
    if (!resolvedTableId && resolvedClassId) {
      const tableIdLower = (tableId || '').toLowerCase();
      let tableNumber = 1;
      if (
        tableIdLower.includes('mesa 2') ||
        tableIdLower.includes('grp_m2') ||
        tableIdLower.includes('_m2') ||
        tableIdLower.includes('mesa_2') ||
        tableIdLower.includes('mesa2')
      ) {
        tableNumber = 2;
      } else if (
        tableIdLower.includes('mesa 3') ||
        tableIdLower.includes('grp_m3') ||
        tableIdLower.includes('_m3') ||
        tableIdLower.includes('mesa_3') ||
        tableIdLower.includes('mesa3')
      ) {
        tableNumber = 3;
      }

      const { data: matchedMesas } = await client
        .from('mesas')
        .select('id, numero, nome')
        .eq('turma_id', resolvedClassId);

      if (matchedMesas && matchedMesas.length > 0) {
        const found = matchedMesas.find(
          (m: any) => m.numero === tableNumber || (m.nome && m.nome.toLowerCase().includes(`mesa ${tableNumber}`))
        );
        resolvedTableId = found?.id || matchedMesas[0].id;
      }
    }

    // 3. Resolve Case (Caso APG) - MUST BE EXACT (semana, numero) so Case 1 never collides with Case 2
    if (!resolvedCaseId) {
      const caseIdLower = (caseId || '').toLowerCase();
      const isCase2 =
        problemNumber === 2 ||
        caseIdLower.includes('_s2') ||
        caseIdLower.includes('_p2') ||
        caseIdLower.includes('caso_2') ||
        caseIdLower.includes('caso2') ||
        caseIdLower.includes('case2') ||
        caseIdLower.includes('c2') ||
        caseIdLower.includes('problema2') ||
        caseIdLower.includes('p2');
      const targetNumero = isCase2 ? 2 : 1;

      let targetWeek = week;
      if (!targetWeek && caseIdLower.includes('case_w')) {
        const match = caseIdLower.match(/case_w(\d+)/);
        if (match) targetWeek = parseInt(match[1], 10);
      }

      let query = client.from('casos_apg').select('id, numero, semana');
      if (targetWeek) {
        query = query.eq('semana', targetWeek);
      }
      query = query.eq('numero', targetNumero);

      const { data: matchedCases } = await query;
      if (matchedCases && matchedCases.length > 0) {
        resolvedCaseId = matchedCases[0].id;
      } else if (targetWeek) {
        // If not in DB, create it with correct week and number
        const { data: soiRows } = await client.from('sois').select('id').eq('ativo', true).limit(1);
        const soiId = soiRows?.[0]?.id;
        if (soiId && isValidUuid(soiId)) {
          const template = initialAPGCases.find(
            (c) => c.week === targetWeek && (c.problemNumber || c.caseNumber || 1) === targetNumero
          );
          const { data: newCase } = await client
            .from('casos_apg')
            .insert({
              soi_id: soiId,
              numero: targetNumero,
              semana: targetWeek,
              titulo: template?.title || `Problema ${targetNumero} - Semana ${targetWeek}`,
              tema: template?.theme || 'Tutoria APG',
              descricao: template?.description || null,
              objetivos: template?.learningObjectives || [],
              instrucoes_tutor: template?.teacherInstructions || null,
              data: template?.date || null,
              status: 'realizado',
            })
            .select('id')
            .single();

          if (newCase?.id && isValidUuid(newCase.id)) {
            resolvedCaseId = newCase.id;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error resolving IDs for notebook:', err);
  }

  return { classId: resolvedClassId, caseId: resolvedCaseId, tableId: resolvedTableId };
}

export async function loadTableNotebook(
  client: SupabaseClient,
  classId: string,
  caseId: string,
  tableId: string,
  week?: number,
  problemNumber?: number
): Promise<ServiceResult<TableNotebook>> {
  const { classId: resolvedClassId, caseId: resolvedCaseId, tableId: resolvedTableId } = await resolveIdsForNotebook(
    client,
    classId,
    caseId,
    tableId,
    week,
    problemNumber
  );

  if (!resolvedClassId || !resolvedCaseId || !resolvedTableId) {
    return { success: true, data: { notes: '', contributions: [] } };
  }

  const { data, error } = await client
    .from('anotacoes_mesa')
    .select('id, observacoes, contribuicoes')
    .eq('turma_id', resolvedClassId)
    .eq('caso_id', resolvedCaseId)
    .eq('mesa_id', resolvedTableId)
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
  notebook: TableNotebook,
  week?: number,
  problemNumber?: number
): Promise<ServiceResult<TableNotebook>> {
  const { classId: resolvedClassId, caseId: resolvedCaseId, tableId: resolvedTableId } = await resolveIdsForNotebook(
    client,
    classId,
    caseId,
    tableId,
    week,
    problemNumber
  );

  if (!resolvedClassId || !resolvedCaseId || !resolvedTableId) {
    return { success: true, data: notebook };
  }

  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return { success: true, data: notebook };

  const payload: any = {
    turma_id: resolvedClassId,
    caso_id: resolvedCaseId,
    mesa_id: resolvedTableId,
    professor_id: authData.user.id,
    observacoes: notebook.notes,
    contribuicoes: notebook.contributions,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('anotacoes_mesa')
    .upsert(payload, { onConflict: 'turma_id,caso_id,mesa_id' })
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
