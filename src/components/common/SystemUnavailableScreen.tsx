import React from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';

interface SystemUnavailableScreenProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const SystemUnavailableScreen: React.FC<SystemUnavailableScreenProps> = ({
  onRetry,
  isRetrying = false,
}) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400 tracking-wider uppercase border border-amber-500/20">
            Status do Serviço
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Sistema temporariamente indisponível
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Não foi possível estabelecer conexão segura com o servidor de banco de dados.
            Por favor, tente novamente em alguns instantes ou entre em contato com a equipe de TI.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 text-left text-[11px] text-slate-400 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Os serviços acadêmicos estão suspensos enquanto a conexão permanecer inacessível.
            Nenhum dado não autenticado será carregado.
          </span>
        </div>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-3 px-4 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Verificando conexão...' : 'Tentar novamente'}</span>
          </button>
        )}

        <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
          TutorNote APG — Faculdade de Medicina
        </div>
      </div>
    </div>
  );
};
