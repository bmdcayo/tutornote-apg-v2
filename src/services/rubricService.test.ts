import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateRubricScores,
  clearClosingChecks,
  RUBRIC_CATEGORIES,
} from './rubricService.js';

const allChecks = Object.fromEntries(
  RUBRIC_CATEGORIES.flatMap((category) =>
    category.items.map((item) => [item.id, true])
  )
);

test('a rubrica completa totaliza 20 pontos', () => {
  const scores = calculateRubricScores(allChecks);
  assert.deepEqual(scores, {
    crit_1: 5,
    crit_2: 5,
    crit_3: 5,
    crit_4: 5,
  });
});

test('a ausência zera somente fechamento e preserva os outros 15 pontos', () => {
  const cleared = clearClosingChecks(allChecks);
  const scores = calculateRubricScores(cleared, true);
  assert.deepEqual(scores, {
    crit_1: 5,
    crit_2: 5,
    crit_3: 0,
    crit_4: 5,
  });
});

test('faixas intermediárias seguem a rubrica aprovada', () => {
  const checks: Record<string, boolean> = {
    abertura_postura_etica: true,
    postura_participacao: true,
    postura_contribuicoes: true,
    fechamento_objetivos: true,
    fechamento_raciocinio: true,
    fechamento_referencias: true,
    assiduidade_pontualidade: true,
  };
  assert.deepEqual(calculateRubricScores(checks), {
    crit_1: 2,
    crit_2: 3.5,
    crit_3: 3.5,
    crit_4: 3.5,
  });
});
