import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';

interface UserInactiveScreenProps {
  onSignOut: () => void;
}

export const UserInactiveScreen: React.FC<UserInactiveScreenProps> = ({ onSignOut }) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-slate-950/90 p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-400 tracking-wider uppercase border border-red-500/20">
            Acesso Inativo
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Usuário Inativo
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Seu perfil no TutorNote APG está desativado no momento. Entre em contato com o administrador do sistema para solicitar a reativação da sua conta.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs py-3 px-4 shadow-lg transition-all cursor-pointer"
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
