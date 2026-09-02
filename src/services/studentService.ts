import { SupabaseClient } from '@supabase/supabase-js';
import { Student } from '../types';

export interface StudentLinkedCounts {
  avaliacoesCount: number;
  alocacoesCount: number;
  historicoCount: number;
  contribuicoesCount: number;
  totalAcademicRecords: number;
  canDeleteDefinitely: boolean;
}

export interface StudentEditPayload {
  name: string;
  enrollment: string;
  semestreCurso?: string;
  classId?: string;
  ativo: boolean;
}

export interface CreateStudentPayload {
  name: string;
  enrollment: string;
  semestreCurso?: string;
  classId: string;
  unit1GroupId: string;
  unit2GroupId: string;
}

/**
 * Valida se a string fornecida é um UUID no padrão RFC 4122 v1-v5.
 */
export function isValidUuid(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
  Valida os dados para edição do estudante.
 */
export function validateStudentEditData(params: {
  name: string;
  enrollment: string;
  classId?: string;
  studentId: string;
  existingStudents: Student[];
}): { valid: boolean; error?: string } {
  const nameTrim = params.name.trim();
  const enrollmentTrim = params.enrollment.trim();

  if (!nameTrim) {
    return { valid: false, error: 'O nome completo do estudante é obrigatório.' };
  }

  if (!enrollmentTrim) {
    return { valid: false, error: 'A matrícula do estudante é obrigatória.' };
  }

  // Verificar matrícula duplicada (excluindo o próprio estudante)
  const isDuplicate = params.existingStudents.some(
    (s) =>
      s.id !== params.studentId &&
      s.enrollment.trim().toLowerCase() === enrollmentTrim.toLowerCase()
  );

  if (isDuplicate) {
    return {
      valid: false,
      error: 'Já existe um estudante com esta matrícula cadastrada no sistema.',
    };
  }

  return { valid: true };
}

/**
 * Valida no Supabase se as duas mesas pertencem à turma selecionada.
 */
export async function validateTablesBelongToClass(
  client: SupabaseClient | null,
  classId: string,
  unit1MesaId: string,
  unit2MesaId: string
): Promise<{ valid: boolean; error?: string }> {
  if (!classId || !unit1MesaId || !unit2MesaId) {
    return {
      valid: false,
      error: 'É necessário selecionar a turma, a mesa da 1ª unidade e a mesa da 2ª unidade.',
    };
  }

  if (!client) {
    return { valid: true };
  }

  try {
    const { data: mesas, error } = await client
      .from('mesas')
      .select('id, turma_id')
      .in('id', [unit1MesaId, unit2MesaId]);

    if (error) {
      return {
        valid: false,
        error: 'Não foi possível validar as mesas selecionadas no banco de dados.',
      };
    }

    if (!mesas || mesas.length !== new Set([unit1MesaId, unit2MesaId]).size) {
      return {
        valid: false,
        error: 'Uma das mesas selecionadas não existe no banco de dados.',
      };
    }

    const invalidMesa = mesas.find((m) => m.turma_id !== classId);
    if (invalidMesa) {
      return {
        valid: false,
        error: 'As mesas selecionadas não pertencem à mesma turma.',
      };
    }

    return { valid: true };
  } catch (_err) {
    return {
      valid: false,
      error: 'Não foi possível validar as mesas selecionadas no banco de dados.',
    };
  }
}

/**
 * Cria um novo estudante no Supabase na tabela `public.alunos`.
 * Omite o campo `id` para que o Supabase gere o UUID nativamente.
 * Cria dinamicamente as duas alocações (U1 e U2) em public.alocacoes_mesa.
 */
export async function createStudentInSupabase(
  client: SupabaseClient | null,
  payload: CreateStudentPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!client) {
    return { success: false, error: 'Cliente de banco de dados não disponível.' };
  }

  const nameTrim = payload.name.trim();
  const enrollmentTrim = payload.enrollment.trim();

  if (!nameTrim) {
    return { success: false, error: 'O nome do estudante é obrigatório.' };
  }
  if (!enrollmentTrim) {
    return { success: false, error: 'A matrícula do estudante é obrigatória.' };
  }
  if (!payload.classId) {
    return { success: false, error: 'Selecione uma turma para o estudante.' };
  }
  if (!payload.unit1GroupId) {
    return { success: false, error: 'Selecione a mesa da 1ª Unidade.' };
  }
  if (!payload.unit2GroupId) {
    return { success: false, error: 'Selecione a mesa da 2ª Unidade.' };
  }

  // 1. Validação de segurança: Confirmar se mesas pertencem à turma selecionada
  const tableCheck = await validateTablesBelongToClass(
    client,
    payload.classId,
    payload.unit1GroupId,
    payload.unit2GroupId
  );
  if (!tableCheck.valid) {
    return { success: false, error: tableCheck.error || 'As mesas selecionadas não pertencem à mesma turma.' };
  }

  try {
    let targetAlunoId: string | null = null;

    // Verificar se o aluno já foi inserido em uma tentativa anterior incompleta
    const { data: existingStudent } = await client
      .from('alunos')
      .select('id, nome, matricula')
      .eq('matricula', enrollmentTrim)
      .maybeSingle();

    if (existingStudent && existingStudent.id) {
      targetAlunoId = existingStudent.id;
      // Atualizar dados do aluno existente
      await client
        .from('alunos')
        .update({
          nome: nameTrim,
          semestre_curso: payload.semestreCurso || null,
          ativo: true,
        })
        .eq('id', targetAlunoId);
    } else {
      // Inserção em public.alunos omitindo 'id', sem enviar 'turma_id' nem 'email'
      const { data: novoAluno, error: alunoError } = await client
        .from('alunos')
        .insert({
          nome: nameTrim,
          matricula: enrollmentTrim,
          semestre_curso: payload.semestreCurso || null,
          ativo: true,
        })
        .select()
        .single();

      if (alunoError || !novoAluno) {
        console.error('[Supabase Create Student Error]', alunoError);

        const code = alunoError?.code || '';
        const msg = (alunoError?.message || '').toLowerCase();

        if (code === '23505' || msg.includes('unique') || msg.includes('matricula')) {
          return {
            success: false,
            error: 'Já existe um estudante cadastrado com esta matrícula.',
          };
        }

        if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
          return {
            success: false,
            error: 'Você não possui autorização para cadastrar estudantes.',
          };
        }

        return {
          success: false,
          error: alunoError?.message || 'Erro ao cadastrar estudante no banco de dados.',
        };
      }

      if (!novoAluno.id || !isValidUuid(novoAluno.id)) {
        return {
          success: false,
          error: 'Identificador gerado pelo banco de dados é inválido.',
        };
      }

      targetAlunoId = novoAluno.id;
    }

    // 2. Criar obrigatoriamente as duas alocações (U1 e U2) usando o novoAluno.id
    const allocRes = await saveStudentTableAllocationsInSupabase(
      client,
      targetAlunoId,
      payload.classId,
      payload.unit1GroupId,
      payload.unit2GroupId
    );

    if (!allocRes.success) {
      return {
        success: false,
        error: `O estudante foi criado em public.alunos, mas a alocação de mesa falhou (${allocRes.error}).`,
      };
    }

    return { success: true, data: { id: targetAlunoId } };
  } catch (err: any) {
    console.error('[Supabase Create Student Exception]', err);
    return {
      success: false,
      error: 'Não foi possível comunicar-se com o banco de dados.',
    };
  }
}

