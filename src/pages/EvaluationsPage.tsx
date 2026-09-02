import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { APGCase, AttendanceStatus, Evaluation, SessionRole } from '../types';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { SOIFilter } from '../components/common/SOIFilter';
import { RubricEvaluationModal } from '../components/RubricEvaluationModal';
import { ObservationModal } from '../components/ObservationModal';
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  Filter,
  Loader2,
  MessageSquare,
  Notebook,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';
import { loadTableNotebook, saveTableNotebook, TableNotebook } from '../services/academicService';
import { caseMatchesSOI } from '../utils/caseCatalog';

export const EvaluationsPage: React.FC = () => {
  const {
    classes,
    groups,
    sois,
    cases,
    students,
    evaluations,
    selectedSemesterId,
    selectedSoiId,
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
    deleteEvaluation,
    saveAPGCase,
  } = useApp();

  const navigate = useNavigate();

  // Selected session parameters
  const activeWeekNum = selectedWeek !== 'all' ? parseInt(selectedWeek) : 1;
  const currentUnitNum: 1 | 2 = activeWeekNum <= 8 ? 1 : 2;
  const semesterClasses = classes.filter(
    (item) =>
      (!selectedSemesterId || selectedSemesterId === 'all' || item.semesterId === selectedSemesterId)
  );
  const soiFilteredClasses = semesterClasses.filter(
    (item) => selectedSoiId === 'all' || !item.soiId || item.soiId === selectedSoiId
  );
  const scopedClasses =
    soiFilteredClasses.length > 0
      ? soiFilteredClasses
      : semesterClasses.length > 0
      ? semesterClasses
      : classes;

  const activeClassId =
    selectedClass !== 'all' && scopedClasses.some((item) => item.id === selectedClass)
      ? selectedClass
      : scopedClasses[0]?.id || '';
  const activeSoiId =
    selectedSoiId !== 'all'
      ? selectedSoiId
      : classes.find((item) => item.id === activeClassId)?.soiId || '';
  const availableCases = cases.filter(
    (c) =>
      c.week === activeWeekNum &&
      (selectedSoiId === 'all' || caseMatchesSOI(c, activeSoiId, sois)) &&
      (!selectedSemesterId || selectedSemesterId === 'all' || !c.semesterId || c.semesterId === selectedSemesterId)
  );

  const [selectedProblemNumber, setSelectedProblemNumber] = useState<1 | 2>(() => {
    try {
      const saved = localStorage.getItem('tutornote_active_problem_number');
      return saved === '2' ? 2 : 1;
    } catch {
      return 1;
    }
  });

  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  const currentCase =
    availableCases.find((c) => c.id === selectedCaseId) ||
    availableCases.find((c) => (c.problemNumber || c.caseNumber || 1) === selectedProblemNumber) ||
    availableCases[0];

  const curProblemNum: 1 | 2 =
    currentCase?.problemNumber ||
    currentCase?.caseNumber ||
    (currentCase?.id?.toLowerCase().includes('_s2') ||
     currentCase?.id?.toLowerCase().includes('_p2') ||
     currentCase?.id?.toLowerCase().includes('caso_2') ||
     currentCase?.id?.toLowerCase().includes('caso2') ||
     currentCase?.id?.toLowerCase().includes('case2') ||
     currentCase?.id?.toLowerCase().includes('c2') ||
     currentCase?.id?.toLowerCase().includes('p2')
      ? 2
      : 1);

  const handleSelectProblemNumber = (num: 1 | 2) => {
    setSelectedProblemNumber(num);
    try {
      localStorage.setItem('tutornote_active_problem_number', String(num));
    } catch {
      // Ignore
    }
    const matched = availableCases.find((c) => (c.problemNumber || c.caseNumber || 1) === num);
    if (matched) {
      setSelectedCaseId(matched.id);
    }
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    const matched = availableCases.find((c) => c.id === caseId);
    if (matched) {
      const pNum = (matched.problemNumber || matched.caseNumber || 1) === 2 ? 2 : 1;
      setSelectedProblemNumber(pNum);
      try {
        localStorage.setItem('tutornote_active_problem_number', String(pNum));
      } catch {
        // Ignore
      }
    }
  };

  useEffect(() => {
    if (availableCases.length) {
      const matched =
        availableCases.find((c) => c.id === selectedCaseId) ||
        availableCases.find((c) => (c.problemNumber || c.caseNumber || 1) === selectedProblemNumber);
      if (matched && matched.id !== selectedCaseId) {
        setSelectedCaseId(matched.id);
      }
    }
  }, [activeWeekNum, activeClassId, cases, selectedProblemNumber]);

  // Auto-sync global selectedUnit with activeWeekNum
  useEffect(() => {
    const targetUnitStr = currentUnitNum.toString();
    if (selectedUnit !== targetUnitStr) {
      setSelectedUnit(targetUnitStr);
    }
  }, [activeWeekNum]);

  const [sessionDate, setSessionDate] = useState<string>(currentCase?.date || '2026-02-09');
  const [dateSavedFeedback, setDateSavedFeedback] = useState<boolean>(false);
  const [showCaseDetails, setShowCaseDetails] = useState<boolean>(false);

  // Sync sessionDate when the selected case changes so each case maintains its own date
  useEffect(() => {
    if (currentCase) {
      setSessionDate(currentCase.date || '2026-02-09');
    }
  }, [currentCase?.id, currentCase?.date]);

  const formatDisplayDate = (d?: string) => {
    if (!d) return '';
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const handleSessionDateChange = async (newDate: string) => {
    setSessionDate(newDate);
    if (!newDate || newDate.trim().length !== 10) return;

    try {
      if (currentCase) {
        // 1. Persist the new date for this specific case (each case of each week has its own date)
        const saveRes = await saveAPGCase({
          ...currentCase,
          date: newDate,
        });

        if (saveRes.data?.id && saveRes.data.id !== selectedCaseId) {
          setSelectedCaseId(saveRes.data.id);
        }

        // 2. Update date on any existing evaluations for this case in the current session
        const currentProbNum = currentCase.problemNumber || currentCase.caseNumber || 1;
        const caseEvals = evaluations.filter(
          (e) =>
            (e.caseId === currentCase.id ||
              (Number(e.week) === Number(currentCase.week) &&
                Number(e.unit) === Number(currentCase.unit) &&
                (e.problemNumber || 1) === currentProbNum)) &&
            (activeClassId ? e.classId === activeClassId : true)
        );

        await Promise.allSettled(
          caseEvals.map((ev) => {
            if (ev.date !== newDate) {
              return saveEvaluation({
                ...ev,
                date: newDate,
                updatedAt: new Date().toISOString().split('T')[0],
              });
            }
            return Promise.resolve();
          })
        );

        setDateSavedFeedback(true);
        setTimeout(() => setDateSavedFeedback(false), 2500);
      }
    } catch (err) {
      console.error('Erro ao atualizar data da avaliação do caso:', err);
    }
  };

  // Table Notebook Modal State
  const [showNotebookModal, setShowNotebookModal] = useState<boolean>(false);
  const [notebookText, setNotebookText] = useState<string>('');
  const [notebookContributions, setNotebookContributions] = useState<TableNotebook['contributions']>([]);
  const [notebookStudentId, setNotebookStudentId] = useState('');
  const [notebookContributionText, setNotebookContributionText] = useState('');
  const [editingContributionIndex, setEditingContributionIndex] = useState<number | null>(null);
  const [editingStudentId, setEditingStudentId] = useState('');
  const [editingContributionText, setEditingContributionText] = useState('');
  const [notebookError, setNotebookError] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isNotebookLoaded, setIsNotebookLoaded] = useState<boolean>(false);

  // Rubric & Observation Modal State
  const [rubricModalStudentId, setRubricModalStudentId] = useState<string | null>(null);
  const [rubricInitialDomainIdx, setRubricInitialDomainIdx] = useState<number>(0);
  const [obsModalStudentId, setObsModalStudentId] = useState<string | null>(null);

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

  const notebookKey = `notebook_${activeClassId}_u${currentUnitNum}_${activeGroupId}_w${activeWeekNum}_${currentCase?.id || 'case1'}`;

  const selectedTable = groups.find((group) => {
    if (group.classId !== activeClassId) return false;
    if (group.id === activeGroupId) return true;
    const name = group.name.toLowerCase();
    return (activeGroupId === 'grp_m1' && name.includes('mesa 1')) ||
      (activeGroupId === 'grp_m2' && name.includes('mesa 2')) ||
      (activeGroupId === 'grp_m3' && name.includes('mesa 3'));
  });

  // Continuous Auto-Save to localStorage and Supabase
  useEffect(() => {
    if (!showNotebookModal || !isNotebookLoaded) return;

    // Synchronously write draft to localStorage
    const notebookData = { notes: notebookText, contributions: notebookContributions, updatedAt: Date.now() };
    localStorage.setItem(notebookKey, JSON.stringify(notebookData));

    const client = getSupabaseClient();
    if (!client || !isSupabaseEnvConfigured() || !currentCase || !selectedTable) {
      setAutoSaveStatus('saved');
      return;
    }

    setAutoSaveStatus('saving');
    const pNum = (currentCase.problemNumber || currentCase.caseNumber || 1) === 2 ? 2 : 1;
    const timer = setTimeout(async () => {
      try {
        const res = await saveTableNotebook(
          client,
          activeClassId,
          currentCase.id,
          selectedTable.id,
          {
            notes: notebookText,
            contributions: notebookContributions,
          },
          activeWeekNum,
          pNum
        );
        if (res.success) {
          setAutoSaveStatus('saved');
          setNotebookError('');
        } else {
          setAutoSaveStatus('idle');
        }
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [notebookText, notebookContributions, showNotebookModal, isNotebookLoaded, notebookKey, activeClassId, currentCase, selectedTable, activeWeekNum]);

  const openNotebook = async (targetCaseId?: string) => {
    const activeCaseToLoad = targetCaseId
      ? availableCases.find((c) => c.id === targetCaseId) || currentCase
      : currentCase;

    const targetCaseIdStr = activeCaseToLoad?.id || 'case1';
    const targetKey = `notebook_${activeClassId}_u${currentUnitNum}_${activeGroupId}_w${activeWeekNum}_${targetCaseIdStr}`;

    setNotebookError('');
    setIsNotebookLoaded(false);

    if (targetCaseId && targetCaseId !== selectedCaseId) {
      setSelectedCaseId(targetCaseId);
      const pNum = (activeCaseToLoad?.problemNumber || activeCaseToLoad?.caseNumber || 1) === 2 ? 2 : 1;
      setSelectedProblemNumber(pNum);
    }

    // 1. Instantly load from localStorage for zero latency
    const savedLocal = localStorage.getItem(targetKey);
    let localNotes = '';
    let localContribs: TableNotebook['contributions'] = [];
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        localNotes = parsed.notes || '';
        localContribs = parsed.contributions || [];
      } catch (err) {
        console.error(err);
      }
    }

    setNotebookText(localNotes);
    setNotebookContributions(localContribs);
    setShowNotebookModal(true);

    // 2. Load from Supabase and reconcile with local draft
    const client = getSupabaseClient();
    if (client && isSupabaseEnvConfigured() && activeCaseToLoad && selectedTable) {
      const pNum = (activeCaseToLoad.problemNumber || activeCaseToLoad.caseNumber || 1) === 2 ? 2 : 1;
      const result = await loadTableNotebook(
        client,
        activeClassId,
        activeCaseToLoad.id,
        selectedTable.id,
        activeWeekNum,
        pNum
      );
      if (result.success && result.data) {
        const remoteNotes = result.data.notes || '';
        const remoteContribs = result.data.contributions || [];

        if (!localNotes.trim() && remoteNotes.trim()) {
          setNotebookText(remoteNotes);
          setNotebookContributions(remoteContribs);
          localStorage.setItem(targetKey, JSON.stringify({ notes: remoteNotes, contributions: remoteContribs, updatedAt: Date.now() }));
        } else if (localNotes.trim() && !remoteNotes.trim()) {
          // Push local draft to Supabase
          saveTableNotebook(
            client,
            activeClassId,
            activeCaseToLoad.id,
            selectedTable.id,
            {
              notes: localNotes,
              contributions: localContribs,
            },
            activeWeekNum,
            pNum
          );
        }
      } else if (result.error) {
        setNotebookError(result.error);
      }
    }

    setIsNotebookLoaded(true);
    setAutoSaveStatus('saved');
  };

  const startEditingContribution = (index: number, item: { studentId: string; text: string }) => {
    setEditingContributionIndex(index);
    setEditingStudentId(item.studentId);
    setEditingContributionText(item.text);
  };

  const cancelEditingContribution = () => {
    setEditingContributionIndex(null);
    setEditingStudentId('');
    setEditingContributionText('');
  };

  const saveEditingContribution = () => {
    if (editingContributionIndex === null) return;
    if (!editingStudentId || !editingContributionText.trim()) return;

    // Preserves exact index and order of all discussion points
    setNotebookContributions((previous) =>
      previous.map((item, idx) =>
        idx === editingContributionIndex
          ? { studentId: editingStudentId, text: editingContributionText.trim() }
          : item
      )
    );
    cancelEditingContribution();
  };

  const handleSwitchNotebookCase = (newCaseId: string) => {
    if (newCaseId === currentCase?.id) return;
    cancelEditingContribution();
    // Save current case draft first
    const currentData = { notes: notebookText, contributions: notebookContributions, updatedAt: Date.now() };
    localStorage.setItem(notebookKey, JSON.stringify(currentData));
    void openNotebook(newCaseId);
  };

  const saveNotebook = async () => {
    cancelEditingContribution();
    const notebook = { notes: notebookText, contributions: notebookContributions };
    localStorage.setItem(notebookKey, JSON.stringify({ ...notebook, updatedAt: Date.now() }));

    const client = getSupabaseClient();
    if (client && isSupabaseEnvConfigured() && currentCase && selectedTable) {
      const pNum = (currentCase.problemNumber || currentCase.caseNumber || 1) === 2 ? 2 : 1;
      const result = await saveTableNotebook(
        client,
        activeClassId,
        currentCase.id,
        selectedTable.id,
        notebook,
        activeWeekNum,
        pNum
      );
      if (!result.success) {
        setNotebookError(result.error || 'Não foi possível salvar.');
        return;
      }
    }
    setShowNotebookModal(false);
  };

  const addNotebookContribution = () => {
    if (!notebookStudentId || !notebookContributionText.trim()) return;
    setNotebookContributions((previous) => [...previous, { studentId: notebookStudentId, text: notebookContributionText.trim() }]);
    setNotebookContributionText('');
  };

  // Helper to find or build an evaluation item for a student in this session
  const getStudentEvaluation = (studentId: string): Evaluation => {
    // 1. Strict match by studentId and caseId if available
    let existing: Evaluation | undefined;
    if (currentCase?.id) {
      existing = evaluations.find((e) => e.studentId === studentId && e.caseId === currentCase.id);
    }
    if (!existing) {
      // Match by student, week, and problem number (or explicit problemNumber)
      existing = evaluations.find((e) => {
        if (e.studentId !== studentId || Number(e.week) !== activeWeekNum) return false;
        if (e.problemNumber) return e.problemNumber === curProblemNum;
        const evalCase = cases.find((c) => c.id === e.caseId);
        const evalProblemNum =
          evalCase?.problemNumber ||
          evalCase?.caseNumber ||
          (e.caseId?.toLowerCase().includes('_s2') ||
           e.caseId?.toLowerCase().includes('_p2') ||
           e.caseId?.toLowerCase().includes('caso_2') ||
           e.caseId?.toLowerCase().includes('caso2') ||
           e.caseId?.toLowerCase().includes('case2') ||
           e.caseId?.toLowerCase().includes('c2') ||
           e.caseId?.toLowerCase().includes('p2')
            ? 2
            : 1);
        return evalProblemNum === curProblemNum;
      });
    }

    if (existing) {
      return existing;
    }

    const student = students.find((s) => s.id === studentId);
    return {
      id: `eval_${studentId}_w${activeWeekNum}_${currentCase?.id || (curProblemNum === 2 ? 'c2' : 'c1')}`,
      studentId,
      classId: student?.classId || activeClassId,
      groupId: student?.groupId || 'grp_a',
      week: activeWeekNum,
      unit: activeWeekNum <= 8 ? 1 : 2,
      problemNumber: curProblemNum,
      caseId: currentCase?.id || `case_w${activeWeekNum}${curProblemNum === 2 ? '_s2' : ''}`,
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

  // S1 and S2 case helpers for the active week
  const s1Case = availableCases.find((c) => (c.problemNumber === 1 || c.caseNumber === 1)) || availableCases[0];
  const s2Case = availableCases.find((c) => (c.problemNumber === 2 || c.caseNumber === 2)) || availableCases[1];

  const getSessionCompletedCount = (caseItem?: APGCase) => {
    if (!caseItem) return 0;
    const targetProblemNum = caseItem.problemNumber || caseItem.caseNumber || 1;
    return sessionStudents.filter((s) => {
      const ev = evaluations.find((e) => {
        if (e.studentId !== s.id || Number(e.week) !== activeWeekNum) return false;
        if (e.caseId === caseItem.id) return true;
        if (e.problemNumber) return e.problemNumber === targetProblemNum;
        const evalCase = cases.find((c) => c.id === e.caseId);
        const evalProblemNum = evalCase?.problemNumber || evalCase?.caseNumber || (e.caseId?.includes('_s2') ? 2 : 1);
        return evalProblemNum === targetProblemNum;
      });
      return ev?.status === 'Concluído';
    }).length;
  };

  const s1CompletedCount = getSessionCompletedCount(s1Case);
  const s2CompletedCount = getSessionCompletedCount(s2Case);

  // Single-Table Constraint per Case Rule Check
  // In APG, a tutor conducts only 1 table per case session.
  const conflictOtherTable = useMemo(() => {
    if (!currentCase?.id || activeGroupId === 'all') return null;

    for (const ev of evaluations) {
      if (ev.caseId !== currentCase.id) continue;
      if (ev.status !== 'Concluído' && ev.totalGrossScore <= 0 && ev.attendance === 'Presente') continue;

      const st = students.find((s) => s.id === ev.studentId);
      if (!st || (activeClassId && st.classId !== activeClassId)) continue;

      const alloc = getStudentAllocation(st.id, currentUnitNum);
      const studentGroupId = alloc?.groupId || st.groupId;

      if (studentGroupId && studentGroupId !== activeGroupId) {
        const otherGroup = groups.find((g) => g.id === studentGroupId);
        const countInOtherTable = evaluations.filter((e) => {
          if (e.caseId !== currentCase.id) return false;
          const otherStudent = students.find((s) => s.id === e.studentId);
          if (!otherStudent || (activeClassId && otherStudent.classId !== activeClassId)) return false;
          const otherAlloc = getStudentAllocation(otherStudent.id, currentUnitNum);
          return (otherAlloc?.groupId || otherStudent.groupId) === studentGroupId && (e.status === 'Concluído' || e.totalGrossScore > 0);
        }).length;

        return {
          groupId: studentGroupId,
          groupName:
            otherGroup?.name ||
            (studentGroupId === 'grp_m1'
              ? 'Mesa 1'
              : studentGroupId === 'grp_m2'
              ? 'Mesa 2'
              : studentGroupId === 'grp_m3'
              ? 'Mesa 3'
              : 'Outra Mesa'),
          studentName: st.name,
          count: countInOtherTable,
        };
      }
    }
    return null;
  }, [evaluations, currentCase, activeGroupId, activeClassId, students, currentUnitNum, getStudentAllocation, groups]);

  // Reset evaluation function
  const handleResetStudentEvaluation = (studentId: string) => {
    const st = students.find((s) => s.id === studentId);
    if (confirm(`Deseja realmente anular a avaliação de ${st?.name || 'estudante'} na Semana ${activeWeekNum}?`)) {
      void deleteEvaluation(studentId, currentUnitNum, activeWeekNum, currentCase?.id);
    }
  };

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

  const caseP1 = availableCases.find((c) => (c.problemNumber || c.caseNumber || 1) === 1) || availableCases[0];
  const caseP2 = availableCases.find((c) => (c.problemNumber || c.caseNumber) === 2) || availableCases[1];

  const getProblemEvaluatedCount = (targetProb: 1 | 2) => {
    const targetCase = targetProb === 1 ? caseP1 : caseP2;
    return sessionStudents.filter((st) => {
      const ev = evaluations.find((e) => {
        if (e.studentId !== st.id || Number(e.week) !== activeWeekNum) return false;
        if (targetCase?.id && e.caseId === targetCase.id) return true;
        if (e.problemNumber) return e.problemNumber === targetProb;
        const eCase = cases.find((c) => c.id === e.caseId);
        const eNum =
          eCase?.problemNumber ||
          eCase?.caseNumber ||
          (e.caseId?.toLowerCase().includes('_s2') ||
           e.caseId?.toLowerCase().includes('_p2') ||
           e.caseId?.toLowerCase().includes('caso_2') ||
           e.caseId?.toLowerCase().includes('caso2') ||
           e.caseId?.toLowerCase().includes('case2') ||
           e.caseId?.toLowerCase().includes('c2') ||
           e.caseId?.toLowerCase().includes('p2')
            ? 2
            : 1);
        return eNum === targetProb;
      });
      return ev && ev.status === 'Concluído';
    }).length;
  };

  const evaluatedCountP1 = getProblemEvaluatedCount(1);
  const evaluatedCountP2 = getProblemEvaluatedCount(2);

  return (
    <div className="space-y-6">
      {/* Header & Session Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
            Módulo de Avaliações
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lançamento e gerenciamento individual das sessões de tutoria APG
          </p>
        </div>

        {/* Filters in required order: 1. Semana -> 2. Unidade (derived) -> 3. Turma -> 4. Mesa */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Problema 1 / Problema 2 Quick Toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleSelectProblemNumber(1)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                curProblemNum === 1
                  ? 'bg-[#C20054] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700/60'
              }`}
              title="Alternar para Avaliações do Problema 1 (Caso 1)"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Problema 1</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  curProblemNum === 1
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {evaluatedCountP1}/{sessionStudents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectProblemNumber(2)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                curProblemNum === 2
                  ? 'bg-[#C20054] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700/60'
              }`}
              title="Alternar para Avaliações do Problema 2 (Caso 2)"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Problema 2</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  curProblemNum === 2
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {evaluatedCountP2}/{sessionStudents.length}
              </span>
            </button>
          </div>

          <button
            onClick={openNotebook}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-colors"
          >
            <Notebook className="h-4 w-4" />
            <span>Bloco de Notas da Mesa</span>
          </button>

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <SOIFilter compact />
            {/* 1. Semana Selector */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                1. Semana
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {Array.from({ length: 20 }, (_, i) => {
                  const w = i + 1;
                  return (
                    <option key={w} value={w.toString()} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                      Semana {w} ({w <= 8 ? '1ª Unidade' : '2ª Unidade'})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">Caso / Problema</label>
              <select
                value={currentCase?.id || ''}
                onChange={(event) => handleSelectCase(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 max-w-xs truncate"
              >
                {availableCases.map((apgCase) => (
                  <option key={apgCase.id} value={apgCase.id} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                    S{String(apgCase.week).padStart(2, '0')}P{apgCase.problemNumber || apgCase.caseNumber} — {apgCase.title}
                  </option>
                ))}
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
                value={activeClassId}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 min-w-[150px]"
              >
                {scopedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <label className="block text-[10px] uppercase font-bold text-slate-400">
                  Data do Caso ({currentCase ? `P${currentCase.problemNumber || currentCase.caseNumber || 1}` : 'Sessão'})
                </label>
                {dateSavedFeedback && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 animate-in fade-in">
                    <Check className="h-3 w-3" /> Salva
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Calendar className="h-3.5 w-3.5 text-[#C20054]" />
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => handleSessionDateChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 py-1 px-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#C20054]/30 cursor-pointer"
                  title="Altere a data deste caso específico da semana (cada caso pode ter sua data própria)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO DE NOTAS DA MESA MODAL */}
      {showNotebookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6">
          <div className="w-full max-w-4xl h-[90vh] max-h-[92vh] flex flex-col rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-zinc-800 shrink-0">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-md bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-[#C20054] dark:bg-rose-950/60 dark:text-rose-300">
                    {activeClassName}
                  </span>
                  {autoSaveStatus === 'saving' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C20054] dark:text-rose-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvando rascunho...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Salvo automaticamente neste caso
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Bloco de notas — {problemCode}: {currentCase?.title} — {activeTableName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Anotações isoladas por caso da semana (Caso 1 / Caso 2), mesa e turma.
                </p>

                {/* Caso 1 / Caso 2 Quick Switcher inside Modal */}
                {availableCases.length > 1 && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Caso da Semana:</span>
                    <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                      {s1Case && (
                        <button
                          type="button"
                          onClick={() => handleSwitchNotebookCase(s1Case.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            currentCase?.id === s1Case.id
                              ? 'bg-[#C20054] text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Caso 1
                        </button>
                      )}
                      {s2Case && (
                        <button
                          type="button"
                          onClick={() => handleSwitchNotebookCase(s2Case.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            currentCase?.id === s2Case.id
                              ? 'bg-[#C20054] text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Caso 2
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowNotebookModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Corpo da Janela com Rolagem e Altura Expandida */}
            <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-1.5">
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                  Anotações gerais da mesa
                </label>
                <textarea
                  value={notebookText}
                  onChange={(e) => setNotebookText(e.target.value)}
                  placeholder="Digite aqui as observações, impressões pedagógicas ou pontos de atenção da mesa neste caso..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800 focus:border-[#C20054] focus:ring-1 focus:ring-[#C20054] focus:outline-hidden dark:border-zinc-800 dark:bg-zinc-900 dark:text-slate-100 min-h-[100px] overflow-y-auto"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3 bg-slate-50/50 dark:bg-zinc-900/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-slate-100">Quem abordou cada ponto</p>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {notebookContributions.length} {notebookContributions.length === 1 ? 'ponto registrado' : 'pontos registrados'}
                  </span>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-[220px_1fr_auto]">
                  <select
                    value={notebookStudentId}
                    onChange={(e) => setNotebookStudentId(e.target.value)}
                    className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#C20054] shadow-xs cursor-pointer"
                  >
                    <option value="" className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-slate-100">
                      Selecione o estudante...
                    </option>
                    {sessionStudents.map((student) => (
                      <option
                        key={student.id}
                        value={student.id}
                        className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-slate-100"
                      >
                        {student.name}
                      </option>
                    ))}
                  </select>
                  <input
                    value={notebookContributionText}
                    onChange={(e) => setNotebookContributionText(e.target.value)}
                    placeholder="Ponto de discussão abordado pelo estudante..."
                    className="rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 px-3.5 py-2 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#C20054] shadow-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addNotebookContribution();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addNotebookContribution}
                    className="rounded-xl bg-[#C20054] hover:bg-[#A10045] text-xs font-bold text-white px-5 py-2 transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </button>
                </div>

                {notebookContributions.length > 0 ? (
                  <div className="max-h-[260px] overflow-y-auto space-y-2 pt-2 pr-1 border-t border-slate-200/60 dark:border-zinc-800/60">
                    {notebookContributions.map((item, index) => {
                      const isEditing = editingContributionIndex === index;

                      if (isEditing) {
                        return (
                          <div
                            key={`editing-${index}`}
                            className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 p-3 border-2 border-amber-400 dark:border-amber-600/80 shadow-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                                <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                Editando ponto de discussão #{index + 1}
                              </span>
                              <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 italic">
                                Pressione Enter para salvar ou Esc para cancelar
                              </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[200px_1fr_auto]">
                              <select
                                value={editingStudentId}
                                onChange={(e) => setEditingStudentId(e.target.value)}
                                className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
                              >
                                {sessionStudents.map((student) => (
                                  <option
                                    key={student.id}
                                    value={student.id}
                                    className="bg-white text-slate-900 dark:bg-zinc-900 dark:text-slate-100"
                                  >
                                    {student.name}
                                  </option>
                                ))}
                              </select>
                              <input
                                value={editingContributionText}
                                onChange={(e) => setEditingContributionText(e.target.value)}
                                placeholder="Texto do ponto de discussão..."
                                autoFocus
                                className="rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 shadow-2xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    saveEditingContribution();
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelEditingContribution();
                                  }
                                }}
                              />
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={saveEditingContribution}
                                  title="Salvar alteração (mantém a posição)"
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingContribution}
                                  title="Cancelar edição"
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${item.studentId}-${index}`}
                          className="flex items-center justify-between rounded-xl bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-800 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700 transition-colors gap-2"
                        >
                          <span className="break-words pr-2 flex-1">
                            <strong className="text-[#C20054] dark:text-rose-400 font-bold">
                              {students.find((s) => s.id === item.studentId)?.name || 'Estudante'}:
                            </strong>{' '}
                            {item.text}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <button
                              type="button"
                              title="Editar ponto de discussão"
                              aria-label="Editar ponto de discussão"
                              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/50 transition-colors cursor-pointer flex items-center justify-center"
                              onClick={() => startEditingContribution(index, item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Remover ponto de discussão"
                              aria-label="Remover ponto de discussão"
                              className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors cursor-pointer flex items-center justify-center"
                              onClick={() => {
                                if (editingContributionIndex === index) {
                                  cancelEditingContribution();
                                }
                                setNotebookContributions((items) => items.filter((_, i) => i !== index));
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400 dark:text-slate-500 italic">
                    Nenhum ponto de discussão registrado para esta sessão ainda.
                  </div>
                )}
              </div>

              {/* PAINEL DO CONTADOR DE PARTICIPAÇÕES DOS ESTUDANTES */}
              <div className="rounded-2xl border border-rose-100 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 dark:border-rose-900/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#C20054] dark:text-rose-400" />
                    <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                      Contador de Participações dos Estudantes
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    <span className="text-slate-600 dark:text-slate-400">
                      Total de pontos: <strong className="text-[#C20054] dark:text-rose-300">{notebookContributions.length}</strong>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      Estudantes ativos:{' '}
                      <strong className="text-[#C20054] dark:text-rose-300">
                        {sessionStudents.filter((st) => notebookContributions.some((c) => c.studentId === st.id)).length} / {sessionStudents.length}
                      </strong>
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5">
                  {sessionStudents.map((st) => {
                    const count = notebookContributions.filter((c) => c.studentId === st.id).length;
                    const isSelected = notebookStudentId === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setNotebookStudentId(st.id)}
                        title={`Clique para selecionar ${st.name} no registro`}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all cursor-pointer ${
                          count > 0
                            ? isSelected
                              ? 'bg-[#C20054] text-white border-[#C20054] shadow-xs'
                              : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 border-rose-200 dark:border-rose-900/60 hover:border-[#C20054]'
                            : isSelected
                              ? 'bg-slate-800 text-white border-slate-800'
                              : 'bg-white/80 dark:bg-zinc-900/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate max-w-[150px] sm:max-w-[200px]">{st.name}</span>
                        <span
                          className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                            count > 0
                              ? isSelected
                                ? 'bg-white text-[#C20054]'
                                : 'bg-[#C20054] text-white'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                  {sessionStudents.length === 0 && (
                    <span className="text-xs text-slate-400 italic">Nenhum estudante alocado nesta mesa.</span>
                  )}
                </div>
              </div>
            </div>

            {notebookError && <p className="text-xs font-semibold text-rose-600 shrink-0 mb-2">{notebookError}</p>}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800 shrink-0">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                Conteúdo preservado e sincronizado em tempo real.
              </span>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setShowNotebookModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  onClick={saveNotebook}
                  className="rounded-xl bg-[#C20054] hover:bg-[#A10045] px-5 py-2 text-xs font-extrabold text-white transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Concluir e Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Caso 1 and Caso 2 Quick Switcher */}
      {availableCases.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#C20054]" />
            <span>Casos da Semana {activeWeekNum}:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 max-w-2xl">
            {/* Caso 1 Button */}
            {s1Case && (
              <button
                type="button"
                onClick={() => setSelectedCaseId(s1Case.id)}
                className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  currentCase?.id === s1Case.id
                    ? 'bg-indigo-900 dark:bg-indigo-600 text-white border-indigo-900 dark:border-indigo-600 shadow-xs ring-2 ring-indigo-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                      currentCase?.id === s1Case.id
                        ? 'bg-indigo-700 text-white dark:bg-indigo-800'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    C1
                  </span>
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate">Caso 1</span>
                    <span
                      className={`text-[10px] font-medium ${
                        currentCase?.id === s1Case.id
                          ? 'text-indigo-200'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      📅 {s1Case.date ? formatDisplayDate(s1Case.date) : 'Data a definir'}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                    s1CompletedCount === sessionStudents.length && sessionStudents.length > 0
                      ? 'bg-emerald-500 text-white'
                      : s1CompletedCount > 0
                      ? currentCase?.id === s1Case.id
                        ? 'bg-indigo-700 text-white'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {s1CompletedCount}/{sessionStudents.length} avaliados
                </span>
              </button>
            )}

            {/* Caso 2 Button */}
            {s2Case && (
              <button
                type="button"
                onClick={() => setSelectedCaseId(s2Case.id)}
                className={`flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  currentCase?.id === s2Case.id
                    ? 'bg-indigo-900 dark:bg-indigo-600 text-white border-indigo-900 dark:border-indigo-600 shadow-xs ring-2 ring-indigo-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                      currentCase?.id === s2Case.id
                        ? 'bg-indigo-700 text-white dark:bg-indigo-800'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    C2
                  </span>
                  <div className="flex flex-col text-left truncate">
                    <span className="truncate">Caso 2</span>
                    <span
                      className={`text-[10px] font-medium ${
                        currentCase?.id === s2Case.id
                          ? 'text-indigo-200'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      📅 {s2Case.date ? formatDisplayDate(s2Case.date) : 'Data a definir'}
                    </span>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold shrink-0 ${
                    s2CompletedCount === sessionStudents.length && sessionStudents.length > 0
                      ? 'bg-emerald-500 text-white'
                      : s2CompletedCount > 0
                      ? currentCase?.id === s2Case.id
                        ? 'bg-indigo-700 text-white'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {s2CompletedCount}/{sessionStudents.length} avaliados
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* APG Single-Table Constraint Warning Alert */}
      {conflictOtherTable && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-200/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5 sm:mt-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  Regra APG: Avaliação de 1 Mesa por Caso da Semana
                </h4>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                  Você já registrou avaliações para a <strong>{conflictOtherTable.groupName}</strong> no caso{' '}
                  <strong>{currentCase?.title}</strong> ({conflictOtherTable.count} alunos com notas/presença).
                  No modelo tutorial, o tutor avalia uma única mesa por caso. Você pode avaliar a mesma mesa no <strong>Caso 1 e Caso 2</strong>, ou avaliar outra mesa no <strong>Caso 2</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              {s2Case && currentCase?.id !== s2Case.id && (
                <button
                  type="button"
                  onClick={() => setSelectedCaseId(s2Case.id)}
                  className="rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-3 py-2 transition-colors cursor-pointer shadow-xs"
                >
                  Alternar para Caso 2 (C2)
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedGroup(conflictOtherTable.groupId)}
                className="rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-zinc-800 text-amber-900 dark:text-amber-200 text-xs font-bold px-3 py-2 transition-colors cursor-pointer"
              >
                Ir para {conflictOtherTable.groupName}
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-indigo-800/80 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-indigo-200">
                  Caso #{currentCase.problemNumber || currentCase.caseNumber} • Semana {currentCase.week} (
                  {currentCase.unit === 1 ? '1ª Unidade' : '2ª Unidade'})
                </span>
                <span className="text-xs text-indigo-200 font-semibold bg-indigo-800/40 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-rose-300" />
                  {currentCase.date ? formatDisplayDate(currentCase.date) : 'Data a definir'}
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
        <div className="border-b border-slate-100 p-4 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${
                  curProblemNum === 2
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50'
                    : 'bg-rose-100 text-[#C20054] dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                }`}
              >
                {curProblemNum === 2 ? 'Caso 2 (Problema 2)' : 'Caso 1 (Problema 1)'}
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Semana {activeWeekNum} — {currentCase?.title || `Problema ${curProblemNum}`}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Lançamento de notas individuais para esta sessão. Clique sobre qualquer nota para abrir a Rubrica Oficial APG.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">
              Média bruta máxima por avaliação: 20.0 pontos
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3">Estudante</th>
                <th className="px-3 py-3">Presença</th>
                <th className="px-3 py-3">Papel</th>
                <th className="px-3 py-3 text-center">Abertura</th>
                <th className="px-3 py-3 text-center">Postura</th>
                <th className="px-3 py-3 text-center">Fechamento</th>
                <th className="px-3 py-3 text-center">Assiduidade</th>
                <th className="px-3 py-3 text-center">Ajuste</th>
                <th className="px-3 py-3 text-center">Total</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-center">Obs</th>
                <th className="px-3 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {sessionStudents.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                    Nenhum estudante encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                sessionStudents.map((student) => {
                  const ev = getStudentEvaluation(student.id);
                  const scores = ev.criterionScores || {};

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{student.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">RA: {student.enrollment}</div>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={ev.attendance}
                          onChange={(e) =>
                            handleQuickAttendanceChange(
                              student.id,
                              e.target.value as AttendanceStatus
                            )
                          }
                          className={`rounded-lg border py-1 px-1.5 text-xs font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            ev.attendance === 'Presente'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : ev.attendance === 'Ausente'
                              ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          <option value="Presente" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">P (Presente)</option>
                          <option value="Ausente" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">F (Falta)</option>
                          <option value="Atestado" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">J (Atestado)</option>
                        </select>
                      </td>

                      <td className="px-3 py-3">
                        <select
                          value={ev.role}
                          onChange={(e) =>
                            handleQuickRoleChange(student.id, e.target.value as SessionRole)
                          }
                          className="rounded-lg border border-slate-200 bg-white py-1 px-1.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Coordenador" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">Coordenador</option>
                          <option value="Secretário" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">Secretário</option>
                          <option value="Membro" className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-100">Membro</option>
                        </select>
                      </td>

                      {/* Domain 1: Abertura */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRubricInitialDomainIdx(0);
                            setRubricModalStudentId(student.id);
                          }}
                          className={`min-w-[48px] rounded-lg border px-2 py-1 text-xs font-bold transition-all hover:scale-105 ${
                            ev.attendance !== 'Presente'
                              ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
                              : scores.crit_1 !== undefined
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {ev.attendance === 'Presente' && scores.crit_1 !== undefined ? scores.crit_1.toFixed(1) : '--'}
                        </button>
                      </td>

                      {/* Domain 2: Postura */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRubricInitialDomainIdx(1);
                            setRubricModalStudentId(student.id);
                          }}
                          className={`min-w-[48px] rounded-lg border px-2 py-1 text-xs font-bold transition-all hover:scale-105 ${
                            ev.attendance !== 'Presente'
                              ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
                              : scores.crit_2 !== undefined
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {ev.attendance === 'Presente' && scores.crit_2 !== undefined ? scores.crit_2.toFixed(1) : '--'}
                        </button>
                      </td>

                      {/* Domain 3: Fechamento */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRubricInitialDomainIdx(2);
                            setRubricModalStudentId(student.id);
                          }}
                          className={`min-w-[48px] rounded-lg border px-2 py-1 text-xs font-bold transition-all hover:scale-105 ${
                            ev.attendance !== 'Presente'
                              ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
                              : scores.crit_3 !== undefined
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {ev.attendance === 'Presente' && scores.crit_3 !== undefined ? scores.crit_3.toFixed(1) : '--'}
                        </button>
                      </td>

                      {/* Domain 4: Assiduidade */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRubricInitialDomainIdx(3);
                            setRubricModalStudentId(student.id);
                          }}
                          className={`min-w-[48px] rounded-lg border px-2 py-1 text-xs font-bold transition-all hover:scale-105 ${
                            ev.attendance !== 'Presente'
                              ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
                              : scores.crit_4 !== undefined
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                          }`}
                        >
                          {ev.attendance === 'Presente' && scores.crit_4 !== undefined ? scores.crit_4.toFixed(1) : '--'}
                        </button>
                      </td>

                      {/* Manual Adjustment (+/-) */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setRubricInitialDomainIdx(4);
                            setRubricModalStudentId(student.id);
                          }}
                          title={ev.adjustmentReason ? `Ajuste Docente: ${ev.adjustmentReason}` : 'Ajuste manual docente (+/-)'}
                          className={`min-w-[48px] rounded-lg border px-2 py-1 text-xs font-bold transition-all hover:scale-105 ${
                            ev.attendance !== 'Presente'
                              ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800'
                              : (ev.adjustmentScore ?? 0) > 0
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-2xs'
                              : (ev.adjustmentScore ?? 0) < 0
                              ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 shadow-2xs'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {ev.attendance === 'Presente'
                            ? (ev.adjustmentScore ?? 0) > 0
                              ? `+${(ev.adjustmentScore ?? 0).toFixed(1)}`
                              : (ev.adjustmentScore ?? 0).toFixed(1)
                            : '--'}
                        </button>
                      </td>

                      {/* Total Score */}
                      <td className="px-3 py-3 text-center font-bold">
                        <span className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 text-emerald-900 dark:text-emerald-300">
                          {ev.attendance === 'Presente' ? ev.totalGrossScore.toFixed(1) : '0.0'}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-center">
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

                      {/* Obs Button */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setObsModalStudentId(student.id)}
                          title="Observações da Sessão"
                          className={`rounded-lg p-1.5 transition-colors border ${
                            ev.teacherNotes
                              ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </td>

                      {/* Action Button */}
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(ev.status === 'Concluído' || ev.totalGrossScore > 0 || (ev.criterionScores && Object.values(ev.criterionScores).some((v) => v > 0))) && (
                            <button
                              type="button"
                              onClick={() => handleResetStudentEvaluation(student.id)}
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors shadow-2xs"
                              title="Anular avaliação lançada por engano"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Anular</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRubricInitialDomainIdx(0);
                              setRubricModalStudentId(student.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 dark:bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-800 dark:hover:bg-indigo-500 transition-colors shadow-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>{ev.status === 'Concluído' ? 'Editar' : 'Avaliar'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rubric Evaluation Modal */}
      {rubricModalStudentId && (() => {
        const studentToEval = sessionStudents.find((s) => s.id === rubricModalStudentId);
        if (!studentToEval) return null;
        const evalToEdit = getStudentEvaluation(rubricModalStudentId);

        return (
          <RubricEvaluationModal
            isOpen={Boolean(rubricModalStudentId)}
            onClose={() => setRubricModalStudentId(null)}
            student={studentToEval}
            evaluation={evalToEdit}
            onSave={(updatedEval) => void saveEvaluation(updatedEval)}
            allStudents={sessionStudents}
            onSelectStudent={(nextId) => setRubricModalStudentId(nextId)}
            initialDomainIndex={rubricInitialDomainIdx}
          />
        );
      })()}

      {/* Observation Modal */}
      {obsModalStudentId && (() => {
        const studentToObs = sessionStudents.find((s) => s.id === obsModalStudentId);
        if (!studentToObs) return null;
        const evalToObs = getStudentEvaluation(obsModalStudentId);

        return (
          <ObservationModal
            isOpen={Boolean(obsModalStudentId)}
            onClose={() => setObsModalStudentId(null)}
            student={studentToObs}
            evaluation={evalToObs}
            onSave={(updatedEval) => void saveEvaluation(updatedEval)}
          />
        );
      })()}
    </div>
  );
};
