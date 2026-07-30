import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}) => {
  const textStyles = {
    default: 'text-slate-900 dark:text-slate-100',
    primary: 'text-[#1E3A8A] dark:text-blue-400',
    info: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-500 dark:text-amber-400',
    danger: 'text-red-500 dark:text-red-400',
  };

  const iconStyles = {
    default: 'text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    primary: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300',
    info: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300',
    success: 'text-green-600 bg-green-50 dark:bg-green-950/60 dark:text-green-300',
    warning: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300',
    danger: 'text-red-600 bg-red-50 dark:bg-red-950/60 dark:text-red-300',
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 shadow-sm transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">{title}</p>
          <h3 className={`text-2xl font-bold ${textStyles[variant]}`}>{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-2">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[variant]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
};