/**
 * Consulta a quantidade de registros vinculados ao aluno no Supabase.
 */
export async function fetchStudentLinkedCounts(
  client: SupabaseClient | null,
  studentId: string,
  localEvalsCount = 0
): Promise<StudentLinkedCounts> {
  let avaliacoesCount = localEvalsCount;
  let alocacoesCount = 0;
  let historicoCount = 0;
  let contribuicoesCount = 0;

  if (!client || !isValidUuid(studentId)) {
    const total = localEvalsCount;
    return {
      avaliacoesCount: localEvalsCount,
      alocacoesCount: 0,
      historicoCount: 0,
      contribuicoesCount: 0,
      totalAcademicRecords: total,
      canDeleteDefinitely: total === 0,
    };
  }

  // 1. Avaliações
  try {
    const { count, error } = await client
      .from('avaliacoes')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', studentId);
    if (!error && count !== null) avaliacoesCount = count;
  } catch {
    // Gracefully fallback to local count
  }

  // 2. Alocações de mesa
  try {
    const { count, error } = await client
      .from('alocacoes_mesa')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', studentId);
    if (!error && count !== null) alocacoesCount = count;
  } catch {
    // Gracefully fallback to 0
  }

  // 3. Histórico de alocações
  try {
    const { count, error } = await client
      .from('historico_alocacoes_mesa')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', studentId);
    if (!error && count !== null) historicoCount = count;
  } catch {
    // Gracefully fallback to 0
  }

  // 4. Contribuições
  try {
    const { count, error } = await client
      .from('contribuicao_estudantes')
      .select('*', { count: 'exact', head: true })
      .eq('aluno_id', studentId);
    if (!error && count !== null) contribuicoesCount = count;
  } catch {
    // Gracefully fallback to 0
  }

  const totalAcademicRecords = avaliacoesCount + alocacoesCount + historicoCount + contribuicoesCount;
  const canDeleteDefinitely = totalAcademicRecords === 0;

  return {
    avaliacoesCount,
    alocacoesCount,
    historicoCount,
    contribuicoesCount,
    totalAcademicRecords,
    canDeleteDefinitely,
  };
}

