import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AttendanceStatus, Evaluation, SessionRole } from '../types';
import { availablePerformanceTags } from '../services/mockData';
import {
  calculateRubricScores,
  clearClosingChecks,
  restoreChecksFromScores,
  RUBRIC_CATEGORIES,
} from '../services/rubricService';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Save,
  Sparkles,
  Tag,
} from 'lucide-react';

const today = () => new Date().toISOString().split('T')[0];

export const IndividualEvaluationPage: React.FC = () => {
  const { studentId, weekStr } = useParams<{ studentId: string; weekStr: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    students,
    classes,
    groups,
    cases,
    evaluations,
    getStudentAllocation,
    saveEvaluation,
    generateGeminiFeedback,
  } = useApp();

  const weekNum = weekStr ? parseInt(weekStr, 10) : 1;
  const unitNum: 1 | 2 = weekNum <= 8 ? 1 : 2;
  const query = new URLSearchParams(location.search);
  const requestedCaseId = query.get('case') || '';
  const requestedTableId = query.get('table') || '';
  const student = students.find((item) => item.id === studentId);
  const studentClass = classes.find((item) => item.id === student?.classId);
  const currentCase =
    cases.find((item) => item.id === requestedCaseId) ||
    cases.find(
      (item) =>
        item.week === weekNum &&
        (!studentClass?.soiId || !item.soiId || item.soiId === studentClass.soiId)
    );
  const existingEval = evaluations.find(
    (item) => item.studentId === studentId && item.caseId === currentCase?.id
  );
  const unitAllocation = student ? getStudentAllocation(student.id, unitNum) : undefined;
  const selectedTableId =
    requestedTableId || existingEval?.groupId || unitAllocation?.groupId || '';
  const selectedTable = groups.find(
    (item) => item.id === selectedTableId && item.classId === student?.classId
  );

  const groupStudents = students.filter((item) => {
    if (!student || item.classId !== student.classId || item.ativo === false) return false;
    return getStudentAllocation(item.id, unitNum)?.groupId === selectedTableId;
  });
  const currentStudentIndex = groupStudents.findIndex((item) => item.id === studentId);
  const nextStudent =
    currentStudentIndex >= 0 && currentStudentIndex < groupStudents.length - 1
      ? groupStudents[currentStudentIndex + 1]
      : null;
  const completedInSessionCount = groupStudents.filter((item) =>
    evaluations.some(
      (evaluation) =>
        evaluation.studentId === item.id &&
        evaluation.caseId === currentCase?.id &&
        evaluation.status === 'Concluído'
    )
  ).length;

  const initialChecks = useMemo(() => {
    if (existingEval?.rubricChecks && Object.keys(existingEval.rubricChecks).length > 0) {
      return existingEval.rubricChecks;
    }
    return restoreChecksFromScores(existingEval?.criterionScores || {});
  }, [existingEval?.id]);

  const [role, setRole] = useState<SessionRole>(existingEval?.role || 'Membro');
  const [attendance, setAttendance] = useState<AttendanceStatus>(
    existingEval?.attendance || 'Presente'
  );
  const [rubricChecks, setRubricChecks] =
    useState<Record<string, boolean>>(initialChecks);
  const [performanceTags, setPerformanceTags] = useState<string[]>(
    existingEval?.performanceTags || []
  );
  const [teacherNotes, setTeacherNotes] = useState(existingEval?.teacherNotes || '');
  const [pedagogicalFeedback, setPedagogicalFeedback] = useState(
    existingEval?.pedagogicalFeedback || ''
  );
  const [isMakeupMode, setIsMakeupMode] = useState(
    Boolean(
      existingEval?.makeupRequired &&
        !existingEval?.makeupCompleted &&
        existingEval?.attendance !== 'Atestado'
    )
  );
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    const checks =
      existingEval?.rubricChecks && Object.keys(existingEval.rubricChecks).length > 0
        ? existingEval.rubricChecks
        : restoreChecksFromScores(existingEval?.criterionScores || {});
    setRole(existingEval?.role || 'Membro');
    setAttendance(existingEval?.attendance || 'Presente');
    setRubricChecks(checks);
    setPerformanceTags(existingEval?.performanceTags || []);
    setTeacherNotes(existingEval?.teacherNotes || '');
    setPedagogicalFeedback(existingEval?.pedagogicalFeedback || '');
    setIsMakeupMode(
      Boolean(
        existingEval?.makeupRequired &&
          !existingEval?.makeupCompleted &&
          existingEval?.attendance !== 'Atestado'
      )
    );
    setSaveError('');
  }, [studentId, currentCase?.id, existingEval?.id]);

  const isAbsent = attendance === 'Ausente';
  const isPendingCertificate = attendance === 'Atestado' && !isMakeupMode;
  const criterionScores = useMemo<Record<string, number>>(
    () => calculateRubricScores(rubricChecks, isAbsent),
    [rubricChecks, isAbsent]
  );
  const liveTotalScore = Object.values(criterionScores).reduce<number>(
    (total, score) => total + Number(score || 0),
    0
  );

  if (!student) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p>Estudante não encontrado.</p>
        <button
          onClick={() => navigate('/avaliacoes')}
          className="mt-4 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white"
        >
          Voltar para Avaliações
        </button>
      </div>
    );
  }

  const handleAttendanceChange = (value: AttendanceStatus) => {
    setAttendance(value);
    if (value === 'Ausente') {
      setRubricChecks((previous) => clearClosingChecks(previous));
      setIsMakeupMode(false);
    } else if (value === 'Atestado') {
      setIsMakeupMode(false);
    }
  };

  const toggleRubricItem = (categoryId: string, itemId: string) => {
    if (isPendingCertificate || (isAbsent && categoryId === 'crit_3')) return;
    setRubricChecks((previous) => ({
      ...previous,
      [itemId]: !previous[itemId],
    }));
  };

  const toggleTag = (tag: string) => {
    setPerformanceTags((previous) =>
      previous.includes(tag)
        ? previous.filter((item) => item !== tag)
        : [...previous, tag]
    );
  };

  const buildEvaluation = (status: 'Concluído' | 'Rascunho'): Evaluation => {
    const completingMakeup =
      Boolean(existingEval?.makeupRequired) && isMakeupMode && status === 'Concluído';
    const certificate = attendance === 'Atestado' && !isMakeupMode;
    return {
      id: existingEval?.id || `eval_${student.id}_${currentCase?.id || weekNum}`,
      studentId: student.id,
      classId: student.classId,
      groupId: selectedTableId,
      week: weekNum,
      unit: unitNum,
      caseId: currentCase?.id || '',
      date: existingEval?.date || currentCase?.date || today(),
      role,
      attendance: completingMakeup ? 'Presente' : attendance,
      criterionScores,
      rubricChecks,
      totalGrossScore: certificate ? 0 : liveTotalScore,
      performanceTags,
      teacherNotes,
      pedagogicalFeedback,
      status: certificate ? 'Pendente' : status,
      updatedAt: today(),
      makeupRequired:
        certificate || Boolean(existingEval?.makeupRequired) || isMakeupMode,
      makeupCompleted:
        completingMakeup || Boolean(existingEval?.makeupCompleted),
      originalAbsenceDate: certificate
        ? existingEval?.originalAbsenceDate || currentCase?.date || today()
        : existingEval?.originalAbsenceDate,
      makeupDate: completingMakeup ? today() : existingEval?.makeupDate,
    };
  };

  const handleGenerateFeedback = async () => {
    if (!currentCase || !selectedTable) {
      setSaveError('O caso ou a mesa desta avaliação não foi encontrado.');
      return;
    }
    setIsAiGenerating(true);
    try {
      setPedagogicalFeedback(
        await generateGeminiFeedback(
          buildEvaluation('Concluído'),
          student,
          currentCase
        )
      );
    } catch (error) {
      console.error(error);
      setSaveError('Não foi possível gerar o parecer pedagógico.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSave = async (
    status: 'Concluído' | 'Rascunho',
    goToNext = false
  ) => {
    setSaveError('');
    if (!currentCase) {
      setSaveError('Caso APG não encontrado. Volte e selecione um caso válido.');
      return;
    }
    if (!selectedTable) {
      setSaveError('Mesa da avaliação não encontrada. Volte e defina a mesa do caso.');
      return;
    }

    setIsSaving(true);
    const result = await saveEvaluation(buildEvaluation(status));
    setIsSaving(false);
    if (!result.success) {
      setSaveError(result.error || 'Não foi possível salvar a avaliação.');
      return;
    }

    if (goToNext && nextStudent) {
      navigate(
        `/avaliar/${nextStudent.id}/${weekNum}?case=${currentCase.id}&table=${selectedTable.id}`
      );
    } else {
      navigate('/avaliacoes');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {saveError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {saveError}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate('/avaliacoes')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Lista de Avaliações
        </button>
        <div className="w-full sm:w-72">
          <ProgressBar
            value={completedInSessionCount}
            max={groupStudents.length}
            label={`Progresso da Turma (${selectedTable?.name || 'Mesa'})`}
            showValue
            color="emerald"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E3A8A] text-lg font-bold text-white">
              {student.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E3A8A] dark:text-blue-400">
                {student.name}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Matrícula: {student.enrollment} • {studentClass?.name} ({selectedTable?.name})
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="primary">
              Semana {weekNum} ({unitNum === 1 ? '1ª Unidade' : '2ª Unidade'})
            </Badge>
            <Badge variant="info">{currentCase?.title || 'Caso não encontrado'}</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Papel desempenhado na sessão
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Coordenador', 'Secretário', 'Membro'] as SessionRole[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setRole(item)}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold ${
                      role === item
                        ? 'border-indigo-900 bg-indigo-900 text-white dark:bg-indigo-600'
                        : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Status de presença
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['Presente', 'Presente'],
                  ['Ausente', 'Ausente'],
                  ['Atestado', 'Atestado'],
                ] as [string, AttendanceStatus][]
              ).map(([label, value]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleAttendanceChange(value)}
                  className={`rounded-xl border px-2 py-2 text-xs font-bold ${
                    attendance === value
                      ? value === 'Presente'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : value === 'Ausente'
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isPendingCertificate && (
        <div className="rounded-2xl border border-blue-300 bg-blue-50 p-5 dark:border-blue-900 dark:bg-blue-950/30">
          <h3 className="font-bold text-blue-900 dark:text-blue-200">
            Atestado registrado — segunda chamada pendente
          </h3>
          <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
            A data da falta e o caso foram preservados. Quando o estudante realizar a
            reposição, abra novamente esta avaliação e inicie a segunda chamada.
          </p>
          <button
            type="button"
            onClick={() => {
              setAttendance('Presente');
              setIsMakeupMode(true);
            }}
            className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800"
          >
            Realizar segunda chamada
          </button>
        </div>
      )}

      {!isPendingCertificate && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Rubrica de avaliação individual
              </h3>
              <p className="text-xs text-slate-500">
                Marque os itens observados. A nota é calculada automaticamente.
              </p>
            </div>
            <div className="rounded-xl bg-indigo-900 px-4 py-2 text-right text-white">
              <span className="block text-[10px] font-bold uppercase opacity-80">
                Total bruto
              </span>
              <span className="text-lg font-black">{liveTotalScore.toFixed(1)} / 20.0</span>
            </div>
          </div>

          {isAbsent && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              Ausência registrada: somente “Fechamento de problema” foi zerado. Os
              demais componentes continuam editáveis pelo professor.
            </div>
          )}

          {isMakeupMode && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              Segunda chamada em andamento. Todos os itens estão disponíveis e o
              histórico do atestado será preservado.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {RUBRIC_CATEGORIES.map((category, index) => {
              const disabled = isAbsent && category.id === 'crit_3';
              return (
                <section
                  key={category.id}
                  className={`rounded-xl border p-4 ${
                    disabled
                      ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20'
                      : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Critério #{index + 1}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {category.name}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {category.description}
                      </p>
                    </div>
                    <span className="whitespace-nowrap font-mono text-base font-black text-indigo-900 dark:text-indigo-300">
                      {criterionScores[category.id].toFixed(1)} / 5.0
                    </span>
                  </div>
                  <div className="space-y-2">
                    {category.items.map((item) => (
                      <label
                        key={item.id}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                          disabled
                            ? 'cursor-not-allowed border-rose-100 text-rose-400 dark:border-rose-900/50'
                            : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(rubricChecks[item.id])}
                          disabled={disabled}
                          onChange={() => toggleRubricItem(category.id, item.id)}
                          className="mt-0.5 h-4 w-4 accent-indigo-700"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  {disabled && (
                    <p className="mt-2 text-[11px] font-semibold text-rose-600">
                      Zerado automaticamente por ausência.
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold">Tags de desempenho e competências</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {availablePerformanceTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                performanceTags.includes(tag)
                  ? 'border-indigo-900 bg-indigo-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {performanceTags.includes(tag) ? `✓ ${tag}` : `+ ${tag}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 text-sm font-bold">Observações privadas do professor</h3>
          <textarea
            rows={4}
            value={teacherNotes}
            onChange={(event) => setTeacherNotes(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Parecer pedagógico para o estudante</h3>
            <button
              type="button"
              onClick={() => void handleGenerateFeedback()}
              disabled={isAiGenerating || isPendingCertificate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              {isAiGenerating ? 'Gerando...' : 'Gerar com Gemini'}
            </button>
          </div>
          <textarea
            rows={4}
            value={pedagogicalFeedback}
            onChange={(event) => setPedagogicalFeedback(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSave('Rascunho')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <Save className="h-4 w-4" />
          Salvar rascunho
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave('Concluído')}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {isMakeupMode ? <ClipboardCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {isMakeupMode ? 'Concluir segunda chamada' : 'Salvar avaliação'}
          </button>
          {nextStudent && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave('Concluído', true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-900 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              Salvar e próximo aluno
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
