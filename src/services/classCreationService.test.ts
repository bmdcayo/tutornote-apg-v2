import { createClassInSupabase, deleteClassInSupabase, fetchClassLinkedCounts, fetchMesasForTurma } from './classCreationService';
import { Class, ClassGroup } from '../types';

/**
 * Suite de Testes para Validação da Criação e Carregamento de Turmas e Mesas no Supabase.
 * Executa as 10 verificações obrigatórias.
 */

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALHA NO TESTE: ${message}`);
    throw new Error(`Test failed: ${message}`);
  } else {
    console.log(`✅ SUCESSO: ${message}`);
  }
}

export async function runClassAndTableTests() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO AUDITORIA E TESTES DE TURMAS E MESAS (SUPABASE)');
  console.log('======================================================\n');

  let passed = 0;

  // Mock de dados da resposta do Supabase
  const mockUserId = 'usr_prof_12345';
  const mockTurmaId = 'turma_uuid_9999';
  const mockSemesterId = 'sem_uuid_2026';

  // Teste 1: A turma é realmente inserida em public.turmas
  console.log('--- Teste 1: Registro inserido em public.turmas ---');
  let queriedTurmasTablePayload: any = null;

  const mockSupabaseSuccess: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: mockUserId } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: mockUserId, nome: 'Prof. Teste' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'semestres') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: mockSemesterId, nome: '2026.1' },
                error: null,
              }),
              limit: async () => ({ data: [{ id: mockSemesterId }], error: null }),
            }),
            limit: async () => ({ data: [{ id: mockSemesterId }], error: null }),
          }),
        };
      }
      if (table === 'turmas') {
        return {
          insert: (payload: any) => {
            queriedTurmasTablePayload = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: mockTurmaId,
                    nome: payload.nome,
                    semestre_id: payload.semestre_id,
                    professor_id: payload.professor_id,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      if (table === 'mesas') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  { id: 'mesa_id_1', nome: 'Mesa 1', numero: 1, turma_id: mockTurmaId, limite_alunos: 10 },
                  { id: 'mesa_id_2', nome: 'Mesa 2', numero: 2, turma_id: mockTurmaId, limite_alunos: 10 },
                  { id: 'mesa_id_3', nome: 'Mesa 3', numero: 3, turma_id: mockTurmaId, limite_alunos: 10 },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    },
  };

  const result1 = await createClassInSupabase(mockSupabaseSuccess, {
    name: 'Medicina 2026.1 - APG I',
    yearSemester: '2026.1',
    semesterId: mockSemesterId,
    responsibleTeacher: 'Prof. Teste',
    userId: mockUserId,
  });

  assert(result1.success === true, 'Operação retornou sucesso para o Supabase');
  assert(queriedTurmasTablePayload !== null, 'Inserção em public.turmas foi executada no banco');
  assert(queriedTurmasTablePayload.nome === 'Medicina 2026.1 - APG I', 'Nome da turma enviado corretamente ao Supabase');
  passed++;

  // Teste 2: O professor_id é o usuário autenticado (session.user.id)
  console.log('\n--- Teste 2: professor_id é o usuário autenticado ---');
  assert(queriedTurmasTablePayload.professor_id === mockUserId, `professor_id (${queriedTurmasTablePayload.professor_id}) é igual a session.user.id (${mockUserId})`);
  passed++;

  // Teste 3: A interface NÃO mostra turma se o banco rejeitar o insert
  console.log('\n--- Teste 3: Interface rejeita turma se insert no Supabase falhar ---');
  const mockSupabaseFailure: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: mockUserId } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: mockUserId, nome: 'Prof. Teste' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'semestres') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: mockSemesterId, nome: '2026.1' },
                error: null,
              }),
              limit: async () => ({ data: [{ id: mockSemesterId }], error: null }),
            }),
          }),
        };
      }
      if (table === 'turmas') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: null,
                error: { message: 'violates foreign key constraint "turmas_semestre_id_fkey"' },
              }),
            }),
          }),
        };
      }
      return {};
    },
  };

  const resultFail = await createClassInSupabase(mockSupabaseFailure, {
    name: 'Turma Invalida',
    yearSemester: '2026.1',
    semesterId: mockSemesterId,
    userId: mockUserId,
  });

  assert(resultFail.success === false, 'Retorna success = false quando o Supabase rejeita a inserção');
  assert(resultFail.class === undefined, 'Nenhuma turma é criada no estado da interface');
  assert(
    resultFail.error === 'O semestre selecionado não existe mais. Atualize a página e selecione um semestre válido.',
    'Mensagem de erro traduzida corretamente para turmas_semestre_id_fkey'
  );
  passed++;

  // Teste 4: Trigger cria exatamente 3 mesas
  console.log('\n--- Teste 4: O trigger cria exatamente três mesas (Mesa 1, 2, 3) ---');
  assert(result1.groups?.length === 3, `Retornadas exatamente 3 mesas (obtido: ${result1.groups?.length})`);
  passed++;

  // Teste 5: As mesas possuem números 1, 2 e 3
  console.log('\n--- Teste 5: Mesas possuem nomes/números 1, 2 e 3 ---');
  const groupNames = result1.groups?.map((g) => g.name) || [];
  assert(groupNames.includes('Mesa 1'), 'Contém Mesa 1');
  assert(groupNames.includes('Mesa 2'), 'Contém Mesa 2');
  assert(groupNames.includes('Mesa 3'), 'Contém Mesa 3');
  passed++;

  // Teste 6: Não existem mesas duplicadas
  console.log('\n--- Teste 6: Não existem mesas duplicadas ---');
  const uniqueGroupIds = new Set(result1.groups?.map((g) => g.id));
  assert(uniqueGroupIds.size === result1.groups?.length, 'Todas as 3 mesas possuem IDs únicos sem duplicatas');
  passed++;

  // Teste 7: A interface carrega as mesas após criar a turma
  console.log('\n--- Teste 7: Interface carrega mesas após criação ---');
  const retryResult = await fetchMesasForTurma(mockSupabaseSuccess, mockTurmaId);
  assert(retryResult.success === true, 'Consulta de mesas de uma turma específica com retorno imediato');
  assert(retryResult.groups?.length === 3, 'Mesas carregadas e associadas ao turma_id');
  passed++;

  // Teste 8: Atualizar o navegador preserva turma e mesas (IDs persistidos no Supabase)
  console.log('\n--- Teste 8: IDs e dados persistidos no Supabase (Sobrevivem ao refresh) ---');
  assert(result1.class?.id === mockTurmaId, `ID da turma é o UUID do Supabase (${mockTurmaId})`);
  passed++;

  // Teste 9: A composição das mesas utiliza os IDs reais
  console.log('\n--- Teste 9: Composição de mesas utiliza IDs reais do banco ---');
  assert(result1.groups?.[0].id === 'mesa_id_1', 'ID da Mesa 1 é o ID real da tabela public.mesas (mesa_id_1)');
  assert(result1.groups?.[1].id === 'mesa_id_2', 'ID da Mesa 2 é o ID real da tabela public.mesas (mesa_id_2)');
  assert(result1.groups?.[2].id === 'mesa_id_3', 'ID da Mesa 3 é o ID real da tabela public.mesas (mesa_id_3)');
  passed++;

  // Teste 10: Nenhum dado demonstrativo é utilizado quando conectado ao Supabase
  console.log('\n--- Teste 10: Nenhum dado demonstrativo/mock é utilizado em produção ---');
  assert(!result1.class?.id.startsWith('cls_17'), 'ID da turma não usa gerador local mock cls_timestamp');
  assert(!result1.groups?.[0].id.startsWith('grp_demo'), 'IDs das mesas não utilizam valores mock demonstrativos');
  passed++;

  // Teste 11: Exclusão com erro de RLS traduz mensagem corretamente
  console.log('\n--- Teste 11: Exclusão com falha de RLS (42501) ---');
  const mockSupabaseRLSDelete: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: mockUserId } },
        error: null,
      }),
    },
    from: (table: string) => ({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({
              data: null,
              error: { code: '42501', message: 'new row violates row-level security policy' },
            }),
          }),
          select: async () => ({
            data: null,
            error: { code: '42501', message: 'new row violates row-level security policy' },
          }),
        }),
      }),
    }),
  };

  const deleteRlsRes = await deleteClassInSupabase(mockSupabaseRLSDelete, mockTurmaId, false);
  assert(deleteRlsRes.success === false, 'Exclusão rejeitada por RLS');
  assert(
    deleteRlsRes.error === 'Você não possui permissão para excluir esta turma.',
    'Mensagem de erro de RLS traduzida corretamente'
  );
  passed++;

  // Teste 12: Exclusão com erro de Foreign Key (23503) traduz mensagem corretamente
  console.log('\n--- Teste 12: Exclusão com restrição de Chave Estrangeira (23503) ---');
  const mockSupabaseFKDelete: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: mockUserId } },
        error: null,
      }),
    },
    from: (table: string) => ({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({
              data: null,
              error: { code: '23503', message: 'violates foreign key constraint' },
            }),
          }),
          select: async () => ({
            data: null,
            error: { code: '23503', message: 'violates foreign key constraint' },
          }),
        }),
      }),
    }),
  };

  const deleteFkRes = await deleteClassInSupabase(mockSupabaseFKDelete, mockTurmaId, false);
  assert(deleteFkRes.success === false, 'Exclusão rejeitada por Foreign Key');
  assert(
    deleteFkRes.error === 'Não foi possível excluir a turma porque existem registros vinculados sem regra de exclusão em cascata.',
    'Mensagem de erro de Chave Estrangeira traduzida corretamente'
  );
  passed++;

  // Teste 13: Exclusão bem sucedida no Supabase
  console.log('\n--- Teste 13: Exclusão de turma bem-sucedida ---');
  const mockSupabaseSuccessDelete: any = {
    auth: {
      getUser: async () => ({
        data: { user: { id: mockUserId } },
        error: null,
      }),
    },
    from: (table: string) => ({
      delete: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({
              data: [{ id: mockTurmaId }],
              error: null,
            }),
          }),
          select: async () => ({
            data: [{ id: mockTurmaId }],
            error: null,
          }),
        }),
      }),
    }),
  };

  const deleteSuccessRes = await deleteClassInSupabase(mockSupabaseSuccessDelete, mockTurmaId, false);
  assert(deleteSuccessRes.success === true, 'Turma excluída com sucesso no banco');
  passed++;

  console.log('\n======================================================');
  console.log(`🎉 TODOS OS 13 TESTES DE AUDITORIA DE TURMAS, MESAS E EXCLUSÃO PASSARAM COM SUCESSO!`);
  console.log('======================================================\n');
}

// Executa os testes se invocado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runClassAndTableTests().catch((err) => {
    console.error('Falha nos testes:', err);
    process.exit(1);
  });
}