/**
 * Atualiza os dados cadastrais do aluno em public.alunos no Supabase.
 * IMPORTANTE: NUNCA envia `turma_id` para public.alunos.
 */
export async function updateStudentInSupabase(
  client: SupabaseClient | null,
  studentId: string,
  payload: StudentEditPayload
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!client) {
    return { success: true };
  }

  if (studentId.startsWith('std_') || !isValidUuid(studentId)) {
    return {
      success: false,
      error: 'Este estudante pertence a dados locais antigos e não está cadastrado no banco. Atualize os dados do sistema e cadastre o estudante novamente.',
    };
  }

  try {
    // Atualização estrita somente de colunas reais de public.alunos (NUNCA envia email ou turma_id)
    const { data, error } = await client
      .from('alunos')
      .update({
        nome: payload.name.trim(),
        matricula: payload.enrollment.trim(),
        semestre_curso: payload.semestreCurso || null,
        ativo: payload.ativo,
      })
      .eq('id', studentId)
      .select()
      .single();

    if (error) {
      console.error('[Supabase Update Student Error]', error);

      const code = error.code || '';
      const msg = (error.message || '').toLowerCase();

      if (code === '22P02' || msg.includes('invalid input syntax for type uuid')) {
        return {
          success: false,
          error: 'O identificador do estudante é inválido. Recarregue os dados do Supabase.',
        };
      }

      if (code === '23505' || msg.includes('unique') || msg.includes('matricula')) {
        return {
          success: false,
          error: 'Já existe um estudante cadastrado com esta matrícula.',
        };
      }

      if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
        return {
          success: false,
          error: 'Você não possui autorização para alterar este estudante.',
        };
      }

      if (msg.includes('fetch failed') || msg.includes('network')) {
        return {
          success: false,
          error: 'Não foi possível comunicar-se com o banco de dados.',
        };
      }

      return {
        success: false,
        error: error.message || 'Erro ao atualizar dados do estudante no banco de dados.',
      };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[Supabase Update Student Exception]', err);
    return {
      success: false,
      error: 'Não foi possível comunicar-se com o banco de dados.',
    };
  }
}

/**
 * Consulta as alocações existentes do aluno em public.alocacoes_mesa.
 */
export async function fetchStudentAllocationsInSupabase(
  client: SupabaseClient | null,
  studentId: string
) {
  if (!client || !isValidUuid(studentId)) {
    return { data: [], error: null };
  }

  const { data: existentes, error: buscaError } = await client
    .from('alocacoes_mesa')
    .select(`
      id,
      aluno_id,
      turma_id,
      mesa_id,
      unidade,
      data_inicio,
      data_fim,
      alterado_por,
      created_at,
      updated_at
    `)
    .eq('aluno_id', studentId)
    .order('unidade');

  return { data: existentes, error: buscaError };
}

