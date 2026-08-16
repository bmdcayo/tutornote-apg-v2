import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';
import { Badge } from '../components/common/Badge';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Database,
  Github,
  KeyRound,
  Loader2,
  Mail,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Sliders,
  UserRound,
  Wifi,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const {
    profile,
    updateAccountProfile,
    updatePassword,
    isDemoMode,
  } = useAuth();

  const isOwnerOrAdmin = profile?.papel === 'administrador' || profile?.email === 'bmdcayo@gmail.com' || isDemoMode;

  // Personal profile and password state
  const [profileName, setProfileName] = useState(profile?.nome || '');
  const [profileEmail, setProfileEmail] = useState(profile?.email || '');
  const [profileInstitution, setProfileInstitution] = useState(profile?.instituicao || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Barema state
  const [maxBarema, setMaxBarema] = useState(settings.maxBaremaScore);
  const [criteria, setCriteria] = useState(settings.baremaCriteria);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Supabase connection test state
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    connected: boolean;
    message: string;
    tableExists?: boolean;
  } | null>(null);

  useEffect(() => {
    setProfileName(profile?.nome || '');
    setProfileEmail(profile?.email || '');
    setProfileInstitution(profile?.instituicao || '');
  }, [profile?.nome, profile?.email, profile?.instituicao]);

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileNotice('');
    setProfileError('');
    setIsSavingProfile(true);
    const result = await updateAccountProfile({
      fullName: profileName,
      email: profileEmail,
      institution: profileInstitution,
    });
    setIsSavingProfile(false);

    if (!result.success) {
      setProfileError(result.error || 'Não foi possível atualizar as informações pessoais.');
      return;
    }
    setProfileNotice(result.message || 'Informações pessoais atualizadas com sucesso.');
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordNotice('');
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('A nova senha deve possuir pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError('A confirmação não corresponde à nova senha.');
      return;
    }

    setIsSavingPassword(true);
    const result = await updatePassword(newPassword);
    setIsSavingPassword(false);
    if (!result.success) {
      setPasswordError(result.error || 'Não foi possível alterar a senha.');
      return;
    }
    setNewPassword('');
    setNewPasswordConfirmation('');
    setPasswordNotice('Senha alterada com sucesso.');
  };

  const handleSaveBarema = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError('');
    const total = criteria.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0);
    if (total !== 20) {
      setSaveError(`A soma dos quatro critérios deve ser exatamente 20 pontos. Soma atual: ${total}.`);
      return;
    }
    const result = await updateSettings({ ...settings, maxBaremaScore: 20, baremaCriteria: criteria });
    if (!result.success) {
      setSaveError(result.error || 'Não foi possível salvar o Barema.');
      return;
    }
    setMaxBarema(20);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };


  const handleTestSupabaseConnection = async () => {
    setIsTestingSupabase(true);
    setTestResult(null);
    try {
      const client = getSupabaseClient();
      if (!client || !isSupabaseEnvConfigured()) throw new Error('Supabase não configurado.');
      const { error } = await client.auth.getSession();
      if (error) throw error;
      setTestResult({ success: true, connected: true, message: 'Conexão com o Supabase validada.' });
    } catch (error: any) {
      setTestResult({
        success: false,
        connected: false,
        message: 'Falha ao se comunicar com o servidor de teste do Supabase.',
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handleResetData = () => {
    if (confirm('Deseja realmente restaurar os dados de demonstração originais?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
          Configurações do Sistema
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ajuste das regras do Barema, fórmulas de cálculo e parâmetros de integração com o Supabase
        </p>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Configurações salvas com sucesso!</span>
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
          <AlertCircle className="h-4 w-4" /><span>{saveError}</span>
        </div>
      )}

      {/* Personal profile and security */}
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleSaveProfile}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <UserRound className="h-4 w-4 text-[#C20054] dark:text-blue-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Minhas informações pessoais
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Estes dados identificam o professor no sistema.
              </p>
            </div>
          </div>

          {profileError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {profileError}
            </div>
          )}
          {profileNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {profileNotice}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nome completo
            </label>
            <div className="relative">
              <UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                autoComplete="name"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              E-mail de acesso
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-300">
              A troca do e-mail pode exigir confirmação no endereço atual e no novo.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Instituição
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={profileInstitution}
                onChange={(event) => setProfileInstitution(event.target.value)}
                autoComplete="organization"
                placeholder="Faculdade de Medicina"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingProfile || isDemoMode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C20054] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingProfile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar informações pessoais
          </button>
        </form>

        <form
          onSubmit={handleChangePassword}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <KeyRound className="h-4 w-4 text-amber-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Alterar minha senha
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                A nova senha passa a valer no próximo acesso.
              </p>
            </div>
          </div>

          {passwordError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {passwordError}
            </div>
          )}
          {passwordNotice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {passwordNotice}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nova senha
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Confirmar nova senha
            </label>
            <input
              type="password"
              value={newPasswordConfirmation}
              onChange={(event) => setNewPasswordConfirmation(event.target.value)}
              minLength={8}
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Utilize uma senha exclusiva e não a compartilhe com outros professores.
          </div>

          <button
            type="submit"
            disabled={isSavingPassword || isDemoMode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingPassword ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Alterar senha
          </button>
        </form>
      </div>

      {/* Barema Rules Settings */}
      <form
        onSubmit={handleSaveBarema}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Regras do Barema de Avaliação APG
            </h3>
          </div>
          <Badge variant="primary">Máximo Total: 20.0 Pontos</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {criteria.map((crit, idx) => (
            <div
              key={crit.id}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">
                Critério #{idx + 1}
              </span>
              <input
                type="text"
                value={crit.name}
                onChange={(e) => {
                  const updated = [...criteria];
                  updated[idx].name = e.target.value;
                  setCriteria(updated);
                }}
                className="w-full font-bold text-xs bg-transparent border-b border-slate-300 py-1 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:border-indigo-600 mb-2"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Pontuação Máxima:</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={crit.maxScore}
                  onChange={(e) => {
                    const updated = [...criteria];
                    updated[idx].maxScore = parseFloat(e.target.value) || 5;
                    setCriteria(updated);
                    setMaxBarema(updated.reduce((sum, criterion) => sum + Number(criterion.maxScore || 0), 0));
                  }}
                  className="w-16 rounded-lg border border-slate-200 bg-white p-1 text-center font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Math Rules Information Box */}
        <div className="rounded-xl bg-indigo-50/80 border border-indigo-100 p-4 text-xs text-indigo-900 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-200 space-y-1">
          <p className="font-bold uppercase tracking-wider text-[10px] text-indigo-700 dark:text-indigo-300">
            Fórmula de Cálculo do Semestre (20 Semanas)
          </p>
          <p>• 1ª Unidade (Semanas 1 a 8): Média das sessões validas = Máximo 20.0 pontos</p>
          <p>• 2ª Unidade (Semanas 9 a 20): Média bruta (0 a 20 pts) × 15 ÷ 20 = Nota Ajustada (0 a 15.0 pts)</p>
          <p className="font-bold pt-1 text-indigo-950 dark:text-white">
            • Nota Final do Semestre = 1ª Unidade (20) + 2ª Unidade Ajustada (15) = Máximo 35.0 pontos
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-800 shadow-xs"
          >
            <Save className="h-4 w-4" />
            <span>Salvar Regras do Barema</span>
          </button>
        </div>
      </form>

      {/* Supabase Integration Preparedness & Server Test */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[#C20054] dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Conexão com o Supabase (Servidor / Variáveis de Ambiente)
            </h3>
          </div>
          <Badge variant={isDemoMode ? 'warning' : 'success'}>{isDemoMode ? 'Modo demonstrativo' : 'Supabase conectado'}</Badge>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          A conexão com o Supabase utiliza as variáveis de ambiente <code className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> e <code className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </p>

        {testResult && (
          <div
            className={`flex items-start gap-3 rounded-xl p-4 text-xs font-semibold border ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200'
                : testResult.tableExists === false
                ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200'
                : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">{testResult.message}</p>
              {testResult.success && (
                <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                  A tabela <code className="font-mono">semestres</code> foi consultada com sucesso no Supabase.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            Teste seguro via API do servidor (sem exposição de segredos)
          </span>
          <button
            type="button"
            onClick={handleTestSupabaseConnection}
            disabled={isTestingSupabase}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all disabled:opacity-50"
          >
            {isTestingSupabase ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            <span>Testar conexão com Supabase</span>
          </button>
        </div>
      </div>


      {/* Reset Data Section */}
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 dark:border-rose-900/40 dark:bg-rose-950/20 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
            Restaurar Dados de Demonstração
          </h3>
          <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
            Limpa alterações locais e recarrega a base fictícia inicial do TutorNote APG.
          </p>
        </div>
        <button
          onClick={handleResetData}
          className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-xs"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Restaurar Padrões</span>
        </button>
      </div>
    </div>
  );
};
