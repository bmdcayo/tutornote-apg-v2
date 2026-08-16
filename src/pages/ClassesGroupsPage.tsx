import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Class, ClassGroup, Student } from '../types';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import { SOIFilter } from '../components/common/SOIFilter';
import {
  ActiveSemester,
  ClassLinkedCounts,
  fetchActiveSemesters,
  fetchClassLinkedCounts,
  findClosestSemester,
} from '../services/classCreationService';
import { getSupabaseClient } from '../lib/supabase';
import {
  AlertCircle,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

export const ClassesGroupsPage: React.FC = () => {
  const {
    classes,
    groups,
    students,
    evaluations,
    semesters,
    sois,
    tableAllocations,
    getStudentAllocation,
    selectedSemesterId: globalSemesterId,
    selectedSemester: globalSemesterName,
    selectedSoiId,
    setSelectedSoiId,
    createSOI,
    deleteSOI,
    saveClass,
    saveGroup,
    importStudents,
    deleteStudent,
    createClassInDatabase,
    updateClassInDatabase,
    retryFetchMesasForTurma,
    deleteClassInDatabase,
    isCreatingClass,
    classError,
    clearClassError,
  } = useApp();

  const { user, profile } = useAuth();

  const canEditClass = useCallback(
    (cls: Class): boolean => {
      if (!profile) return true;
      const role = (profile.papel || '').toLowerCase().trim();
      if (role === 'administrador' || role === 'admin') return true;
      if (role === 'visualizador' || role === 'viewer') return false;

      const currentUserId = profile.id || user?.id;
      if (cls.professorId && currentUserId && cls.professorId === currentUserId) return true;
      if (cls.createdBy && currentUserId && cls.createdBy === currentUserId) return true;

      if (
        cls.responsibleTeacher &&
        profile.nome &&
        cls.responsibleTeacher.trim().toLowerCase() === profile.nome.trim().toLowerCase()
      ) {
        return true;
      }

      if (
        !cls.professorId &&
        !cls.createdBy &&
        (!cls.responsibleTeacher || cls.responsibleTeacher === 'Docente não identificado')
      ) {
        return true;
      }

      return false;
    },
    [profile, user]
  );
  const [activeTab, setActiveTab] = useState<'sois' | 'turmas' | 'grupos' | 'importar'>('sois');
  const [showSOIModal, setShowSOIModal] = useState(false);
  const [soiName, setSoiName] = useState('');
  const [soiError, setSoiError] = useState<string | null>(null);
  const [isSavingSOI, setIsSavingSOI] = useState(false);

  // New Class Form State
  const [showClassModal, setShowClassModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classSemester, setClassSemester] = useState('');
  const [modalSelectedSemesterId, setModalSelectedSemesterId] = useState('');
  const [modalSelectedSoiId, setModalSelectedSoiId] = useState('');
  const [activeSemestres, setActiveSemestres] = useState<ActiveSemester[]>([]);
  const [isLoadingSemestres, setIsLoadingSemestres] = useState(false);
  const [classTeacher, setClassTeacher] = useState(profile?.nome || '');
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);

  // Filter classes by global selected semester
  const semesterClasses = classes.filter((cls) => {
    if (!globalSemesterId && !globalSemesterName) return true;
    if (globalSemesterId && cls.semesterId === globalSemesterId) return true;
    if (globalSemesterName && cls.yearSemester === globalSemesterName) return true;
    return false;
  });
  const soiFilteredClasses = semesterClasses.filter(
    (cls) => selectedSoiId === 'all' || !cls.soiId || cls.soiId === selectedSoiId
  );
  const filteredClasses =
    soiFilteredClasses.length > 0
      ? soiFilteredClasses
      : semesterClasses.length > 0
      ? semesterClasses
      : classes;

  const semesterSOIs = sois.filter((soi) => !globalSemesterId || soi.semesterId === globalSemesterId);

  const handleCreateSOI = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!globalSemesterId || !soiName.trim()) return;
    setIsSavingSOI(true);
    setSoiError(null);
    const result = await createSOI(globalSemesterId, soiName);
    setIsSavingSOI(false);
    if (!result.success) {
      setSoiError(result.error || 'Não foi possível cadastrar o SOI.');
      return;
    }
    setSoiName('');
    setShowSOIModal(false);
  };

  const handleDeleteSOI = async (soiId: string, name: string) => {
    if (!window.confirm(`Excluir o ${name}? Esta ação só é permitida quando não existem turmas vinculadas.`)) return;
    const result = await deleteSOI(soiId);
    if (!result.success) {
      setSoiError(result.error || 'Não foi possível excluir o SOI.');
    }
  };

  // Retrying mesas loading state
  const [retryingTurmaId, setRetryingTurmaId] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);

  // Deletion Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  const [linkedCounts, setLinkedCounts] = useState<ClassLinkedCounts | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [isDeletingClass, setIsDeletingClass] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  const loadActiveSemestresFromSupabase = useCallback(async () => {
    setIsLoadingSemestres(true);
    const client = getSupabaseClient();
    if (client) {
      const { semestres, error } = await fetchActiveSemesters(client);
      if (semestres && semestres.length > 0) {
        setActiveSemestres(semestres);
        const sel = semestres.length === 1 ? semestres[0] : (findClosestSemester(semestres) || semestres[0]);
        setModalSelectedSemesterId(sel.id);
        setClassSemester(sel.nome);
      } else {
        setActiveSemestres([]);
        setModalSelectedSemesterId('');
        setClassSemester('');
        if (error) {
          setModalErrorMessage(error);
        }
      }
    } else if (semesters && semesters.length > 0) {
      const mapped: ActiveSemester[] = semesters.map((s) => ({
        id: s.id,
        nome: s.name,
        data_inicio: s.startDate,
        data_fim: s.endDate,
        ativo: true,
      }));
      setActiveSemestres(mapped);
      const sel = mapped.length === 1 ? mapped[0] : (findClosestSemester(mapped) || mapped[0]);
      setModalSelectedSemesterId(sel.id);
      setClassSemester(sel.nome);
    } else {
      setActiveSemestres([]);
      setModalSelectedSemesterId('');
      setClassSemester('');
    }
    setIsLoadingSemestres(false);
  }, [semesters]);

  useEffect(() => {
    if (profile?.nome) {
      setClassTeacher(profile.nome);
    }
  }, [profile?.nome]);

  useEffect(() => {
    loadActiveSemestresFromSupabase();
  }, [loadActiveSemestresFromSupabase]);

  const handleOpenClassModal = () => {
    try {
      localStorage.removeItem('turma_draft');
      localStorage.removeItem('class_draft');
      localStorage.removeItem('new_class_draft');
    } catch {
      // Ignore localStorage errors
    }
    setModalErrorMessage(null);
    clearClassError();
    setClassName('');
    setClassTeacher(profile?.nome || '');
    const targetSemesterId = globalSemesterId || modalSelectedSemesterId;
    const availableSOIs = sois.filter((soi) => soi.semesterId === targetSemesterId);
    setModalSelectedSoiId(
      selectedSoiId !== 'all' && availableSOIs.some((soi) => soi.id === selectedSoiId)
        ? selectedSoiId
        : availableSOIs[0]?.id || ''
    );
    setShowClassModal(true);
    loadActiveSemestresFromSupabase();
  };

  const handleCloseClassModal = () => {
    try {
      localStorage.removeItem('turma_draft');
      localStorage.removeItem('class_draft');
      localStorage.removeItem('new_class_draft');
    } catch {
      // Ignore localStorage errors
    }
    setModalErrorMessage(null);
    clearClassError();
    setShowClassModal(false);
  };

  // New Group Form State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupClassId, setGroupClassId] = useState(classes[0]?.id || '');
  const [groupLimit, setGroupLimit] = useState(10);

  // Import CSV/XLSX text parser
  const [importCsvText, setImportCsvText] = useState('');
  const [importClassId, setImportClassId] = useState(classes[0]?.id || '');
  const [importGroupId, setImportGroupId] = useState(groups[0]?.id || '');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [importNotice, setImportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Keep importClassId and importGroupId synchronized with available classes and groups
  useEffect(() => {
    if (!importClassId && classes.length > 0) {
      setImportClassId(classes[0].id);
    }
  }, [classes, importClassId]);

  useEffect(() => {
    if (importClassId) {
      const validGroups = groups.filter((g) => g.classId === importClassId);
      if (validGroups.length > 0) {
        const exists = validGroups.some((g) => g.id === importGroupId);
        if (!exists) {
          setImportGroupId(validGroups[0].id);
        }
      } else {
        setImportGroupId('');
      }
    }
  }, [importClassId, groups, importGroupId]);

  const handleCreateClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    if (!modalSelectedSemesterId || activeSemestres.length === 0) {
      setModalErrorMessage(
        'Nenhum semestre letivo ativo foi encontrado. Cadastre ou ative um semestre antes de criar a turma.'
      );
      return;
    }
    if (!modalSelectedSoiId) {
      setModalErrorMessage('Selecione o SOI ao qual esta turma pertence.');
      return;
    }

    setModalErrorMessage(null);
    clearClassError();
    setIsSubmittingClass(true);

    try {
      const res = await createClassInDatabase({
        name: className.trim(),
        yearSemester: classSemester || '2026.1',
        semesterId: modalSelectedSemesterId,
        soiId: modalSelectedSoiId,
        responsibleTeacher: classTeacher || profile?.nome || 'Docente não identificado',
      });

      if (res.success) {
        setClassName('');
        setShowClassModal(false);

        if (res.mesasPending) {
          setRetryNotice(`A turma "${res.class?.name}" foi criada, mas as mesas ainda não foram carregadas.`);
        } else {
          setRetryNotice(null);
        }
      } else {
        setModalErrorMessage(res.error || 'Não foi possível cadastrar a turma no Supabase.');
      }
    } catch (err: any) {
      setModalErrorMessage(err.message || 'Erro inesperado ao cadastrar a turma.');
    } finally {
      setIsSubmittingClass(false);
    }
  };

  const handleRetryMesas = async (turmaId: string) => {
    setRetryingTurmaId(turmaId);
    setRetryNotice(null);
    try {
      const res = await retryFetchMesasForTurma(turmaId);
      if (!res.success) {
        setRetryNotice(res.error || 'As mesas ainda não foram carregadas. Tente novamente.');
      }
    } finally {
      setRetryingTurmaId(null);
    }
  };

  const handleOpenDeleteModal = async (cls: Class) => {
    setDeletingClass(cls);
    setConfirmNameInput('');
    setDeleteModalError(null);
    setIsLoadingCounts(true);
    setShowDeleteModal(true);

    const client = getSupabaseClient();
    if (client) {
      const counts = await fetchClassLinkedCounts(client, cls.id);
      const localStudentsCount = students.filter((s) => s.classId === cls.id).length;
      const localEvalsCount = evaluations.filter((e) => e.classId === cls.id).length;
      const finalAlunos = Math.max(counts.alunosCount, localStudentsCount);
      const finalEvals = Math.max(counts.avaliacoesCount, localEvalsCount);

      setLinkedCounts({
        alunosCount: finalAlunos,
        mesasCount: counts.mesasCount,
        casosCount: counts.casosCount,
        avaliacoesCount: finalEvals,
        isHasAcademicData: finalAlunos > 0 || counts.casosCount > 0 || finalEvals > 0,
      });
    } else {
      const localStudentsCount = students.filter((s) => s.classId === cls.id).length;
      const localMesasCount = groups.filter((g) => g.classId === cls.id).length;
      const localEvalsCount = evaluations.filter((e) => e.classId === cls.id).length;

      setLinkedCounts({
        alunosCount: localStudentsCount,
        mesasCount: localMesasCount,
        casosCount: 0,
        avaliacoesCount: localEvalsCount,
        isHasAcademicData: localStudentsCount > 0 || localEvalsCount > 0,
      });
    }
    setIsLoadingCounts(false);
  };

  const handleConfirmDeleteClass = async () => {
    if (!deletingClass) return;

    if (linkedCounts?.isHasAcademicData && confirmNameInput.trim() !== deletingClass.name.trim()) {
      setDeleteModalError(`Você deve digitar exatamente "${deletingClass.name}" para confirmar a exclusão.`);
      return;
    }

    setDeleteModalError(null);
    setIsDeletingClass(true);

    try {
      const res = await deleteClassInDatabase(deletingClass.id);
      if (res.success) {
        setDeleteNotice(`Turma "${deletingClass.name}" excluída com sucesso.`);
        setShowDeleteModal(false);
        setDeletingClass(null);
      } else {
        setDeleteModalError(res.error || 'Não foi possível excluir a turma.');
      }
    } catch (err: any) {
      setDeleteModalError(err.message || 'Erro de comunicação ao excluir a turma.');
    } finally {
      setIsDeletingClass(false);
    }
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName) return;
    saveGroup({
      id: `grp_${Date.now()}`,
      name: groupName,
      classId: groupClassId,
      limitStudents: groupLimit,
    });
    setGroupName('');
    setShowGroupModal(false);
  };

  const handleProcessImport = async () => {
    setImportNotice(null);

    if (!importCsvText.trim()) {
      setImportNotice({
        type: 'error',
        message: 'Por favor, insira o texto no formato CSV/XLSX com os dados dos alunos.',
      });
      return;
    }

    if (!importClassId) {
      setImportNotice({
        type: 'error',
        message: 'Selecione a turma de destino para os estudantes.',
      });
      return;
    }

    if (!importGroupId) {
      setImportNotice({
        type: 'error',
        message: 'Selecione a mesa / grupo de destino para os estudantes.',
      });
      return;
    }

    const targetClass = classes.find((c) => c.id === importClassId);
    const targetGroup = groups.find((g) => g.id === importGroupId);

    const lines = importCsvText.split('\n');
    const importedList: Omit<Student, 'id'>[] = [];

    lines.forEach((line) => {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine.toLowerCase().startsWith('nome') || cleanLine.toLowerCase().startsWith('aluno')) {
        return; // Skip empty lines and header rows
      }

      // Support comma, semicolon, or tab separators
      let parts = cleanLine.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        importedList.push({
          name: parts[0],
          enrollment: parts[1],
          classId: importClassId,
          groupId: importGroupId,
          status: 'Ativo',
        });
      }
    });

    if (importedList.length === 0) {
      setImportNotice({
        type: 'error',
        message: 'Nenhum estudante válido foi encontrado no texto digitado. Use o formato: Nome, Matrícula, Email',
      });
      return;
    }

    setIsProcessingImport(true);
    try {
      const res = await importStudents(importedList);
      if (res.success) {
        setImportCsvText('');
        const classNameStr = targetClass?.name || 'Turma selecionada';
        const groupNameStr = targetGroup?.name || 'Mesa selecionada';
        setImportNotice({
          type: 'success',
          message: `Sucesso! ${res.importedCount || importedList.length} estudante(s) foram importados e alocados em "${groupNameStr}" (${classNameStr}).`,
        });
      } else {
        setImportNotice({
          type: 'error',
          message: res.error || 'Não foi possível importar os estudantes no banco de dados.',
        });
      }
    } catch (err: any) {
      setImportNotice({
        type: 'error',
        message: err.message || 'Erro inesperado ao processar a importação de alunos.',
      });
    } finally {
      setIsProcessingImport(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Tab Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
            Módulo de Turmas e Mesas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerenciamento de semestres, turmas, mesas e importação via XLSX/CSV
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('sois')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'sois'
                ? 'bg-[#C20054] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            SOIs
          </button>
          <button
            onClick={() => setActiveTab('turmas')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'turmas'
                ? 'bg-[#C20054] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Turmas
          </button>
          <button
            onClick={() => setActiveTab('grupos')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'grupos'
                ? 'bg-[#C20054] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Mesas APG
          </button>
          <button
            onClick={() => setActiveTab('importar')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'importar'
                ? 'bg-[#C20054] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Importar Alunos
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <SOIFilter />
        {selectedSoiId !== 'all' && (
          <span className="pb-2 text-xs text-slate-500">
            Exibindo somente turmas e mesas do SOI selecionado.
          </span>
        )}
      </div>

      {/* Global Notice Alert for Delete or Pending Tables */}
      {deleteNotice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span>{deleteNotice}</span>
          <button onClick={() => setDeleteNotice(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {retryNotice && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>{retryNotice}</span>
          </div>
          {classes.length > 0 && (
            <button
              onClick={() => handleRetryMesas(classes[0].id)}
              disabled={retryingTurmaId !== null}
              className="inline-flex items-center gap-1.5 shrink-0 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-all disabled:opacity-50"
            >
              {retryingTurmaId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>Tentar novamente</span>
            </button>
          )}
        </div>
      )}

      {/* Tab 1: SOIs */}
      {activeTab === 'sois' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cada SOI reúne uma ou mais turmas e compartilha o mesmo conjunto de casos APG.
            </p>
            <button
              onClick={() => {
                setSoiError(null);
                setShowSOIModal(true);
              }}
              disabled={!globalSemesterId}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Cadastrar SOI
            </button>
          </div>

          {soiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
              {soiError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {semesterSOIs.map((soi) => {
              const soiClasses = classes.filter((item) => item.soiId === soi.id);
              const soiClassIds = new Set(soiClasses.map((item) => item.id));
              const soiStudents = new Set(
                tableAllocations
                  .filter((allocation) => soiClassIds.has(allocation.classId))
                  .map((allocation) => allocation.studentId)
              ).size;
              return (
                <div key={soi.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Componente curricular</span>
                      <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{soi.name}</h3>
                      <p className="text-xs text-slate-500">{soiClasses.length} turma(s) • {soiStudents} estudante(s)</p>
                    </div>
                    <button
                      onClick={() => handleDeleteSOI(soi.id, soi.name)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                      title="Excluir SOI"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSoiId(soi.id);
                      setActiveTab('turmas');
                    }}
                    className="mt-4 w-full rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/30"
                  >
                    Ver turmas deste SOI
                  </button>
                </div>
              );
            })}
          </div>

          {semesterSOIs.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
              Nenhum SOI foi cadastrado no semestre selecionado.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Turmas */}
      {activeTab === 'turmas' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={handleOpenClassModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-900 shadow-xs transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Cadastrar Nova Turma</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredClasses.map((cls) => {
              const classStudents = students.filter((s) => s.classId === cls.id);
              const distinctAllocStudentIds = tableAllocations.filter((a) => a.classId === cls.id).map((a) => a.studentId);
              const totalDistinctAlunos = new Set([...classStudents.map((s) => s.id), ...distinctAllocStudentIds]).size;
              const classEvals = evaluations.filter((e) => e.classId === cls.id);
              const completedEvals = classEvals.filter((e) => e.status === 'Concluído').length;
              const classMesas = groups.filter((g) => g.classId === cls.id);

              const semesterDisplayName =
                cls.yearSemester ||
                activeSemestres.find((s) => s.id === cls.semesterId)?.nome ||
                semesters.find((s) => s.id === cls.semesterId)?.name ||
                'Semestre não informado';

              return (
                <div
                  key={cls.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        SEMESTRE
                      </span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {semesterDisplayName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="primary">{totalDistinctAlunos} Alunos</Badge>
                      {canEditClass(cls) ? (
                        <button
                          onClick={() => handleOpenDeleteModal(cls)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Excluir turma"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span
                          className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md"
                          title="Apenas o professor responsável ou administrador pode alterar/excluir esta turma"
                        >
                          Somente Leitura
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {cls.name}
                    </h3>
                    <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      {sois.find((soi) => soi.id === cls.soiId)?.name || 'SOI não identificado'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Docente Responsável: <span className="font-semibold text-slate-700 dark:text-slate-300">{cls.responsibleTeacher}</span>
                    </p>
                    <label className="mt-3 block text-[10px] font-bold uppercase text-slate-400">SOI da turma</label>
                    <select
                      value={cls.soiId || ''}
                      disabled={!canEditClass(cls)}
                      onChange={async (event) => {
                        if (!canEditClass(cls)) return;
                        const result = await updateClassInDatabase({ ...cls, soiId: event.target.value });
                        if (!result.success) {
                          setRetryNotice(result.error || 'Não foi possível alterar o SOI da turma.');
                        }
                      }}
                      title={!canEditClass(cls) ? 'Apenas o professor criador ou administrador pode alterar o SOI desta turma' : undefined}
                      className={`mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
                        !canEditClass(cls) ? 'opacity-60 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">Selecione o SOI</option>
                      {sois
                        .filter((soi) => soi.semesterId === cls.semesterId)
                        .map((soi) => (
                          <option key={soi.id} value={soi.id}>{soi.name}</option>
                        ))}
                    </select>
                  </div>

                  {/* Mesas Status Badge */}
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800 text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Mesas Cadastradas:</span>
                    {classMesas.length > 0 ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {classMesas.length} Mesa(s) ({classMesas.map((m) => m.name).join(', ')})
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 font-medium">Aguardando mesas...</span>
                        <button
                          onClick={() => handleRetryMesas(cls.id)}
                          disabled={retryingTurmaId === cls.id}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          {retryingTurmaId === cls.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          <span>Tentar novamente</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Class Completion Progress */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <ProgressBar
                      value={completedEvals}
                      max={Math.max(1, classEvals.length)}
                      label="Progresso de Lançamentos das Avaliações"
                      showValue
                      color="indigo"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Grupos/Mesas APG */}
      {activeTab === 'grupos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowGroupModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-900 shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Criar Novo Grupo APG</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {groups.filter((grp) => filteredClasses.some((cls) => cls.id === grp.classId)).map((grp) => {
              const groupStudents = students.filter((s) => {
                if (s.groupId === grp.id) return true;
                const alloc1 = getStudentAllocation(s.id, 1);
                const alloc2 = getStudentAllocation(s.id, 2);
                return alloc1?.groupId === grp.id || alloc2?.groupId === grp.id;
              });
              const parentClass = classes.find((c) => c.id === grp.classId);

              return (
                <div
                  key={grp.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {grp.name}
                      </h3>
                      <p className="text-[11px] text-slate-500">{parentClass?.name || 'Turma não identificada'}</p>
                    </div>
                    <Badge variant={groupStudents.length >= grp.limitStudents ? 'warning' : 'success'}>
                      {groupStudents.length} / {grp.limitStudents} Alunos
                    </Badge>
                  </div>

                  {/* Group Student List */}
                  <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
                    {groupStudents.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        Nenhum aluno nesta mesa.
                      </p>
                    ) : (
                      groupStudents.map((std) => (
                        <div
                          key={std.id}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800"
                        >
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">
                              {std.name}
                            </p>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {std.enrollment}
                            </span>
                          </div>
                          <button
                            onClick={() => deleteStudent(std.id)}
                            className="text-rose-500 hover:text-rose-700 p-1"
                            title="Remover aluno"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Import Students CSV / XLSX */}
      {activeTab === 'importar' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Importação em Lote de Estudantes (XLSX / CSV)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cole linhas no formato: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-900 dark:text-indigo-300">Nome, Matrícula, Email</code>
              </p>
            </div>
          </div>

          {importNotice && (
            <div
              className={`flex items-center justify-between rounded-xl border p-3.5 text-xs font-bold ${
                importNotice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              <span>{importNotice.message}</span>
              <button onClick={() => setImportNotice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Turma Destino
              </label>
              <select
                value={importClassId}
                onChange={(e) => setImportClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(semesterClasses.length > 0 ? semesterClasses : classes).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.soiId ? `(${sois.find((s) => s.id === c.soiId)?.name || 'SOI'})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mesa / Grupo Destino
              </label>
              <select
                value={importGroupId}
                onChange={(e) => setImportGroupId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {groups.filter((g) => g.classId === importClassId).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            rows={6}
            value={importCsvText}
            onChange={(e) => setImportCsvText(e.target.value)}
            placeholder={`Exemplo de conteúdo CSV:
Gabriel Siqueira, 20261050, gabriel.s@med.edu.br
Helena Alencar, 20261051, helena.a@med.edu.br
Igor Machado, 20261052, igor.m@med.edu.br`}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />

          <button
            onClick={handleProcessImport}
            disabled={isProcessingImport}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs disabled:opacity-50 transition-all cursor-pointer"
          >
            {isProcessingImport ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Importando e Alocando...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Processar e Importar Alunos</span>
              </>
            )}
          </button>
        </div>
      )}

      {showSOIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreateSOI}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cadastrar SOI</h3>
              <button type="button" onClick={() => setShowSOIModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {soiError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
                {soiError}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Semestre</label>
              <input
                readOnly
                value={semesters.find((semester) => semester.id === globalSemesterId)?.name || globalSemesterName}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Nome do SOI</label>
              <input
                autoFocus
                required
                value={soiName}
                onChange={(event) => setSoiName(event.target.value)}
                placeholder="Ex.: SOI II"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowSOIModal(false)} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingSOI || !globalSemesterId || !soiName.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isSavingSOI && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar SOI
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Class with Supabase Confirmation */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateClassSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cadastrar Turma (Supabase)</h3>
              <button
                type="button"
                disabled={isSubmittingClass}
                onClick={handleCloseClassModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Banner inside Modal */}
            {(modalErrorMessage || classError) && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{modalErrorMessage || classError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome da Turma
              </label>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Ex: Medicina 2026.1 - APG I"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Semestre Letivo
              </label>
              {isLoadingSemestres ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#C20054]" />
                  <span>Consultando semestres ativos no Supabase...</span>
                </div>
              ) : activeSemestres.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                  Nenhum semestre letivo ativo cadastrado.
                </div>
              ) : (
                <select
                  required
                  value={modalSelectedSemesterId}
                  onChange={(e) => {
                    const semId = e.target.value;
                    setModalSelectedSemesterId(semId);
                    const found = activeSemestres.find((s) => s.id === semId);
                    if (found) {
                      setClassSemester(found.nome);
                    }
                    const firstSOI = sois.find((soi) => soi.semesterId === semId);
                    setModalSelectedSoiId(firstSOI?.id || '');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {activeSemestres.map((sem) => (
                    <option key={sem.id} value={sem.id}>
                      {sem.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SOI
              </label>
              <select
                required
                value={modalSelectedSoiId}
                onChange={(event) => setModalSelectedSoiId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Selecione o SOI</option>
                {sois
                  .filter((soi) => soi.semesterId === modalSelectedSemesterId)
                  .map((soi) => (
                    <option key={soi.id} value={soi.id}>{soi.name}</option>
                  ))}
              </select>
              {modalSelectedSemesterId && !sois.some((soi) => soi.semesterId === modalSelectedSemesterId) && (
                <p className="mt-1 text-[11px] text-amber-600">
                  Cadastre primeiro um SOI na guia “SOIs”.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Docente Responsável
              </label>
              <input
                type="text"
                required
                value={classTeacher}
                onChange={(e) => setClassTeacher(e.target.value)}
                placeholder="Ex: Prof. Dr. Armando"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-800 dark:border-blue-900/30 dark:bg-blue-950/30 dark:text-blue-300 space-y-1">
              <p className="font-bold">ℹ️ Informação sobre o banco de dados:</p>
              <p>
                Ao salvar, o registro será gravado em <code className="font-mono bg-blue-100 px-1 py-0.5 rounded text-indigo-900">public.turmas</code> no Supabase com seu ID de professor (session.user.id). As 3 mesas (Mesa 1, Mesa 2, Mesa 3) serão geradas pelo trigger do banco.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                disabled={isSubmittingClass}
                onClick={handleCloseClassModal}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingClass || isLoadingSemestres || activeSemestres.length === 0 || !modalSelectedSemesterId || !modalSelectedSoiId}
                className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-5 py-2 text-xs font-bold text-white hover:bg-indigo-900 disabled:opacity-50"
              >
                {isSubmittingClass ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirmando no Supabase...</span>
                  </>
                ) : (
                  <span>Salvar Turma</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Group */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Criar Grupo APG</h3>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome do Grupo / Mesa
              </label>
              <input
                type="text"
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ex: Mesa 4"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Turma Vinculada
              </label>
              <select
                value={groupClassId}
                onChange={(e) => setGroupClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {filteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#C20054] px-4 py-2 text-xs font-bold text-white hover:bg-indigo-900"
              >
                Salvar Grupo
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal Deletion Confirmation */}
      {showDeleteModal && deletingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Excluir Turma</h3>
              </div>
              <button
                type="button"
                disabled={isDeletingClass}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingClass(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Tem certeza de que deseja excluir a turma &quot;{deletingClass.name}&quot;?
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                A exclusão removerá as mesas e os registros acadêmicos vinculados. Esta ação não poderá ser desfeita.
              </p>
            </div>

            {/* Linked Data Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Resumo dos Registros Vinculados:
              </span>
              {isLoadingCounts ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[#C20054]" />
                  <span>Verificando registros vinculados no Supabase...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Alunos:</span>
                    <span className={`font-bold ${linkedCounts?.alunosCount ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {linkedCounts?.alunosCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Mesas:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {linkedCounts?.mesasCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Casos APG:</span>
                    <span className={`font-bold ${linkedCounts?.casosCount ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {linkedCounts?.casosCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Avaliações:</span>
                    <span className={`font-bold ${linkedCounts?.avaliacoesCount ? 'text-amber-600' : 'text-slate-700 dark:text-slate-300'}`}>
                      {linkedCounts?.avaliacoesCount || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Required Typing Input if contains academic data */}
            {linkedCounts?.isHasAcademicData && !isLoadingCounts && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Esta turma possui dados acadêmicos. Para confirmar a exclusão, digite o nome exato da turma abaixo:
                </label>
                <p className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                  {deletingClass.name}
                </p>
                <input
                  type="text"
                  value={confirmNameInput}
                  onChange={(e) => setConfirmNameInput(e.target.value)}
                  placeholder={`Digite "${deletingClass.name}"`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            )}

            {/* Delete Modal Error Banner */}
            {deleteModalError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{deleteModalError}</span>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingClass}
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingClass(null);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                disabled={
                  isDeletingClass ||
                  isLoadingCounts ||
                  (linkedCounts?.isHasAcademicData && confirmNameInput.trim() !== deletingClass.name.trim())
                }
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
              >
                {isDeletingClass ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Excluir Turma</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
