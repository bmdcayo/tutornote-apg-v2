import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { APGCase, CaseStatus } from '../../types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Trash2,
  Upload,
  X,
  Edit3,
  BookOpen,
} from 'lucide-react';

export interface ImportCaseRow {
  tempId: string;
  soiRaw: string;
  soiId: string;
  week: number;
  problemNumber: 1 | 2;
  title: string;
  theme: string;
  date: string;
  time: string;
  room: string;
  description: string;
  learningObjectives: string[];
  learningObjectivesRaw: string;
  teacherInstructions: string;
  status: CaseStatus;
  errors: string[];
  warnings: string[];
  isDuplicateInFile: boolean;
  isDuplicateInDatabase: boolean;
}

interface ImportCasesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const ImportCasesModal: React.FC<ImportCasesModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { cases, sois, selectedSoiId, importAPGCases } = useApp();

  const [importRows, setImportRows] = useState<ImportCaseRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [defaultSoiId, setDefaultSoiId] = useState<string>(
    selectedSoiId !== 'all' ? selectedSoiId : sois[0]?.id || ''
  );
  const [activeTab, setActiveTab] = useState<'all' | 'valid' | 'warnings' | 'errors'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Resolve SOI ID from text (code, name, or fallback to defaultSoiId)
  const resolveSoiId = (raw: string, fallbackId: string): { soiId: string; matchedName: string } => {
    const fallbackSoi = sois.find((s) => s.id === fallbackId) || sois[0];
    if (!raw || !raw.trim()) {
      return { soiId: fallbackSoi?.id || '', matchedName: fallbackSoi?.name || '' };
    }

    const rawClean = raw.trim();
    const lowerClean = rawClean.toLowerCase();

    // 1. Direct ID match
    const matchById = sois.find((s) => s.id === rawClean);
    if (matchById) return { soiId: matchById.id, matchedName: matchById.name };

    // 2. Exact Name match (case-insensitive)
    const matchByName = sois.find((s) => s.name.trim().toLowerCase() === lowerClean);
    if (matchByName) return { soiId: matchByName.id, matchedName: matchByName.name };

    // 3. Exact Code match (case-insensitive)
    const matchByCode = sois.find((s) => {
      const code = s.code?.trim().toLowerCase();
      if (!code) return false;
      return (
        code === lowerClean ||
        `soi ${code}` === lowerClean ||
        `soi-${code}` === lowerClean ||
        `soi_${code}` === lowerClean
      );
    });
    if (matchByCode) return { soiId: matchByCode.id, matchedName: matchByCode.name };

    // 4. Normalized string match without spaces or special chars
    const normRaw = lowerClean.replace(/[^a-z0-9]/g, '');
    const matchByNorm = sois.find((s) => {
      const normName = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normCode = (s.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        (normName && normName === normRaw) ||
        (normCode && normCode === normRaw) ||
        (normCode && `soi${normCode}` === normRaw)
      );
    });
    if (matchByNorm) return { soiId: matchByNorm.id, matchedName: matchByNorm.name };

    // 5. Number / Roman numeral token extraction (I, II, III, IV, V, VI or 1, 2, 3, 4, 5, 6)
    const romanToArabic: Record<string, string> = {
      i: '1', '1': '1',
      ii: '2', '2': '2',
      iii: '3', '3': '3',
      iv: '4', '4': '4',
      v: '5', '5': '5',
      vi: '6', '6': '6',
    };

    const extractToken = (str: string) => {
      const cleanStr = str.toLowerCase();
      const match = cleanStr.match(/\b(?:soi\s*|-|_)?(iii|ii|iv|vi|i|v|\d+)\b/);
      if (!match) return '';
      const token = match[1];
      return romanToArabic[token] || token;
    };

    const rawToken = extractToken(lowerClean);
    if (rawToken) {
      const matchByToken = sois.find((s) => {
        const sToken = extractToken(s.name) || extractToken(s.code || '');
        return Boolean(sToken && sToken === rawToken);
      });
      if (matchByToken) return { soiId: matchByToken.id, matchedName: matchByToken.name };
    }

    // Fallback if no specific match
    return { soiId: fallbackSoi?.id || '', matchedName: fallbackSoi?.name || '' };
  };

  // Helper to validate rows
  const validateRows = (
    rows: Omit<ImportCaseRow, 'errors' | 'warnings' | 'isDuplicateInFile' | 'isDuplicateInDatabase'>[],
    overrideDefaultSoiId?: string
  ): ImportCaseRow[] => {
    const fallbackSoi = overrideDefaultSoiId || defaultSoiId;

    const validatedRows = rows.map((r) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const cleanTitle = r.title.trim();
      const cleanTheme = r.theme.trim();
      const cleanDescription = r.description.trim();
      const cleanInstructions = r.teacherInstructions.trim();
      const cleanDate = r.date.trim() || '2026-02-09';
      const cleanTime = r.time.trim() || '08:00';
      const cleanRoom = r.room.trim() || 'Sala APG 101';

      // Parse objectives array
      const objectives = r.learningObjectivesRaw
        .split(/;|\n/)
        .map((o) => o.trim())
        .filter(Boolean);

      // Determine effective soiId:
      // If r.soiId is already set to a valid SOI, keep it. Otherwise resolve from r.soiRaw or fallback.
      let soiId = r.soiId && sois.some((s) => s.id === r.soiId) ? r.soiId : '';
      if (!soiId) {
        const soiInfo = resolveSoiId(r.soiRaw, fallbackSoi);
        soiId = soiInfo.soiId;
      }

      if (!soiId) {
        errors.push('SOI não identificado. Selecione um SOI na linha ou um SOI padrão.');
      }

      if (!cleanTitle) {
        errors.push('Título do caso é obrigatório.');
      }

      if (!r.week || isNaN(r.week) || r.week < 1 || r.week > 20) {
        errors.push('Semana deve ser um número entre 1 e 20.');
      }

      if (![1, 2].includes(r.problemNumber)) {
        errors.push('Problema deve ser 1 (P1) ou 2 (P2).');
      }

      return {
        ...r,
        soiId,
        title: cleanTitle,
        theme: cleanTheme,
        date: cleanDate,
        time: cleanTime,
        room: cleanRoom,
        description: cleanDescription,
        learningObjectives: objectives,
        teacherInstructions: cleanInstructions,
        errors,
        warnings,
        isDuplicateInFile: false,
        isDuplicateInDatabase: false,
      };
    });

    // Check duplicates across file
    const keyCounts: Record<string, number> = {};
    validatedRows.forEach((r) => {
      if (r.soiId) {
        const key = `${r.soiId}_S${r.week}_P${r.problemNumber}`;
        keyCounts[key] = (keyCounts[key] || 0) + 1;
      }
    });

    return validatedRows.map((r) => {
      if (!r.soiId) return r;
      const rowKey = `${r.soiId}_S${r.week}_P${r.problemNumber}`;
      const isDuplicateInFile = Boolean(keyCounts[rowKey] > 1);
      const warnings = [...r.warnings];

      if (isDuplicateInFile) {
        warnings.push('Semana/Problema duplicado na mesma planilha para este SOI.');
      }

      const isDuplicateInDatabase = cases.some(
        (c) =>
          c.soiId === r.soiId &&
          c.week === r.week &&
          (c.problemNumber || c.caseNumber || 1) === r.problemNumber
      );
      if (isDuplicateInDatabase) {
        warnings.push('Já existe um caso cadastrado para esta Semana e Problema no sistema (será atualizado).');
      }

      return {
        ...r,
        warnings,
        isDuplicateInFile,
        isDuplicateInDatabase,
      };
    });
  };

  // Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        const parsedRows = jsonData.map((row, index) => {
          const normalizedRow: Record<string, string> = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            normalizedRow[cleanKey] = String(row[key] ?? '').trim();
          });

          const soiRaw =
            normalizedRow['soi'] ||
            normalizedRow['soi_nome'] ||
            normalizedRow['soi_codigo'] ||
            normalizedRow['modulo'] ||
            normalizedRow['componente'] ||
            '';

          const semanaNum = parseInt(
            normalizedRow['semana'] || normalizedRow['sem'] || normalizedRow['week'] || '1',
            10
          );

          const probRaw =
            normalizedRow['problema'] ||
            normalizedRow['prob'] ||
            normalizedRow['p'] ||
            normalizedRow['numero'] ||
            normalizedRow['num'] ||
            '1';
          const problemNumber: 1 | 2 = String(probRaw).includes('2') ? 2 : 1;

          const title =
            normalizedRow['titulo'] ||
            normalizedRow['title'] ||
            normalizedRow['nome'] ||
            normalizedRow['caso'] ||
            '';

          const theme = normalizedRow['tema'] || normalizedRow['theme'] || normalizedRow['assunto'] || '';
          const date = normalizedRow['data'] || normalizedRow['date'] || '2026-02-09';
          const time = normalizedRow['horario'] || normalizedRow['hora'] || normalizedRow['time'] || '08:00';
          const room = normalizedRow['sala'] || normalizedRow['room'] || normalizedRow['local'] || 'Sala APG 101';
          const description =
            normalizedRow['descricao'] || normalizedRow['description'] || normalizedRow['vinheta'] || '';
          const learningObjectivesRaw =
            normalizedRow['objetivos'] ||
            normalizedRow['learningobjectives'] ||
            normalizedRow['objectives'] ||
            normalizedRow['metas'] ||
            '';
          const teacherInstructions =
            normalizedRow['instrucoes_tutor'] ||
            normalizedRow['instrucoes'] ||
            normalizedRow['orientacoes'] ||
            normalizedRow['tutor'] ||
            '';

          const statusRaw = (normalizedRow['status'] || 'planejado').toLowerCase();
          const status: CaseStatus = statusRaw.includes('realiza')
            ? 'realizado'
            : statusRaw.includes('cancela')
            ? 'cancelado'
            : 'planejado';

          return {
            tempId: `case_row_${Date.now()}_${index}`,
            soiRaw,
            soiId: '',
            week: isNaN(semanaNum) ? 1 : semanaNum,
            problemNumber,
            title,
            theme,
            date,
            time,
            room,
            description,
            learningObjectives: [],
            learningObjectivesRaw,
            teacherInstructions,
            status,
          };
        });

        const validated = validateRows(parsedRows);
        setImportRows(validated);
      } catch (err) {
        setSubmitError('Erro ao ler o arquivo. Certifique-se de que é um arquivo Excel (.xlsx) ou CSV válido.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Change default SOI for fallback
  const handleDefaultSoiChange = (newDefaultSoiId: string) => {
    setDefaultSoiId(newDefaultSoiId);
    setImportRows((prev) => validateRows(prev, newDefaultSoiId));
  };

  // Cell Change Handler
  const handleCellChange = (tempId: string, field: keyof ImportCaseRow, value: any) => {
    setImportRows((prev) => {
      const updated = prev.map((row) => {
        if (row.tempId === tempId) {
          return { ...row, [field]: value };
        }
        return row;
      });
      return validateRows(updated);
    });
  };

  // Delete Row
  const handleDeleteRow = (tempId: string) => {
    setImportRows((prev) => validateRows(prev.filter((r) => r.tempId !== tempId)));
  };

  // Template Download XLSX
  const handleDownloadTemplateXlsx = () => {
    const defaultSoiName = sois.find((s) => s.id === defaultSoiId)?.name || sois[0]?.name || 'SOI 1';

    const templateData = [
      {
        soi: defaultSoiName,
        semana: 1,
        problema: 1,
        titulo: 'Caso 1: Febre de Origem Indeterminada e Astenia',
        tema: 'Anemia e Síndromes Febris',
        data: '2026-02-09',
        horario: '08:00',
        sala: 'Sala APG 101',
        descricao:
          'Paciente do sexo masculino, 45 anos, apresenta febre diária há 2 semanas acompanhada de astenia e perda ponderal de 4 kg.',
        objetivos:
          'Identificar as principais causas de febre prolongada; Compreender exames laboratoriais metabólicos; Formular hipóteses diagnósticas diferenciais.',
        instrucoes_tutor:
          'Orientar os estudantes a detalhar o exame físico completo antes de solicitar exames complementares de alto custo.',
        status: 'planejado',
      },
      {
        soi: defaultSoiName,
        semana: 1,
        problema: 2,
        titulo: 'Caso 2: Dor Torácica Aguda em Pronto Socorro',
        tema: 'Síndrome Coronariana Aguda',
        data: '2026-02-12',
        horario: '08:00',
        sala: 'Sala APG 102',
        descricao:
          'Paciente de 58 anos, hipertenso e diabético, é admitido com dor retroesternal em aperto radiada para o braço esquerdo.',
        objetivos:
          'Reconhecer fatores de risco cardiovascular; Interpretar ECG inicial em dor torácica; Discutir a conduta imediata na sala de emergência.',
        instrucoes_tutor:
          'Estimular o foco no tempo porta-balão e no uso racional de antiagregantes plaquetários.',
        status: 'planejado',
      },
      {
        soi: defaultSoiName,
        semana: 2,
        problema: 1,
        titulo: 'Caso 3: Dispneia Progressiva aos Esforços',
        tema: 'Insuficiência Cardíaca Congestiva',
        data: '2026-02-16',
        horario: '08:00',
        sala: 'Sala APG 103',
        descricao:
          'Mulher de 62 anos queixa-se de falta de ar ao subir um lance de escada, ortopneia e edema de membros inferiores.',
        objetivos:
          'Compreender os critérios de Framingham para ICC; Analisar a fisiopatologia do remodelamento cardíaco; Prescrever terapêutica otimizada.',
        instrucoes_tutor: 'Discutir a importância das orientações não farmacológicas e do controle do sódio na dieta.',
        status: 'planejado',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Casos APG');

    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 10 },
      { wch: 10 },
      { wch: 35 },
      { wch: 25 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 },
      { wch: 45 },
      { wch: 45 },
      { wch: 40 },
      { wch: 12 },
    ];

    XLSX.writeFile(workbook, 'modelo_importacao_casos_apg.xlsx');
  };

  // Template Download CSV
  const handleDownloadTemplateCsv = () => {
    const defaultSoiName = sois.find((s) => s.id === defaultSoiId)?.name || sois[0]?.name || 'SOI 1';

    const csvLines = [
      'soi,semana,problema,titulo,tema,data,horario,sala,descricao,objetivos,instrucoes_tutor,status',
      `"${defaultSoiName}",1,1,"Caso 1: Febre de Origem Indeterminada","Anemia e Síndromes Febris","2026-02-09","08:00","Sala APG 101","Paciente de 45 anos com febre há 2 semanas.","Identificar causas de febre; Solicitar exames metabólicos; Propor conduta inicial.","Estimular anamnese sistemática.","planejado"`,
      `"${defaultSoiName}",1,2,"Caso 2: Dor Torácica Aguda","Síndrome Coronariana Aguda","2026-02-12","08:00","Sala APG 102","Paciente de 58 anos com dor retroesternal.","Reconhecer risco de SCA; Interpretar ECG; Discutir conduta imediata.","Focar no tempo de atendimento.","planejado"`,
    ];

    const csvContent = csvLines.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_casos_apg.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit Import
  const handleConfirmImport = async () => {
    setSubmitError(null);
    const validRows = importRows.filter((r) => r.errors.length === 0);

    if (validRows.length === 0) {
      setSubmitError('Nenhum caso válido disponível para importar.');
      return;
    }

    setIsSubmitting(true);

    const casesToImport: APGCase[] = validRows.map((r) => {
      const computedUnit: 1 | 2 = r.week <= 8 ? 1 : 2;
      return {
        id: '',
        soiId: r.soiId,
        problemNumber: r.problemNumber,
        caseNumber: r.problemNumber,
        week: r.week,
        unit: computedUnit,
        title: r.title,
        theme: r.theme,
        date: r.date,
        time: r.time,
        room: r.room,
        description: r.description,
        learningObjectives: r.learningObjectives,
        teacherInstructions: r.teacherInstructions,
        status: r.status,
      };
    });

    const res = await importAPGCases(casesToImport);
    setIsSubmitting(false);

    if (!res.success) {
      setSubmitError(res.error || 'Não foi possível importar os casos.');
      return;
    }

    if (onSuccess) {
      onSuccess(`${res.count || validRows.length} casos de APG importados com sucesso!`);
    }

    setImportRows([]);
    setFileName('');
    onClose();
  };

  // Summary counts
  const validRowsCount = importRows.filter((r) => r.errors.length === 0).length;
  const warningRowsCount = importRows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length;
  const errorRowsCount = importRows.filter((r) => r.errors.length > 0).length;

  const filteredDisplayRows = importRows.filter((r) => {
    if (activeTab === 'valid') return r.errors.length === 0;
    if (activeTab === 'warnings') return r.errors.length === 0 && r.warnings.length > 0;
    if (activeTab === 'errors') return r.errors.length > 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative my-8 w-full max-w-6xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-[#1E3A8A] dark:bg-blue-900/50 dark:text-blue-300">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Importação em Lote de Casos APG
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Importe planos de aula de semanas, problemas P1/P2 e objetivos via XLSX ou CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {submitError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Download Model Section & Upload Zone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download Models Box */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-900/30 dark:bg-blue-950/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 font-bold text-xs text-[#1E3A8A] dark:text-blue-400 mb-1">
                  <Download className="h-4 w-4" />
                  <span>Modelos de Planilha para Importação</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
                  Baixe o modelo pré-formatado contendo os cabeçalhos padrão (SOI, Semana 1-20, Problema 1 ou 2, Título, Tema, Data, Objetivos e Orientações pedagógicas).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplateXlsx}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Baixar Modelo Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTemplateCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-900 hover:bg-blue-50 shadow-xs dark:border-blue-800 dark:bg-slate-800 dark:text-blue-200 transition-all"
                >
                  <FileText className="h-4 w-4" />
                  <span>Baixar Modelo CSV (.csv)</span>
                </button>
              </div>
            </div>

            {/* Dropzone Box */}
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-5 text-center hover:border-blue-500 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-800/40 transition-all flex flex-col items-center justify-center min-h-[160px]">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-2 animate-bounce" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {fileName ? fileName : 'Clique ou arraste a planilha aqui para carregar'}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Formatos suportados: .XLSX, .XLS, .CSV</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all"
              >
                {isProcessing ? 'Lendo Arquivo...' : fileName ? 'Trocar Arquivo' : 'Selecionar Arquivo'}
              </button>
            </div>
          </div>

          {/* Import Controls & Global SOI Fallback */}
          {importRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    SOI Padrão (Para linhas sem SOI informado)
                  </label>
                  <select
                    value={defaultSoiId}
                    onChange={(e) => handleDefaultSoiChange(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {sois.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || 'SOI'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tabs / Filter */}
                <div className="flex rounded-xl bg-slate-200/70 p-1 dark:bg-slate-700/60">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      activeTab === 'all'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    Todos ({importRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('valid')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      activeTab === 'valid'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-900'
                    }`}
                  >
                    Prontos ({validRowsCount})
                  </button>
                  {warningRowsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('warnings')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        activeTab === 'warnings'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
                      }`}
                    >
                      Avisos ({warningRowsCount})
                    </button>
                  )}
                  {errorRowsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('errors')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                        activeTab === 'errors'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-rose-700 dark:text-rose-400 hover:text-rose-900'
                      }`}
                    >
                      Erros ({errorRowsCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Table Preview */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 max-h-[380px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 w-10 text-center">Status</th>
                      <th className="p-3">SOI / Módulo</th>
                      <th className="p-3 w-20 text-center">Semana</th>
                      <th className="p-3 w-20 text-center">Problema</th>
                      <th className="p-3">Título do Caso APG</th>
                      <th className="p-3">Tema Principal</th>
                      <th className="p-3 w-28">Data</th>
                      <th className="p-3 w-28">Sala</th>
                      <th className="p-3 w-12 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDisplayRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                          Nenhum caso nesta categoria.
                        </td>
                      </tr>
                    ) : (
                      filteredDisplayRows.map((row) => {
                        const hasErrors = row.errors.length > 0;
                        const hasWarnings = row.warnings.length > 0;

                        return (
                          <tr
                            key={row.tempId}
                            className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                              hasErrors
                                ? 'bg-rose-50/40 dark:bg-rose-950/20'
                                : hasWarnings
                                ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                : ''
                            }`}
                          >
                            {/* Status Icon */}
                            <td className="p-3 text-center">
                              {hasErrors ? (
                                <div className="group relative inline-block">
                                  <AlertCircle className="h-4 w-4 text-rose-500 mx-auto cursor-pointer" />
                                  <div className="absolute left-1/2 bottom-full mb-1 -translate-x-1/2 hidden group-hover:block z-20 w-48 rounded-lg bg-rose-900 p-2 text-[10px] font-medium text-white shadow-lg">
                                    {row.errors.join('; ')}
                                  </div>
                                </div>
                              ) : hasWarnings ? (
                                <div className="group relative inline-block">
                                  <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto cursor-pointer" />
                                  <div className="absolute left-1/2 bottom-full mb-1 -translate-x-1/2 hidden group-hover:block z-20 w-52 rounded-lg bg-amber-900 p-2 text-[10px] font-medium text-white shadow-lg">
                                    {row.warnings.join('; ')}
                                  </div>
                                </div>
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                              )}
                            </td>

                            {/* SOI Selection */}
                            <td className="p-2">
                              <select
                                value={row.soiId}
                                onChange={(e) => handleCellChange(row.tempId, 'soiId', e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              >
                                {sois.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Week */}
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={row.week}
                                onChange={(e) =>
                                  handleCellChange(row.tempId, 'week', parseInt(e.target.value, 10) || 1)
                                }
                                className="w-16 text-center rounded-lg border border-slate-200 bg-white py-1 px-1 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>

                            {/* Problem Number */}
                            <td className="p-2 text-center">
                              <select
                                value={row.problemNumber}
                                onChange={(e) =>
                                  handleCellChange(
                                    row.tempId,
                                    'problemNumber',
                                    parseInt(e.target.value, 10) === 2 ? 2 : 1
                                  )
                                }
                                className="rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              >
                                <option value={1}>P1</option>
                                <option value={2}>P2</option>
                              </select>
                            </td>

                            {/* Title */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) => handleCellChange(row.tempId, 'title', e.target.value)}
                                placeholder="Título do caso..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>

                            {/* Theme */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.theme}
                                onChange={(e) => handleCellChange(row.tempId, 'theme', e.target.value)}
                                placeholder="Tema do caso..."
                                className="w-full rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              />
                            </td>

                            {/* Date */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.date}
                                onChange={(e) => handleCellChange(row.tempId, 'date', e.target.value)}
                                className="w-24 rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              />
                            </td>

                            {/* Room */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.room}
                                onChange={(e) => handleCellChange(row.tempId, 'room', e.target.value)}
                                className="w-24 rounded-lg border border-slate-200 bg-white py-1 px-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              />
                            </td>

                            {/* Actions */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.tempId)}
                                className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400 transition-all"
                                title="Excluir caso da lista"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/80">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {importRows.length > 0 ? (
              <span>
                Total: <strong className="text-slate-800 dark:text-slate-200">{importRows.length}</strong> casos | Válidos:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{validRowsCount}</strong>
              </span>
            ) : (
              'Selecione uma planilha para começar.'
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={validRowsCount === 0 || isSubmitting}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-2 text-xs font-bold text-white hover:bg-blue-900 disabled:opacity-50 shadow-xs transition-all"
            >
              <Upload className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? 'Importando Casos...'
                  : `Confirmar Importação (${validRowsCount})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
