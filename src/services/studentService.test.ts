import {
  deactivateStudentInSupabase,
  deleteStudentInSupabase,
  fetchStudentLinkedCounts,
  isValidUuid,
  reactivateStudentInSupabase,
  updateStudentInSupabase,
  updateStudentTableAllocationInSupabase,
  validateStudentEditData,
} from './studentService';
import { Student } from '../types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Test assertion failed: ${message}`);
  }
  console.log(`✅ SUCESSO: ${message}`);
}

export async function runStudentServiceTests() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO TESTES DO STUDENT SERVICE (MÓDULO DE ALUNOS)');
  console.log('======================================================\n');

  let passed = 0;

  const validUuid1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const validUuid2 = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

  const sampleStudents: Student[] = [
    {
      id: validUuid1,
      name: 'João Silva',
      enrollment: '20261001',
      classId: 'turma_a',
      groupId: 'grp_m1',
      status: 'Ativo',
      ativo: true,
    },
    {
      id: validUuid2,
      name: 'Maria Santos',
      enrollment: '20261002',
      classId: 'turma_a',
      groupId: 'grp_m2',
      status: 'Ativo',
      ativo: true,
    },
  ];

  // Teste 1: Validação de nome obrigatório
  console.log('--- Teste 1: Nome completo obrigatório ---');
  const res1 = validateStudentEditData({
    name: '   ',
    enrollment: '20261001',
    classId: 'turma_a',
    studentId: validUuid1,
    existingStudents: sampleStudents,
  });
  assert(res1.valid === false, 'Validação rejeita nome vazio');
  assert(res1.error === 'O nome completo do estudante é obrigatório.', 'Mensagem de nome obrigatório');
  passed++;

  // Teste 2: Validação de matrícula obrigatória
  console.log('\n--- Teste 2: Matrícula obrigatória ---');
  const res2 = validateStudentEditData({
    name: 'João Silva',
    enrollment: '',
    classId: 'turma_a',
    studentId: validUuid1,
    existingStudents: sampleStudents,
  });
  assert(res2.valid === false, 'Validação rejeita matrícula vazia');
  assert(res2.error === 'A matrícula do estudante é obrigatória.', 'Mensagem de matrícula obrigatória');
  passed++;

  // Teste 3: Matrícula duplicada no sistema
  console.log('\n--- Teste 3: Bloqueio de matrícula duplicada no sistema ---');
  const res4 = validateStudentEditData({
    name: 'João Silva Editado',
    enrollment: '20261002', // Matrícula da Maria Santos
    classId: 'turma_a',
    studentId: validUuid1,
    existingStudents: sampleStudents,
  });
  assert(res4.valid === false, 'Validação rejeita matrícula duplicada');
  assert(res4.error === 'Já existe um estudante com esta matrícula cadastrada no sistema.', 'Mensagem de matrícula duplicada');
  passed++;

  // Teste 4: Edição do próprio aluno mantém a própria matrícula
  console.log('\n--- Teste 4: Edição do próprio aluno mantém a própria matrícula ---');
  const res5 = validateStudentEditData({
    name: 'João Silva Editado',
    enrollment: '20261001',
    classId: 'turma_a',
    studentId: validUuid1,
    existingStudents: sampleStudents,
  });
  assert(res5.valid === true, 'Validação aceita a própria matrícula');
  passed++;

  // Teste 6: Rejeição de ID std_ local antigo no Supabase
  console.log('\n--- Teste 6: Rejeição de ID std_ antigo ao tentar chamar Supabase ---');
  const mockSupabase: any = {
    from: () => ({
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    }),
  };
  const stdDeleteRes = await deleteStudentInSupabase(mockSupabase, 'std_1785374385714');
  assert(stdDeleteRes.success === false, 'Exclusão com ID std_ bloqueada com sucesso');
  assert(
    stdDeleteRes.error?.includes('dados locais antigos'),
    'Mensagem explicativa para ID std_'
  );
  passed++;

  // Teste 7: Desativação do estudante (ativo: false)
  console.log('\n--- Teste 7: Desativação do estudante (ativo: false) ---');
  let updateObj: any = null;
  const mockSupabaseDeactivate: any = {
    from: (table: string) => ({
      update: (payload: any) => {
        updateObj = payload;
        return {
          eq: (col: string, val: string) => Promise.resolve({ error: null }),
        };
      },
    }),
  };
  const deactivateRes = await deactivateStudentInSupabase(mockSupabaseDeactivate, validUuid1);
  assert(deactivateRes.success === true, 'Estudante desativado com sucesso');
  assert(updateObj?.ativo === false, 'Payload de atualização contém ativo: false');
  passed++;

  // Teste 8: Reativação do estudante (ativo: true)
  console.log('\n--- Teste 8: Reativação do estudante (ativo: true) ---');
  let reactivateObj: any = null;
  const mockSupabaseReactivate: any = {
    from: (table: string) => ({
      update: (payload: any) => {
        reactivateObj = payload;
        return {
          eq: (col: string, val: string) => Promise.resolve({ error: null }),
        };
      },
    }),
  };
  const reactivateRes = await reactivateStudentInSupabase(mockSupabaseReactivate, validUuid1);
  assert(reactivateRes.success === true, 'Estudante reativado com sucesso');
  assert(reactivateObj?.ativo === true, 'Payload de atualização contém ativo: true');
  passed++;

  // Teste 9: Bloqueio de exclusão definitiva para estudante com avaliações
  console.log('\n--- Teste 9: Bloqueio de exclusão definitiva com registros acadêmicos ---');
  const mockSupabaseAcademicData: any = {
    from: (table: string) => ({
      select: () => ({
        or: () => Promise.resolve({ count: 5, error: null }),
      }),
    }),
  };
  const deleteBlockedRes = await deleteStudentInSupabase(mockSupabaseAcademicData, validUuid1);
  assert(deleteBlockedRes.success === false, 'Exclusão definitiva bloqueada');
  assert(
    deleteBlockedRes.error ===
      'Este estudante possui registros acadêmicos e não pode ser excluído definitivamente. Utilize a opção Desativar estudante.',
    'Mensagem de bloqueio de exclusão correta'
  );
  passed++;

  // Teste 10: Exclusão definitiva de estudante sem registros
  console.log('\n--- Teste 10: Exclusão definitiva de estudante sem nenhum registro acadêmico ---');
  const mockSupabaseNoRecords: any = {
    from: (table: string) => {
      if (table === 'alunos') {
        return {
          delete: () => ({
            eq: (col: string, id: string) => ({
              select: () => Promise.resolve({ data: [{ id }], error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          or: () => Promise.resolve({ count: 0, error: null }),
        }),
      };
    },
  };
  const deleteAllowedRes = await deleteStudentInSupabase(mockSupabaseNoRecords, validUuid2);
  assert(deleteAllowedRes.success === true, 'Exclusão concluída com sucesso');
  passed++;

  console.log('\n======================================================');
  console.log(`🎉 TODOS OS ${passed} TESTES DO MÓDULO DE ALUNOS PASSARAM COM SUCESSO!`);
  console.log('======================================================\n');
}

if (import.meta.url.endsWith('studentService.test.ts')) {
  runStudentServiceTests().catch((err) => {
    console.error('Falha nos testes:', err);
    process.exit(1);
  });
}
