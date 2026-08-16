import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  Columns,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth, getInitials, formatRole } from '../../context/AuthContext';

interface SidebarProps {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileMenuOpen, setMobileMenuOpen }) => {
  const { settings } = useApp();
  const { logout, profile, loading } = useAuth();

  const navItems = [
    { label: 'Visão Geral', path: '/', icon: LayoutDashboard },
    { label: 'Avaliações', path: '/avaliacoes', icon: ClipboardCheck },
    { label: 'Alunos', path: '/alunos', icon: Users },
    { label: 'Turmas e Mesas', path: '/turmas-grupos', icon: GraduationCap },
    { label: 'Composição das Mesas', path: '/composicao-mesas', icon: Columns },
    { label: 'Casos APG', path: '/casos-apg', icon: BookOpen },
    { label: 'Relatórios', path: '/relatorios', icon: FileText },
    { label: 'Calendário', path: '/calendario', icon: Calendar },
    { label: 'Configurações', path: '/configuracoes', icon: Settings },
  ];

  const content = (
    <div className="flex h-full flex-col justify-between">
      <div className="p-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#C20054] font-black text-xl text-white shadow-md">
              A
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                <span className="text-[#C20054]">Afya</span> TutorNote
              </h1>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Acompanhamento APG
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 dark:hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-rose-500/10 text-[#C20054] dark:bg-rose-500/20 dark:text-rose-400 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-900 dark:hover:text-slate-200'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile Section */}
      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C20054] flex items-center justify-center shrink-0 font-bold text-xs text-white shadow-xs">
            {getInitials(profile?.nome)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
              {loading ? 'Carregando...' : profile?.nome || '—'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {profile?.email ? `${profile.email}` : formatRole(profile?.papel)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            logout();
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair da Conta</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-white text-slate-900 dark:bg-black dark:text-white flex-col border-r border-slate-200 dark:border-zinc-800">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white text-slate-900 dark:bg-black dark:text-white shadow-2xl flex flex-col">
            {content}
          </aside>
        </div>
      )}
    </>
  );
};
