import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseEnvConfigured } from '../lib/supabase';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  papel: 'administrador' | 'professor' | 'visualizador' | string;
  instituicao: string;
  ativo: boolean;
}

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'U';
  // Remove common title prefixes if present in input string
  const clean = name.replace(/^(prof\.|professor|dr\.|dra\.|docente)\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatRole(papel?: string | null): string {
  if (!papel) return 'Usuário';
  const p = papel.toLowerCase().trim();
  if (p === 'administrador' || p === 'admin') return 'Administrador';
  if (p === 'professor' || p === 'docente' || p === 'tutor') return 'Professor';
  if (p === 'visualizador' || p === 'viewer') return 'Visualizador';
  return papel.charAt(0).toUpperCase() + papel.slice(1);
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isSystemUnavailable: boolean;
  isCheckingConnection: boolean;
  isDemoMode: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  checkSystemHealth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isSystemUnavailable, setIsSystemUnavailable] = useState<boolean>(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(true);

  // Environment check: Fallback to demo/local mode if Supabase is not configured
  const isDev = Boolean(import.meta.env.DEV || import.meta.env.MODE === 'development');
  const envDemoConfig = import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';
  const isDemoMode = isDev && envDemoConfig;

  const fetchProfileFromDatabase = async (
    userId: string,
    userEmail?: string
  ): Promise<{ profile: UserProfile | null; errorMsg: string | null }> => {
    const client = getSupabaseClient();
    if (!client) {
      return { profile: null, errorMsg: 'Cliente Supabase indisponível.' };
    }

    try {
      const { data, error: dbError } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (dbError) {
        console.error('[Profile Fetch DB Error]', dbError.message);
        return { profile: null, errorMsg: `Erro ao consultar perfil: ${dbError.message}` };
      }

      if (!data) {
        return { profile: null, errorMsg: 'Perfil não cadastrado no banco de dados.' };
      }

      const mappedProfile: UserProfile = {
        id: data.id || userId,
        nome: data.nome || data.name || data.full_name || userEmail?.split('@')[0] || 'Usuário',
        email: data.email || userEmail || '',
        papel: data.papel || data.role || 'professor',
        instituicao: data.instituicao || data.institution || 'Faculdade de Medicina',
        ativo:
          data.ativo !== undefined
            ? Boolean(data.ativo)
            : data.is_active !== undefined
            ? Boolean(data.is_active)
            : true,
      };

      return { profile: mappedProfile, errorMsg: null };
    } catch (err: any) {
      console.error('[Profile Fetch Exception]', err);
      return { profile: null, errorMsg: 'Falha na comunicação ao carregar o perfil.' };
    }
  };

  const refreshProfile = async (): Promise<void> => {
    if (isDemoMode) {
      setProfile({
        id: 'demo_user_01',
        nome: 'Cayo Amaral Abreu',
        email: 'prof.tutor@ufba.br',
        papel: 'professor',
        instituicao: 'Faculdade de Medicina',
        ativo: true,
      });
      setError(null);
      setLoading(false);
      return;
    }

    if (!session?.user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { profile: dbProfile, errorMsg } = await fetchProfileFromDatabase(
      session.user.id,
      session.user.email
    );

    setProfile(dbProfile);
    setError(errorMsg);
    setLoading(false);
  };

  const checkSystemHealth = async (): Promise<boolean> => {
    setIsCheckingConnection(true);

    if (isDemoMode) {
      setIsSystemUnavailable(false);
      setIsCheckingConnection(false);

      const savedDemoAuth = localStorage.getItem('tutornote_auth_user');
      if (savedDemoAuth) {
        try {
          setProfile(JSON.parse(savedDemoAuth));
        } catch {
          setProfile({
            id: 'demo_user_01',
            nome: 'Cayo Amaral Abreu',
            email: 'prof.tutor@ufba.br',
            papel: 'professor',
            instituicao: 'Faculdade de Medicina',
            ativo: true,
          });
        }
      } else {
        const defaultDemoUser: UserProfile = {
          id: 'demo_user_01',
          nome: 'Cayo Amaral Abreu',
          email: 'prof.tutor@ufba.br',
          papel: 'professor',
          instituicao: 'Faculdade de Medicina',
          ativo: true,
        };
        setProfile(defaultDemoUser);
        localStorage.setItem('tutornote_auth_user', JSON.stringify(defaultDemoUser));
      }
      setLoading(false);
      return true;
    }

    if (!isSupabaseEnvConfigured()) {
      console.error('[Database Connection Error] As variáveis de ambiente do banco de dados não foram fornecidas.');
      setIsSystemUnavailable(true);
      setIsCheckingConnection(false);
      setLoading(false);
      return false;
    }

    try {
      const res = await fetch('/api/supabase/test');
      const data = await res.json();

      if (!data.connected && data.connected !== true) {
        console.error('[Database Connection Error] O serviço de banco de dados está inacessível ou desconectado.');
        setIsSystemUnavailable(true);
        setIsCheckingConnection(false);
        setLoading(false);
        return false;
      }

      setIsSystemUnavailable(false);

      const client = getSupabaseClient();
      if (client) {
        const { data: authData } = await client.auth.getSession();
        if (authData.session) {
          setSession(authData.session);
          setUser(authData.session.user);
          const { profile: dbProfile, errorMsg } = await fetchProfileFromDatabase(
            authData.session.user.id,
            authData.session.user.email
          );
          setProfile(dbProfile);
          setError(errorMsg);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      }

      setIsCheckingConnection(false);
      setLoading(false);
      return true;
    } catch {
      console.error('[Database Connection Error] Falha de comunicação com o servidor de banco de dados.');
      setIsSystemUnavailable(true);
      setIsCheckingConnection(false);
      setLoading(false);
      return false;
    }
  };

  useEffect(() => {
    checkSystemHealth();

    if (!isDemoMode) {
      const client = getSupabaseClient();
      if (client) {
        const { data: authListener } = client.auth.onAuthStateChange(
          async (_event, newSession) => {
            if (newSession) {
              setSession(newSession);
              setUser(newSession.user);
              setLoading(true);
              const { profile: dbProfile, errorMsg } = await fetchProfileFromDatabase(
                newSession.user.id,
                newSession.user.email
              );
              setProfile(dbProfile);
              setError(errorMsg);
              setLoading(false);
            } else {
              setSession(null);
              setUser(null);
              setProfile(null);
              setError(null);
              setLoading(false);
            }
          }
        );

        return () => {
          authListener.subscription.unsubscribe();
        };
      }
    }
  }, []);

  const login = async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (isDemoMode) {
      const demoProf: UserProfile = {
        id: 'demo_user_01',
        nome: 'Cayo Amaral Abreu',
        email: email || 'prof.tutor@ufba.br',
        papel: 'professor',
        instituicao: 'Faculdade de Medicina',
        ativo: true,
      };
      setProfile(demoProf);
      localStorage.setItem('tutornote_auth_user', JSON.stringify(demoProf));
      return { success: true };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Cliente de banco de dados indisponível.' };
    }

    try {
      const { data, error: authError } = await client.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (authError) {
        return { success: false, error: authError.message || 'Credenciais inválidas.' };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        setLoading(true);
        const { profile: dbProfile, errorMsg } = await fetchProfileFromDatabase(
          data.session.user.id,
          data.session.user.email
        );
        setProfile(dbProfile);
        setError(errorMsg);
        setLoading(false);
        return { success: true };
      }

      return { success: false, error: 'Não foi possível estabelecer a sessão.' };
    } catch {
      return { success: false, error: 'Erro de comunicação durante a autenticação.' };
    }
  };

  const loginDemo = () => {
    if (!isDemoMode) return;
    const demoProf: UserProfile = {
      id: 'demo_user_01',
      nome: 'Cayo Amaral Abreu',
      email: 'prof.tutor@ufba.br',
      papel: 'professor',
      instituicao: 'Faculdade de Medicina',
      ativo: true,
    };
    setProfile(demoProf);
    localStorage.setItem('tutornote_auth_user', JSON.stringify(demoProf));
  };

  const resetPassword = async (
    email: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    if (isDemoMode) {
      return {
        success: true,
        message: 'No modo demonstrativo, a redefinição de senha é simulada com sucesso.',
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Serviço de banco de dados indisponível.' };
    }

    try {
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : '/reset-password';

      const { error: resetErr } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetErr) {
        return { success: false, error: resetErr.message };
      }

      return {
        success: true,
        message: 'Link para redefinição de senha enviado para seu e-mail com sucesso.',
      };
    } catch {
      return { success: false, error: 'Falha ao solicitar redefinição de senha.' };
    }
  };

  const signOut = async () => {
    if (!isDemoMode) {
      const client = getSupabaseClient();
      if (client) {
        await client.auth.signOut();
      }
    }
    setSession(null);
    setUser(null);
    setProfile(null);
    setError(null);
    localStorage.removeItem('tutornote_auth_user');
  };
  const updatePassword = async (password: string) => {
    if (password.length < 8) return { success: false, error: 'A senha deve possuir pelo menos 8 caracteres.' };
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Serviço de autenticação indisponível.' };
    const { error: updateError } = await client.auth.updateUser({ password });
    return updateError ? { success: false, error: updateError.message } : { success: true };
  };

  const isAuthenticated = isDemoMode ? Boolean(profile) : Boolean(session?.user);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        error,
        isAuthenticated,
        isSystemUnavailable,
        isCheckingConnection,
        isDemoMode,
        login,
        loginDemo,
        resetPassword,
        updatePassword,
        refreshProfile,
        signOut,
        logout: signOut,
        checkSystemHealth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
};
