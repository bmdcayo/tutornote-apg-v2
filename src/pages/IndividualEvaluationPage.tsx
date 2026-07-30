import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AttendanceStatus, Evaluation, SessionRole } from '../types';
import { availablePerformanceTags } from '../services/mockData';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Bot,
  CheckCircle2,
  Save,
  Sparkles,
  Tag,
  UserCheck,
} from 'lucide-react';

export const IndividualEvaluationPage: React.FC = () => {
  const { studentId, weekStr } = useParams<{ studentId: string; weekStr: string }>();
  const navigate = useNavigate();
  const {
    students,
    classes,
    groups,
    cases,
    evaluations,
    settings,
    getStudentAllocation,
    saveEvaluation,
    generateGeminiFeedback,
  } = useApp();

  const weekNum = weekStr ? parseInt(weekStr) : 1;
  const location = useLocation();
  const requestedCaseId = new URLSearchParams(location.search).get('case') || '';
  const student = students.find((s) => s.id === studentId);
  const currentCase = cases.find((c) => c.id === requestedCaseId) ||
    cases.find((c) => c.week === weekNum && (!c.classId || c.classId === student?.classId));

  // Group students for progress bar & "Salvar e Próximo"
  const groupStudents = students.filter(
    (s) => s.classId === student?.classId && s.groupId === student?.groupId
  );
  const currentStudentIdx = groupStudents.findIndex((s) => s.id === studentId);
  const nextStudent =
    currentStudentIdx >= 0 && currentStudentIdx < groupStudents.length - 1
      ? groupStudents[currentStudentIdx + 1]
      : null;

  // Completed evaluations in this session for progress
  const completedInSessionCount = groupStudents.filter((s) => {
    const ev = evaluations.find((e) => e.studentId === s.id && e.caseId === currentCase?.id);
    return ev?.status === 'Concluído';
  }).length;

  // Existing evaluation or default state
  const existingEval = evaluations.find(
    (e) => e.studentId === studentId && e.caseId === currentCase?.id
  );

  const [role, setRole] = useState<SessionRole>(existingEval?.role || 'Membro');
  const [attendance, setAttendance] = useState<AttendanceStatus>(
    existingEval?.attendance || 'Presente'
  );

  // Criteria scores (0 to max 5.0)
  const initialScores: Record<string, number> = existingEval?.criterionScores || {
    crit_1: 4.5,
    crit_2: 4.5,
    crit_3: 4.0,
    crit_4: 4.0,
  };
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>(initialScores);

  const [performanceTags, setPerformanceTags] = useState<string[]>(
    existingEval?.performanceTags || []
  );
  const [teacherNotes, setTeacherNotes] = useState<string>(existingEval?.teacherNotes || '');
  const [pedagogicalFeedback, setPedagogicalFeedback] = useState<string>(
    existingEval?.pedagogicalFeedback || ''
  );
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [saveError, setSaveError] = useState('');

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

  const studentClass = classes.find((c) => c.id === student.classId);
  const unitNum = weekNum <= 8 ? 1 : 2;
  const unitAllocation = getStudentAllocation(student.id, unitNum);
  const studentGroup = groups.find((g) => g.id === (unitAllocation?.groupId || student.groupId));

  // Calculate live total score
  const liveTotalScore = settings.baremaCriteria.reduce((acc, crit) => {
    const scoreVal = criterionScores[crit.id] ?? 0;
    return acc + Math.max(0, Math.min(scoreVal, crit.maxScore));
  }, 0);

  const handleScoreChange = (critId: string, val: number) => {
    const crit = settings.baremaCriteria.find((c) => c.id === critId);
    const max = crit?.maxScore || 5;
    const clamped = Math.max(0, Math.min(val, max));
    setCriterionScores((prev) => ({ ...prev, [critId]: clamped }));
  };

  const toggleTag = (tag: string) => {
    if (performanceTags.includes(tag)) {
      setPerformanceTags(performanceTags.filter((t) => t !== tag));
    } else {
      setPerformanceTags([...performanceTags, tag]);
    }
  };

  const handleGenerateFeedback = async () => {
    setIsAiGenerating(true);
    try {
      const dummyEval: Evaluation = {
        id: existingEval?.id || `eval_${student.id}_w${weekNum}`,
        studentId: student.id,
        classId: student.classId,
        groupId: unitAllocation?.groupId || student.groupId,
        week: weekNum,
        unit: unitNum,
        caseId: currentCase?.id || '',
        date: new Date().toISOString().split('T')[0],
        role,
        attendance,
        criterionScores,
        totalGrossScore: liveTotalScore,
        performanceTags,
        teacherNotes,
        pedagogicalFeedback: '',
        status: 'Concluído',
        updatedAt: new Date().toISOString().split('T')[0],
      };

      const result = await generateGeminiFeedback(dummyEval, student, currentCase);
      setPedagogicalFeedback(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSave = async (status: 'Concluído' | 'Rascunho', goToNext = false) => {
    setSaveError('');
    const isCertificate = attendance === 'Atestado';
    const isCompletingMakeup = Boolean(existingEval?.makeupRequired) && attendance === 'Presente' && status === 'Concluído';
    const evalData: Evaluation = {
      id: existingEval?.id || `eval_${student.id}_w${weekNum}`,
      studentId: student.id,
      classId: student.classId,
      groupId: unitAllocation?.groupId || student.groupId,
      week: weekNum,
      unit: unitNum,
      caseId: currentCase?.id || '',
      date: existingEval?.date || new Date().toISOString().split('T')[0],
      role,
      attendance,
      criterionScores,
      totalGrossScore: attendance === 'Presente' ? liveTotalScore : 0,
      performanceTags,
      teacherNotes,
      pedagogicalFeedback,
      status: isCertificate ? 'Pendente' : status,
      updatedAt: new Date().toISOString().split('T')[0],
      makeupRequired: isCertificate || existingEval?.makeupRequired || false,
      makeupCompleted: isCompletingMakeup || existingEval?.makeupCompleted || false,
      originalAbsenceDate: isCertificate ? existingEval?.originalAbsenceDate || new Date().toISOString().split('T')[0] : existingEval?.originalAbsenceDate,
      makeupDate: isCompletingMakeup ? new Date().toISOString().split('T')[0] : existingEval?.makeupDate,
    };

    const result = await saveEvaluation(evalData);
    if (!result.success) { setSaveError(result.error || 'Não foi possível salvar a avaliação.'); return; }

    if (goToNext && nextStudent) {
      navigate(`/avaliar/${nextStudent.id}/${weekNum}?case=${currentCase?.id || ''}`);
    } else {
      navigate('/avaliacoes');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {saveError && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{saveError}</div>}
      {/* Top Bar with Back Button & Session Progress */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate('/avaliacoes')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para Lista de Avaliações</span>
        </button>

        {/* Group Session Progress Bar */}
        <div className="w-full sm:w-72">
          <ProgressBar
            value={completedInSessionCount}
            max={groupStudents.length}
            label={`Progresso da Turma (${studentGroup?.name})`}
            showValue
            color="emerald"
          />
        </div>
      </div>

      {/* Student Identification Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E3A8A] text-white font-bold text-lg shadow-sm">
              {student.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1E3A8A] dark:text-blue-400">
                {student.name}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Matrícula: {student.enrollment} • {studentClass?.name} ({studentGroup?.name})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              Semana {weekNum} ({unitNum === 1 ? '1ª Unidade' : '2ª Unidade'})
            </Badge>
            <Badge variant="info">{currentCase?.title || 'Caso APG'}</Badge>
          </div>
        </div>

        {/* Role & Attendance Pickers */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Papel Desempenhado na Sessão
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Coordenador', 'Secretário', 'Membro'] as SessionRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-xl border py-2 px-3 text-xs font-bold transition-all ${
                    role === r
                      ? 'border-indigo-900 bg-indigo-900 text-white shadow-xs dark:bg-indigo-600'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Status de Presença
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { label: 'Presente', val: 'Presente' },
                  { label: 'Ausente (0.0)', val: 'Ausente' },
                  { label: 'Atestado', val: 'Atestado' },
                ] as { label: string; val: AttendanceStatus }[]
              ).map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setAttendance(item.val)}
                  className={`rounded-xl border py-2 px-2 text-xs font-bold transition-all ${
                    attendance === item.val
                      ? item.val === 'Presente'
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : item.val === 'Ausente'
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Four Barema Criteria Scores (Max 20 pts total) */}
      {attendance === 'Presente' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Critérios do Barema de Avaliação Individual
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Atribua pontuação de 0.0 a 5.0 pontos para cada um dos 4 critérios
              </p>
            </div>
            <div className="rounded-xl bg-indigo-900 px-4 py-2 text-white text-right shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-80">
                Total Bruto
              </span>
              <span className="text-lg font-black">{liveTotalScore.toFixed(1)} / 20.0</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {settings.baremaCriteria.map((crit, idx) => {
              const currentVal = criterionScores[crit.id] ?? 0;
              return (
                <div
                  key={crit.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Critério #{idx + 1}
                      </span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {crit.name}
                      </h4>
                      {crit.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {crit.description}
                        </p>
                      )}
                    </div>
                    <span className="text-base font-black text-indigo-900 dark:text-indigo-300 font-mono">
                      {currentVal.toFixed(1)} / {crit.maxScore}.0
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <input
                      type="range"
                      min="0"
                      max={crit.maxScore}
                      step="0.1"
                      value={currentVal}
                      onChange={(e) => handleScoreChange(crit.id, parseFloat(e.target.value))}
                      className="w-full accent-indigo-900 dark:accent-indigo-500 cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max={crit.maxScore}
                      step="0.1"
                      value={currentVal}
                      onChange={(e) =>
                        handleScoreChange(crit.id, parseFloat(e.target.value) || 0)
                      }
                      className="w-16 rounded-lg border border-slate-200 bg-white py-1 px-2 text-center text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Tags Selection */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Tags de Desempenho e Competências
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {availablePerformanceTags.map((tag) => {
            const isSelected = performanceTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-indigo-900 bg-indigo-900 text-white shadow-xs dark:bg-indigo-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isSelected ? `✓ ${tag}` : `+ ${tag}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Teacher Notes & Gemini Pedagogical Feedback */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Teacher Confidential Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">
            Observações Privadas do Professor
          </h3>
          <textarea
            rows={4}
            value={teacherNotes}
            onChange={(e) => setTeacherNotes(e.target.value)}
            placeholder="Anotações sobre comportamento, engajamento ou pontos de dúvida do aluno..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {/* Pedagogical Feedback + Gemini Generator */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Parecer Pedagógico para o Estudante
            </h3>
            <button
              type="button"
              onClick={handleGenerateFeedback}
              disabled={isAiGenerating}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-900 to-indigo-800 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>{isAiGenerating ? 'Gerando...' : 'Gerar parecer com Gemini'}</span>
            </button>
          </div>
          <textarea
            rows={4}
            value={pedagogicalFeedback}
            onChange={(e) => setPedagogicalFeedback(e.target.value)}
            placeholder="Parecer descritivo e orientações para os próximos casos APG..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Save Action Footer */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => handleSave('Rascunho')}
          className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Salvar Rascunho
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave('Concluído', false)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Salvar Avaliação</span>
          </button>

          {nextStudent && (
            <button
              type="button"
              onClick={() => handleSave('Concluído', true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-800 shadow-md"
            >
              <span>Salvar e Próximo Aluno</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
