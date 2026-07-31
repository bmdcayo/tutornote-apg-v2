import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Building2,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundPlus,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, registerProfessor, loginDemo, resetPassword, isDemoMode } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const res = await login(email, password);
    setLoading(false);

    if (!res.success) {
      setErrorMsg(res.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setResetLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await resetPassword(resetEmail);
    setResetLoading(false);

    if (res.success) {
      setSuccessMsg(res.message || 'E-mail de redefinição de senha enviado com sucesso.');
      setShowForgotModal(false);
      setResetEmail('');
    } else {
      setErrorMsg(res.error || 'Erro ao enviar e-mail de redefinição.');
    }
  };

  const changeAuthMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Preencha o nome completo, o e-mail e a senha.');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('A senha deve possuir pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('A confirmação de senha não corresponde à senha informada.');
      return;
    }

    setLoading(true);
    const result = await registerProfessor({
      fullName,
      email,
      password,
      institution,
    });
    setLoading(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Não foi possível criar a conta.');
      return;
    }

    if (result.requiresEmailConfirmation) {
      const registeredEmail = email.trim().toLowerCase();
      setFullName('');
      setInstitution('');
      setPassword('');
      setConfirmPassword('');
      setEmail(registeredEmail);
      setAuthMode('login');
      setSuccessMsg(
        result.message ||
          'Cadastro realizado. Confirme o e-mail recebido antes de entrar.'
      );
      return;
    }

    setSuccessMsg(result.message || 'Conta criada com sucesso.');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1E3A8A] text-white shadow-xl ring-1 ring-white/10">
            <BookOpen className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <span className="inline-block rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-bold text-blue-400 uppercase tracking-wider border border-blue-500/20">
              Faculdade de Medicina — APG
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
              TutorNote APG
            </h1>
            <p className="text-xs text-slate-400">
              Acesso exclusivo para docentes, tutores e avaliadores acadêmicos
            </p>
          </div>
        </div>

        {/* Authentication Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-8 shadow-2xl backdrop-blur-md space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Lock className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-200">Autenticação do Sistema</h2>
          </div>

          {!isDemoMode && (
            <div className="grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
              <button
                type="button"
                onClick={() => changeAuthMode('login')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
                  authMode === 'login'
                    ? 'bg-[#1E3A8A] text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="h-3.5 w-3.5" />
                Entrar
              </button>
              <button
                type="button"
                onClick={() => changeAuthMode('register')}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors ${
                  authMode === 'register'
                    ? 'bg-[#1E3A8A] text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserRoundPlus className="h-3.5 w-3.5" />
                Criar conta
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 font-medium">
              {successMsg}
            </div>
          )}

          {authMode === 'login' || isDemoMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  E-mail de acesso
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tutor@faculdade.edu.br"
                    autoComplete="email"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Senha de Acesso
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] text-amber-400 hover:underline font-medium cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 text-white font-bold text-xs py-3 px-4 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <LogIn className="h-4 w-4 text-amber-400" />
                <span>{loading ? 'Autenticando...' : 'Entrar no Sistema'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegistration} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Nome completo
                </label>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nome e sobrenome"
                    autoComplete="name"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  E-mail de acesso
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tutor@faculdade.edu.br"
                    autoComplete="email"
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Instituição <span className="font-normal text-slate-500">(opcional)</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Faculdade de Medicina"
                    autoComplete="organization"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Senha
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      minLength={8}
                      autoComplete="new-password"
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] leading-relaxed text-blue-200">
                A nova conta será criada exclusivamente como <strong>Professor</strong>.
                O acesso poderá exigir confirmação pelo e-mail informado.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-800 text-white font-bold text-xs py-3 px-4 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <UserRoundPlus className="h-4 w-4 text-amber-400" />
                <span>{loading ? 'Criando conta...' : 'Criar conta de professor'}</span>
              </button>
            </form>
          )}

          {/* Demo Login Option if explicit VITE_ENABLE_DEMO_MODE=true in DEV */}
          {isDemoMode && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Modo de Desenvolvimento Ativo</span>
              </div>
              <p className="text-[11px] text-slate-400">
                A variável <code className="font-mono text-amber-300">VITE_ENABLE_DEMO_MODE=true</code> está ativada.
              </p>
              <button
                type="button"
                onClick={loginDemo}
                className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs py-2.5 px-3 transition-colors cursor-pointer"
              >
                Acesso Demonstrativo (Professor APG)
              </button>
            </div>
          )}
        </div>

        {/* Confidentiality Footer */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Ambiente seguro com criptografia de ponta a ponta</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Dúvidas de acesso? Contate o departamento de Tecnologia da Informação.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Recuperação de Senha</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Informe o seu e-mail institucional para receber um link de redefinição de senha.
              </p>
            </div>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  E-mail do Usuário
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="tutor@faculdade.edu.br"
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 py-2.5 px-3 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {resetLoading ? 'Enviando...' : 'Enviar Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