/**
 * Salva as alocações da 1ª e 2ª unidades para um estudante no Supabase.
 * Valida a autenticação do usuário, o pertencimento das mesas à turma e os UUIDs.
 * NUNCA envia atualizado_em, criado_em, ou datas fictícias em data_inicio/data_fim.
 */
export async function saveStudentTableAllocationsInSupabase(
  client: SupabaseClient | null,
  studentId: string,
  classId: string,
  unit1MesaId: string,
  unit2MesaId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!client) {
    return { success: true };
  }

  // 1. Validar UUIDs obrigatórios
  if (!isValidUuid(studentId)) {
    return {
      success: false,
      error: 'O identificador do estudante é inválido para gravação no banco de dados.',
    };
  }
  if (!isValidUuid(classId)) {
    return {
      success: false,
      error: 'A turma selecionada é inválida ou não está cadastrada no banco de dados.',
    };
  }
  if (!isValidUuid(unit1MesaId)) {
    return {
      success: false,
      error: 'A mesa selecionada para a 1ª Unidade é inválida.',
    };
  }
  if (!isValidUuid(unit2MesaId)) {
    return {
      success: false,
      error: 'A mesa selecionada para a 2ª Unidade é inválida.',
    };
  }

  // 2. Validar que ambas as mesas pertencem à turma selecionada
  const tableCheck = await validateTablesBelongToClass(client, classId, unit1MesaId, unit2MesaId);
  if (!tableCheck.valid) {
    return {
      success: false,
      error: tableCheck.error || 'As mesas selecionadas não pertencem à mesma turma.',
    };
  }

  // 3. Validar usuário autenticado
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: 'Usuário não autenticado no sistema. Operação bloqueada.',
    };
  }

  try {
    // 4. Salvar Unidade 1
    const { data: existenteU1 } = await client
      .from('alocacoes_mesa')
      .select('id, aluno_id, turma_id, mesa_id, unidade')
      .eq('aluno_id', studentId)
      .eq('unidade', 1)
      .maybeSingle();

    let alocacaoU1: any = null;
    let erroU1: any = null;

    if (existenteU1 && existenteU1.id) {
      const resU1 = await client
        .from('alocacoes_mesa')
        .update({
          turma_id: classId,
          mesa_id: unit1MesaId,
          alterado_por: user.id,
        })
        .eq('id', existenteU1.id)
        .select('id, aluno_id, turma_id, mesa_id, unidade')
        .single();
      alocacaoU1 = resU1.data;
      erroU1 = resU1.error;
    } else {
      const resU1 = await client
        .from('alocacoes_mesa')
        .insert({
          aluno_id: studentId,
          turma_id: classId,
          mesa_id: unit1MesaId,
          unidade: 1,
          alterado_por: user.id,
        })
        .select('id, aluno_id, turma_id, mesa_id, unidade')
        .single();
      alocacaoU1 = resU1.data;
      erroU1 = resU1.error;
    }

    if (erroU1) {
      console.error('[Supabase Allocation U1 Error]', erroU1);
      return {
        success: false,
        error: `Falha ao salvar a alocação da 1ª Unidade: ${erroU1.message || 'Erro no banco de dados.'}`,
      };
    }

    // 5. Salvar Unidade 2
    const { data: existenteU2 } = await client
      .from('alocacoes_mesa')
      .select('id, aluno_id, turma_id, mesa_id, unidade')
      .eq('aluno_id', studentId)
      .eq('unidade', 2)
      .maybeSingle();

    let alocacaoU2: any = null;
    let erroU2: any = null;

    if (existenteU2 && existenteU2.id) {
      const resU2 = await client
        .from('alocacoes_mesa')
        .update({
          turma_id: classId,
          mesa_id: unit2MesaId,
          alterado_por: user.id,
        })
        .eq('id', existenteU2.id)
        .select('id, aluno_id, turma_id, mesa_id, unidade')
        .single();
      alocacaoU2 = resU2.data;
      erroU2 = resU2.error;
    } else {
      const resU2 = await client
        .from('alocacoes_mesa')
        .insert({
          aluno_id: studentId,
          turma_id: classId,
          mesa_id: unit2MesaId,
          unidade: 2,
          alterado_por: user.id,
        })
        .select('id, aluno_id, turma_id, mesa_id, unidade')
        .single();
      alocacaoU2 = resU2.data;
      erroU2 = resU2.error;
    }

    if (erroU2) {
      console.error('[Supabase Allocation U2 Error]', erroU2);
      return {
        success: false,
        error: `A alocação da 1ª Unidade foi salva, mas ocorreu falha na 2ª Unidade: ${erroU2.message || 'Erro no banco de dados.'}`,
      };
    }

    if (!alocacaoU1 || !alocacaoU2) {
      return {
        success: false,
        error: 'Não foi possível confirmar a gravação das alocações no banco de dados.',
      };
    }

    return {
      success: true,
      data: { alocacaoU1, alocacaoU2 },
    };
  } catch (err: any) {
    console.error('[Supabase Allocation Exception]', err);
    return {
      success: false,
      error: 'Não foi possível comunicar-se com o banco de dados.',
    };
  }
}

