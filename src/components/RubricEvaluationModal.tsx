import React, { useState, useEffect, useRef } from 'react';
import { Evaluation, Student, SessionRole } from '../types';
import { X, ChevronLeft, ChevronRight, Check, CheckCircle2, RotateCcw, Sliders, Plus, Minus, Info } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface RubricDomain {
  id: string; // 'crit_1', 'crit_2', 'crit_3', 'crit_4'
  title: string;
  items: string[];
  calculateScore: (checkedCount: number) => number;
}

export const APG_RUBRIC_DOMAINS: RubricDomain[] = [
  {
    id: 'crit_1',
    title: '1. Abertura do Problema',
    items: [
      'Postura ética e responsável',
      'Colaboração em todos os passos',
      'Uso de conhecimentos prévios para formulação de hipóteses',
      'Auxílio na elaboração de objetivos',
    ],
    calculateScore: (count) => {
      if (count >= 3) return 5.0;
      if (count === 2) return 3.5;
      if (count === 1) return 2.0;
      return 0.0;
    },
  },
  {
    id: 'crit_2',
    title: '2. Postura e Colaboração',
    items: [
      'Participação ativa nas discussões',
      'Contribuições relevantes do estudo',
      'Desempenho ético no papel de coordenador, secretário ou membro',
    ],
    calculateScore: (count) => {
      if (count >= 3) return 5.0;
      if (count === 2) return 3.5;
      if (count === 1) return 2.0;
      return 0.0;
    },
  },
  {
    id: 'crit_3',
    title: '3. Fechamento do Problema',
    items: [
      'Domínio completo dos objetivos',
      'Raciocínio lógico e estruturado',
      'Uso de referências científicas confiáveis',
      'Uso de recursos diversificados',
      'Terminologia técnica adequada',
    ],
    calculateScore: (count) => {
      if (count >= 5) return 5.0;
      if (count >= 3) return 3.5;
      if (count >= 1) return 2.0;
      return 0.0;
    },
  },
  {
    id: 'crit_4',
    title: '4. Assiduidade',
    items: [
      'Pontualidade na sessão',
      'Permanência e presença ativa durante toda a atividade',
    ],
    calculateScore: (count) => {
      if (count >= 2) return 5.0;
      if (count === 1) return 3.5;
      return 0.0;
    },
  },
];

// Helper to deduce initial checked indices if only numeric score is present
export function getDefaultCheckedIndices(domainId: string, score: number): number[] {
  if (score >= 5.0) {
    if (domainId === 'crit_1') return [0, 1, 2, 3];
    if (domainId === 'crit_2') return [0, 1, 2];
    if (domainId === 'crit_3') return [0, 1, 2, 3, 4];
    if (domainId === 'crit_4') return [0, 1];
  } else if (score >= 3.5) {
    if (domainId === 'crit_1') return [0, 1];
    if (domainId === 'crit_2') return [0, 1];
    if (domainId === 'crit_3') return [0, 1, 2];
    if (domainId === 'crit_4') return [0];
  } else if (score >= 2.0) {
    return [0];
  }
  return [];
}

const ADJUSTMENT_PRESETS = [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0];

interface RubricEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  evaluation: Evaluation;
  onSave: (updatedEval: Evaluation) => void;
  allStudents?: Student[];
  onSelectStudent?: (studentId: string) => void;
  initialDomainIndex?: number;
}

