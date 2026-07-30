import React from 'react';
import { Layers3 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SOIFilterProps {
  compact?: boolean;
}

export const SOIFilter: React.FC<SOIFilterProps> = ({ compact = false }) => {
  const {
    sois,
    selectedSemesterId,
    selectedSoiId,
    setSelectedSoiId,
  } = useApp();

  const available = sois.filter(
    (soi) => !selectedSemesterId || soi.semesterId === selectedSemesterId
  );

  return (
    <div>
      <label className="mb-0.5 block text-[10px] font-bold uppercase text-slate-400">
        SOI
      </label>
      <div className="relative">
        <Layers3 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <select
          aria-label="Filtrar por SOI"
          value={selectedSoiId}
          onChange={(event) => setSelectedSoiId(event.target.value)}
          className={`rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
            compact ? 'py-1.5' : 'py-2.5'
          }`}
        >
          <option value="all">Todos os SOIs</option>
          {available.map((soi) => (
            <option key={soi.id} value={soi.id}>
              {soi.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
