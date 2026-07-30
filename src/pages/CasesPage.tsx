import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { APGCase, CaseStatus } from '../types';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import {
  BookOpen,
  Calendar,
  Clock,
  Edit3,
  Filter,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

export const CasesPage: React.FC = () => {
  const {
    cases,
    classes,
    saveAPGCase,
    deleteAPGCase,
    selectedSemesterId,
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
  const [caseNumber, setCaseNumber] = useState<number>(cases.length + 1);
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

  const filteredCases = cases.filter((c) => {
    if (selectedUnit !== 'all' && c.unit.toString() !== selectedUnit) return false;
    return true;
  });

  const handleOpenAddModal = () => {
    setEditingCase(null);
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
    setCaseNumber(apgCase.caseNumber);
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

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const objectivesList = learningObjectivesText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    saveAPGCase({
      id: editingCase?.id || `case_${Date.now()}`,
      caseNumber,
      week,
      unit: week <= 8 ? 1 : 2, // Auto-computed!
      title,
      theme,
      date,
      time,
      room,
      description,
      learningObjectives: objectivesList,
      teacherInstructions,
      status,
    });

    setShowCaseModal(false);
  };

  return (
    <div className="space-y-6">
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
            {/* 1. Turma Filter */}
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
                {classes.filter((c) => !selectedSemesterId || c.semesterId === selectedSemesterId).map((c) => (
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
        {filteredCases.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Caso #{c.caseNumber} • Semana {c.week} ({c.unit === 1 ? '1ª Unidade' : '2ª Unidade'})
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

              <h3 className="text-base font-black text-slate-900 dark:text-white line-clamp-1">
                {c.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium mb-3">{c.theme}</p>

              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{c.date}</span>
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 ml-2" />
                  <span>{c.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{c.room}</span>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                {c.description}
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
                  onClick={() => deleteAPGCase(c.id)}
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                  title="Excluir Caso"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Número do Caso
                </label>
                <input
                  type="number"
                  required
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
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
                onClick={() => setShowCaseModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-900 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-800"
              >
                Salvar Caso APG
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