export const RubricEvaluationModal: React.FC<RubricEvaluationModalProps> = ({
  isOpen,
  onClose,
  student,
  evaluation,
  onSave,
  allStudents = [],
  onSelectStudent,
  initialDomainIndex = 0,
}) => {
  const [activeDomainIdx, setActiveDomainIdx] = useState<number>(initialDomainIndex);
  const [checkedMap, setCheckedMap] = useState<Record<string, number[]>>({});
  const [adjustmentScore, setAdjustmentScore] = useState<number>(evaluation.adjustmentScore || 0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>(evaluation.adjustmentReason || '');

  const { deleteEvaluation } = useApp();

  const handleResetEvaluation = () => {
    if (confirm(`Deseja realmente anular a avaliação de ${student.name} na Semana ${evaluation.week}?`)) {
      void deleteEvaluation(student.id, evaluation.unit, evaluation.week, evaluation.caseId);
      onClose();
    }
  };

  const checkedMapRef = useRef(checkedMap);
  const evaluationRef = useRef(evaluation);
  const adjustmentScoreRef = useRef(adjustmentScore);
  const adjustmentReasonRef = useRef(adjustmentReason);

  useEffect(() => {
    checkedMapRef.current = checkedMap;
  }, [checkedMap]);

  useEffect(() => {
    evaluationRef.current = evaluation;
  }, [evaluation]);

  useEffect(() => {
    adjustmentScoreRef.current = adjustmentScore;
  }, [adjustmentScore]);

  useEffect(() => {
    adjustmentReasonRef.current = adjustmentReason;
  }, [adjustmentReason]);

  useEffect(() => {
    setActiveDomainIdx(initialDomainIndex);
  }, [initialDomainIndex, student.id]);

  // Initialize local checked state & adjustment when modal opens or active student changes
  useEffect(() => {
    if (!isOpen) return;

    if (evaluation.checkedCriteria && Object.keys(evaluation.checkedCriteria).length > 0) {
      setCheckedMap(evaluation.checkedCriteria);
    } else {
      const initialMap: Record<string, number[]> = {};
      APG_RUBRIC_DOMAINS.forEach((domain) => {
        const score = evaluation.criterionScores?.[domain.id] ?? 0;
        initialMap[domain.id] = getDefaultCheckedIndices(domain.id, score);
      });
      setCheckedMap(initialMap);
    }
    setAdjustmentScore(evaluation.adjustmentScore || 0);
    setAdjustmentReason(evaluation.adjustmentReason || '');
  }, [isOpen, student.id]);

  // Compute live totals
  const baremaSum = APG_RUBRIC_DOMAINS.reduce((sum, domain) => {
    const checked = checkedMap[domain.id] || [];
    return sum + domain.calculateScore(checked.length);
  }, 0);

  const finalGrossTotal = Math.max(0, Math.min(20.0, baremaSum + (Number(adjustmentScore) || 0)));

  // Save current rubric state to parent state / storage
  const saveCurrentState = (
    mapToUse?: Record<string, number[]>,
    adjToUse?: number,
    reasonToUse?: string
  ) => {
    const map = mapToUse || checkedMapRef.current;
    const adj = adjToUse !== undefined ? adjToUse : adjustmentScoreRef.current;
    const reason = reasonToUse !== undefined ? reasonToUse : adjustmentReasonRef.current;

    const newCriterionScores: Record<string, number> = {};
    let newBaremaTotal = 0;

    APG_RUBRIC_DOMAINS.forEach((domain) => {
      const checked = map[domain.id] || [];
      const score = domain.calculateScore(checked.length);
      newCriterionScores[domain.id] = score;
      newBaremaTotal += score;
    });

    const finalScore = Math.max(0, Math.min(20.0, newBaremaTotal + (Number(adj) || 0)));
    const currentEval = evaluationRef.current || evaluation;
    const updatedEval: Evaluation = {
      ...currentEval,
      criterionScores: newCriterionScores,
      checkedCriteria: map,
      adjustmentScore: adj,
      adjustmentReason: reason,
      totalGrossScore: currentEval.attendance === 'Presente' ? finalScore : 0,
      status: 'Concluído',
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onSave(updatedEval);
  };

  // Auto-close and auto-save ONLY when user switches browser tab or minimizes browser window
  useEffect(() => {
    if (!isOpen) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentState();
        onClose();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isAdjustmentTab = activeDomainIdx === 4;
  const currentDomain = APG_RUBRIC_DOMAINS[activeDomainIdx] || APG_RUBRIC_DOMAINS[0];
  const activeChecked = checkedMap[currentDomain?.id] || [];

  const toggleCheck = (itemIdx: number) => {
    const updated = activeChecked.includes(itemIdx)
      ? activeChecked.filter((i) => i !== itemIdx)
      : [...activeChecked, itemIdx];

    const newMap = {
      ...checkedMap,
      [currentDomain.id]: updated,
    };

    setCheckedMap(newMap);
    saveCurrentState(newMap);
  };

  const handleAdjustmentChange = (newAdj: number) => {
    const clamped = Math.round(newAdj * 10) / 10;
    setAdjustmentScore(clamped);
    saveCurrentState(checkedMap, clamped, adjustmentReason);
  };

  const handleReasonChange = (newReason: string) => {
    setAdjustmentReason(newReason);
    saveCurrentState(checkedMap, adjustmentScore, newReason);
  };

  const handleSaveAndClose = (customCheckedMap?: Record<string, number[]>) => {
    saveCurrentState(customCheckedMap, adjustmentScore, adjustmentReason);
    onClose();
  };

  // Find previous / next student
  const studentIndex = allStudents.findIndex((s) => s.id === student.id);
  const prevStudent = studentIndex > 0 ? allStudents[studentIndex - 1] : null;
  const nextStudent = studentIndex >= 0 && studentIndex < allStudents.length - 1 ? allStudents[studentIndex + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Avaliação de Tutoria APG
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3" /> Salvo em tempo real
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              Rubrica Oficial APG & Ajuste Docente
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Student Identification & Navigation */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-2.5 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-900 text-white font-bold text-sm shadow-xs">
              {student.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {student.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                RA: {student.enrollment} •{' '}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                  {evaluation.role || 'Membro'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSelectStudent && (
              <>
                <button
                  disabled={!prevStudent}
                  onClick={() => prevStudent && onSelectStudent(prevStudent.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Aluno Anterior</span>
                </button>
                <button
                  disabled={!nextStudent}
                  onClick={() => nextStudent && onSelectStudent(nextStudent.id)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <span className="hidden sm:inline">Próximo Aluno</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs / Domain Steps Header (5 Tabs including Ajuste) */}
        <div className="grid grid-cols-5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-xs">
          {APG_RUBRIC_DOMAINS.map((domain, idx) => {
            const checkedCount = (checkedMap[domain.id] || []).length;
            const score = domain.calculateScore(checkedCount);
            const isActive = idx === activeDomainIdx;

            return (
              <button
                key={domain.id}
                onClick={() => setActiveDomainIdx(idx)}
                className={`p-2.5 text-left transition-all border-b-2 flex flex-col justify-between ${
                  isActive
                    ? 'border-indigo-600 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-400 font-bold shadow-xs'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="truncate font-semibold text-[11px]">
                  {idx + 1}. {domain.title.replace(/^\d+\.\s*/, '')}
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] opacity-80">
                  <span>
                    {checkedCount}/{domain.items.length}
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-300">
                    {score.toFixed(1)}
                  </span>
                </div>
              </button>
            );
          })}

          {/* 5th Tab: Ajuste (+/-) */}
          <button
            onClick={() => setActiveDomainIdx(4)}
            className={`p-2.5 text-left transition-all border-b-2 flex flex-col justify-between ${
              isAdjustmentTab
                ? 'border-indigo-600 bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-400 font-bold shadow-xs'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="truncate font-semibold text-[11px] flex items-center gap-1">
              <Sliders className="h-3 w-3" />
              <span>5. Ajuste (+/-)</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="opacity-80">Docente</span>
              <span
                className={`font-bold ${
                  adjustmentScore > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : adjustmentScore < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500'
                }`}
              >
                {adjustmentScore > 0 ? `+${adjustmentScore.toFixed(1)}` : adjustmentScore.toFixed(1)}
              </span>
            </div>
          </button>
        </div>

        {/* Live Score Summary Banner */}
        <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 px-6 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
            <span>
              Barema: <strong className="text-indigo-950 dark:text-indigo-200 font-mono">{baremaSum.toFixed(1)}</strong>
            </span>
            <span>+</span>
            <span>
              Ajuste:{' '}
              <strong
                className={`font-mono ${
                  adjustmentScore > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : adjustmentScore < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {adjustmentScore > 0 ? `+${adjustmentScore.toFixed(1)}` : adjustmentScore.toFixed(1)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Final:
            </span>
            <span className="rounded-lg bg-emerald-600 text-white font-mono font-black px-2.5 py-0.5 text-xs shadow-xs">
              {finalGrossTotal.toFixed(1)} / 20.0
            </span>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {!isAdjustmentTab ? (
            <>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  MARQUE OS CRITÉRIOS OBSERVADOS DURANTE A SESSÃO:
                </h4>
                <div className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  Pontuação deste domínio: {currentDomain.calculateScore(activeChecked.length).toFixed(1)} / 5.0
                </div>
              </div>

              {/* Checkboxes List */}
              <div className="space-y-2.5">
                {currentDomain.items.map((itemText, i) => {
                  const isChecked = activeChecked.includes(i);
                  return (
                    <div
                      key={i}
                      onClick={() => toggleCheck(i)}
                      className={`group flex items-center gap-3.5 rounded-xl border p-3.5 transition-all cursor-pointer ${
                        isChecked
                          ? 'border-indigo-500 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-100 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                          isChecked
                            ? 'border-indigo-600 bg-indigo-600 text-white dark:bg-indigo-500'
                            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 group-hover:border-slate-400'
                        }`}
                      >
                        {isChecked && <Check className="h-4 w-4 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium leading-relaxed">
                        <span className="font-bold text-slate-400 dark:text-slate-500 mr-1.5">
                          {i + 1}.
                        </span>
                        {itemText}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Rubric Score Scale Reminder Box */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
                  Escala de Pontuação deste Domínio:
                </span>
                {currentDomain.id === 'crit_1' && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>🔵 5,0 = 3+ itens</span>
                    <span>🟢 3,5 = 2 itens</span>
                    <span>🟡 2,0 = 1 item</span>
                    <span>🔴 0,0 = Nenhum item</span>
                  </div>
                )}
                {currentDomain.id === 'crit_2' && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>🔵 5,0 = Todos (3 itens)</span>
                    <span>🟢 3,5 = 2 itens</span>
                    <span>🟡 2,0 = 1 item</span>
                    <span>🔴 0,0 = Nenhum item</span>
                  </div>
                )}
                {currentDomain.id === 'crit_3' && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>🔵 5,0 = Todos (5 itens)</span>
                    <span>🟢 3,5 = 3 a 4 itens</span>
                    <span>🟡 2,0 = 1 a 2 itens</span>
                    <span>🔴 0,0 = Nenhum item</span>
                  </div>
                )}
                {currentDomain.id === 'crit_4' && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>🔵 5,0 = Ambos (2 itens)</span>
                    <span>🟢 3,5 = 1 item</span>
                    <span>🔴 0,0 = Nenhum item</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Dedicated Tab 5: Ajuste Docente (+/-) */
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-700 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                    Ajuste Manual Docente (+ / -)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Permite aplicar bônus ou penalidades pedagógicas diretamente sobre a nota do barema oficial,
                  sem alterar a pontuação calculada nos 4 domínios da rubrica. O total final é automaticamente limitado entre 0.0 e 20.0 pontos.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Seleção Rápida de Ajuste (Pontos):
                </label>
                <div className="grid grid-cols-5 sm:grid-cols-9 gap-1.5">
                  {ADJUSTMENT_PRESETS.map((preset) => {
                    const isSelected = adjustmentScore === preset;
                    const isPositive = preset > 0;
                    const isNegative = preset < 0;

                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAdjustmentChange(preset)}
                        className={`rounded-xl py-2 px-1 text-xs font-bold transition-all ${
                          isSelected
                            ? isPositive
                              ? 'bg-emerald-600 text-white shadow-xs scale-105'
                              : isNegative
                              ? 'bg-rose-600 text-white shadow-xs scale-105'
                              : 'bg-slate-700 text-white shadow-xs scale-105'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset > 0 ? `+${preset.toFixed(1)}` : preset.toFixed(1)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Precise Value Custom Stepper */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                    Valor Personalizado do Ajuste
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ajuste fino de 0.1 em 0.1 ponto
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustmentChange(adjustmentScore - 0.5)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                    title="Diminuir 0.5 ponto"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    min="-20"
                    max="20"
                    value={adjustmentScore}
                    onChange={(e) => handleAdjustmentChange(parseFloat(e.target.value) || 0)}
                    className={`h-9 w-20 rounded-xl border text-center text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      adjustmentScore > 0
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : adjustmentScore < 0
                        ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAdjustmentChange(adjustmentScore + 0.5)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                    title="Aumentar 0.5 ponto"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustmentChange(0)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 ml-1"
                  >
                    Zerar
                  </button>
                </div>
              </div>

              {/* Justification Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Justificativa Pedagógica do Ajuste (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Síntese clínica de excelência / Participação destacada no fechamento..."
                  value={adjustmentReason}
                  onChange={(e) => handleReasonChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleResetEvaluation}
              title="Anular avaliação deste estudante nesta semana"
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/80 px-3.5 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Anular Avaliação</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeDomainIdx > 0 && (
              <button
                type="button"
                onClick={() => setActiveDomainIdx(activeDomainIdx - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Etapa Anterior</span>
              </button>
            )}

            {activeDomainIdx < 4 ? (
              <button
                type="button"
                onClick={() => setActiveDomainIdx(activeDomainIdx + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 dark:bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800 dark:hover:bg-indigo-500 transition-colors shadow-xs"
              >
                <span>{activeDomainIdx === 3 ? 'Ir para Ajuste (+/-)' : 'Próximo Domínio'}</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => handleSaveAndClose()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Check className="h-4 w-4" />
              <span>Concluir e Salvar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

