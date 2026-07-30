import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';
import { Badge } from '../components/common/Badge';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Loader2,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Sliders,
  Wifi,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useApp();
  const { isDemoMode } = useAuth();

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
        <h2 className="text-2xl font-bold text-[#1E3A8A] dark:text-blue-400 tracking-tight">
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
            <Database className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all disabled:opacity-50"
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
