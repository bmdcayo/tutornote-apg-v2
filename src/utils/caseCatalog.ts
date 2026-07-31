import { APGCase, SOI } from '../types';

const normalizeSOI = (value?: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const getCaseSOI = (apgCase: APGCase, sois: SOI[]): SOI | undefined =>
  sois.find((soi) => soi.id === apgCase.soiId);

export const getCaseSemesterId = (apgCase: APGCase, sois: SOI[]): string =>
  apgCase.semesterId || getCaseSOI(apgCase, sois)?.semesterId || '';

export const getCaseSOICode = (apgCase: APGCase, sois: SOI[]): string =>
  apgCase.soiCode || getCaseSOI(apgCase, sois)?.code || '';

export const getCaseSOIName = (apgCase: APGCase, sois: SOI[]): string =>
  apgCase.soiName || getCaseSOI(apgCase, sois)?.name || 'SOI não identificado';

export const caseMatchesSOI = (
  apgCase: APGCase,
  targetSoiId: string,
  sois: SOI[]
): boolean => {
  if (!targetSoiId || targetSoiId === 'all') return true;
  if (apgCase.soiId === targetSoiId) return true;

  const targetSOI = sois.find((soi) => soi.id === targetSoiId);
  if (!targetSOI) return false;

  const caseSemesterId = getCaseSemesterId(apgCase, sois);
  const caseSOICode = getCaseSOICode(apgCase, sois);
  return (
    Boolean(caseSOICode) &&
    normalizeSOI(caseSOICode) === normalizeSOI(targetSOI.code) &&
    (!caseSemesterId || caseSemesterId === targetSOI.semesterId)
  );
};

export const caseMatchesCatalogScope = (
  apgCase: APGCase,
  selectedSemesterId: string,
  selectedSoiId: string,
  sois: SOI[]
): boolean => {
  const caseSemesterId = getCaseSemesterId(apgCase, sois);
  if (selectedSemesterId && caseSemesterId && caseSemesterId !== selectedSemesterId) {
    return false;
  }
  return caseMatchesSOI(apgCase, selectedSoiId, sois);
};

export const canManageCatalogCase = (
  apgCase: APGCase,
  userId: string | undefined,
  role: string | undefined,
  sois: SOI[]
): boolean => {
  const normalizedRole = String(role || '').toLowerCase();
  if (normalizedRole === 'administrador' || normalizedRole === 'admin') return true;
  if (apgCase.createdBy) return apgCase.createdBy === userId;

  // Compatibilidade com registros anteriores à coluna created_by:
  // um caso ligado diretamente a um SOI do usuário era, por definição, dele.
  return sois.some((soi) => soi.id === apgCase.soiId);
};
