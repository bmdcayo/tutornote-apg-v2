import {
  calculateAPGGrades,
  calculateEvaluationTotalScore,
  calculateStudentSummary,
  calculateWeeklyAverage,
  getEffectiveScoreForEvaluation,
  roundTo2Decimals,
} from './calculationService.js';
import { BaremaCriterion, Evaluation } from '../types.js';

/**
 * Suite de Testes do Sistema de Cálculo APG
 * 
 * Executa as 12 verificações obrigatórias de auditoria do TutorNote APG.
 */

function assertEqual(actual: number, expected: number, message: string) {
  const diff = Math.abs(actual - expected);
  if (diff > 0.001) {
    console.error(`❌ FALHA: ${message} | Esperado: ${expected}, Obtido: ${actual}`);
    throw new Error(`Test failed: ${message}`);
  } else {
    console.log(`✅ SUCESSO: ${message} (${actual} === ${expected})`);
  }
}

function assertLessThanOrEqual(actual: number, max: number, message: string) {
  if (actual > max + 0.001) {
    console.error(`❌ FALHA: ${message} | ${actual} excede o limite máximo de ${max}`);
    throw new Error(`Boundary test failed: ${message}`);
  } else {
    console.log(`✅ SUCESSO: ${message} (${actual} <= ${max})`);
  }
}

