import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  APGCase,
  AppSettings,
  Class,
  ClassGroup,
  Evaluation,
  Semester,
  Student,
  StudentCalculatedSummary,
  TableAllocation,
  TableAllocationChangeLog,
} from '../types';
import {
  initialAPGCases,
  initialClasses,
  initialEvaluations,
  initialGroups,
  initialSemesters,
  initialSettings,
  initialStudents,
  initialTableAllocationLogs,
  initialTableAllocations,
} from '../services/mockData';
import {
  calculateEvaluationTotalScore,
  calculateStudentSummary,
} from '../services/calculationService';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  createClassInSupabase,
  CreateClassParams,
  CreateClassResult,
  deleteClassInSupabase,
  fetchAllClassesAndMesas,
  fetchMesasForTurma,
} from '../services/classCreationService';
import {
  StudentEditPayload,
  createStudentInSupabase,
  deactivateStudentInSupabase,
  deleteStudentInSupabase,
  isValidUuid,
  reactivateStudentInSupabase,
  saveStudentTableAllocationsInSupabase,
  updateStudentInSupabase,
  updateStudentTableAllocationInSupabase,
  validateTablesBelongToClass,
} from '../services/studentService';
import {
  deleteCaseInSupabase,
  loadSettingsFromSupabase,
  saveCaseInSupabase,
  saveEvaluationInSupabase,
  saveSettingsInSupabase,
} from '../services/academicService';

interface AppContextType {
  semesters: Semester[];
  classes: Class[];
  groups: ClassGroup[];
  students: Student[];
  cases: APGCase[];
  evaluations: Evaluation[];
  settings: AppSettings;
  darkMode: boolean;
  toggleDarkMode: () => void;
  refreshStudents: () => Promise<void>;
  updateStudentFull: (studentId: string, payload: StudentEditPayload) => Promise<{ success: boolean; error?: string }>;
  updateStudentTablesFull: (studentId: string, classId: string, u1MesaId: string, u2MesaId: string) => Promise<{ success: boolean; error?: string }>;
  deactivateStudentFull: (studentId: string) => Promise<{ success: boolean; error?: string }>;
  reactivateStudentFull: (studentId: string) => Promise<{ success: boolean; error?: string }>;
  deleteStudentDefinitely: (studentId: string) => Promise<{ success: boolean; error?: string }>;

  // Supabase Class & Table Creation states & methods
  isCreatingClass: boolean;
  classError: string | null;
  mesasPendingTurmaId: string | null;
  clearClassError: () => void;
  refreshClassesAndGroups: () => Promise<void>;
  createClassInDatabase: (params: Omit<CreateClassParams, 'userId'>) => Promise<CreateClassResult>;
  retryFetchMesasForTurma: (turmaId: string) => Promise<{ success: boolean; groups?: ClassGroup[]; error?: string }>;
  updateClassInDatabase: (cls: Class) => Promise<{ success: boolean; error?: string }>;
  deleteClassInDatabase: (classId: string) => Promise<{ success: boolean; error?: string }>;

  // Table Allocations
  tableAllocations: TableAllocation[];
  tableAllocationLogs: TableAllocationChangeLog[];
  getStudentAllocation: (studentId: string, unit: 1 | 2) => TableAllocation | undefined;
  getStudentTableName: (studentId: string, unit: 1 | 2) => string;
  saveTableAllocation: (studentId: string, classId: string, groupId: string, unit: 1 | 2, changedBy?: string) => void;
  copyUnit1CompositionToUnit2: (classId: string, changedBy?: string) => number;
  removeTableAllocation: (studentId: string, unit: 1 | 2) => void;

  // Reminders & Notifications
  s08p2ReminderOpen: boolean;
  setS08p2ReminderOpen: (open: boolean) => void;
  s08p2PendingAlert: boolean;
  setS08p2PendingAlert: (pending: boolean) => void;
  notifications: string[];
  addNotification: (msg: string) => void;
  dismissNotification: (index: number) => void;

  // Global Filter State
  selectedSemester: string;
  setSelectedSemester: (sem: string) => void;
  selectedSemesterId: string;
  setSelectedSemesterId: (id: string) => void;
  selectedClass: string;
  setSelectedClass: (cls: string) => void;
  selectedGroup: string;
  setSelectedGroup: (grp: string) => void;
  selectedUnit: string; // 'all' | '1' | '2'
  setSelectedUnit: (unit: string) => void;
  selectedWeek: string; // 'all' | '1'..'20'
  setSelectedWeek: (week: string) => void;
  globalSearch: string;
  setGlobalSearch: (term: string) => void;

  // Actions
  saveEvaluation: (evaluation: Evaluation) => Promise<{ success: boolean; error?: string }>;
  getStudentCalculatedSummary: (studentId: string) => StudentCalculatedSummary | null;
  getCalculatedSummaries: () => StudentCalculatedSummary[];
  addStudent: (student: Omit<Student, 'id'>, unit1GroupId?: string, unit2GroupId?: string) => void;
  updateStudent: (student: Student, unit1GroupId?: string, unit2GroupId?: string) => void;
  deleteStudent: (studentId: string) => void;
  importStudents: (newStudents: Omit<Student, 'id'>[]) => void;
  saveAPGCase: (apgCase: APGCase) => Promise<{ success: boolean; error?: string }>;
  deleteAPGCase: (caseId: string) => Promise<{ success: boolean; error?: string }>;
  saveClass: (cls: Class) => void;
  saveGroup: (grp: ClassGroup) => void;
  updateSettings: (newSettings: AppSettings) => Promise<{ success: boolean; error?: string }>;
  generateGeminiFeedback: (evaluation: Evaluation, student: Student, apgCase?: APGCase) => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDev = Boolean(import.meta.env.DEV || import.meta.env.MODE === 'development');
  const envDemoConfig = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
  const isDemoMode = isDev && envDemoConfig;

