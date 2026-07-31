export interface RubricItem {
  id: string;
  label: string;
}

export interface RubricCategory {
  id: 'crit_1' | 'crit_2' | 'crit_3' | 'crit_4';
  name: string;
  description: string;
  items: RubricItem[];
  scoreForCheckedCount: (checkedCount: number) => number;
}

export const RUBRIC_CATEGORIES: RubricCategory[] = [
  {
    id: 'crit_1',
    name: 'Abertura de problema',
    description: 'Preparação, ética, colaboração e construção inicial do caso.',
    items: [
      { id: 'abertura_postura_etica', label: 'Postura ética e responsável' },
      { id: 'abertura_colaboracao', label: 'Colaboração em todos os passos' },
      {
        id: 'abertura_conhecimentos_previos',
        label: 'Uso de conhecimentos prévios para hipóteses',
      },
      {
        id: 'abertura_objetivos',
        label: 'Auxílio na elaboração de objetivos',
      },
    ],
    scoreForCheckedCount: (count) => {
      if (count <= 0) return 0;
      if (count === 1) return 2;
      if (count === 2) return 3.5;
      return 5;
    },
  },
  {
    id: 'crit_2',
    name: 'Postura e colaboração',
    description: 'Participação, relevância das contribuições e desempenho ético.',
    items: [
      {
        id: 'postura_participacao',
        label: 'Participação ativa nas discussões',
      },
      {
        id: 'postura_contribuicoes',
        label: 'Contribuições relevantes do estudo',
      },
      {
        id: 'postura_papel',
        label: 'Desempenho ético no papel (coordenador, secretário ou membro)',
      },
    ],
    scoreForCheckedCount: (count) => {
      if (count <= 0) return 0;
      if (count === 1) return 2;
      if (count === 2) return 3.5;
      return 5;
    },
  },
  {
    id: 'crit_3',
    name: 'Fechamento de problema',
    description: 'Domínio, raciocínio, evidências e comunicação técnico-científica.',
    items: [
      {
        id: 'fechamento_objetivos',
        label: 'Domínio completo dos objetivos',
      },
      {
        id: 'fechamento_raciocinio',
        label: 'Raciocínio lógico e estruturado',
      },
      {
        id: 'fechamento_referencias',
        label: 'Referências científicas confiáveis',
      },
      {
        id: 'fechamento_recursos',
        label: 'Uso de recursos diversificados',
      },
      {
        id: 'fechamento_terminologia',
        label: 'Terminologia técnica adequada',
      },
    ],
    scoreForCheckedCount: (count) => {
      if (count <= 0) return 0;
      if (count <= 2) return 2;
      if (count <= 4) return 3.5;
      return 5;
    },
  },
  {
    id: 'crit_4',
    name: 'Assiduidade',
    description: 'Pontualidade e permanência durante as atividades.',
    items: [
      { id: 'assiduidade_pontualidade', label: 'Pontualidade' },
      {
        id: 'assiduidade_permanencia',
        label: 'Permanência durante as atividades',
      },
    ],
    scoreForCheckedCount: (count) => {
      if (count <= 0) return 0;
      if (count === 1) return 3.5;
      return 5;
    },
  },
];

export function calculateRubricScores(
  checks: Record<string, boolean>,
  absent = false
): Record<string, number> {
  return Object.fromEntries(
    RUBRIC_CATEGORIES.map((category) => {
      if (absent && category.id === 'crit_3') return [category.id, 0];
      const checkedCount = category.items.filter((item) => Boolean(checks[item.id])).length;
      return [category.id, category.scoreForCheckedCount(checkedCount)];
    })
  );
}

export function clearClosingChecks(
  checks: Record<string, boolean>
): Record<string, boolean> {
  const closingItemIds = new Set(
    RUBRIC_CATEGORIES.find((category) => category.id === 'crit_3')?.items.map(
      (item) => item.id
    ) || []
  );
  return Object.fromEntries(
    Object.entries(checks).map(([id, checked]) => [
      id,
      closingItemIds.has(id) ? false : checked,
    ])
  );
}

export function restoreChecksFromScores(
  scores: Record<string, number>
): Record<string, boolean> {
  const desiredCounts: Record<string, (score: number) => number> = {
    crit_1: (score) => (score >= 5 ? 3 : score >= 3.5 ? 2 : score >= 2 ? 1 : 0),
    crit_2: (score) => (score >= 5 ? 3 : score >= 3.5 ? 2 : score >= 2 ? 1 : 0),
    crit_3: (score) => (score >= 5 ? 5 : score >= 3.5 ? 3 : score >= 2 ? 1 : 0),
    crit_4: (score) => (score >= 5 ? 2 : score >= 3.5 ? 1 : 0),
  };

  return Object.fromEntries(
    RUBRIC_CATEGORIES.flatMap((category) => {
      const count = desiredCounts[category.id]?.(Number(scores[category.id] || 0)) || 0;
      return category.items.map((item, index) => [item.id, index < count]);
    })
  );
}

export const DEFAULT_RUBRIC_SETTINGS = RUBRIC_CATEGORIES.map((category) => ({
  id: category.id,
  name: category.name,
  maxScore: 5,
  description: category.description,
}));
