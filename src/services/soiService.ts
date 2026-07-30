import { SupabaseClient } from '@supabase/supabase-js';
import { SOI } from '../types';
import { isValidUuid } from './studentService';

type Result<T = undefined> = {
  success: boolean;
  data?: T;
  error?: string;
};

const normalizeCode = (name: string): string =>
  name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '');

const friendlyError = (error: any, fallback: string): string => {
  const message = String(error?.message || '');
  const lower = message.toLowerCase();
  if (error?.code === '23505') return 'Já existe um SOI com esse nome neste semestre.';
  if (error?.code === '23503') return 'O semestre selecionado não existe mais.';
  if (error?.code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Você não possui permissão para realizar esta operação.';
  }
  return message || fallback;
};

const mapSOI = (row: any): SOI => ({
  id: row.id,
  semesterId: row.semestre_id,
  name: row.nome || row.codigo || 'SOI',
  code: row.codigo || normalizeCode(row.nome || 'SOI'),
  active: row.ativo !== false,
  createdAt: row.created_at,
});

export async function fetchSOIs(client: SupabaseClient): Promise<Result<SOI[]>> {
  const { data, error } = await client
    .from('sois')
    .select('id, semestre_id, nome, codigo, ativo, created_at')
    .eq('ativo', true)
    .order('nome');

  return error
    ? { success: false, error: friendlyError(error, 'Não foi possível carregar os SOIs.') }
    : { success: true, data: (data || []).map(mapSOI) };
}

export async function createSOIInSupabase(
  client: SupabaseClient,
  semesterId: string,
  name: string
): Promise<Result<SOI>> {
  if (!isValidUuid(semesterId)) return { success: false, error: 'Selecione um semestre válido.' };
  if (!name.trim()) return { success: false, error: 'Informe o nome do SOI.' };

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError || !authData.user) return { success: false, error: 'Sua sessão expirou. Entre novamente.' };

  const payload = {
    semestre_id: semesterId,
    professor_id: authData.user.id,
    nome: name.trim().toUpperCase(),
    codigo: normalizeCode(name),
    ativo: true,
  };
  const { data, error } = await client
    .from('sois')
    .insert(payload)
    .select('id, semestre_id, nome, codigo, ativo, created_at')
    .single();

  return error || !data
    ? { success: false, error: friendlyError(error, 'Não foi possível cadastrar o SOI.') }
    : { success: true, data: mapSOI(data) };
}

export async function deleteSOIInSupabase(
  client: SupabaseClient,
  soiId: string
): Promise<Result> {
  if (!isValidUuid(soiId)) return { success: false, error: 'SOI inválido.' };
  const { data, error } = await client.from('sois').delete().eq('id', soiId).select('id');
  if (error) return { success: false, error: friendlyError(error, 'Não foi possível excluir o SOI.') };
  if (!data?.length) return { success: false, error: 'O SOI não foi excluído ou não está acessível.' };
  return { success: true };
}