/**
 * Função de retrocompatibilidade para atualização individual de alocação de mesa.
 */
export async function updateStudentTableAllocationInSupabase(
  client: SupabaseClient | null,
  studentId: string,
  classId: string,
  unit: 1 | 2,
  mesaId: string
): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: true };
  }

  if (!isValidUuid(studentId) || !isValidUuid(classId) || !isValidUuid(mesaId)) {
    return {
      success: false,
      error: 'Parâmetros de alocação inválidos para gravação no banco de dados.',
    };
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'Sua sessão expirou. Entre novamente antes de salvar as mesas.' };
    }

    const { data: existente, error: lookupError } = await client
      .from('alocacoes_mesa')
      .select('id, aluno_id, turma_id, mesa_id, unidade')
      .eq('aluno_id', studentId)
      .eq('unidade', unit)
      .maybeSingle();
    if (lookupError) {
      return {
        success: false,
        error: `Não foi possível consultar a alocação atual: ${lookupError.message}`,
      };
    }

    if (existente && existente.id) {
      const { data: updated, error } = await client
        .from('alocacoes_mesa')
        .update({
          turma_id: classId,
          mesa_id: mesaId,
          alterado_por: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)
        .select('id, aluno_id, turma_id, mesa_id, unidade')
        .single();

      if (error) {
        console.error('[Supabase Single Allocation Update Error]', error);
        return { success: false, error: error.message };
      }
      if (!updated || updated.mesa_id !== mesaId || Number(updated.unidade) !== unit) {
        return { success: false, error: 'O banco não confirmou a atualização da mesa.' };
      }
    } else {
      const { data: inserted, error } = await client
        .from('alocacoes_mesa')
        .insert({
          aluno_id: studentId,
          turma_id: classId,
          mesa_id: mesaId,
          unidade: unit,
          alterado_por: user.id,
        })
        .select('id, aluno_id, turma_id, mesa_id, unidade')
        .single();

      if (error) {
        console.error('[Supabase Single Allocation Insert Error]', error);
        return { success: false, error: error.message };
      }
      if (!inserted || inserted.mesa_id !== mesaId || Number(inserted.unidade) !== unit) {
        return { success: false, error: 'O banco não confirmou a criação da alocação.' };
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Single Allocation Exception]', err);
    return { success: false, error: 'Erro de comunicação ao salvar alocação de mesa.' };
  }
}

/**
 * Desativa o estudante no Supabase (`ativo: false`).
 */
export async function deactivateStudentInSupabase(
  client: SupabaseClient | null,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: true };
  }

  if (studentId.startsWith('std_') || !isValidUuid(studentId)) {
    return {
      success: false,
      error: 'Este estudante pertence a dados locais antigos e não está cadastrado no banco. Atualize os dados do sistema e cadastre o estudante novamente.',
    };
  }

  try {
    const { error } = await client
      .from('alunos')
      .update({ ativo: false })
      .eq('id', studentId);

    if (error) {
      console.error('[Supabase Deactivate Student Error]', error);
      if (error.code === '22P02') {
        return { success: false, error: 'O identificador do estudante é inválido. Recarregue os dados do Supabase.' };
      }
      if (error.code === '42501' || error.message.includes('row-level security')) {
        return { success: false, error: 'Você não possui autorização para alterar este estudante.' };
      }
      return { success: false, error: error.message || 'Erro ao desativar estudante.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Deactivate Student Exception]', err);
    return { success: false, error: 'Não foi possível comunicar-se com o banco de dados.' };
  }
}