export function runCalculationTests() {
  console.log('\n======================================================');
  console.log('🧪 INICIANDO AUDITORIA E TESTES DO SISTEMA DE CÁLCULO APG');
  console.log('======================================================\n');

  let passedCount = 0;

  const testCriteria: BaremaCriterion[] = [
    { id: 'crit_1', name: 'Abertura e Pontualidade', maxScore: 5, description: '' },
    { id: 'crit_2', name: 'Postura e Trabalho em Grupo', maxScore: 5, description: '' },
    { id: 'crit_3', name: 'Desempenho Técnico', maxScore: 5, description: '' },
    { id: 'crit_4', name: 'Fechamento e Síntese', maxScore: 5, description: '' },
  ];

  // Teste 1: Quatro critérios com nota 5 devem resultar em 20 pontos.
  console.log('--- Teste 1: Quatro critérios com nota 5 (5+5+5+5) ---');
  const score1 = calculateEvaluationTotalScore(
    { crit_1: 5, crit_2: 5, crit_3: 5, crit_4: 5 },
    testCriteria
  );
  assertEqual(score1, 20.0, '4 critérios de 5.0 somam 20.0 pontos');
  passedCount++;

  // Teste 2: Um critério não pode ultrapassar 5 pontos.
  console.log('\n--- Teste 2: Um critério não pode ultrapassar 5 pontos ---');
  const score2 = calculateEvaluationTotalScore(
    { crit_1: 8, crit_2: 3, crit_3: 2, crit_4: 1 }, // crit_1 inflado para 8
    testCriteria
  );
  // crit_1 é limitado a 5.0 -> 5 + 3 + 2 + 1 = 11.0
  assertEqual(score2, 11.0, 'Critério inflado para 8.0 é limitado a 5.0 (5+3+2+1=11.0)');
  passedCount++;

  // Teste 3: O barema não pode ultrapassar 20 pontos.
  console.log('\n--- Teste 3: O barema não pode ultrapassar 20 pontos ---');
  const score3 = calculateEvaluationTotalScore(
    { crit_1: 10, crit_2: 10, crit_3: 10, crit_4: 10 },
    testCriteria
  );
  assertLessThanOrEqual(score3, 20.0, 'Soma total do barema limitada rigidamente a 20.0');
  passedCount++;

  // Teste 4: A primeira unidade não pode ultrapassar 20.
  console.log('\n--- Teste 4: A primeira unidade não pode ultrapassar 20 ---');
  const resU1Over = calculateAPGGrades({ u1GrossScore: 28.0 });
  assertLessThanOrEqual(resU1Over.unit1Grade, 20.0, 'Nota da 1ª unidade limitada a 20.0');
  passedCount++;

  // Teste 5: A média 20 da segunda unidade deve ser ajustada para 15.
  console.log('\n--- Teste 5: Média 20 da 2ª unidade ajustada para 15 ---');
  const resU2_20 = calculateAPGGrades({ u2GrossScore: 20.0 });
  assertEqual(resU2_20.unit2Adjusted, 15.0, 'Média bruta 20.0 na 2ª unidade ajustada para 15.0');
  passedCount++;

  // Teste 6: A média 16 deve ser ajustada para 12.
  console.log('\n--- Teste 6: Média 16 da 2ª unidade ajustada para 12 ---');
  const resU2_16 = calculateAPGGrades({ u2GrossScore: 16.0 });
  assertEqual(resU2_16.unit2Adjusted, 12.0, 'Média bruta 16.0 na 2ª unidade ajustada para 12.0');
  passedCount++;

  // Teste 7: A média 10 deve ser ajustada para 7,5.
  console.log('\n--- Teste 7: Média 10 da 2ª unidade ajustada para 7,5 ---');
  const resU2_10 = calculateAPGGrades({ u2GrossScore: 10.0 });
  assertEqual(resU2_10.unit2Adjusted, 7.5, 'Média bruta 10.0 na 2ª unidade ajustada para 7.5');
  passedCount++;

  // Teste 8: A nota final não pode ultrapassar 35.
  console.log('\n--- Teste 8: A nota final não pode ultrapassar 35 ---');
  const resFinalOver = calculateAPGGrades({ u1GrossScore: 25.0, u2GrossScore: 25.0 });
  assertLessThanOrEqual(resFinalOver.finalGrade, 35.0, 'Nota final limitada rigidamente a 35.0');
  passedCount++;

  // Teste 9: Ausência zera apenas fechamento e preserva os demais critérios.
  console.log('\n--- Teste 9: Ausência preserva até 15 pontos e zera o fechamento ---');
  const mockAbsentEval: Evaluation = {
    id: 'e_absent',
    studentId: 's1',
    classId: 'c1',
    groupId: 'g1',
    week: 1,
    unit: 1,
    caseId: 'case1',
    date: '2026-02-09',
    role: 'Membro',
    attendance: 'Ausente',
    criterionScores: { crit_1: 5, crit_2: 5, crit_3: 0, crit_4: 5 },
    totalGrossScore: 15.0,
    performanceTags: [],
    teacherNotes: 'Sem justificativa',
    pedagogicalFeedback: '',
    status: 'Concluído',
    updatedAt: '2026-02-09',
  };
  const absentScore = getEffectiveScoreForEvaluation(mockAbsentEval);
  assertEqual(absentScore ?? -1, 15.0, 'Ausência preserva os três critérios editáveis');
  passedCount++;

  // Teste 10: Atestado gera pendência de segunda chamada e não recebe nota zero.
  console.log('\n--- Teste 10: Atestado gera pendência de segunda chamada ---');
  const mockCertificateEval: Evaluation = {
    id: 'e_cert',
    studentId: 's1',
    classId: 'c1',
    groupId: 'g1',
    week: 2,
    unit: 1,
    caseId: 'case2',
    date: '2026-02-16',
    role: 'Membro',
    attendance: 'Atestado',
    criterionScores: {},
    totalGrossScore: 0.0,
    performanceTags: [],
    teacherNotes: 'Atestado médico anexado',
    pedagogicalFeedback: '',
    status: 'Pendente',
    updatedAt: '2026-02-16',
    makeupRequired: true,
    makeupCompleted: false,
    originalAbsenceDate: '2026-02-16',
  };
  const certScore = getEffectiveScoreForEvaluation(mockCertificateEval);
  if (certScore === null) {
    console.log('✅ SUCESSO: Atestado retorna null enquanto aguarda segunda chamada');
  } else {
    throw new Error(`Atestado não retornou null: obtido ${certScore}`);
  }
  
  // Testando média com 1 presente (20.0) e 1 atestado
  const weekEvalsWithCert = [
    { ...mockAbsentEval, attendance: 'Presente' as const, totalGrossScore: 20.0 },
    mockCertificateEval,
  ];
  const weekAvg = calculateWeeklyAverage(weekEvalsWithCert);
  assertEqual(weekAvg ?? 0, 20.0, 'A pendência de segunda chamada não recebe zero antes da reposição');
  passedCount++;

  // Teste 11: Avaliação pendente não deve receber zero automaticamente.
  console.log('\n--- Teste 11: Avaliação pendente não recebe zero automaticamente ---');
  const mockPendingEval: Evaluation = {
    id: 'e_pend',
    studentId: 's1',
    classId: 'c1',
    groupId: 'g1',
    week: 3,
    unit: 1,
    caseId: 'case3',
    date: '2026-02-23',
    role: 'Membro',
    attendance: 'Presente',
    criterionScores: {},
    totalGrossScore: 0.0,
    performanceTags: [],
    teacherNotes: '',
    pedagogicalFeedback: '',
    status: 'Pendente', // Status pendente
    updatedAt: '2026-02-23',
  };
  const pendingScore = getEffectiveScoreForEvaluation(mockPendingEval);
  if (pendingScore === null) {
    console.log('✅ SUCESSO: Avaliação pendente retorna null (não computa zero automaticamente)');
  } else {
    throw new Error(`Avaliação pendente não retornou null: obtido ${pendingScore}`);
  }
  passedCount++;

  // Teste 12: Relatórios devem reproduzir os valores exibidos no dashboard.
  console.log('\n--- Teste 12: Relatórios reproduzem exatamente os valores do Dashboard ---');
  const studentEvalsForSummary: Evaluation[] = [
    { ...mockAbsentEval, id: 'ev1', week: 1, unit: 1, attendance: 'Presente', totalGrossScore: 18.0, status: 'Concluído' },
    { ...mockAbsentEval, id: 'ev2', week: 2, unit: 1, attendance: 'Ausente', totalGrossScore: 0.0, status: 'Concluído' }, // U1 avg = (18 + 0)/2 = 9.0
    { ...mockAbsentEval, id: 'ev3', week: 9, unit: 2, attendance: 'Presente', totalGrossScore: 16.0, status: 'Concluído' }, // U2 gross = 16.0 -> U2 adj = 12.0
  ];
  const dashboardSummary = calculateStudentSummary(
    's1',
    'João Silva',
    '2026001',
    'Turma A',
    'Grupo 1',
    studentEvalsForSummary
  );

  const directCalcResult = calculateAPGGrades({ evaluations: studentEvalsForSummary });

  assertEqual(dashboardSummary.unit1Grade, directCalcResult.unit1Grade, 'Relatório U1 coincide com Dashboard U1 (9.0)');
  assertEqual(dashboardSummary.unit2Gross, directCalcResult.unit2Gross, 'Relatório U2 Bruta coincide com Dashboard U2 Bruta (16.0)');
  assertEqual(dashboardSummary.unit2Adjusted, directCalcResult.unit2Adjusted, 'Relatório U2 Ajustada coincide com Dashboard U2 Ajustada (12.0)');
  assertEqual(dashboardSummary.finalGrade, directCalcResult.finalGrade, 'Relatório Nota Final coincide com Dashboard Nota Final (21.0)');
  passedCount++;

  console.log('\n======================================================');
  console.log(`🎉 TODOS OS ${passedCount} DE 12 TESTES PASSARAM COM 100% DE SUCESSO!`);
  console.log('======================================================\n');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runCalculationTests();
}
