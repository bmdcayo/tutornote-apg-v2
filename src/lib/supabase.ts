import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }
  if (!supabaseClientInstance) {
    try {
      supabaseClientInstance = createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch {
      // Technical log without exposing credentials
      console.error('[Supabase Error] Falha ao inicializar o cliente Supabase.');
      return null;
    }
  }
  return supabaseClientInstance;
}

export function isSupabaseEnvConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      supabaseUrl.trim().length > 0 &&
      supabasePublishableKey &&
      supabasePublishableKey.trim().length > 0
  );
}
