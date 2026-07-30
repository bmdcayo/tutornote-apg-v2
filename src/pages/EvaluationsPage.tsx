import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AttendanceStatus, Evaluation, SessionRole } from '../types';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Filter,
  Notebook,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';
import { loadTableNotebook, saveTableNotebook, TableNotebook } from '../services/academicService';

export const EvaluationsPage: React.FC = () => {
  const {
    classes,
    groups,
    cases,
    students,
    evaluations,
    selectedSemesterId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
    selectedWeek,
    setSelectedWeek,
    getStudentAllocation,
    getStudentTableName,
    saveEvaluation,
  } = useApp();

  const navigate = useNavigate();

  // Selected session parameters
  const activeWeekNum = selectedWeek !== 'all' ? parseInt(selectedWeek) : 1;
  const currentUnitNum: 1 | 2 = activeWeekNum <= 8 ? 1 : 2;
  const activeClassId = selectedClass !== 'all' ? selectedClass : classes[0]?.id || '';
  const availableCases = cases.filter((c) => c.week === activeWeekNum && (!c.classId || c.classId === activeClassId));
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const currentCase = availableCases.find((c) => c.id === selectedCaseId) || availableCases[0];
  useEffect(() => {
    if (availableCases.length && !availableCases.some((c) => c.id === selectedCaseId)) setSelectedCaseId(availableCases[0].id);
  }, [activeWeekNum, activeClassId, cases, selectedCaseId]);

  // Auto-sync global selectedUnit with activeWeekNum
  useEffect(() => {
    const targetUnitStr = currentUnitNum.toString();
    if (selectedUnit !== targetUnitStr) {
      setSelectedUnit(targetUnitStr);
    }
  }, [activeWeekNum]);

  const [sessionDate, setSessionDate] = useState<string>(currentCase?.date || '2026-02-09');
  const [showCaseDetails, setShowCaseDetails] = useState<boolean>(false);

  // Table Notebook Modal State
  const [showNotebookModal, setShowNotebookModal] = useState<boolean>(false);
  const [notebookText, setNotebookText] = useState<string>('');
  const [notebookContributions, setNotebookContributions] = useState<TableNotebook['contributions']>([]);
  const [notebookStudentId, setNotebookStudentId] = useState('');
  const [notebookContributionText, setNotebookContributionText] = useState('');
  const [notebookError, setNotebookError] = useState('');

  // Get active class and group students
  const activeGroupId = selectedGroup !== 'all' ? selectedGroup : 'all';

  const sessionStudents = students.filter((s) => {
    if (s.ativo === false || s.status === 'Inativo') return false;
    if (activeClassId && s.classId !== activeClassId) return false;
    if (activeGroupId !== 'all') {
      const alloc = getStudentAllocation(s.id, currentUnitNum);
      if (!alloc) return false;
      if (alloc.groupId !== activeGroupId) {
        const group = groups.find((g) => g.id === alloc.groupId);
        if (!group) return false;
        const lowerName = group.name.toLowerCase();
        if (activeGroupId === 'grp_m1' && !lowerName.includes('mesa 1')) return false;
        if (activeGroupId === 'grp_m2' && !lowerName.includes('mesa 2')) return false;
        if (activeGroupId === 'grp_m3' && !lowerName.includes('mesa 3')) return false;
      }
    }
    return true;
  });

  // Load table notebook text from storage (isolated by class, unit, table, and week)
  const activeClassName = classes.find((c) => c.id === activeClassId)?.name || 'Medicina 2026.1';
  const activeTableName =
    activeGroupId === 'grp_m1'
      ? 'Mesa 1'
      : activeGroupId === 'grp_m2'
      ? 'Mesa 2'
      : activeGroupId === 'grp_m3'
      ? 'Mesa 3'
      : 'Todas as Mesas';
  const weekPad = activeWeekNum < 10 ? `0${activeWeekNum}` : `${activeWeekNum}`;
  const problemCode = `S${weekPad}P${currentCase?.problemNumber || currentCase?.caseNumber || 1}`;

  const notebookKey = `notebook_${activeClassId}_u${currentUnitNum}_${activeGroupId}_w${activeWeekNum}`;

  const selectedTable = groups.find((group) => {
    if (group.classId !== activeClassId) return false;
    if (group.id === activeGroupId) return true;
    const name = group.name.toLowerCase();
    return (activeGroupId === 'grp_m1' && name.includes('mesa 1')) ||
      (activeGroupId === 'grp_m2' && name.includes('mesa 2')) ||
      (activeGroupId === 'grp_m3' && name.includes('mesa 3'));
  });
  const openNotebook = async () => {
    const client = getSupabaseClient();
    if (client && isSupabaseEnvConfigured() && currentCase && selectedTable) {
      const result = await loadTableNotebook(client, activeClassId, currentCase.id, selectedTable.id);
      if (result.success && result.data) {
        setNotebookText(result.data.notes); setNotebookContributions(result.data.contributions);
      } else setNotebookError(result.error || 'Não foi possível carregar as anotações.');
    } else {
      const saved = localStorage.getItem(notebookKey);
      const parsed = saved ? JSON.parse(saved) : { notes: '', contributions: [] };
      setNotebookText(parsed.notes || ''); setNotebookContributions(parsed.contributions || []);
    }
    setShowNotebookModal(true);
  };

  const saveNotebook = async () => {
    const notebook = { notes: notebookText, contributions: notebookContributions };
    const client = getSupabaseClient();
    if (client && isSupabaseEnvConfigured() && currentCase && selectedTable) {
      const result = await saveTableNotebook(client, activeClassId, currentCase.id, selectedTable.id, notebook);
      if (!result.success) { setNotebookError(result.error || 'Não foi possível salvar.'); return; }
    } else localStorage.setItem(notebookKey, JSON.stringify(notebook));
    setShowNotebookModal(false);
  };
  const addNotebookContribution = () => {
    if (!notebookStudentId || !notebookContributionText.trim()) return;
    setNotebookContributions((previous) => [...previous, { studentId: notebookStudentId, text: notebookContributionText.trim() }]);
    setNotebookContributionText('');
  };

  // Helper to find or build an evaluation item for a student in this session
  const getStudentEvaluation = (studentId: string): Evaluation => {
    const existing = evaluations.find(
      (e) => e.studentId === studentId && e.caseId === currentCase?.id
    );
    if (existing) return existing;

    const student = students.find((s) => s.id === studentId);
    return {
      id: `eval_${studentId}_w${activeWeekNum}`,
      studentId,
      classId: student?.classId || activeClassId,
      groupId: student?.groupId || 'grp_a',
      week: activeWeekNum,
      unit: activeWeekNum <= 8 ? 1 : 2,
      caseId: currentCase?.id || '',
      date: sessionDate,
      role: 'Membro',
      attendance: 'Presente',
      criterionScores: { crit_1: 0, crit_2: 0, crit_3: 0, crit_4: 0 },
      totalGrossScore: 0,
      performanceTags: [],
      teacherNotes: '',
      pedagogicalFeedback: '',
      status: 'Pendente',
      updatedAt: new Date().toISOString().split('T')[0],
    };
  };

  // Session Stats
  let evaluatedCount = 0;
  let pendingCount = 0;
  let presentCount = 0;
  let absentCount = 0;
  let certCount = 0;

  sessionStudents.forEach((s) => {
    const ev = getStudentEvaluation(s.id);
    if (ev.status === 'Concluído') evaluatedCount++;
    else pendingCount++;

    if (ev.attendance === 'Presente') presentCount++;
    else if (ev.attendance === 'Ausente') absentCount++;
    else if (ev.attendance === 'Atestado') certCount++;
  });

  const totalStudentsInSession = sessionStudents.length;
  const consideredSessions = presentCount + absentCount;
  const sessionAttendanceRate =
    consideredSessions > 0 ? (presentCount / consideredSessions) * 100 : 100;

  // Quick Inline Role & Attendance Changer
  const handleQuickRoleChange = (studentId: string, role: SessionRole) => {
    const ev = getStudentEvaluation(studentId);
    void saveEvaluation({ ...ev, role });
  };

  const handleQuickAttendanceChange = (
    studentId: string,
    attendance: AttendanceStatus
  ) => {
    const ev = getStudentEvaluation(studentId);
    let updatedStatus = ev.status;
    let scores = { ...ev.criterionScores };

    if (attendance === 'Ausente') {
      // Absent score is 0
      scores = { crit_1: 0, crit_2: 0, crit_3: 0, crit_4: 0 };
      updatedStatus = 'Pendente';
    } else if (attendance === 'Atestado') {
      scores = { crit_1: 0, crit_2: 0, crit_3: 0, crit_4: 0 };
      updatedStatus = 'Concluído';
    }

    void saveEvaluation({
      ...ev,
      attendance,
      criterionScores: scores,
      status: updatedStatus,
      makeupRequired: attendance === 'Atestado',
      makeupCompleted: attendance === 'Atestado' ? false : ev.makeupCompleted,
      originalAbsenceDate: attendance === 'Atestado' ? sessionDate : ev.originalAbsenceDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Session Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A8A] dark:text-blue-400 tracking-tight">
            Módulo de Avaliações
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lançamento e gerenciamento individual das sessões de tutoria APG
          </p>
        </div>

        {/* Filters in required order: 1. Semana -> 2. Unidade (derived) -> 3. Turma -> 4. Mesa */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openNotebook}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            <Notebook className="h-4 w-4" />
            <span>Bloco de Notas da Mesa</span>
          </button>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            {/* 1. Semana Selector */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                1. Semana / Caso
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {Array.from({ length: 20 }, (_, i) => {
                  const w = i + 1;
                  return (
                    <option key={w} value={w.toString()}>
                      Semana {w} ({w <= 8 ? '1ª Unidade' : '2ª Unidade'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Caso</label>
              <select value={currentCase?.id || ''} onChange={(event) => setSelectedCaseId(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold">
                {availableCases.map((apgCase) => <option key={apgCase.id} value={apgCase.id}>S{String(apgCase.week).padStart(2, '0')}P{apgCase.problemNumber || apgCase.caseNumber} — {apgCase.title}</option>)}
              </select>
            </div>

            {/* Unidade e Mesa */}
            <UnitTableFilters
              selectedUnit={currentUnitNum.toString()}
              onUnitChange={() => {}} // Unit is derived from week
              selectedTable={selectedGroup}
              onTableChange={setSelectedGroup}
              disableUnitSelect={true}
            />

            {/* 3. Turma Selector */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                Turma
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {classes.filter((c) => !selectedSemesterId || c.semesterId === selectedSemesterId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                Data da Sessão
              </label>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Calendar className="h-3.5 w-3.5" />
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-1 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO DE NOTAS DA MESA MODAL */}
      {showNotebookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <span className="inline-block rounded-md bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {activeClassName}
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  Bloco de notas — {problemCode} — {currentUnitNum}ª Unidade — {activeTableName}
                </h3>
                <p className="text-xs text-slate-500">
                  Anotações pedagógicas isoladas por turma, unidade, mesa e semana.
                </p>
              </div>
              <button
                onClick={() => setShowNotebookModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <textarea
              value={notebookText}
              onChange={(e) => setNotebookText(e.target.value)}
              placeholder="Digite aqui as observações, impressões pedagógicas ou pontos de atenção da mesa nesta sessão..."
              rows={8}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="rounded-xl border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-bold">Quem abordou cada ponto</p>
              <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                <select value={notebookStudentId} onChange={(e) => setNotebookStudentId(e.target.value)} className="rounded-lg border px-2 py-2 text-xs">
                  <option value="">Selecione o estudante</option>
                  {sessionStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
                </select>
                <input value={notebookContributionText} onChange={(e) => setNotebookContributionText(e.target.value)} placeholder="Ponto de discussão abordado..." className="rounded-lg border px-3 py-2 text-xs" />
                <button type="button" onClick={addNotebookContribution} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">Adicionar</button>
              </div>
              {notebookContributions.map((item, index) => <div key={`${item.studentId}-${index}`} className="flex justify-between text-xs"><span><strong>{students.find((s) => s.id === item.studentId)?.name}:</strong> {item.text}</span><button type="button" className="text-rose-600" onClick={() => setNotebookContributions((items) => items.filter((_, i) => i !== index))}>Remover</button></div>)}
            </div>
            {notebookError && <p className="text-xs font-semibold text-rose-600">{notebookError}</p>}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowNotebookModal(false)}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={saveNotebook}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-xs"
              >
                Salvar Anotações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APG Case Banner & Objectives Accordion */}
      {currentCase && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-900 to-indigo-950 p-5 text-white shadow-md dark:border-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-800/80 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-indigo-200">
                  Caso #{currentCase.caseNumber} • Semana {currentCase.week} (
                  {currentCase.unit === 1 ? '1ª Unidade' : '2ª Unidade'})
                </span>
                <span className="text-xs text-indigo-300 font-medium">
                  {currentCase.time} • {currentCase.room}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-bold">{currentCase.title}</h2>
              <p className="text-xs text-indigo-200/90">{currentCase.theme}</p>
            </div>

            <button
              onClick={() => setShowCaseDetails(!showCaseDetails)}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              <span>{showCaseDetails ? 'Ocultar Instruções' : 'Ver Instruções & Objetivos'}</span>
              {showCaseDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {showCaseDetails && (
            <div className="mt-4 border-t border-indigo-800/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h4 className="font-bold text-indigo-200 uppercase tracking-wider mb-1">
                  Objetivos de Aprendizagem
                </h4>
                <ul className="list-disc list-inside space-y-1 text-indigo-100/90">
                  {currentCase.learningObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-indigo-200 uppercase tracking-wider mb-1">
                  Instruções ao Tutor
                </h4>
                <p className="text-indigo-100/90 leading-relaxed">{currentCase.teacherInstructions}</p>
                <div className="mt-2 text-[11px] text-indigo-300 italic">
                  Descrição: {currentCase.description}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase text-slate-400">Total Alunos</p>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100">{totalStudentsInSession}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Avaliados</p>
          <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{evaluatedCount}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Pendentes</p>
          <p className="text-lg font-black text-amber-700 dark:text-amber-300">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase text-slate-400">Presentes</p>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100">{presentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase text-rose-500">Ausentes</p>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400">{absentCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase text-blue-500">Atestados</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{certCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-bold uppercase text-slate-400">Frequência</p>
          <p className="text-lg font-black text-slate-800 dark:text-slate-100">
            {sessionAttendanceRate.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Session Students Interactive Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Lista de Estudantes da Sessão (Semana {activeWeekNum})
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            Média bruta máxima por avaliação: 20.0 pontos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Estudante</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Grupo</th>
                <th className="px-4 py-3">Papel na Sessão</th>
                <th className="px-4 py-3">Presença</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Nota Bruta (Máx 20)</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {sessionStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Nenhum estudante encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sessionStudents.map((student) => {
                  const ev = getStudentEvaluation(student.id);

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                        {student.name}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono">{student.enrollment}</td>
                      <td className="px-4 py-3">
                        <Badge variant="neutral" size="sm">
                          {groups.find((g) => g.id === student.groupId)?.name || 'Grupo A'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={ev.role}
                          onChange={(e) =>
                            handleQuickRoleChange(student.id, e.target.value as SessionRole)
                          }
                          className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <option value="Coordenador">Coordenador</option>
                          <option value="Secretário">Secretário</option>
                          <option value="Membro">Membro</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={ev.attendance}
                          onChange={(e) =>
                            handleQuickAttendanceChange(
                              student.id,
                              e.target.value as AttendanceStatus
                            )
                          }
                          className={`rounded-lg border py-1 px-2 text-xs font-bold ${
                            ev.attendance === 'Presente'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : ev.attendance === 'Ausente'
                              ? 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          <option value="Presente">Presente</option>
                          <option value="Ausente">Ausente (0.0)</option>
                          <option value="Atestado">Atestado (2ª chamada)</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            ev.status === 'Concluído'
                              ? 'success'
                              : ev.status === 'Pendente'
                              ? 'warning'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {ev.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {ev.attendance === 'Presente'
                          ? `${ev.totalGrossScore.toFixed(1)} / 20.0`
                          : ev.attendance === 'Ausente'
                          ? '0.0 / 20.0 (Falta)'
                          : ev.makeupCompleted ? '2ª chamada concluída' : 'Pendente de 2ª chamada'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            navigate(`/avaliar/${student.id}/${activeWeekNum}?case=${currentCase?.id || ''}`)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-800 transition-colors shadow-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>{ev.status === 'Concluído' ? 'Editar' : 'Avaliar'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