  const { user, profile } = useAuth();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<Class[]>(isDemoMode ? initialClasses : []);
  const [groups, setGroups] = useState<ClassGroup[]>(isDemoMode ? initialGroups : []);
  const [students, setStudents] = useState<Student[]>(isDemoMode ? initialStudents : []);
  const [cases, setCases] = useState<APGCase[]>(isDemoMode ? initialAPGCases : []);
  const [evaluations, setEvaluations] = useState<Evaluation[]>(isDemoMode ? initialEvaluations : []);
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Class & Table Creation Async States
  const [isCreatingClass, setIsCreatingClass] = useState<boolean>(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [mesasPendingTurmaId, setMesasPendingTurmaId] = useState<string | null>(null);

  // Table Allocations State
  const [tableAllocations, setTableAllocations] = useState<TableAllocation[]>(isDemoMode ? initialTableAllocations : []);
  const [tableAllocationLogs, setTableAllocationLogs] = useState<TableAllocationChangeLog[]>(isDemoMode ? initialTableAllocationLogs : []);

  // Reminders & Notifications State
  const [s08p2ReminderOpen, setS08p2ReminderOpen] = useState<boolean>(false);
  const [s08p2PendingAlert, setS08p2PendingAlert] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // Fetch classes and tables directly from Supabase
  const refreshClassesAndGroups = async () => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseEnvConfigured()) return;

