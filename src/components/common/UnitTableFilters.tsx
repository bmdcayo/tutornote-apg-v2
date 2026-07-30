import React from 'react';
import { Columns, Layers, Info } from 'lucide-react';

export interface UnitTableFiltersProps {
  selectedUnit: string; // 'all' | '1' | '2' | 'compare'
  onUnitChange: (unit: string) => void;
  selectedTable: string; // 'all' | 'grp_m1' | 'grp_m2' | 'grp_m3' (or table name/id)
  onTableChange: (table: string) => void;
  showCompareOption?: boolean;
  isUnitAutoDerived?: boolean;
  autoDerivedUnitNotice?: string; // e.g., "Mesa avaliada — 1ª Unidade"
  unitDisabled?: boolean;
  tableOptions?: Array<{ id: string; name: string }>; // default Mesa 1, Mesa 2, Mesa 3
  compact?: boolean;
  className?: string;
}

export const defaultTableOptions = [
  { id: 'grp_m1', name: 'Mesa 1' },
  { id: 'grp_m2', name: 'Mesa 2' },
  { id: 'grp_m3', name: 'Mesa 3' },
];

export const UnitTableFilters: React.FC<UnitTableFiltersProps> = ({
  selectedUnit,
  onUnitChange,
  selectedTable,
  onTableChange,
  showCompareOption = false,
  isUnitAutoDerived = false,
  autoDerivedUnitNotice,
  unitDisabled = false,
  tableOptions = defaultTableOptions,
  compact = false,
  className = '',
}) => {
  const handleUnitSelect = (newUnit: string) => {
    onUnitChange(newUnit);
    if (newUnit === 'all' || newUnit === 'compare') {
      onTableChange('all');
    } else if (selectedTable !== 'all') {
      // Reset table filter when unit changes to avoid cross-unit mismatch
      onTableChange('all');
    }
  };

  const isTableDisabled = selectedUnit === 'all' || selectedUnit === 'compare';

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${className}`}>
      {/* Selector 1: Unidade */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Unidade
        </label>
        {isUnitAutoDerived && autoDerivedUnitNotice ? (
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
            <Layers className="h-4 w-4 shrink-0 text-blue-500" />
            <span>{autoDerivedUnitNotice}</span>
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedUnit}
              onChange={(e) => handleUnitSelect(e.target.value)}
              disabled={unitDisabled}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800"
            >
              <option value="all">Todas as unidades</option>
              <option value="1">1ª Unidade — Semanas 1 a 8</option>
              <option value="2">2ª Unidade — Semanas 9 a 20</option>
              {showCompareOption && <option value="compare">Comparar unidades</option>}
            </select>
            <Layers className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        )}
      </div>

      {/* Selector 2: Mesa */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Mesa
        </label>
        <div className="relative">
          <select
            value={isTableDisabled ? 'all' : selectedTable}
            onChange={(e) => onTableChange(e.target.value)}
            disabled={isTableDisabled}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800"
          >
            <option value="all">Todas as mesas</option>
            {tableOptions.map((tbl) => (
              <option key={tbl.id} value={tbl.id}>
                {tbl.name}
              </option>
            ))}
          </select>
          <Columns className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
        {selectedUnit === 'all' && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Info className="h-3 w-3 text-slate-400" />
            <span>Selecione uma unidade para filtrar por mesa</span>
          </p>
        )}
      </div>
    </div>
  );
};
