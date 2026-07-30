import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { APGCase, CaseStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { SOIFilter } from '../components/common/SOIFilter';
import {
  BookOpen,
  Calendar,
  Clock,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const CasesPage: React.FC = () => {
  const {
    cases,
    classes,
    sois,
    saveAPGCase,
    deleteAPGCase,
    selectedSemesterId,
    selectedSoiId,
    setSelectedSoiId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
  } = useApp();

  const [showCaseModal, setShowCaseModal] = useState<boolean>(false);
  const [editingCase, setEditingCase] = useState<APGCase | null>(null);

  // Form Fields
  const [formSoiId, setFormSoiId] = useState<string>('');
  const [problemNumber, setProblemNumber] = useState<1 | 2>(1);
  const [caseNumber, setCaseNumber] = useState<number>(1);
  const [week, setWeek] = useState<number>(1);
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [date, setDate] = useState('2026-02-09');
  const [time, setTime] = useState('08:00');
  const [room, setRoom] = useState('Sala APG 101');
  const [description, setDescription] = useState('');
  const [learningObjectivesText, setLearningObjectivesText] = useState('');
  const [teacherInstructions, setTeacherInstructions] = useState('');
  const [status, setStatus] = useState<CaseStatus>('planejado');

  // Status & Feedback State
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Deletion State
  const [caseToDelete, setCaseToDelete] = useState<APGCase | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const scopedClasses = classes.filter(
    (item) =>
      (!selectedSemesterId || item.semesterId === selectedSemesterId) &&
      (selectedSoiId === 'all' || item.soiId === selectedSoiId)
  );

  const filteredCases = cases.filter((c) => {
    if (selectedSoiId !== 'all' && c.soiId !== selectedSoiId) return false;
    if (selectedUnit !== 'all' && c.unit.toString() !== selectedUnit) return false;
    return true;
  });

  const handleOpenAddModal = () => {
    setEditingCase(null);
    setFormError(null);
    const selectedClassSOI = classes.find((item) => item.id === selectedClass)?.soiId;
    setFormSoiId(selectedSoiId !== 'all' ? selectedSoiId : selectedClassSOI || scopedClasses[0]?.soiId || '');
    setProblemNumber(1);
    setCaseNumber(cases.length + 1);
    setWeek(1);
    setTitle('');
    setTheme('');
    setDate('2026-02-09');
    setTime('08:00');
    setRoom('Sala APG 101');
    setDescription('');
    setLearningObjectivesText('');
    setTeacherInstructions('');
    setStatus('planejado');
    setShowCaseModal(true);
  };

  const handleOpenEditModal = (apgCase: APGCase) => {
    setEditingCase(apgCase);
    setFormError(null);
    setFormSoiId(apgCase.soiId || (selectedSoiId !== 'all' ? selectedSoiId : ''));
    setProblemNumber((apgCase.problemNumber || apgCase.caseNumber || 1) === 2 ? 2 : 1);
    setCaseNumber(apgCase.caseNumber || 1);
    setWeek(apgCase.week);
    setTitle(apgCase.title);
    setTheme(apgCase.theme);
    setDate(apgCase.date);
    setTime(apgCase.time);
    setRoom(apgCase.room);
    setDescription(apgCase.description);
    setLearningObjectivesText(apgCase.learningObjectives.join('\n'));
    setTeacherInstructions(apgCase.teacherInstructions);
    setStatus(apgCase.status);
    setShowCaseModal(true);
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formSoiId) {
      setFormError('Selecione um SOI válido para o caso APG.');
      return;
    }

    if (!title.trim()) {
      setFormError('Informe o título do caso APG.');
      return;
    }

    setIsSubmitting(true);

    const objectivesList = learningObjectivesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const code = `S${String(week).padStart(2, '0')}P${problemNumber}`;

    const result = await saveAPGCase({
      id: editingCase?.id || '',
      soiId: formSoiId,
      problemNumber,
      caseNumber: problemNumber,
      week,
      unit: week <= 8 ? 1 : 2,
      title: title.trim(),
      theme: theme.trim(),
      date,
      time,
      room: room.trim(),
      description: description.trim(),
      learningObjectives: objectivesList,
      teacherInstructions: teacherInstructions.trim(),
      status,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setFormError(result.error || 'Erro ao salvar caso APG no Supabase.');
      return;
    }

    setShowCaseModal(false);
    setSuccessMessage(`Caso ${code} salvo e carregado com sucesso`);
  };

  const handleOpenDeleteModal = (c: APGCase) => {
    setCaseToDelete(c);
    setDeleteError(null);
    setIsDeleting(false);
  };

  const handleConfirmDelete = async () => {
    if (!caseToDelete) return;
    setDeleteError(null);
    setIsDeleting(true);

    const problemCode = `S${String(caseToDelete.week).padStart(2, '0')}P${caseToDelete.problemNumber || caseToDelete.caseNumber || 1}`;

    const res = await deleteAPGCase(caseToDelete.id);
    setIsDeleting(false);

    if (!res.success) {
      setDeleteError(res.error || 'Não foi possível excluir o caso.');
      return;
    }

    setCaseToDelete(null);
    setSuccessMessage(`Caso ${problemCode} excluído com sucesso.`);
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 flex items-center justify-between shadow-xs">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 dark:text-emerald-400 font-bold hover:text-emerald-800 text-sm ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* Page Title & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A8A] dark:text-blue-400 tracking-tight">
            Módulo de Casos APG
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cadastramento e cronograma das 20 semanas com identificação automática de Unidade (1 a 8 = 1ª, 9 a 20 = 2ª)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <SOIFilter compact />
            {/* Turma Filter */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                Turma
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="all">Todas as Turmas</option>
                {scopedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2 & 3. Unidade e Mesa */}
            <UnitTableFilters
              selectedUnit={selectedUnit}
              onUnitChange={setSelectedUnit}
              selectedTable={selectedGroup}
              onTableChange={setSelectedGroup}
            />
          </div>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Caso APG</span>
          </button>
        </div>
      </div>

      {/* Cases List */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCases.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Nenhum caso APG foi cadastrado neste banco de dados
            </p>
          </div>
        ) : (
          filteredCases.map((c) => {
            const problemCode = `S${String(c.week).padStart(2, '0')}P${c.problemNumber || c.caseNumber || 1}`;
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Caso {problemCode} • Semana {c.week} ({c.unit === 1 ? '1ª Unidade' : '2ª Unidade'})
                    </span>
                    <Badge
                      variant={
                        c.status === 'realizado'
                          ? 'success'
                          : c.status === 'cancelado'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <p className="mb-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                    {sois.find((soi) => soi.id === c.soiId)?.name || 'SOI não identificado'}
                  </p>

                  <h3 className="text-base font-black text-slate-900 dark:text-white line-clamp-1">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mb-3">{c.theme}</p>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{c.date || 'Data não definida'}</span>
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                      <span>{c.time || 'Horário não definido'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{c.room || 'Sala não definida'}</span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {c.description || 'Sem descrição cadastrada.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    {c.learningObjectives.length} Objetivos de Aprendizagem
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditModal(c)}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      title="Editar Caso"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOpenDeleteModal(c)}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                      title="Excluir Caso"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add/Edit Case */}
      {showCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveSubmit}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingCase ? 'Editar Caso APG' : 'Cadastrar Novo Caso APG'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCaseModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Error Message Inside Modal Form */}
            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                SOI do Caso APG
              </label>
              <select
                required
                value={formSoiId}
                onChange={(e) => {
                  setFormSoiId(e.target.value);
                  setSelectedSoiId(e.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="" disabled>Selecione um SOI...</option>
                {sois.filter((soi) => !selectedSemesterId || soi.semesterId === selectedSemesterId).map((soi) => (
                  <option key={soi.id} value={soi.id}>
                    {soi.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Problema (P1 ou P2)
                </label>
                <select
                  value={problemNumber}
                  onChange={(e) => setProblemNumber(Number(e.target.value) as 1 | 2)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={1}>P1 (Problema 1)</option>
                  <option value={2}>P2 (Problema 2)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Semana (1 a 20)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={week}
                  onChange={(e) => setWeek(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unidade (Calculada)
                </label>
                <input
                  type="text"
                  disabled
                  value={week <= 8 ? '1ª Unidade' : '2ª Unidade'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2 text-xs font-bold text-indigo-900 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Título do Caso APG
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Dispneia Aguda no Idoso"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tema / Área Médica
              </label>
              <input
                type="text"
                required
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Ex: Sistema Cardiorrespiratório"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data da Sessão
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Horário
                </label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sala
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Descrição do Caso
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Objetivos de Aprendizagem (um por linha)
              </label>
              <textarea
                rows={3}
                value={learningObjectivesText}
                onChange={(e) => setLearningObjectivesText(e.target.value)}
                placeholder="Compreender os mecanismos fisiopatológicos...&#10;Identificar sinais semiológicos..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Instruções ao Professor
              </label>
              <input
                type="text"
                value={teacherInstructions}
                onChange={(e) => setTeacherInstructions(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Situação
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CaseStatus)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="planejado">Planejado</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowCaseModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Caso APG</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Modal Deletion Confirmation */}
      {caseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Confirmar Exclusão</span>
              </h3>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCaseToDelete(null)}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Deseja excluir o caso {`S${String(caseToDelete.week).padStart(2, '0')}P${caseToDelete.problemNumber || caseToDelete.caseNumber || 1}`}?
            </p>

            {/* Error message inside deletion modal */}
            {deleteError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setCaseToDelete(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 min-w-[110px]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Excluir Caso</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasesPage;