/**
 * Reativa o estudante no Supabase (`ativo: true`).
 */
export async function reactivateStudentInSupabase(
  client: SupabaseClient | null,
  studentId: string
): Promise<{ success: boolean; error?: string }> {
  if (!client) {
    return { success: true };
  }

  if (studentId.startsWith('std_') || !isValidUuid(studentId)) {
    return {
      success: false,
      error: 'Este estudante pertence a dados locais antigos e não está cadastrado no banco. Atualize os dados do sistema e cadastre o estudante novamente.',
    };
  }

  try {
    const { error } = await client
      .from('alunos')
      .update({ ativo: true })
      .eq('id', studentId);

    if (error) {
      console.error('[Supabase Reactivate Student Error]', error);
      if (error.code === '22P02') {
        return { success: false, error: 'O identificador do estudante é inválido. Recarregue os dados do Supabase.' };
      }
      if (error.code === '42501' || error.message.includes('row-level security')) {
        return { success: false, error: 'Você não possui autorização para alterar este estudante.' };
      }
      return { success: false, error: error.message || 'Erro ao reativar estudante.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Reactivate Student Exception]', err);
    return { success: false, error: 'Não foi possível comunicar-se com o banco de dados.' };
  }
}

/**
 * Realiza a exclusão definitiva do estudante no Supabase SOMENTE SE for um UUID válido e não houver registros acadêmicos.
 */
export async function deleteStudentInSupabase(
  client: SupabaseClient | null,
  studentId: string,
  localLinkedCount: number = 0
): Promise<{ success: boolean; error?: string }> {
  // Se o ID for legado std_ ou não for um UUID válido, aborta antes de chamar o Supabase
  if (studentId.startsWith('std_') || !isValidUuid(studentId)) {
    return {
      success: false,
      error: 'Este estudante pertence a dados locais antigos e não está cadastrado no banco. Atualize os dados do sistema e cadastre o estudante novamente.',
    };
  }

  if (!client) {
    if (localLinkedCount > 0) {
      return {
        success: false,
        error: 'Este estudante possui registros acadêmicos e não pode ser excluído definitivamente. Utilize a opção Desativar estudante.',
      };
    }
    return { success: true };
  }

  // Verificar contagem de registros no banco
  const counts = await fetchStudentLinkedCounts(client, studentId);
  const totalRecords = counts.totalAcademicRecords + localLinkedCount;

  if (totalRecords > 0) {
    return {
      success: false,
      error: 'Este estudante possui registros acadêmicos e não pode ser excluído definitivamente. Utilize a opção Desativar estudante.',
    };
  }

  try {
    const { data, error } = await client
      .from('alunos')
      .delete()
      .eq('id', studentId)
      .select('id');

    if (error) {
      console.error('[Supabase Delete Student Error]', error);

      const code = error.code || '';
      const msg = (error.message || '').toLowerCase();
      const details = (error.details || '').toLowerCase();

      if (code === '22P02' || msg.includes('invalid input syntax for type uuid')) {
        return {
          success: false,
          error: 'O identificador do estudante é inválido. Recarregue os dados do Supabase.',
        };
      }

      if (
        code === '23503' ||
        msg.includes('foreign key constraint') ||
        details.includes('foreign key constraint') ||
        msg.includes('violates foreign key')
      ) {
        return {
          success: false,
          error: 'O estudante possui registros acadêmicos vinculados e não pode ser excluído. Desative-o para preservar o histórico.',
        };
      }

      if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
        return {
          success: false,
          error: 'Você não possui autorização para alterar este estudante.',
        };
      }

      if (msg.includes('fetch failed') || msg.includes('network')) {
        return {
          success: false,
          error: 'Não foi possível comunicar-se com o banco de dados.',
        };
      }

      return {
        success: false,
        error: error.message || 'Erro ao excluir estudante do banco de dados.',
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'O estudante não foi encontrado no banco de dados.',
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Supabase Delete Student Exception]', err);
    return { success: false, error: 'Não foi possível comunicar-se com o banco de dados.' };
  }
}
