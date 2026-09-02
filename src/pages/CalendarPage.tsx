import React from 'react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { SOIFilter } from '../components/common/SOIFilter';
import { BookOpen, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { caseMatchesCatalogScope } from '../utils/caseCatalog';

export const CalendarPage: React.FC = () => {
  const {
    cases,
    sois,
    classes,
    selectedSemesterId,
    selectedSoiId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
  } = useApp();

  const scopedClasses = classes.filter(
    (item) =>
      (!selectedSemesterId || selectedSemesterId === 'all' || item.semesterId === selectedSemesterId) &&
      (selectedSoiId === 'all' || item.soiId === selectedSoiId)
  );
  const scopedCases = cases.filter(
    (item) => caseMatchesCatalogScope(item, selectedSemesterId, selectedSoiId, sois)
  );

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
            Calendário do Semestre
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cronograma das 20 semanas de sessões de tutoria APG
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <SOIFilter compact />
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
          const weekCases = scopedCases.filter((c) => c.week === weekNum);
          const isUnit1 = weekNum <= 8;

          if (selectedUnit === '1' && !isUnit1) return null;
          if (selectedUnit === '2' && isUnit1) return null;

          const allDone = weekCases.length > 0 && weekCases.every((c) => c.status === 'realizado');

          return (
            <div
              key={weekNum}
              className={`rounded-2xl border p-4 shadow-xs transition-all ${
                allDone
                  ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                    isUnit1
                      ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  Semana {weekNum} ({isUnit1 ? 'Unid 1' : 'Unid 2'})
                </span>
                {weekCases.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-400">
                    {weekCases.length} {weekCases.length === 1 ? 'caso' : 'casos'}
                  </span>
                )}
              </div>

              {weekCases.length > 0 ? (
                <div className="space-y-3">
                  {weekCases.map((apgCase) => (
                    <div
                      key={apgCase.id}
                      className="border-t border-slate-100 dark:border-slate-800/80 pt-2 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="rounded-sm bg-rose-50 dark:bg-rose-950/50 text-[#C20054] dark:text-rose-400 font-extrabold text-[10px] px-1.5 py-0.5">
                          Caso #{apgCase.problemNumber || apgCase.caseNumber}
                        </span>
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
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                        {apgCase.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                        {apgCase.theme}
                      </p>

                      <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5 font-medium">
                          <CalendarIcon className="h-3 w-3 text-[#C20054]" />
                          <span className="text-slate-700 dark:text-slate-300 font-semibold">
                            {apgCase.date || 'Data a definir'}
                          </span>
                          {apgCase.time && (
                            <>
                              <Clock className="h-3 w-3 text-slate-400 ml-1" />
                              <span>{apgCase.time}</span>
                            </>
                          )}
                        </div>
                        {apgCase.room && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>{apgCase.room}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
