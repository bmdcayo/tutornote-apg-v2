import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Student, StudentCalculatedSummary } from '../types';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { SOIFilter } from '../components/common/SOIFilter';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  Filter,
  GraduationCap,
  Info,
  LayoutGrid,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatGrade } from '../services/calculationService';
import { ImportStudentsModal } from '../components/students/ImportStudentsModal';
import { fetchStudentLinkedCounts } from '../services/studentService';
import { getSupabaseClient } from '../lib/supabase';

export const StudentsPage: React.FC = () => {
  const {
    students,
    classes,
    groups,
    evaluations,
    settings,
    selectedSemesterId,
    selectedSoiId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
    globalSearch,
    setGlobalSearch,
    getStudentCalculatedSummary,
    getStudentTableName,
    getStudentAllocation,
    addStudent,
    updateStudentFull,
    updateStudentTablesFull,
    deactivateStudentFull,
    reactivateStudentFull,
    deleteStudentDefinitely,
    deleteEvaluation,
  } = useApp();

  // Selected student for detail modal
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Status Filter: 'Ativos' | 'Inativos' | 'Todos'
  const [statusFilter, setStatusFilter] = useState<'Ativos' | 'Inativos' | 'Todos'>('Ativos');

  // Open dropdown menu track
  const [activeMenuStudentId, setActiveMenuStudentId] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Edit Student Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnrollment, setEditEnrollment] = useState('');
  const [editSemestreCurso, setEditSemestreCurso] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editAtivo, setEditAtivo] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Table Allocation Modal state
  const [tablesStudent, setTablesStudent] = useState<Student | null>(null);
  const [tableClassId, setTableClassId] = useState('');
  const [tableU1GroupId, setTableU1GroupId] = useState('');
  const [tableU2GroupId, setTableU2GroupId] = useState('');
  const [tableSuccess, setTableSuccess] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [isSubmittingTable, setIsSubmittingTable] = useState(false);
  const [showAllSemestersForTableModal, setShowAllSemestersForTableModal] = useState(false);

  // Deactivate Modal state
  const [deactivatingStudent, setDeactivatingStudent] = useState<Student | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [isSubmittingDeactivate, setIsSubmittingDeactivate] = useState(false);

  // Reactivate Modal state
  const [reactivatingStudent, setReactivatingStudent] = useState<Student | null>(null);
  const [reactivateError, setReactivateError] = useState<string | null>(null);
  const [isSubmittingReactivate, setIsSubmittingReactivate] = useState(false);

  // Delete Permanently Modal state
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [linkedCounts, setLinkedCounts] = useState<{
    avaliacoesCount: number;
    alocacoesCount: number;
    contribuicoesCount: number;
    historicoCount: number;
    totalLinked: number;
  } | null>(null);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // New Student Form state
  const [newName, setNewName] = useState('');
  const [newEnrollment, setNewEnrollment] = useState('');
  const [newSemestreCurso, setNewSemestreCurso] = useState('1º Semestre');
  const [newClassId, setNewClassId] = useState('');
  const [newUnit1GroupId, setNewUnit1GroupId] = useState('');
  const [newUnit2GroupId, setNewUnit2GroupId] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  const [showAllSemestersForAddModal, setShowAllSemestersForAddModal] = useState(false);

  // Global notification banner inside StudentsPage
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const allSemesterClasses = classes.filter(
    (c) => !selectedSemesterId || selectedSemesterId === 'all' || c.semesterId === selectedSemesterId
  );
  const soiClasses = allSemesterClasses.filter(
    (c) => selectedSoiId === 'all' || !c.soiId || c.soiId === selectedSoiId
  );
  const semesterClasses =
    soiClasses.length > 0 ? soiClasses : allSemesterClasses.length > 0 ? allSemesterClasses : classes;
  const semesterClassIds = new Set(semesterClasses.map((c) => c.id));

  // Filter students: Search -> Turma -> Status -> Unidade -> Mesa
  const filteredStudents = students.filter((s) => {
    // 1. Search
    if (
      globalSearch.trim() &&
      !s.name.toLowerCase().includes(globalSearch.toLowerCase()) &&
      !s.enrollment.includes(globalSearch)
    ) {
      return false;
    }

    // 2. Turma & Semester
    if (selectedClass !== 'all') {
      if (s.classId !== selectedClass) return false;
    } else if ((selectedSemesterId && selectedSemesterId !== 'all') || selectedSoiId !== 'all') {
      // Um aluno ainda sem alocação deve permanecer visível para que o
      // professor consiga atribuir sua turma e suas mesas pela própria tela.
      if (s.classId && !semesterClassIds.has(s.classId)) return false;
    }

    // 3. Status filter ('Ativos' default, 'Inativos', 'Todos')
    const isStudentActive = s.ativo !== false && s.status !== 'Inativo';
    if (statusFilter === 'Ativos' && !isStudentActive) return false;
    if (statusFilter === 'Inativos' && isStudentActive) return false;

    // 4 & 5. Unidade & Mesa
    if (selectedUnit !== 'all' && selectedGroup !== 'all') {
      const unitNum: 1 | 2 = selectedUnit === '2' ? 2 : 1;
      const alloc = getStudentAllocation(s.id, unitNum);
      if (!alloc) return false;

      if (alloc.groupId !== selectedGroup) {
        const group = groups.find((g) => g.id === alloc.groupId);
        if (!group) return false;
        const lowerName = group.name.toLowerCase();
        if (selectedGroup === 'grp_m1' && !lowerName.includes('mesa 1')) return false;
        if (selectedGroup === 'grp_m2' && !lowerName.includes('mesa 2')) return false;
        if (selectedGroup === 'grp_m3' && !lowerName.includes('mesa 3')) return false;
      }
    }
    return true;
  });

  // Calculate active student count metrics
  const activeStudentsCount = students.filter((s) => s.ativo !== false && s.status !== 'Inativo').length;
  const inactiveStudentsCount = students.filter((s) => s.ativo === false || s.status === 'Inativo').length;

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedStudentSummary = selectedStudentId
    ? getStudentCalculatedSummary(selectedStudentId)
    : null;

  // Handlers for action menu triggers
  const handleOpenEditModal = (student: Student) => {
    setActiveMenuStudentId(null);
    setEditingStudent(student);
    setEditName(student.name);
    setEditEnrollment(student.enrollment);
    setEditSemestreCurso(student.semestreCurso || '1º Semestre');
    setEditClassId(student.classId);
    setEditAtivo(student.ativo !== false && student.status !== 'Inativo');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleOpenTableModal = (student: Student) => {
    setActiveMenuStudentId(null);
    setTablesStudent(student);
    const initialClassId = student.classId || classes[0]?.id || '';
    setTableClassId(initialClassId);
    const u1Alloc = getStudentAllocation(student.id, 1);
    const u2Alloc = getStudentAllocation(student.id, 2);
    const classMesas = groups.filter((g) => !g.classId || g.classId === initialClassId);
    setTableU1GroupId(u1Alloc?.groupId || student.groupId || classMesas[0]?.id || '');
    setTableU2GroupId(u2Alloc?.groupId || u1Alloc?.groupId || student.groupId || classMesas[0]?.id || '');
    setTableSuccess(null);
    setTableError(null);
  };

  const handleOpenDeactivateModal = (student: Student) => {
    setActiveMenuStudentId(null);
    setDeactivatingStudent(student);
    setDeactivateError(null);
  };

  const handleOpenReactivateModal = (student: Student) => {
    setActiveMenuStudentId(null);
    setReactivatingStudent(student);
    setReactivateError(null);
  };

  const handleOpenDeleteModal = async (student: Student) => {
    setActiveMenuStudentId(null);
    setDeletingStudent(student);
    setDeleteConfirmInput('');
    setDeleteError(null);
    setIsLoadingCounts(true);

    const client = getSupabaseClient();
    const localEvals = evaluations.filter((e) => e.studentId === student.id).length;
    const counts = await fetchStudentLinkedCounts(client, student.id, localEvals);
    setLinkedCounts(counts);
    setIsLoadingCounts(false);
  };

  // Submit Edit Student
  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setEditError(null);
    setEditSuccess(null);
    setIsSubmittingEdit(true);

    const res = await updateStudentFull(editingStudent.id, {
      name: editName,
      enrollment: editEnrollment,
      semestreCurso: editSemestreCurso,
      classId: editClassId,
      ativo: editAtivo,
    });

    setIsSubmittingEdit(false);
    if (res.success) {
      setEditSuccess('Dados do estudante atualizados com sucesso!');
      showToast('Estudante atualizado com sucesso.');
      setTimeout(() => {
        setEditingStudent(null);
      }, 1200);
    } else {
      setEditError(res.error || 'Erro ao atualizar dados do estudante.');
    }
  };

  // Submit Table Allocations
  const handleSaveTableAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tablesStudent) return;
    setTableError(null);
    setTableSuccess(null);

    if (!tableClassId) {
      setTableError('Selecione uma turma para o estudante.');
      return;
    }
    if (!tableU1GroupId || !tableU2GroupId) {
      setTableError('Selecione a mesa da 1ª e da 2ª unidade.');
      return;
    }

    const u1Mesa = groups.find((g) => g.id === tableU1GroupId);
    const u2Mesa = groups.find((g) => g.id === tableU2GroupId);
    if (
      (u1Mesa && u1Mesa.classId && u1Mesa.classId !== tableClassId) ||
      (u2Mesa && u2Mesa.classId && u2Mesa.classId !== tableClassId)
    ) {
      setTableError('As mesas selecionadas não pertencem à mesma turma.');
      return;
    }

    setIsSubmittingTable(true);

    const res = await updateStudentTablesFull(
      tablesStudent.id,
      tableClassId,
      tableU1GroupId,
      tableU2GroupId
    );

    setIsSubmittingTable(false);
    if (res.success) {
      setTableSuccess('Alocações de mesa salvas com sucesso!');
      showToast('Alocações de mesa e turma atualizadas.');
      setTimeout(() => {
        setTablesStudent(null);
      }, 1200);
    } else {
      setTableError(res.error || 'Erro ao salvar alocações de mesa.');
    }
  };

  // Submit Deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactivatingStudent) return;
    setIsSubmittingDeactivate(true);
    setDeactivateError(null);

    const res = await deactivateStudentFull(deactivatingStudent.id);
    setIsSubmittingDeactivate(false);

    if (res.success) {
      showToast(`Estudante ${deactivatingStudent.name} desativado com sucesso.`);
      setDeactivatingStudent(null);
    } else {
      setDeactivateError(res.error || 'Não foi possível desativar o estudante.');
    }
  };

  // Submit Reactivate
  const handleConfirmReactivate = async () => {
    if (!reactivatingStudent) return;
    setIsSubmittingReactivate(true);
    setReactivateError(null);

    const res = await reactivateStudentFull(reactivatingStudent.id);
    setIsSubmittingReactivate(false);

    if (res.success) {
      showToast(`Estudante ${reactivatingStudent.name} reativado com sucesso.`);
      const st = reactivatingStudent;
      setReactivatingStudent(null);
      // Open table modal to allow checking table assignments for reactivated student
      handleOpenTableModal(st);
    } else {
      setReactivateError(res.error || 'Não foi possível reativar o estudante.');
    }
  };

  // Submit Delete Permanently
  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    if (linkedCounts && linkedCounts.totalLinked > 0) return;

    const trimmedInput = deleteConfirmInput.trim();
    if (
      trimmedInput !== deletingStudent.name.trim() &&
      trimmedInput !== deletingStudent.enrollment.trim()
    ) {
      setDeleteError('A confirmação não corresponde exatamente ao nome ou matrícula do estudante.');
      return;
    }

    setIsSubmittingDelete(true);
    setDeleteError(null);

    const res = await deleteStudentDefinitely(deletingStudent.id);
    setIsSubmittingDelete(false);

    if (res.success) {
      showToast(`Estudante ${deletingStudent.name} excluído definitivamente.`);
      setDeletingStudent(null);
    } else {
      setDeleteError(res.error || 'Não foi possível excluir o estudante.');
    }
  };

  const handleOpenAddModal = () => {
    const initialCId = selectedClass !== 'all' ? selectedClass : classes[0]?.id || '';
    setNewClassId(initialCId);
    const classMesas = groups.filter((g) => !g.classId || g.classId === initialCId);
    setNewUnit1GroupId(classMesas[0]?.id || '');
    setNewUnit2GroupId(classMesas[0]?.id || '');
    setNewName('');
    setNewEnrollment('');
    setAddError(null);
    setShowAddModal(true);
  };

  // New Student submit
  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const nameTrim = newName.trim();
    const enrollmentTrim = newEnrollment.trim();

    if (!nameTrim) {
      setAddError('O nome do estudante é obrigatório.');
      return;
    }
    if (!enrollmentTrim) {
      setAddError('A matrícula do estudante é obrigatória.');
      return;
    }
    if (!newClassId) {
      setAddError('Selecione a turma do estudante.');
      return;
    }
    if (!newUnit1GroupId) {
      setAddError('Selecione a mesa da 1ª Unidade.');
      return;
    }
    if (!newUnit2GroupId) {
      setAddError('Selecione a mesa da 2ª Unidade.');
      return;
    }

    const u1Mesa = groups.find((g) => g.id === newUnit1GroupId);
    const u2Mesa = groups.find((g) => g.id === newUnit2GroupId);
    if (
      (u1Mesa && u1Mesa.classId && u1Mesa.classId !== newClassId) ||
      (u2Mesa && u2Mesa.classId && u2Mesa.classId !== newClassId)
    ) {
      setAddError('As mesas selecionadas não pertencem à mesma turma.');
      return;
    }

    setIsSubmittingAdd(true);

    const res = await addStudent(
      {
        name: nameTrim,
        enrollment: enrollmentTrim,
        semestreCurso: newSemestreCurso.trim() || '1º Semestre',
        classId: newClassId,
        groupId: newUnit1GroupId,
        status: 'Ativo',
        ativo: true,
      },
      newUnit1GroupId,
      newUnit2GroupId
    );

    setIsSubmittingAdd(false);

    if (res && !res.success) {
      setAddError(res.error || 'Não foi possível concluir o cadastro do estudante.');
    } else {
      setNewName('');
      setNewEnrollment('');
      setNewUnit1GroupId('');
      setNewUnit2GroupId('');
      setAddError(null);
      setShowAddModal(false);
      showToast('Estudante cadastrado com sucesso!');
    }
  };

  // Student specific chart data
  const studentEvals = selectedStudentId
    ? evaluations.filter((e) => e.studentId === selectedStudentId)
    : [];

  const studentWeeklyChartData = Array.from({ length: 20 }, (_, i) => {
    const weekNum = i + 1;
    const ev = studentEvals.find((e) => e.week === weekNum);
    return {
      semana: `Sem ${weekNum}`,
      nota: ev && ev.attendance === 'Presente' ? ev.totalGrossScore : null,
    };
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl dark:bg-white dark:text-slate-900 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
            Módulo de Alunos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerenciamento completo de estudantes, mesas da 1ª e 2ª unidades e acompanhamento longitudinal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-xs transition-all"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#C20054] dark:text-blue-400" />
            <span>Importar Alunos (XLSX / CSV)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C20054] px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Cadastrar Novo Aluno</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* 1. Busca por nome ou matrícula */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="w-full lg:w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
          <SOIFilter />
          {/* Status Filter: Ativos (default), Inativos, Todos */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Situação
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'Ativos' | 'Inativos' | 'Todos')}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 px-3 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="Ativos">Ativos ({activeStudentsCount})</option>
              <option value="Inativos">Inativos ({inactiveStudentsCount})</option>
              <option value="Todos">Todos ({students.length})</option>
            </select>
          </div>

          {/* 2. Turma */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Turma
            </label>
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 px-3 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">Todas as Turmas</option>
                {semesterClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* 3 & 4. Unidade e Mesa */}
          <UnitTableFilters
            selectedUnit={selectedUnit}
            onUnitChange={setSelectedUnit}
            selectedTable={selectedGroup}
            onTableChange={setSelectedGroup}
          />
        </div>
      </div>

      {/* Students Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredStudents.map((std) => {
          const summary = getStudentCalculatedSummary(std.id);
          const u1TableName = getStudentTableName(std.id, 1);
          const u2TableName = getStudentTableName(std.id, 2);
          const isInactive = std.ativo === false || std.status === 'Inativo';

          let badgeVariant: 'success' | 'info' | 'warning' = 'success';
          let badgeText = 'Permaneceu';

          if (u2TableName === 'Não definida') {
            badgeVariant = 'warning';
            badgeText = 'Alocação pendente';
          } else if (u1TableName !== u2TableName) {
            badgeVariant = 'info';
            badgeText = 'Mudou de mesa';
          }

          const isMenuOpen = activeMenuStudentId === std.id;

          return (
            <div
              key={std.id}
              className={`relative rounded-2xl border bg-white p-4 shadow-xs transition-all flex flex-col justify-between dark:bg-slate-900 ${
                isInactive
                  ? 'border-slate-300 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40 opacity-80'
                  : 'border-slate-200 hover:border-indigo-500 hover:shadow-md dark:border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div
                    onClick={() => setSelectedStudentId(std.id)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm shrink-0 ${
                        isInactive ? 'bg-slate-400 dark:bg-slate-700' : 'bg-indigo-900'
                      }`}
                    >
                      {std.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {std.name}
                        </h3>
                        {isInactive && (
                          <span className="inline-flex items-center rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-black text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            INATIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Matrícula: {std.enrollment}
                      </p>
                    </div>
                  </div>

                  <div className="relative flex items-center gap-1">
                    {summary?.hasAlert && !isInactive && (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}

                    {/* Action Menu Dropdown Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuStudentId(isMenuOpen ? null : std.id);
                      }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                      title="Opções do estudante"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Action Dropdown Menu */}
                    {isMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuStudentId(null);
                          }}
                        />
                        <div className="absolute right-0 top-7 z-30 min-w-[190px] rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-800 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuStudentId(null);
                              setSelectedStudentId(std.id);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                            <span>Ver perfil completo</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(std);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-600" />
                            <span>Editar estudante</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTableModal(std);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                          >
                            <LayoutGrid className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Alterar mesas (U1/U2)</span>
                          </button>

                          {isInactive ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReactivateModal(std);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                            >
                              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Reativar estudante</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeactivateModal(std);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                            >
                              <UserX className="h-3.5 w-3.5 text-amber-600" />
                              <span>Desativar estudante</span>
                            </button>
                          )}

                          <div className="my-1 border-t border-slate-100 dark:border-slate-700/80" />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeleteModal(std);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 font-bold"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                            <span>Excluir definitivamente</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Compact Unit & Table allocation details */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800 text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">
                    U1: {u1TableName} • U2: {u2TableName}
                  </span>
                  <Badge variant={badgeVariant} size="sm">
                    {badgeText}
                  </Badge>
                </div>
              </div>

              {/* Grades Summary Grid */}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    1ª Unidade (Máx 20)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatGrade(summary?.unit1Grade)} / 20.0
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    2ª Bruta (Máx 20)
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {formatGrade(summary?.unit2Gross)} / 20.0
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    2ª Ajustada (Máx 15)
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-400">
                    {formatGrade(summary?.unit2Adjusted)} / 15.0
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Nota Final (Máx 35)
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {formatGrade(summary?.finalGrade)} / 35.0
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] dark:border-slate-800">
                <span className="text-slate-500">
                  Frequência: {summary?.attendanceRate.toFixed(0)}%
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStudentId(std.id)}
                  className="text-indigo-600 font-bold dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Ver perfil →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL 1: Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveEditStudent}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Editar Estudante
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                {editSuccess}
              </div>
            )}

            <div className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg dark:bg-slate-800">
              ID do Aluno: <span className="font-bold text-slate-700 dark:text-slate-300">{editingStudent.id}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Matrícula *
                </label>
                <input
                  type="text"
                  required
                  value={editEnrollment}
                  onChange={(e) => setEditEnrollment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Semestre do Curso
                </label>
                <input
                  type="text"
                  value={editSemestreCurso}
                  onChange={(e) => setEditSemestreCurso(e.target.value)}
                  placeholder="Ex: 1º Semestre"
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Situação Cadastral
                </label>
                <select
                  value={editAtivo ? 'ativo' : 'inativo'}
                  onChange={(e) => setEditAtivo(e.target.value === 'ativo')}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: Table Allocation Modal (U1 / U2) */}
      {tablesStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveTableAllocations}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Alterar Turma e Mesas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTablesStudent(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span className="font-bold">{tablesStudent.name}</span> ({tablesStudent.enrollment})
            </div>

            {tableError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {tableError}
              </div>
            )}

            {tableSuccess && (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                {tableSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Turma *
                </label>
                <select
                  value={tableClassId}
                  onChange={(e) => {
                    const newCId = e.target.value;
                    setTableClassId(newCId);
                    const classMesas = groups.filter((g) => !g.classId || g.classId === newCId);
                    if (classMesas.length > 0) {
                      setTableU1GroupId(classMesas[0].id);
                      setTableU2GroupId(classMesas[0].id);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                >
                  {(showAllSemestersForTableModal
                    ? classes
                    : classes.filter((c) =>
                        ((!selectedSemesterId || selectedSemesterId === 'all' || c.semesterId === selectedSemesterId) &&
                          (selectedSoiId === 'all' || c.soiId === selectedSoiId)) ||
                        c.id === tableClassId
                      )
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllSemestersForTableModal}
                    onChange={(e) => setShowAllSemestersForTableModal(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Mostrar turmas de outros semestres</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mesa da 1ª Unidade (Semanas 1 a 8) *
                </label>
                <select
                  value={tableU1GroupId}
                  onChange={(e) => setTableU1GroupId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                >
                  {groups
                    .filter((g) => !g.classId || g.classId === tableClassId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mesa da 2ª Unidade (Semanas 9 a 20) *
                </label>
                <select
                  value={tableU2GroupId}
                  onChange={(e) => setTableU2GroupId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                >
                  {groups
                    .filter((g) => !g.classId || g.classId === tableClassId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50/70 p-3 text-[11px] text-blue-900 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                Alterar a alocação da 2ª unidade não modifica a 1ª unidade. As avaliações anteriores e o histórico de trocas de mesa serão preservados.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTablesStudent(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingTable}
                className="rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {isSubmittingTable ? 'Salvando...' : 'Salvar Alocações'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: Deactivate Confirmation Modal */}
      {deactivatingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 shrink-0">
                <UserX className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Desativar Estudante?
              </h3>
            </div>

            {deactivateError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {deactivateError}
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Você está desativando o estudante <span className="font-bold text-slate-900 dark:text-white">{deactivatingStudent.name}</span> (Matrícula: {deactivatingStudent.enrollment}).
            </p>

            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300 space-y-1.5 border border-slate-200 dark:border-slate-700">
              <p className="font-bold text-slate-900 dark:text-white">O que acontece ao desativar:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                <li>O aluno deixará de aparecer em novas sessões de avaliação.</li>
                <li>Notas, presenças, pareceres e histórico de mesas serão integralmente preservados.</li>
                <li>Não será considerado pendente ou ausente em lançamentos futuros.</li>
                <li>Poderá ser reativado a qualquer momento.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeactivatingStudent(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={isSubmittingDeactivate}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isSubmittingDeactivate ? 'Desativando...' : 'Confirmar Desativação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Reactivate Confirmation Modal */}
      {reactivatingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Reativar Estudante?
              </h3>
            </div>

            {reactivateError && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                {reactivateError}
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Você está reativando o estudante <span className="font-bold text-slate-900 dark:text-white">{reactivatingStudent.name}</span> (Matrícula: {reactivatingStudent.enrollment}).
            </p>

            <p className="text-[11px] text-slate-500">
              Após a reativação, você poderá ajustar a mesa do estudante para a 1ª e 2ª unidades.
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReactivatingStudent(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReactivate}
                disabled={isSubmittingReactivate}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isSubmittingReactivate ? 'Reativando...' : 'Confirmar Reativação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Delete Permanently Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/60 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Excluir Definitivamente
              </h3>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span className="font-bold">{deletingStudent.name}</span> (Matrícula: {deletingStudent.enrollment})
            </div>

            {isLoadingCounts ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Verificando histórico e registros acadêmicos...
              </div>
            ) : linkedCounts && linkedCounts.totalLinked > 0 ? (
              /* Block deletion if student has linked academic records */
              <div className="space-y-3">
                <div className="rounded-xl bg-rose-50 p-4 text-xs font-semibold text-rose-900 dark:bg-rose-950/70 dark:text-rose-200 border border-rose-200 dark:border-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Exclusão Não Permitida</span>
                  </div>
                  <p>
                    Este estudante possui registros acadêmicos e não pode ser excluído definitivamente. Utilize a opção <span className="underline font-bold">Desativar estudante</span>.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800 space-y-1.5">
                  <p className="font-bold text-slate-800 dark:text-slate-200">Registros encontrados:</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div>• Avaliações: {linkedCounts.avaliacoesCount}</div>
                    <div>• Registros de Presença: {linkedCounts.avaliacoesCount}</div>
                    <div>• Alocações de Mesa: {linkedCounts.alocacoesCount}</div>
                    <div>• Contribuições: {linkedCounts.contribuicoesCount}</div>
                    <div>• Histórico Acadêmico: {linkedCounts.historicoCount}</div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const st = deletingStudent;
                      setDeletingStudent(null);
                      handleOpenDeactivateModal(st);
                    }}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Desativar Estudante
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingStudent(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              /* Zero linked records: Allow deletion with explicit text confirmation */
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Este estudante não possui avaliações ou registros acadêmicos vinculados.
                </p>

                {deleteError && (
                  <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                    {deleteError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Para confirmar, digite exatamente a matrícula (<span className="font-mono font-bold">{deletingStudent.enrollment}</span>) ou o nome do estudante:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder={deletingStudent.enrollment}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDeletingStudent(null)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={
                      isSubmittingDelete ||
                      (deleteConfirmInput.trim() !== deletingStudent.name.trim() &&
                        deleteConfirmInput.trim() !== deletingStudent.enrollment.trim())
                    }
                    className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-40"
                  >
                    {isSubmittingDelete ? 'Excluindo...' : 'Excluir Definitivamente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 6: Student Detail Modal / Drawer */}
      {selectedStudent && selectedStudentSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-900 text-white font-black text-base">
                  {selectedStudent.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      {selectedStudent.name}
                    </h2>
                    {(selectedStudent.ativo === false || selectedStudent.status === 'Inativo') && (
                      <span className="inline-flex items-center rounded-md bg-rose-100 px-2 py-0.5 text-xs font-black text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                        INATIVO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    Matrícula: {selectedStudent.enrollment}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      1ª Unid: {selectedStudentSummary.unit1TableName || 'Mesa 1'}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                      2ª Unid: {selectedStudentSummary.unit2TableName || 'Mesa 1'}
                    </span>
                    <Badge
                      variant={
                        selectedStudentSummary.tableChangeStatus === 'Mudou de mesa'
                          ? 'info'
                          : selectedStudentSummary.tableChangeStatus === 'Segunda unidade não definida'
                          ? 'warning'
                          : 'success'
                      }
                      size="sm"
                    >
                      {selectedStudentSummary.tableChangeStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const st = selectedStudent;
                    setSelectedStudentId(null);
                    handleOpenEditModal(st);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentId(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Required Four Grade Displays */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-center dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                  Média 1ª Unidade
                </p>
                <p className="text-xl font-black text-indigo-900 dark:text-indigo-200">
                  {formatGrade(selectedStudentSummary.unit1Grade)}
                </p>
                <p className="text-[10px] text-indigo-500">Máximo 20.0</p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-center dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">
                  Média Bruta 2ª Unid
                </p>
                <p className="text-xl font-black text-blue-900 dark:text-blue-200">
                  {formatGrade(selectedStudentSummary.unit2Gross)}
                </p>
                <p className="text-[10px] text-blue-500">Máximo 20.0</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                  Nota Ajustada 2ª
                </p>
                <p className="text-xl font-black text-emerald-900 dark:text-emerald-200">
                  {formatGrade(selectedStudentSummary.unit2Adjusted)}
                </p>
                <p className="text-[10px] text-emerald-500">Máximo 15.0</p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-center dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                  Nota Final
                </p>
                <p className="text-xl font-black text-amber-900 dark:text-amber-200">
                  {formatGrade(selectedStudentSummary.finalGrade)}
                </p>
                <p className="text-[10px] text-amber-500">Máximo 35.0</p>
              </div>
            </div>

            {/* Attendance & Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                  Detalhamento de Frequência
                </h4>
                <div className="flex justify-between text-xs">
                  <span>Presentes: {selectedStudentSummary.presentCount}</span>
                  <span className="text-rose-600 font-bold">
                    Ausentes: {selectedStudentSummary.absentCount}
                  </span>
                  <span className="text-blue-600 font-bold">
                    Atestados: {selectedStudentSummary.certificateCount}
                  </span>
                  <span>Taxa: {selectedStudentSummary.attendanceRate.toFixed(0)}%</span>
                </div>
              </div>

              {selectedStudentSummary.hasAlert && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <h4 className="text-xs font-bold uppercase text-amber-800 dark:text-amber-300 mb-1">
                    Alertas Pedagógicos
                  </h4>
                  <ul className="list-disc list-inside text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
                    {selectedStudentSummary.alertReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Evolution Chart */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">
                Evolução Semanal do Aluno (Semanas 1 a 20)
              </h4>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={studentWeeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semana" stroke="#94a3b8" fontSize={10} />
                    <YAxis domain={[0, 20]} stroke="#94a3b8" fontSize={10} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="nota"
                      name="Nota Semanal"
                      stroke="#2563eb"
                      strokeWidth={2}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Evaluation History */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3">
                Histórico de Avaliações
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {studentEvals.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800"
                  >
                    <div>
                      <span className="font-bold">Semana {ev.week}</span> • Papel: {ev.role} •{' '}
                      Presença: {ev.attendance}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-900 dark:text-indigo-300">
                        {ev.attendance === 'Presente'
                          ? `${ev.totalGrossScore.toFixed(1)} / 20.0`
                          : ev.attendance}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Deseja realmente anular a avaliação da Semana ${ev.week}?`)) {
                            void deleteEvaluation(ev.studentId, ev.unit, ev.week, ev.caseId);
                          }
                        }}
                        className="flex items-center gap-1 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/80 px-2 py-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition-colors"
                        title="Anular avaliação desta semana"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Anular</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Student */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleAddStudentSubmit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cadastrar Novo Estudante
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAddError(null);
                  setShowAddModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {addError && (
              <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200 dark:border-red-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Maria Eduarda Santos"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Matrícula
              </label>
              <input
                type="text"
                required
                value={newEnrollment}
                onChange={(e) => setNewEnrollment(e.target.value)}
                placeholder="Ex: 20261099"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Turma *
              </label>
              <select
                required
                value={newClassId}
                onChange={(e) => {
                  const selectedCId = e.target.value;
                  setNewClassId(selectedCId);
                  const classMesas = groups.filter((g) => !g.classId || g.classId === selectedCId);
                  if (classMesas.length > 0) {
                    setNewUnit1GroupId(classMesas[0].id);
                    setNewUnit2GroupId(classMesas[0].id);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-semibold"
              >
                <option value="" disabled>
                  Selecione uma Turma
                </option>
                {(showAllSemestersForAddModal
                  ? classes
                  : classes.filter((c) =>
                      (!selectedSemesterId || selectedSemesterId === 'all' || c.semesterId === selectedSemesterId) &&
                      (selectedSoiId === 'all' || c.soiId === selectedSoiId)
                    )
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 mt-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllSemestersForAddModal}
                  onChange={(e) => setShowAllSemestersForAddModal(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Mostrar turmas de outros semestres</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mesa da 1ª Unidade *
                </label>
                <select
                  required
                  value={newUnit1GroupId}
                  onChange={(e) => setNewUnit1GroupId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                >
                  <option value="" disabled>
                    Selecione a Mesa U1
                  </option>
                  {groups
                    .filter((g) => !g.classId || g.classId === newClassId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mesa da 2ª Unidade *
                </label>
                <select
                  required
                  value={newUnit2GroupId}
                  onChange={(e) => setNewUnit2GroupId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-semibold"
                >
                  <option value="" disabled>
                    Selecione a Mesa U2
                  </option>
                  {groups
                    .filter((g) => !g.classId || g.classId === newClassId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd}
                className="rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {isSubmittingAdd ? 'Cadastrando...' : 'Salvar Aluno'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Import Students XLSX / CSV */}
      <ImportStudentsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
};
