import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ResetPasswordPage: React.FC = () => {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError('As senhas informadas não são iguais.');
      return;
    }
    setLoading(true);
    const result = await updatePassword(password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Não foi possível atualizar a senha.');
      return;
    }
    setSuccess(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-amber-400" />
          <h1 className="font-bold">Definir nova senha</h1>
        </div>
        {success ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              Senha atualizada com sucesso.
            </p>
            <button
              onClick={async () => {
                await signOut();
                window.location.assign('/');
              }}
              className="w-full rounded-xl bg-blue-800 py-2.5 text-sm font-bold"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <p className="rounded-xl bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha (mínimo de 8 caracteres)"
              minLength={8}
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm"
            />
            <input
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Confirmar nova senha"
              minLength={8}
              required
              className="w-full rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-2.5 text-sm font-bold disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
