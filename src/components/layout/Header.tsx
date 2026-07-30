import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  LogOut,
  Moon,
  Search,
  Sun,
  User,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth, getInitials, formatRole } from '../../context/AuthContext';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (open: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu, setMobileMenuOpen }) => {
  const handleOpenMobile = () => {
    if (onOpenMobileMenu) onOpenMobileMenu();
    else if (setMobileMenuOpen) setMobileMenuOpen(true);
  };
  const {
    semesters,
    selectedSemester,
    setSelectedSemester,
    selectedSemesterId,
    setSelectedSemesterId,
    globalSearch,
    setGlobalSearch,
    darkMode,
    toggleDarkMode,
    evaluations,
    settings,
  } = useApp();

  const { logout, profile, loading } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Calculate pending evaluations for notification counter
  const pendingEvals = evaluations.filter((e) => e.status === 'Pendente');

  const userInitials = getInitials(profile?.nome);
  const userRoleText = formatRole(profile?.papel);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 sm:px-8 dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Left side: Mobile Toggle, Global Search & Semester Select */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={handleOpenMobile}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Abrir menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="relative w-64 max-w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            placeholder="Pesquisa global..."
            className="w-full rounded-md border-transparent bg-slate-100 py-1.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900 transition-all"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={selectedSemesterId || selectedSemester}
          onChange={(e) => {
            const val = e.target.value;
            const foundSem = semesters.find((s) => s.id === val || s.name === val);
            if (foundSem) {
              setSelectedSemesterId(foundSem.id);
            } else {
              setSelectedSemester(val);
            }
          }}
          disabled={semesters.length === 0}
          className="hidden sm:block rounded-md border-none bg-slate-100 py-1.5 px-3 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200"
        >
          {semesters.length === 0 ? (
            <option value="">Nenhum semestre letivo ativo cadastrado.</option>
          ) : (
            semesters.map((s) => (
              <option key={s.id} value={s.id}>
                Semestre {s.name}
              </option>
            ))
          )}
        </select>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
          title={darkMode ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
        >
          {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-600" />}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Notificações"
          >
            <Bell className="h-5 w-5" />
            {pendingEvals.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {pendingEvals.length}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Notificações APG
                </h4>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                {pendingEvals.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Todas as avaliações estão em dia!</span>
                  </div>
                ) : (
                  pendingEvals.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 text-xs text-slate-800 dark:border-amber-900/30 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                      <p className="font-semibold text-amber-900 dark:text-amber-300">
                        Avaliação Pendente - Semana {item.week}
                      </p>
                      <p className="mt-0.5 text-slate-600 dark:text-amber-200/80">
                        Sessão de tutoria necessita de lançamento final.
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Professor Profile Dropdown */}
        <div className="relative border-l border-slate-200 pl-2 sm:pl-4 dark:border-slate-800">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-900 text-white font-bold text-sm shadow-xs">
              {userInitials}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                {loading ? 'Carregando...' : profile?.nome || '—'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{userRoleText}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 hidden md:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
              <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {profile?.nome || '—'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{profile?.email || '—'}</p>
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                  {profile?.instituicao || settings.institution}
                </p>
              </div>
              <div className="mt-2 space-y-1">
                <a
                  href="/configuracoes"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <User className="h-4 w-4 text-slate-400" />
                  <span>Perfil e Preferências</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