    try {
      const { classes: fetchedClasses, groups: fetchedGroups } = await fetchAllClassesAndMesas(client);
      setClasses(fetchedClasses);
      setGroups(fetchedGroups);
    } catch (err) {
      console.error('[Supabase Fetch Error]', err);
    }
  };

  // Initial data loading from Supabase when available
  useEffect(() => {
    const loadSupabaseData = async () => {
      const client = getSupabaseClient();
      if (!client || !isSupabaseEnvConfigured()) return;

      try {
        // 1. Semestres (Apenas ativos)
        const { data: semData } = await client
          .from('semestres')
          .select('id, nome, data_inicio, data_fim, ativo')
          .eq('ativo', true)
          .order('data_inicio');
        if (semData && semData.length > 0) {
          const mappedSem = semData.map((s: any) => ({
            id: s.id,
            name: s.nome || s.codigo || '',
            startDate: s.data_inicio || '',
            endDate: s.data_fim || '',
            isCurrent: Boolean(s.ativo),
          }));
          setSemesters(mappedSem);
          const activeSem = mappedSem.find((s) => s.isCurrent) || mappedSem[0];
          if (activeSem) {
            setSelectedSemesterIdState(activeSem.id);
            setSelectedSemesterState(activeSem.name);
          }
        } else {
          setSemesters([]);
          setSelectedSemesterIdState('');
          setSelectedSemesterState('');
        }

        // 2. Turmas e Mesas
        await refreshClassesAndGroups();

        // 3. Alunos e Alocações de Mesa
        const { data: alData, error: alunosError } = await client.from('alunos').select('*');
        if (alunosError) {
          throw alunosError;
        }

        const { data: alocData, error: alocacoesError } = await client
          .from('alocacoes_mesa')
          .select('id, aluno_id, turma_id, mesa_id, unidade, data_inicio, data_fim, alterado_por, created_at, updated_at');
        if (alocacoesError) {
          console.error('[Supabase Fetch Allocations Error]', alocacoesError);
        }
        const { data: mesasData } = await client.from('mesas').select('*');

        const allMesas = mesasData || [];
        const allAlocations = alocacoesError ? [] : (alocData || []);

        const validAlunos = (alData || []).filter((a: any) => !String(a.id).startsWith('std_'));
        const stdIgnored = (alData || []).length - validAlunos.length;
        if (stdIgnored > 0) {
          console.info(`[Supabase Sync] Ignorados ${stdIgnored} estudantes legados com ID local std_`);
        }

        setStudents(
          validAlunos.map((a: any) => {
            const u1Alloc = allAlocations.find((al: any) => al.aluno_id === a.id && Number(al.unidade) === 1);
            const u2Alloc = allAlocations.find((al: any) => al.aluno_id === a.id && Number(al.unidade) === 2);
            const u1Mesa = allMesas.find((m: any) => m.id === u1Alloc?.mesa_id);
            const u2Mesa = allMesas.find((m: any) => m.id === u2Alloc?.mesa_id);

            const derivedClassId = u1Alloc?.turma_id || u2Alloc?.turma_id || u1Mesa?.turma_id || u2Mesa?.turma_id || '';
            const derivedGroupId = u1Alloc?.mesa_id || u2Alloc?.mesa_id || '';

            return {
              id: a.id,
              name: a.nome || '',
              enrollment: a.matricula || '',
              classId: derivedClassId,
              groupId: derivedGroupId,
              status: a.ativo === false ? 'Inativo' : 'Ativo',
              ativo: a.ativo !== false,
              semestreCurso: a.semestre_curso || '',
            };
          })
        );

        // 4. Casos APG
        const { data: csData } = await client.from('casos_apg').select('*');
        if (csData && csData.length > 0) {
          setCases(
            csData.map((c: any) => ({
              id: c.id,
              classId: c.turma_id || '',
              problemNumber: Number(c.numero) === 2 ? 2 : 1,
              caseNumber: Number(c.numero) === 2 ? 2 : 1,
              week: c.semana || 1,
              unit: c.semana <= 8 ? 1 : 2,
              title: c.titulo || c.title,
              theme: c.tema || c.theme || '',
              date: c.data || '',
              time: c.hora_inicio || '',
              room: c.sala || '',
              description: c.descricao || '',
              learningObjectives: Array.isArray(c.objetivos) ? c.objetivos : [],
              teacherInstructions: c.instrucoes_tutor || '',
              status: c.status || 'planejado',
            }))
          );
        }

        // 5. Avaliações
        const { data: evData } = await client.from('avaliacoes').select('*');
        if (evData && evData.length > 0) {
          const mappedEvaluations: Evaluation[] = evData.map((e: any) => {
              const evalUnit = Number(e.unidade || (Number(e.semana) > 8 ? 2 : 1)) as 1 | 2;
              const studentAllocation = allAlocations.find(
                (a: any) => a.aluno_id === e.aluno_id && Number(a.unidade) === evalUnit
              );
              return {
                id: e.id,
                studentId: e.aluno_id,
                classId: e.turma_id || studentAllocation?.turma_id || '',
                groupId: e.mesa_id || studentAllocation?.mesa_id || '',
                week: e.semana || 1,
                unit: evalUnit,
                caseId: e.caso_id || e.sessao_id || '',
                date: e.created_at || new Date().toISOString().split('T')[0],
                role: e.papel_sessao || 'Membro',
                attendance: e.presenca || 'Presente',
                criterionScores: e.pontuacoes_criterios || {
                  crit_1: Number(e.abertura || 0),
                  crit_2: Number(e.postura || 0),
                  crit_3: Number(e.desempenho || 0),
                  crit_4: Number(e.fechamento || 0),
                },
                totalGrossScore: Number(e.nota_bruta || 0),
                performanceTags: Array.isArray(e.tags) ? e.tags : [],
                teacherNotes: e.observacao_professor || '',
                pedagogicalFeedback: e.parecer_ia || '',
                status: e.status || 'Concluído',
                updatedAt: e.updated_at || e.created_at || new Date().toISOString().split('T')[0],
                makeupRequired: Boolean(e.segunda_chamada_necessaria),
                makeupCompleted: Boolean(e.segunda_chamada_concluida),
                originalAbsenceDate: e.data_falta_original || undefined,
                makeupDate: e.data_segunda_chamada || undefined,
              };
            });
          setEvaluations(mappedEvaluations);
          const makeupAlerts = mappedEvaluations
            .filter((evaluation) => evaluation.makeupRequired && !evaluation.makeupCompleted)
            .map((evaluation) => {
              const studentName = validAlunos.find((item: any) => item.id === evaluation.studentId)?.nome || 'Estudante';
              const caseRow = (csData || []).find((item: any) => item.id === evaluation.caseId);
              const code = `S${String(evaluation.week).padStart(2, '0')}P${Number(caseRow?.numero) === 2 ? 2 : 1}`;
              return `Segunda chamada pendente: ${studentName} — ${code} — falta em ${evaluation.originalAbsenceDate || evaluation.date}.`;
            });
          setNotifications((previous) => Array.from(new Set([...makeupAlerts, ...previous])));
        }

        setSettings(await loadSettingsFromSupabase(client, initialSettings));

        // 6. Alocações de Mesas
        setTableAllocations(
          allAlocations.map((a: any) => ({
            id: a.id,
            studentId: a.aluno_id,
            classId: a.turma_id,
            groupId: a.mesa_id,
            unit: Number(a.unidade) as 1 | 2,
            startDate: a.data_inicio || a.created_at || '',
            createdAt: a.created_at || '',
            updatedAt: a.updated_at || a.created_at || '',
            changedBy: a.alterado_por || 'Sistema',
          }))
        );
      } catch (err) {
        console.warn('[Supabase Initial Data Load]', err);
      }
    };

    loadSupabaseData();
  }, [user?.id]);

  // Create Class In Database (Supabase)
  const createClassInDatabase = async (
    params: Omit<CreateClassParams, 'userId'>
  ): Promise<CreateClassResult> => {
    setIsCreatingClass(true);
    setClassError(null);

    const client = getSupabaseClient();
    const userId = user?.id || profile?.id;

    if (!client || !isSupabaseEnvConfigured() || !userId) {
      if (!params.semesterId) {
        setIsCreatingClass(false);
        return {
          success: false,
          error: 'Nenhum semestre letivo ativo foi encontrado. Cadastre ou ative um semestre antes de criar a turma.',
        };
      }
      // Offline / Local state mode fallback
      const newId = `cls_${Date.now()}`;
      const newClass: Class = {
        id: newId,
        name: params.name,
        semesterId: params.semesterId,
        yearSemester: params.yearSemester,
        responsibleTeacher: params.responsibleTeacher || profile?.nome || 'Docente não identificado',
      };
      const defaultMesas: ClassGroup[] = [
        { id: `grp_m1_${newId}`, name: 'Mesa 1', classId: newId, limitStudents: 10 },
        { id: `grp_m2_${newId}`, name: 'Mesa 2', classId: newId, limitStudents: 10 },
        { id: `grp_m3_${newId}`, name: 'Mesa 3', classId: newId, limitStudents: 10 },
      ];
      setClasses((prev) => [newClass, ...prev]);
      setGroups((prev) => [...prev, ...defaultMesas]);
      setIsCreatingClass(false);
      return { success: true, class: newClass, groups: defaultMesas };
    }

    // Call service to perform real Supabase INSERT & table fetching
    const result = await createClassInSupabase(client, {
      ...params,
      userId,
    });

    if (result.success && result.class) {
      if (result.class.semesterId) {
        setSelectedSemesterId(result.class.semesterId);
      }
      // Invalidate cache and re-fetch from Supabase to keep state in full sync
      await refreshClassesAndGroups();

      if (result.mesasPending) {
        setMesasPendingTurmaId(result.class.id);
      } else {
        setMesasPendingTurmaId(null);
      }
    } else {
      setClassError(result.error || 'Erro ao cadastrar turma no banco de dados.');
    }

    setIsCreatingClass(false);
    return result;
  };

  // Retry fetching mesas for a class
  const retryFetchMesasForTurmaHandler = async (
    turmaId: string
  ): Promise<{ success: boolean; groups?: ClassGroup[]; error?: string }> => {
    const client = getSupabaseClient();
    if (!client || !isSupabaseEnvConfigured()) {
      const currentGroups = groups.filter((g) => g.classId === turmaId);
      return { success: true, groups: currentGroups };
    }

    const res = await fetchMesasForTurma(client, turmaId);
    if (res.success && res.groups && res.groups.length > 0) {
      setGroups((prev) => {
        const otherGroups = prev.filter((g) => g.classId !== turmaId);
        return [...otherGroups, ...res.groups!];
      });
      setMesasPendingTurmaId(null);
      return res;
    }
    return res;
  };

  // Update Class in DB
  const updateClassInDatabase = async (updatedClass: Class): Promise<{ success: boolean; error?: string }> => {
    try {
      const client = getSupabaseClient();
      if (client && isSupabaseEnvConfigured()) {
        const { error } = await client
          .from('turmas')
          .update({
            nome: updatedClass.name,
            semestre_id: updatedClass.semesterId,
          })
          .eq('id', updatedClass.id);

        if (error) {
          return { success: false, error: error.message };
        }
      }
      setClasses((prev) => prev.map((c) => (c.id === updatedClass.id ? updatedClass : c)));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao atualizar turma.' };
    }
  };

  // Delete Class in DB
  const deleteClassInDatabase = async (classId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const client = getSupabaseClient();
      if (client && isSupabaseEnvConfigured()) {
        const isAdmin = profile?.papel === 'administrador' || profile?.papel === 'admin';
        const deleteRes = await deleteClassInSupabase(client, classId, isAdmin);
        if (!deleteRes.success) {
          return deleteRes;
        }
      }

      // Update local state and invalidate filters
      setClasses((prev) => prev.filter((c) => c.id !== classId));
      setGroups((prev) => prev.filter((g) => g.classId !== classId));

      if (selectedClass === classId) {
        setSelectedClass('all');
      }

      // Re-fetch classes and mesas to keep everything synchronized
      await refreshClassesAndGroups();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao excluir turma.' };
    }
  };

  // Requirement 3: Check S08P2 (Week 8) status dynamically across global dataset
  useEffect(() => {
    const caseW8 = cases.find((c) => c.week === 8 || c.caseNumber === 8);
    const isCaseW8Finalized = caseW8
      ? caseW8.status === 'realizado' || (caseW8 as any).status === 'finalizada'
      : false;
    const hasConcludedEvalsW8 = evaluations.some(
      (e) => e.week === 8 && e.status === 'Concluído'
    );

    const isS08P2Finalized = isCaseW8Finalized || hasConcludedEvalsW8;
    const hasStudents = students.length > 0;

    if (!isS08P2Finalized || !hasStudents) {
      setS08p2PendingAlert(false);
      setNotifications([]);
      return;
    }

    const unassignedUnit2 = students.filter((st) => {
      const alloc = tableAllocations.find((a) => a.studentId === st.id && a.unit === 2);
      return !alloc;
    });

    if (unassignedUnit2.length > 0) {
      setS08p2PendingAlert(true);
      setNotifications(['Composição das mesas da 2ª unidade pendente.']);
    } else {
      setS08p2PendingAlert(false);
      setNotifications([]);
    }
  }, [cases, evaluations, students, tableAllocations]);

  // Global filters
  const [selectedSemester, setSelectedSemesterState] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterIdState] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  useEffect(() => {
    if (semesters.length > 0) {
      if (semesters.length === 1 || !selectedSemesterId || !semesters.some((s) => s.id === selectedSemesterId)) {
        setSelectedSemesterIdState(semesters[0].id);
        setSelectedSemesterState(semesters[0].name);
      }
    } else {
      setSelectedSemesterIdState('');
      setSelectedSemesterState('');
    }
  }, [semesters]);

  const setSelectedSemester = (semName: string) => {
    setSelectedSemesterState(semName);
    const matched = semesters.find((s) => s.name === semName || s.id === semName);
    if (matched) {
      setSelectedSemesterIdState(matched.id);
      setSelectedSemesterState(matched.name);
    }
  };

  const setSelectedSemesterId = (semId: string) => {
    setSelectedSemesterIdState(semId);
    const matched = semesters.find((s) => s.id === semId || s.name === semId);
    if (matched) {
      setSelectedSemesterState(matched.name);
    }
  };

  const handleSetSelectedClass = (cls: string) => {
    setSelectedClass(cls);
    setSelectedUnit('all');
    setSelectedGroup('all');
  };

  const handleSetSelectedUnit = (unit: string) => {
    setSelectedUnit(unit);
    if (unit === 'all' || unit === 'compare') {
      setSelectedGroup('all');
    }
  };

  const isStudentInSelectedTable = (studentId: string, unitStr: string, tableIdStr: string): boolean => {
    if (unitStr === 'all' || unitStr === 'compare' || tableIdStr === 'all') return true;
    const unitNum: 1 | 2 = unitStr === '2' ? 2 : 1;
    const alloc = getStudentAllocation(studentId, unitNum);
    if (!alloc) return false;
    if (alloc.groupId === tableIdStr) return true;
    const group = groups.find((g) => g.id === alloc.groupId);
    if (!group) return false;
    if (group.id === tableIdStr) return true;
    const lowerName = group.name.toLowerCase();
    if (tableIdStr === 'grp_m1' && lowerName.includes('mesa 1')) return true;
    if (tableIdStr === 'grp_m2' && lowerName.includes('mesa 2')) return true;
    if (tableIdStr === 'grp_m3' && lowerName.includes('mesa 3')) return true;
    return false;
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const addNotification = (msg: string) => {
    setNotifications((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
  };

  const dismissNotification = (index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  const getStudentAllocation = (studentId: string, unit: 1 | 2): TableAllocation | undefined => {
    return tableAllocations.find((a) => a.studentId === studentId && a.unit === unit);
  };

  const getStudentTableName = (studentId: string, unit: 1 | 2): string => {
    const alloc = getStudentAllocation(studentId, unit);
    if (!alloc) return 'Não definida';
    const group = groups.find((g) => g.id === alloc.groupId);
    return group?.name || 'Não definida';
  };

  const saveTableAllocation = (
    studentId: string,
    classId: string,
    groupId: string,
    unit: 1 | 2,
    changedBy = 'Prof. Responsável'
  ) => {
    setTableAllocations((prev) => {
      const existingIdx = prev.findIndex((a) => a.studentId === studentId && a.unit === unit);
      const prevGroupId = existingIdx >= 0 ? prev[existingIdx].groupId : undefined;

      const updatedAlloc: TableAllocation = {
        id: existingIdx >= 0 ? prev[existingIdx].id : `alloc_${studentId}_u${unit}_${Date.now()}`,
        studentId,
        classId,
        groupId,
        unit,
        startDate: new Date().toISOString().split('T')[0],
        createdAt: existingIdx >= 0 ? prev[existingIdx].createdAt : new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        changedBy,
      };

      if (prevGroupId !== groupId) {
        setTableAllocationLogs((logs) => [
          ...logs,
          {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            studentId,
            classId,
            previousGroupId: prevGroupId,
            newGroupId: groupId,
            unit,
            date: new Date().toLocaleString('pt-BR'),
            changedBy,
          },
        ]);
      }

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = updatedAlloc;
        return copy;
      }
      return [...prev, updatedAlloc];
    });
  };

  const removeTableAllocation = (studentId: string, unit: 1 | 2) => {
    setTableAllocations((prev) => prev.filter((a) => !(a.studentId === studentId && a.unit === unit)));
  };

  const copyUnit1CompositionToUnit2 = (classId: string, changedBy = 'Prof. Responsável'): number => {
    const classStudents = students.filter((s) => s.classId === classId);
    let count = 0;

    const newAllocations = [...tableAllocations];
    const newLogs = [...tableAllocationLogs];
    const nowStr = new Date().toISOString().split('T')[0];
    const logDateStr = new Date().toLocaleString('pt-BR');

    classStudents.forEach((student) => {
      const u1Alloc = newAllocations.find((a) => a.studentId === student.id && a.unit === 1);
      if (u1Alloc) {
        const u2Idx = newAllocations.findIndex((a) => a.studentId === student.id && a.unit === 2);
        const prevGroup = u2Idx >= 0 ? newAllocations[u2Idx].groupId : undefined;

        if (prevGroup !== u1Alloc.groupId) {
          count++;
          newLogs.push({
            id: `log_copy_${student.id}_${Date.now()}`,
            studentId: student.id,
            classId,
            previousGroupId: prevGroup,
            newGroupId: u1Alloc.groupId,
            unit: 2,
            date: logDateStr,
            changedBy,
          });
        }

        const u2AllocItem: TableAllocation = {
          id: u2Idx >= 0 ? newAllocations[u2Idx].id : `alloc_${student.id}_u2_${Date.now()}`,
          studentId: student.id,
          classId,
          groupId: u1Alloc.groupId,
          unit: 2,
          startDate: nowStr,
          createdAt: u2Idx >= 0 ? newAllocations[u2Idx].createdAt : nowStr,
          updatedAt: nowStr,
          changedBy,
        };

        if (u2Idx >= 0) {
          newAllocations[u2Idx] = u2AllocItem;
        } else {
          newAllocations.push(u2AllocItem);
        }
      }
    });

    setTableAllocations(newAllocations);
    setTableAllocationLogs(newLogs);
    return count;
  };

  const saveEvaluation = async (evaluation: Evaluation): Promise<{ success: boolean; error?: string }> => {
    const totalScore = calculateEvaluationTotalScore(
      evaluation.criterionScores,
      settings.baremaCriteria
    );

    const updatedEval: Evaluation = {
      ...evaluation,
      totalGrossScore: totalScore,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    let persistedEvaluation = updatedEval;
    const client = getSupabaseClient();
    if (!isDemoMode) {
      if (!client || !isSupabaseEnvConfigured()) return { success: false, error: 'Supabase não configurado.' };
      const result = await saveEvaluationInSupabase(client, updatedEval);
      if (!result.success || !result.data) return { success: false, error: result.error || 'Não foi possível salvar a avaliação.' };
      persistedEvaluation = result.data;
    }
    setEvaluations((prev) => {
      const idx = prev.findIndex((e) => e.id === evaluation.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = persistedEvaluation;
        return copy;
      }
      const sameCaseIndex = prev.findIndex((e) => e.studentId === persistedEvaluation.studentId && e.caseId === persistedEvaluation.caseId);
      if (sameCaseIndex >= 0) {
        const copy = [...prev];
        copy[sameCaseIndex] = persistedEvaluation;
        return copy;
      }
      return [...prev, persistedEvaluation];
    });

    if (persistedEvaluation.makeupRequired && !persistedEvaluation.makeupCompleted) {
      const studentName = students.find((s) => s.id === persistedEvaluation.studentId)?.name || 'Estudante';
      const apgCase = cases.find((c) => c.id === persistedEvaluation.caseId);
      const code = `S${String(persistedEvaluation.week).padStart(2, '0')}P${apgCase?.problemNumber || apgCase?.caseNumber || 1}`;
      const message = `Segunda chamada pendente: ${studentName} — ${code} — falta em ${persistedEvaluation.originalAbsenceDate || persistedEvaluation.date}.`;
      setNotifications((prev) => (prev.includes(message) ? prev : [message, ...prev]));
    }
    const savedCase = cases.find((c) => c.id === persistedEvaluation.caseId);
    if (evaluation.week === 8 && (savedCase?.problemNumber || savedCase?.caseNumber) === 2) {
      setS08p2ReminderOpen(true);
      addNotification('Composição das mesas da 2ª unidade pendente.');
    }
    return { success: true };
  };

  const getStudentCalculatedSummary = (studentId: string): StudentCalculatedSummary | null => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return null;

    const studentClass = classes.find((c) => c.id === student.classId);
    const u1TableName = getStudentTableName(studentId, 1);
    const u2TableName = getStudentTableName(studentId, 2);

    let tableChangeStatus: 'Permaneceu na mesma mesa' | 'Mudou de mesa' | 'Segunda unidade não definida' = 'Permaneceu na mesma mesa';
    if (u2TableName === 'Não definida') {
      tableChangeStatus = 'Segunda unidade não definida';
    } else if (u1TableName !== u2TableName) {
      tableChangeStatus = 'Mudou de mesa';
    }

    const studentEvals = evaluations.filter((e) => e.studentId === studentId);

    return calculateStudentSummary(
      student.id,
      student.name,
      student.enrollment,
      studentClass?.name || 'Turma não atribuída',
      u1TableName,
      studentEvals,
      settings.lowScoreAlertThreshold,
      settings.maxAbsencesAlertThreshold,
      u1TableName,
      u2TableName,
      tableChangeStatus
    );
  };

  const getCalculatedSummaries = (): StudentCalculatedSummary[] => {
    return students
      .filter((s) => {
        if (selectedClass !== 'all' && s.classId !== selectedClass) return false;
        if (selectedUnit !== 'all' && selectedGroup !== 'all') {
          if (!isStudentInSelectedTable(s.id, selectedUnit, selectedGroup)) {
            return false;
          }
        }
        if (
          globalSearch.trim() &&
          !s.name.toLowerCase().includes(globalSearch.toLowerCase()) &&
          !s.enrollment.includes(globalSearch)
        ) {
          return false;
        }
        return true;
      })
      .map((s) => {
        const studentClass = classes.find((c) => c.id === s.classId);
        const u1TableName = getStudentTableName(s.id, 1);
        const u2TableName = getStudentTableName(s.id, 2);

        let tableChangeStatus: 'Permaneceu na mesma mesa' | 'Mudou de mesa' | 'Segunda unidade não definida' = 'Permaneceu na mesma mesa';
        if (u2TableName === 'Não definida') {
          tableChangeStatus = 'Segunda unidade não definida';
        } else if (u1TableName !== u2TableName) {
          tableChangeStatus = 'Mudou de mesa';
        }

        const studentEvals = evaluations.filter((e) => e.studentId === s.id);

        return calculateStudentSummary(
          s.id,
          s.name,
          s.enrollment,
          studentClass?.name || '-',
          u1TableName,
          studentEvals,
          settings.lowScoreAlertThreshold,
          settings.maxAbsencesAlertThreshold,
          u1TableName,
          u2TableName,
          tableChangeStatus
        );
      });
  };

  const addStudent = async (
    newStudent: Omit<Student, 'id'>,
    unit1GroupId?: string,
    unit2GroupId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    const u1 = unit1GroupId || newStudent.groupId;
    const u2 = unit2GroupId || u1 || newStudent.groupId;

    if (!newStudent.classId || !u1 || !u2) {
      return {
        success: false,
        error: 'É necessário selecionar a turma, a mesa da 1ª unidade e a mesa da 2ª unidade.',
      };
    }

    if (client && isConfigured) {
      const res = await createStudentInSupabase(client, {
        name: newStudent.name,
        enrollment: newStudent.enrollment,
        semestreCurso: newStudent.semestreCurso,
        classId: newStudent.classId,
        unit1GroupId: u1,
        unit2GroupId: u2,
      });

      if (!res.success) {
        return { success: false, error: res.error || 'Erro ao cadastrar estudante no banco de dados.' };
      }

      await refreshStudents();
      return { success: true };
    } else {
      const createdId = `std_${Date.now()}`;
      const created: Student = {
        ...newStudent,
        id: createdId,
        groupId: u1,
      };
      setStudents((prev) => [...prev, created]);

      if (u1) {
        saveTableAllocation(createdId, created.classId, u1, 1);
      }
      if (u2) {
        saveTableAllocation(createdId, created.classId, u2, 2);
      }
      return { success: true };
    }
  };

  const updateStudent = (
    updatedStudent: Student,
    unit1GroupId?: string,
    unit2GroupId?: string
  ) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === updatedStudent.id
          ? { ...updatedStudent, groupId: unit1GroupId || updatedStudent.groupId }
          : s
      )
    );

    if (unit1GroupId) {
      saveTableAllocation(updatedStudent.id, updatedStudent.classId, unit1GroupId, 1);
    }
    if (unit2GroupId) {
      saveTableAllocation(updatedStudent.id, updatedStudent.classId, unit2GroupId, 2);
    } else if (unit2GroupId === '') {
      removeTableAllocation(updatedStudent.id, 2);
    }
  };

  const deleteStudent = (studentId: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setEvaluations((prev) => prev.filter((e) => e.studentId !== studentId));
    setTableAllocations((prev) => prev.filter((a) => a.studentId !== studentId));
  };

  const importStudents = async (
    newStudentsList: Omit<Student, 'id'>[]
  ): Promise<{ success: boolean; importedCount?: number; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    if (client && isConfigured) {
      let count = 0;
      for (const s of newStudentsList) {
        const res = await createStudentInSupabase(client, {
          name: s.name,
          enrollment: s.enrollment,
          semestreCurso: s.semestreCurso,
          classId: s.classId,
          unit1GroupId: s.groupId,
          unit2GroupId: s.groupId,
        });
        if (res.success) count++;
      }
      await refreshStudents();
      return { success: true, importedCount: count };
    } else {
      const formatted = newStudentsList.map((s, idx) => {
        const id = `std_imp_${Date.now()}_${idx}`;
        if (s.groupId) {
          saveTableAllocation(id, s.classId, s.groupId, 1);
          saveTableAllocation(id, s.classId, s.groupId, 2);
        }
        return {
          ...s,
          id,
        };
      });
      setStudents((prev) => [...prev, ...formatted]);
      return { success: true, importedCount: formatted.length };
    }
  };

  const saveAPGCase = async (apgCase: APGCase): Promise<{ success: boolean; error?: string }> => {
    const computedUnit: 1 | 2 = apgCase.week <= 8 ? 1 : 2;
    const finalCase: APGCase = {
      ...apgCase,
      unit: computedUnit,
    };

    let persistedCase = finalCase;
    const client = getSupabaseClient();
    if (!isDemoMode) {
      if (!client || !isSupabaseEnvConfigured()) return { success: false, error: 'Supabase não configurado.' };
      const result = await saveCaseInSupabase(client, finalCase);
      if (!result.success || !result.data) return { success: false, error: result.error || 'Não foi possível salvar o caso.' };
      persistedCase = result.data;
    }
    setCases((prev) => {
      const idx = prev.findIndex((c) => c.id === apgCase.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = persistedCase;
        return copy;
      }
      return [...prev, isDemoMode ? { ...persistedCase, id: `case_${Date.now()}` } : persistedCase];
    });
    return { success: true };
  };

  const deleteAPGCase = async (caseId: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!isDemoMode) {
      if (!client || !isSupabaseEnvConfigured()) return { success: false, error: 'Supabase não configurado.' };
      const result = await deleteCaseInSupabase(client, caseId);
      if (!result.success) return result;
    }
    setCases((prev) => prev.filter((c) => c.id !== caseId));
    return { success: true };
  };

  const saveClass = (cls: Class) => {
    createClassInDatabase({
      name: cls.name,
      yearSemester: cls.yearSemester,
      semesterId: cls.semesterId,
      responsibleTeacher: cls.responsibleTeacher,
    });
  };

  const saveGroup = (grp: ClassGroup) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.id === grp.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = grp;
        return copy;
      }
      return [...prev, { ...grp, id: `grp_${Date.now()}` }];
    });
  };

  const updateSettings = async (newSettings: AppSettings): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!isDemoMode) {
      if (!client || !isSupabaseEnvConfigured()) return { success: false, error: 'Supabase não configurado.' };
      const result = await saveSettingsInSupabase(client, newSettings);
      if (!result.success) return result;
    }
    setSettings(newSettings);
    return { success: true };
  };

  const refreshStudents = async () => {
    const client = getSupabaseClient();
    if (client && isSupabaseEnvConfigured()) {
      const { data: alData, error: alunosError } = await client.from('alunos').select('*');
      if (alunosError) {
        console.error('[Supabase Refresh Students Error]', alunosError);
        return;
      }

      const { data: alocData, error: alocacoesError } = await client
        .from('alocacoes_mesa')
        .select('id, aluno_id, turma_id, mesa_id, unidade, data_inicio, data_fim, alterado_por, created_at, updated_at');
      if (alocacoesError) {
        console.error('[Supabase Refresh Allocations Error]', alocacoesError);
      }
      const { data: mesasData } = await client.from('mesas').select('*');

      const allMesas = mesasData || [];
      const allAlocations = alocacoesError ? [] : (alocData || []);

      const validAlunos = (alData || []).filter((a: any) => !String(a.id).startsWith('std_'));
      const stdIgnored = (alData || []).length - validAlunos.length;
      if (stdIgnored > 0) {
        console.info(`[Supabase Sync] Ignorados ${stdIgnored} estudantes legados com ID local std_`);
      }

      setStudents(
        validAlunos.map((a: any) => {
          const u1Alloc = allAlocations.find((al: any) => al.aluno_id === a.id && Number(al.unidade) === 1);
          const u2Alloc = allAlocations.find((al: any) => al.aluno_id === a.id && Number(al.unidade) === 2);
          const u1Mesa = allMesas.find((m: any) => m.id === u1Alloc?.mesa_id);
          const u2Mesa = allMesas.find((m: any) => m.id === u2Alloc?.mesa_id);

          const derivedClassId = u1Alloc?.turma_id || u2Alloc?.turma_id || u1Mesa?.turma_id || u2Mesa?.turma_id || '';
          const derivedGroupId = u1Alloc?.mesa_id || u2Alloc?.mesa_id || '';

          return {
            id: a.id,
            name: a.nome || '',
            enrollment: a.matricula || '',
            classId: derivedClassId,
            groupId: derivedGroupId,
            status: a.ativo === false ? 'Inativo' : 'Ativo',
            ativo: a.ativo !== false,
            semestreCurso: a.semestre_curso || '',
          };
        })
      );

      setTableAllocations(
        allAlocations.map((a: any) => ({
          id: a.id,
          studentId: a.aluno_id,
          classId: a.turma_id,
          groupId: a.mesa_id,
          unit: Number(a.unidade) as 1 | 2,
          startDate: a.data_inicio || a.created_at || '',
          createdAt: a.created_at || '',
          updatedAt: a.updated_at || a.created_at || '',
          changedBy: a.alterado_por || 'Sistema',
        }))
      );
    }
  };

  const updateStudentFull = async (
    studentId: string,
    payload: StudentEditPayload
  ): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    if (client && isConfigured) {
      const res = await updateStudentInSupabase(client, studentId, payload);
      if (!res.success) {
        return res;
      }
      await refreshStudents();
      return { success: true };
    } else {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? {
                ...s,
                name: payload.name.trim(),
                enrollment: payload.enrollment.trim(),
                semestreCurso: payload.semestreCurso,
                classId: payload.classId,
                ativo: payload.ativo,
                status: payload.ativo ? 'Ativo' : 'Inativo',
              }
            : s
        )
      );
      return { success: true };
    }
  };

  const updateStudentTablesFull = async (
    studentId: string,
    classId: string,
    u1MesaId: string,
    u2MesaId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    if (!classId || !u1MesaId || !u2MesaId) {
      return {
        success: false,
        error: 'É necessário selecionar a turma, a mesa da 1ª unidade e a mesa da 2ª unidade.',
      };
    }

    if (client && isConfigured) {
      const res = await saveStudentTableAllocationsInSupabase(client, studentId, classId, u1MesaId, u2MesaId);
      if (!res.success) {
        return { success: false, error: res.error };
      }
      await refreshStudents();
      await refreshClassesAndGroups();
      return { success: true };
    } else {
      if (u1MesaId) saveTableAllocation(studentId, classId, u1MesaId, 1);
      if (u2MesaId) saveTableAllocation(studentId, classId, u2MesaId, 2);
      return { success: true };
    }
  };

  const deactivateStudentFull = async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    if (client && isConfigured) {
      const res = await deactivateStudentInSupabase(client, studentId);
      if (!res.success) return res;
      await refreshStudents();
      return { success: true };
    } else {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ativo: false, status: 'Inativo' } : s))
      );
      return { success: true };
    }
  };

  const reactivateStudentFull = async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    if (client && isConfigured) {
      const res = await reactivateStudentInSupabase(client, studentId);
      if (!res.success) return res;
      await refreshStudents();
      return { success: true };
    } else {
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, ativo: true, status: 'Ativo' } : s))
      );
      return { success: true };
    }
  };

  const deleteStudentDefinitely = async (studentId: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    const isConfigured = isSupabaseEnvConfigured();

    const localEvalsCount = evaluations.filter((e) => e.studentId === studentId).length;

    if (client && isConfigured) {
      const res = await deleteStudentInSupabase(client, studentId, localEvalsCount);
      if (!res.success) return res;
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setTableAllocations((prev) => prev.filter((a) => a.studentId !== studentId));
      return { success: true };
    } else {
      if (localEvalsCount > 0) {
        return {
          success: false,
          error: 'Este estudante possui registros acadêmicos e não pode ser excluído definitivamente. Utilize a opção Desativar estudante.',
        };
      }
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setTableAllocations((prev) => prev.filter((a) => a.studentId !== studentId));
      return { success: true };
    }
  };

  const generateGeminiFeedback = async (
    evaluation: Evaluation,
    _student: Student,
    apgCase?: APGCase
  ): Promise<string> => {
    try {
      const criteriaScoresList = settings.baremaCriteria.map((c) => ({
        name: c.name,
        score: evaluation.criterionScores[c.id] ?? 0,
        max: c.maxScore,
      }));

      const payload = {
        caseTitle: apgCase?.title || `Caso APG Semana ${evaluation.week}`,
        caseObjectives: apgCase?.learningObjectives || [],
        week: evaluation.week,
        unit: evaluation.unit,
        role: evaluation.role,
        scores: criteriaScoresList,
        tags: evaluation.performanceTags || [],
        teacherNotes: evaluation.teacherNotes || '',
      };

      const res = await fetch('/api/gemini/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.feedback) {
        return data.feedback;
      } else {
        throw new Error(data.error || 'Erro na resposta do serviço de IA.');
      }
    } catch (err: any) {
      console.warn('Erro ao chamar Gemini, fallback local acionado:', err);
      return `1. Síntese do desempenho: O(A) discente participou ativamente da sessão da Semana ${evaluation.week} exercendo o papel de ${evaluation.role}.\n2. Pontos fortes: Demonstrou engajamento nas discussões e colaboração com o grupo durante o caso.\n3. Oportunidades de melhoria: Aprofundar a fundamentação teórica referente aos objetivos do caso APG.\n4. Orientação para a próxima sessão: Manter a pontualidade e aperfeiçoar a síntese integradora dos objetivos.`;
    }
  };

  return (
    <AppContext.Provider
      value={{
        semesters,
        classes,
        groups,
        students,
        cases,
        evaluations,
        settings,
        darkMode,
        toggleDarkMode,
        isCreatingClass,
        classError,
        mesasPendingTurmaId,
        clearClassError: () => setClassError(null),
        refreshClassesAndGroups,
        createClassInDatabase,
        retryFetchMesasForTurma: retryFetchMesasForTurmaHandler,
        updateClassInDatabase,
        deleteClassInDatabase,
        tableAllocations,
        tableAllocationLogs,
        getStudentAllocation,
        getStudentTableName,
        saveTableAllocation,
        copyUnit1CompositionToUnit2,
        removeTableAllocation,
        s08p2ReminderOpen,
        setS08p2ReminderOpen,
        s08p2PendingAlert,
        setS08p2PendingAlert,
        notifications,
        addNotification,
        dismissNotification,
        selectedSemester,
        setSelectedSemester,
        selectedSemesterId,
        setSelectedSemesterId,
        selectedClass,
        setSelectedClass: handleSetSelectedClass,
        selectedGroup,
        setSelectedGroup,
        selectedUnit,
        setSelectedUnit: handleSetSelectedUnit,
        selectedWeek,
        setSelectedWeek,
        globalSearch,
        setGlobalSearch,
        saveEvaluation,
        getStudentCalculatedSummary,
        getCalculatedSummaries,
        refreshStudents,
        updateStudentFull,
        updateStudentTablesFull,
        deactivateStudentFull,
        reactivateStudentFull,
        deleteStudentDefinitely,
        addStudent,
        updateStudent,
        deleteStudent,
        importStudents,
        saveAPGCase,
        deleteAPGCase,
        saveClass,
        saveGroup,
        updateSettings,
        generateGeminiFeedback,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
