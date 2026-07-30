import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ClassGroup, Student, TableAllocation } from '../types';
import { Badge } from '../components/common/Badge';
import { SOIFilter } from '../components/common/SOIFilter';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';
import { updateStudentTableAllocationInSupabase } from '../services/studentService';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Columns,
  Copy,
  Info,
  RefreshCw,
  RotateCcw,
  Save,
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
} from 'lucide-react';

export const TableCompositionPage: React.FC = () => {
  const {
    semesters,
    classes,
    groups,
    students,
    tableAllocations,
    selectedSemesterId,
    setSelectedSemesterId,
    selectedSoiId,
    saveTableAllocation,
    copyUnit1CompositionToUnit2,
    getStudentAllocation,
    getStudentTableName,
    refreshStudents,
    refreshClassesAndGroups,
  } = useApp();

  // Filter classes by selected semester
  const filteredClasses = useMemo(() => {
    return classes.filter(
      (c) =>
        (!selectedSemesterId || c.semesterId === selectedSemesterId) &&
        (selectedSoiId === 'all' || c.soiId === selectedSoiId)
    );
  }, [classes, selectedSemesterId, selectedSoiId]);

  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Auto-select class when filteredClasses changes or on initial load
  useEffect(() => {
    if (filteredClasses.length > 0) {
      if (!selectedClassId || !filteredClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(filteredClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [filteredClasses, selectedClassId]);

  const [activeUnitMode, setActiveUnitMode] = useState<'u1' | 'u2' | 'compare'>('u1');

  // Draft allocation state for local batch editing before save
  const [draftAllocations, setDraftAllocations] = useState<Record<string, string>>({}); // studentId -> groupId
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>(
    new Date().toLocaleString('pt-BR')
  );

  // Modals
  const [showCopyConfirmModal, setShowCopyConfirmModal] = useState<boolean>(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [pendingTargetMode, setPendingTargetMode] = useState<'u1' | 'u2' | 'compare' | null>(null);

  const activeClass = filteredClasses.find((c) => c.id === selectedClassId) || filteredClasses[0];

  // Derive classStudents from active students in class OR with allocations in class
  const classStudents = useMemo(() => {
    const ids = new Set<string>();
    if (selectedClassId) {
      students.forEach((s) => {
        if (s.ativo !== false && s.classId === selectedClassId) {
          ids.add(s.id);
        }
      });
      tableAllocations.forEach((a) => {
        if (a.classId === selectedClassId) {
          const st = students.find((s) => s.id === a.studentId);
          if (!st || st.ativo !== false) {
            ids.add(a.studentId);
          }
        }
      });
    }
    return Array.from(ids).map((id) => {
      const existing = students.find((s) => s.id === id);
      if (existing) return existing;
      return {
        id,
        name: `Estudante ${id.slice(0, 6)}`,
        enrollment: '',
        classId: selectedClassId,
        groupId: '',
        status: 'Ativo' as const,
        ativo: true,
      };
    });
  }, [selectedClassId, students, tableAllocations]);

  const classGroups = groups.filter((g) => g.classId === selectedClassId);

  // Find groups for Mesa 1, Mesa 2, Mesa 3
  const mesa1Group = classGroups.find((g) => g.name.toLowerCase().includes('mesa 1') || g.name.toLowerCase().includes('grupo a')) || classGroups[0];
  const mesa2Group = classGroups.find((g) => g.name.toLowerCase().includes('mesa 2') || g.name.toLowerCase().includes('grupo b')) || classGroups[1];
  const mesa3Group = classGroups.find((g) => g.name.toLowerCase().includes('mesa 3') || g.name.toLowerCase().includes('grupo c')) || classGroups[2];

  const currentUnitNum: 1 | 2 = activeUnitMode === 'u2' ? 2 : 1;

  // Initialize draft when class, unit mode or allocations change
  useEffect(() => {
    const initialDraft: Record<string, string> = {};
    classStudents.forEach((student) => {
      const alloc = tableAllocations.find(
        (a) => a.studentId === student.id && a.classId === selectedClassId && a.unit === currentUnitNum
      );
      if (alloc) {
        initialDraft[student.id] = alloc.groupId;
      }
    });
    setDraftAllocations(initialDraft);
    setHasPendingChanges(false);
  }, [selectedClassId, activeUnitMode, tableAllocations, classStudents, currentUnitNum]);

  // Handle draft changes
  const handleAssignStudent = (studentId: string, groupId: string) => {
    setDraftAllocations((prev) => {
      const copy = { ...prev };
      if (groupId === '') {
        delete copy[studentId];
      } else {
        copy[studentId] = groupId;
      }
      return copy;
    });
    setHasPendingChanges(true);
    setJustSaved(false);
    setSaveError('');
    setSaveMessage('');
  };

  const handleSaveDraft = async () => {
    if (activeUnitMode === 'compare' || !hasPendingChanges || isSaving) return;
    if (!selectedClassId) {
      setSaveError('Selecione uma turma antes de salvar a composição.');
      return;
    }

    setIsSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const client = getSupabaseClient();
      const changedStudents = classStudents.filter((student) => {
        const savedGroupId = tableAllocations.find(
          (allocation) =>
            allocation.studentId === student.id &&
            allocation.classId === selectedClassId &&
            allocation.unit === currentUnitNum
        )?.groupId || '';
        return (draftAllocations[student.id] || '') !== savedGroupId;
      });

      if (changedStudents.length === 0) {
        setHasPendingChanges(false);
        setSaveMessage(`Nenhuma alteração pendente na ${currentUnitNum}ª unidade.`);
        return;
      }

      if (client && isSupabaseEnvConfigured()) {
        for (const student of changedStudents) {
          const targetGroupId = draftAllocations[student.id];
          if (!targetGroupId) {
            throw new Error(
              `${student.name} ficou sem mesa. Selecione uma mesa antes de salvar.`
            );
          }

          const result = await updateStudentTableAllocationInSupabase(
            client,
            student.id,
            selectedClassId,
            currentUnitNum,
            targetGroupId
          );
          if (!result.success) {
            throw new Error(
              `Não foi possível salvar ${student.name}: ${result.error || 'erro não informado pelo Supabase.'}`
            );
          }
        }

        const { data: confirmedAllocations, error: confirmationError } = await client
          .from('alocacoes_mesa')
          .select('aluno_id, turma_id, mesa_id, unidade')
          .eq('turma_id', selectedClassId)
          .eq('unidade', currentUnitNum)
          .in('aluno_id', changedStudents.map((student) => student.id));

        if (confirmationError) {
          throw new Error(`As alterações foram enviadas, mas não foi possível confirmá-las: ${confirmationError.message}`);
        }

        const unconfirmedStudent = changedStudents.find((student) => {
          const targetGroupId = draftAllocations[student.id];
          return !confirmedAllocations?.some(
            (allocation) =>
              allocation.aluno_id === student.id &&
              allocation.mesa_id === targetGroupId &&
              Number(allocation.unidade) === currentUnitNum
          );
        });
        if (unconfirmedStudent) {
          throw new Error(`O Supabase não confirmou a nova mesa de ${unconfirmedStudent.name}.`);
        }

        await refreshStudents();
        await refreshClassesAndGroups();
      } else {
        changedStudents.forEach((student) => {
          const targetGroupId = draftAllocations[student.id];
          if (targetGroupId) {
            saveTableAllocation(student.id, selectedClassId, targetGroupId, currentUnitNum);
          }
        });
      }
      setHasPendingChanges(false);
      setJustSaved(true);
      setSaveMessage(
        `Composição da ${currentUnitNum}ª unidade salva com sucesso (${changedStudents.length} alteração${changedStudents.length === 1 ? '' : 'ões'}).`
      );
      setLastSavedTimestamp(new Date().toLocaleString('pt-BR'));
    } catch (err: any) {
      console.error('Error saving draft allocations:', err);
      setJustSaved(false);
      setSaveError(err?.message || `Não foi possível salvar a composição da ${currentUnitNum}ª unidade.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDraft = () => {
    const resetDraft: Record<string, string> = {};
    classStudents.forEach((student) => {
      const alloc = tableAllocations.find(
        (a) => a.studentId === student.id && a.classId === selectedClassId && a.unit === currentUnitNum
      );
      if (alloc) {
        resetDraft[student.id] = alloc.groupId;
      }
    });
    setDraftAllocations(resetDraft);
    setHasPendingChanges(false);
    setJustSaved(false);
    setSaveError('');
    setSaveMessage('');
  };

  const handleSwitchMode = (targetMode: 'u1' | 'u2' | 'compare') => {
    if (hasPendingChanges) {
      setPendingTargetMode(targetMode);
      setShowUnsavedModal(true);
    } else {
      setActiveUnitMode(targetMode);
    }
  };

  const confirmSwitchMode = () => {
    if (pendingTargetMode) {
      setActiveUnitMode(pendingTargetMode);
      setPendingTargetMode(null);
    }
    setShowUnsavedModal(false);
    setHasPendingChanges(false);
    setJustSaved(false);
  };

  const handleExecuteCopyU1 = async () => {
    setIsSaving(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        for (const student of classStudents) {
          const u1Alloc = tableAllocations.find(
            (a) => a.studentId === student.id && a.classId === selectedClassId && a.unit === 1
          );
          if (u1Alloc && u1Alloc.groupId) {
            await updateStudentTableAllocationInSupabase(
              client,
              student.id,
              selectedClassId,
              2,
              u1Alloc.groupId
            );
          }
        }
        await refreshStudents();
        await refreshClassesAndGroups();
      } else {
        copyUnit1CompositionToUnit2(selectedClassId);
      }
      setShowCopyConfirmModal(false);
      setActiveUnitMode('u2');
      setJustSaved(true);
      setLastSavedTimestamp(new Date().toLocaleString('pt-BR'));
    } catch (err) {
      console.error('Error copying U1 composition:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Compute statistics
  const totalStudentsCount = classStudents.length;
  const allocatedStudentsCount = classStudents.filter((s) => draftAllocations[s.id]).length;
  const unallocatedStudentsCount = totalStudentsCount - allocatedStudentsCount;

  const m1Students = classStudents.filter((s) => draftAllocations[s.id] === mesa1Group?.id);
  const m2Students = classStudents.filter((s) => draftAllocations[s.id] === mesa2Group?.id);
  const m3Students = classStudents.filter((s) => draftAllocations[s.id] === mesa3Group?.id);
  const unassignedStudents = classStudents.filter((s) => !draftAllocations[s.id]);

  const counts = [m1Students.length, m2Students.length, m3Students.length];
  const maxMesaCount = Math.max(...counts);
  const minMesaCount = Math.min(...counts);
  const numericalDiff = maxMesaCount - minMesaCount;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A8A] dark:text-blue-400 tracking-tight flex items-center gap-2">
            <Columns className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Composição das Mesas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerenciamento longitudinal e alocação dinâmica dos estudantes nas Mesas 1, 2 e 3 por unidade
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <SOIFilter />
          {/* Semester Selector */}
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            disabled={semesters.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {semesters.length === 0 ? (
              <option value="">Nenhum semestre letivo ativo cadastrado.</option>
            ) : (
              semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  Semestre {sem.name}
                </option>
              ))
            )}
          </select>

          {/* Class Selector */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            {filteredClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => handleSwitchMode('u1')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeUnitMode === 'u1'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            1ª Unidade — Semanas 1 a 8
          </button>
          <button
            onClick={() => handleSwitchMode('u2')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeUnitMode === 'u2'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            2ª Unidade — Semanas 9 a 20
          </button>
          <button
            onClick={() => handleSwitchMode('compare')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              activeUnitMode === 'compare'
                ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Comparar unidades
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeUnitMode === 'u2' && (
            <button
              onClick={() => setShowCopyConfirmModal(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
            >
              <Copy className="h-4 w-4" />
              Copiar composição da 1ª unidade
            </button>
          )}

          {activeUnitMode !== 'compare' && (
            <>
              <button
                onClick={handleResetDraft}
                disabled={!hasPendingChanges || isSaving}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Desfazer
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={!hasPendingChanges || isSaving}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving
                  ? `Salvando ${currentUnitNum}ª unidade...`
                  : `Salvar alterações da ${currentUnitNum}ª unidade`}
              </button>
            </>
          )}
        </div>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
      {saveMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Turma</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{totalStudentsCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Com Mesa</p>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{allocatedStudentsCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Sem Mesa</p>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{unallocatedStudentsCount}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Mesa 1</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{m1Students.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Mesa 2</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{m2Students.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Mesa 3</p>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{m3Students.length}</p>
        </div>
      </div>

      {/* System Integrity & Composition Alerts */}
      {unallocatedStudentsCount > 0 && activeUnitMode !== 'compare' && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">Composição Incompleta — {unallocatedStudentsCount} estudante(s) sem mesa</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                A composição das mesas para a {currentUnitNum}ª unidade precisa ser concluída antes das sessões de avaliação.
              </p>
            </div>
          </div>
          {activeUnitMode === 'u2' && (
            <button
              onClick={() => setShowCopyConfirmModal(true)}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-amber-700"
            >
              Copiar da 1ª Unidade
            </button>
          )}
        </div>
      )}

      {numericalDiff > 2 && activeUnitMode !== 'compare' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <span>
            <strong>Diferença numérica entre mesas:</strong> A maior mesa possui {maxMesaCount} estudantes e a menor possui {minMesaCount} (diferença de {numericalDiff}). As mesas não precisam ter tamanhos idênticos, mas recomenda-se equilíbrio.
          </span>
        </div>
      )}

      {/* Status Bar for Unsaved Changes and System State */}
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
        <div className="flex items-center gap-2">
          {hasPendingChanges ? (
            <Badge variant="warning" size="sm">
              Alterações pendentes não salvas
            </Badge>
          ) : justSaved ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Composição atualizada
            </span>
          ) : allocatedStudentsCount === 0 ? (
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Info className="h-4 w-4 text-slate-400" /> Nenhum estudante alocado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Composição carregada
            </span>
          )}
        </div>
        <span>Última atualização: {lastSavedTimestamp}</span>
      </div>

      {/* MAIN VIEW MODE: UNIT 1 OR UNIT 2 THREE-COLUMN CARDS */}
      {activeUnitMode !== 'compare' ? (
        <div className="space-y-6">
          {/* Unallocated Students Pool (if any exist) */}
          {unassignedStudents.length > 0 && (
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Estudantes sem mesa definida na {currentUnitNum}ª Unidade ({unassignedStudents.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {unassignedStudents.map((std) => (
                  <div
                    key={std.id}
                    className="flex flex-col justify-between rounded-xl border border-amber-200 bg-white p-3 shadow-2xs dark:border-amber-900/40 dark:bg-slate-900"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{std.name}</p>
                      <p className="text-[11px] text-slate-500">Matrícula: {std.enrollment}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-slate-400">Atribuir para:</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAssignStudent(std.id, mesa1Group.id)}
                          className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300"
                        >
                          Mesa 1
                        </button>
                        <button
                          onClick={() => handleAssignStudent(std.id, mesa2Group.id)}
                          className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300"
                        >
                          Mesa 2
                        </button>
                        <button
                          onClick={() => handleAssignStudent(std.id, mesa3Group.id)}
                          className="rounded-lg bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300"
                        >
                          Mesa 3
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* THREE TABLES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* MESA 1 CARD */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 bg-blue-50/50 p-4 dark:border-slate-800 dark:bg-blue-950/20 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-extrabold text-white text-xs shadow-xs">
                    M1
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mesa 1</h3>
                    <p className="text-[11px] text-slate-500">
                      {m1Students.length} integrante(s)
                    </p>
                  </div>
                </div>
                <Badge variant="blue" size="sm">
                  {m1Students.length} discentes
                </Badge>
              </div>

              <div className="p-4 space-y-3 flex-1 min-h-[220px]">
                {m1Students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs italic text-center border-2 border-dashed border-slate-100 rounded-xl dark:border-slate-800">
                    Nenhum estudante alocado na Mesa 1
                  </div>
                ) : (
                  m1Students.map((std) => {
                    const u1Mesa = getStudentTableName(std.id, 1);
                    const isChanged = activeUnitMode === 'u2' && u1Mesa !== 'Mesa 1' && u1Mesa !== 'Não definida';
                    const isStayed = activeUnitMode === 'u2' && u1Mesa === 'Mesa 1';

                    return (
                      <div
                        key={std.id}
                        className="group flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-2xs hover:border-blue-300 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{std.name}</p>
                            <p className="text-[10px] text-slate-500">Matrícula: {std.enrollment}</p>
                          </div>
                          {activeUnitMode === 'u2' && (
                            <div>
                              {isStayed && (
                                <Badge variant="success" size="sm">
                                  Permaneceu
                                </Badge>
                              )}
                              {isChanged && (
                                <Badge variant="info" size="sm">
                                  Veio da {u1Mesa}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Move selector dropdown */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
                          <span className="text-[10px] text-slate-400">Mover para:</span>
                          <select
                            value={draftAllocations[std.id] || ''}
                            onChange={(e) => handleAssignStudent(std.id, e.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <option value={mesa1Group.id}>Mesa 1</option>
                            <option value={mesa2Group.id}>Mesa 2</option>
                            <option value={mesa3Group.id}>Mesa 3</option>
                            <option value="">Remover mesa</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* MESA 2 CARD */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/50 p-4 dark:border-slate-800 dark:bg-indigo-950/20 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-extrabold text-white text-xs shadow-xs">
                    M2
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mesa 2</h3>
                    <p className="text-[11px] text-slate-500">
                      {m2Students.length} integrante(s)
                    </p>
                  </div>
                </div>
                <Badge variant="indigo" size="sm">
                  {m2Students.length} discentes
                </Badge>
              </div>

              <div className="p-4 space-y-3 flex-1 min-h-[220px]">
                {m2Students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs italic text-center border-2 border-dashed border-slate-100 rounded-xl dark:border-slate-800">
                    Nenhum estudante alocado na Mesa 2
                  </div>
                ) : (
                  m2Students.map((std) => {
                    const u1Mesa = getStudentTableName(std.id, 1);
                    const isChanged = activeUnitMode === 'u2' && u1Mesa !== 'Mesa 2' && u1Mesa !== 'Não definida';
                    const isStayed = activeUnitMode === 'u2' && u1Mesa === 'Mesa 2';

                    return (
                      <div
                        key={std.id}
                        className="group flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-2xs hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{std.name}</p>
                            <p className="text-[10px] text-slate-500">Matrícula: {std.enrollment}</p>
                          </div>
                          {activeUnitMode === 'u2' && (
                            <div>
                              {isStayed && (
                                <Badge variant="success" size="sm">
                                  Permaneceu
                                </Badge>
                              )}
                              {isChanged && (
                                <Badge variant="info" size="sm">
                                  Veio da {u1Mesa}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Move selector dropdown */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
                          <span className="text-[10px] text-slate-400">Mover para:</span>
                          <select
                            value={draftAllocations[std.id] || ''}
                            onChange={(e) => handleAssignStudent(std.id, e.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <option value={mesa1Group.id}>Mesa 1</option>
                            <option value={mesa2Group.id}>Mesa 2</option>
                            <option value={mesa3Group.id}>Mesa 3</option>
                            <option value="">Remover mesa</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* MESA 3 CARD */}
            <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 bg-purple-50/50 p-4 dark:border-slate-800 dark:bg-purple-950/20 rounded-t-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 font-extrabold text-white text-xs shadow-xs">
                    M3
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Mesa 3</h3>
                    <p className="text-[11px] text-slate-500">
                      {m3Students.length} integrante(s)
                    </p>
                  </div>
                </div>
                <Badge variant="purple" size="sm">
                  {m3Students.length} discentes
                </Badge>
              </div>

              <div className="p-4 space-y-3 flex-1 min-h-[220px]">
                {m3Students.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-xs italic text-center border-2 border-dashed border-slate-100 rounded-xl dark:border-slate-800">
                    Nenhum estudante alocado na Mesa 3
                  </div>
                ) : (
                  m3Students.map((std) => {
                    const u1Mesa = getStudentTableName(std.id, 1);
                    const isChanged = activeUnitMode === 'u2' && u1Mesa !== 'Mesa 3' && u1Mesa !== 'Não definida';
                    const isStayed = activeUnitMode === 'u2' && u1Mesa === 'Mesa 3';

                    return (
                      <div
                        key={std.id}
                        className="group flex flex-col rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-2xs hover:border-purple-300 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{std.name}</p>
                            <p className="text-[10px] text-slate-500">Matrícula: {std.enrollment}</p>
                          </div>
                          {activeUnitMode === 'u2' && (
                            <div>
                              {isStayed && (
                                <Badge variant="success" size="sm">
                                  Permaneceu
                                </Badge>
                              )}
                              {isChanged && (
                                <Badge variant="info" size="sm">
                                  Veio da {u1Mesa}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Move selector dropdown */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2 dark:border-slate-700/60">
                          <span className="text-[10px] text-slate-400">Mover para:</span>
                          <select
                            value={draftAllocations[std.id] || ''}
                            onChange={(e) => handleAssignStudent(std.id, e.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <option value={mesa1Group.id}>Mesa 1</option>
                            <option value={mesa2Group.id}>Mesa 2</option>
                            <option value={mesa3Group.id}>Mesa 3</option>
                            <option value="">Remover mesa</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MODE: COMPARAR UNIDADES VIEW */
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Comparativo de Alocação das Mesas — 1ª Unidade vs. 2ª Unidade
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualização consolidada de permanência e movimentação por discente
              </p>
            </div>
            <Badge variant="blue" size="md">
              {classStudents.length} discentes
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider dark:bg-slate-800/80 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Estudante</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">1ª Unidade (Sem 1-8)</th>
                  <th className="px-4 py-3 text-center">Transição</th>
                  <th className="px-4 py-3">2ª Unidade (Sem 9-20)</th>
                  <th className="px-4 py-3">Situação da Mudança</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {classStudents.map((student) => {
                  const u1Mesa = getStudentTableName(student.id, 1);
                  const u2Mesa = getStudentTableName(student.id, 2);

                  let statusVariant: 'success' | 'info' | 'warning' = 'success';
                  let statusText = 'Permaneceu na mesma mesa';

                  if (u2Mesa === 'Não definida') {
                    statusVariant = 'warning';
                    statusText = 'Segunda unidade não definida';
                  } else if (u1Mesa !== u2Mesa) {
                    statusVariant = 'info';
                    statusText = 'Mudou de mesa';
                  }

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        {student.name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">{student.enrollment}</td>
                      <td className="px-4 py-3.5 font-semibold text-blue-600 dark:text-blue-400">
                        {u1Mesa}
                      </td>
                      <td className="px-4 py-3.5 text-center text-slate-400">
                        <ArrowRight className="h-4 w-4 inline" />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-purple-600 dark:text-purple-400">
                        {u2Mesa}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={statusVariant} size="sm">
                          {statusText}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => {
                            setActiveUnitMode('u2');
                          }}
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Editar U2
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: COPY U1 TO U2 */}
      {showCopyConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/60">
                <Copy className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Copiar composição da 1ª unidade?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Você está prestes a copiar a alocação de mesas da 1ª unidade para a 2ª unidade da turma{' '}
              <strong>{activeClass.name}</strong>.
            </p>

            <div className="rounded-xl bg-slate-50 p-3.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
              <p>
                • <strong>Total de estudantes a copiar:</strong> {totalStudentsCount}
              </p>
              <p>• A composição da 1ª unidade permanecerá intacta.</p>
              <p>• Os estudantes não serão duplicados nos relatórios ou cadastros.</p>
              <p>• Você poderá ajustar individualmente as mesas depois.</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCopyConfirmModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleExecuteCopyU1}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 transition-all"
              >
                Confirmar cópia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: UNSAVED CHANGES WHEN SWITCHING */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Alterações pendentes não salvas
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Você fez alterações na composição das mesas da {currentUnitNum}ª unidade que ainda não foram salvas.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowUnsavedModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSwitchMode}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700"
              >
                Sair sem salvar
              </button>
              <button
                onClick={() => {
                  handleSaveDraft();
                  confirmSwitchMode();
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
              >
                Salvar e prosseguir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
