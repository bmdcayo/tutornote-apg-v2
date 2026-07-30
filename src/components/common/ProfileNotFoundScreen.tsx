import React from 'react';
import { UserX, RefreshCw, LogOut, AlertCircle } from 'lucide-react';

interface ProfileNotFoundScreenProps {
  onRetry: () => void;
  onSignOut: () => void;
  errorMsg?: string | null;
}

export const ProfileNotFoundScreen: React.FC<ProfileNotFoundScreenProps> = ({
  onRetry,
  onSignOut,
  errorMsg,
}) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/90 p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <UserX className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400 tracking-wider uppercase border border-amber-500/20">
            Acesso Restrito
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Perfil não encontrado
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sua conta está autenticada, porém não foi localizado um registro correspondente na tabela de perfis de usuário do sistema.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-left text-[11px] text-amber-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onRetry}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-3 px-4 shadow-lg transition-all cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Tentar novamente</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs py-2.5 px-4 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            <span>Sair da conta</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
          TutorNote APG — Faculdade de Medicina
        </div>
      </div>
    </div>
  );
};
