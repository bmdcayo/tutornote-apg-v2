import React from 'react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { BookOpen, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const {
    cases,
    classes,
    selectedSemesterId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
  } = useApp();

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A8A] dark:text-blue-400 tracking-tight">
            Calendário do Semestre
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cronograma das 20 semanas de sessões de tutoria APG
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
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

          <UnitTableFilters
            selectedUnit={selectedUnit}
            onUnitChange={setSelectedUnit}
            selectedTable={selectedGroup}
            onTableChange={setSelectedGroup}
          />
        </div>
      </div>

      {/* 20 Weeks Timeline Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 20 }, (_, i) => {
          const weekNum = i + 1;
          const apgCase = cases.find((c) => c.week === weekNum);
          const isUnit1 = weekNum <= 8;

          if (selectedUnit === '1' && !isUnit1) return null;
          if (selectedUnit === '2' && isUnit1) return null;

          return (
            <div
              key={weekNum}
              className={`rounded-2xl border p-4 shadow-xs transition-all ${
                apgCase?.status === 'realizado'
                  ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                    isUnit1
                      ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  Semana {weekNum} ({isUnit1 ? 'Unid 1' : 'Unid 2'})
                </span>
                {apgCase && (
                  <Badge
                    variant={
                      apgCase.status === 'realizado'
                        ? 'success'
                        : apgCase.status === 'cancelado'
                        ? 'danger'
                        : 'warning'
                    }
                    size="sm"
                  >
                    {apgCase.status}
                  </Badge>
                )}
              </div>

              {apgCase ? (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    Caso #{apgCase.caseNumber}: {apgCase.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                    {apgCase.theme}
                  </p>

                  <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="h-3 w-3 text-slate-400" />
                      <span>{apgCase.date}</span>
                      <Clock className="h-3 w-3 text-slate-400 ml-1" />
                      <span>{apgCase.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{apgCase.room}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-slate-400 italic">
                  Sem caso agendado para esta semana.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
