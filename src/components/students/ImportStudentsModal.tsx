import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { Student } from '../../types';
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
} from 'lucide-react';

interface ImportRow {
  tempId: string;
  name: string;
  enrollment: string;
  email: string;
  turmaRaw: string;
  grupoRaw: string;
  classId: string;
  groupId: string;
  errors: string[];
  warnings: string[];
  isDuplicateInFile: boolean;
  isDuplicateInDatabase: boolean;
}

interface ImportStudentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({ isOpen, onClose }) => {
  const { students, classes, groups, selectedSemesterId, importStudents } = useApp();

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper to resolve Class ID from string (name or id)
  const resolveClassId = (rawName: string): string => {
    if (!rawName) return classes[0]?.id || 'cls_1';
    const found = classes.find(
      (c) => c.name.toLowerCase() === rawName.trim().toLowerCase() || c.id === rawName.trim()
    );
    return found ? found.id : classes[0]?.id || 'cls_1';
  };

  // Helper to resolve Group ID from string (name or id)
  const resolveGroupId = (rawName: string): string => {
    if (!rawName) return groups[0]?.id || 'grp_1';
    const found = groups.find(
      (g) => g.name.toLowerCase() === rawName.trim().toLowerCase() || g.id === rawName.trim()
    );
    return found ? found.id : groups[0]?.id || 'grp_1';
  };

  // Helper to validate a set of rows
  const validateRows = (rows: Omit<ImportRow, 'errors' | 'warnings' | 'isDuplicateInFile' | 'isDuplicateInDatabase'>[]): ImportRow[] => {
    const enrollmentCounts: Record<string, number> = {};
    rows.forEach((r) => {
      const enr = r.enrollment.trim();
      if (enr) {
        enrollmentCounts[enr] = (enrollmentCounts[enr] || 0) + 1;
      }
    });

    return rows.map((r) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const cleanName = r.name.trim();
      const cleanEnrollment = r.enrollment.trim();
      const cleanEmail = r.email.trim();

      // Check mandatory fields
      if (!cleanName) {
        errors.push('Nome é obrigatório');
      }
      if (!cleanEnrollment) {
        errors.push('Matrícula é obrigatória');
      }

      // Check email format
      if (cleanEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          errors.push('E-mail em formato inválido');
        }
      }

      // Check duplicates in file
      const isDuplicateInFile = Boolean(cleanEnrollment && enrollmentCounts[cleanEnrollment] > 1);
      if (isDuplicateInFile) {
        warnings.push('Matrícula duplicada na mesma planilha');
      }

      // Check duplicates in database
      const isDuplicateInDatabase = Boolean(
        cleanEnrollment && students.some((s) => s.enrollment.trim() === cleanEnrollment)
      );
      if (isDuplicateInDatabase) {
        warnings.push('Matrícula já existente no sistema (não será sobrescrita silenciosamente)');
      }

      return {
        ...r,
        name: cleanName,
        enrollment: cleanEnrollment,
        email: cleanEmail,
        classId: resolveClassId(r.turmaRaw),
        groupId: resolveGroupId(r.grupoRaw),
        errors,
        warnings,
        isDuplicateInFile,
        isDuplicateInDatabase,
      };
    });
  };

  // Parse uploaded file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse JSON rows
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        const parsedRows = jsonData.map((row, index) => {
          // Normalize header keys (lowercase and remove accents)
          const normalizedRow: Record<string, string> = {};
          Object.keys(row).forEach((key) => {
            const cleanKey = key
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            normalizedRow[cleanKey] = String(row[key] ?? '').trim();
          });

          // Extract values
          const name = normalizedRow['nome'] || normalizedRow['aluno'] || normalizedRow['estudante'] || '';
          const enrollment = normalizedRow['matricula'] || normalizedRow['matr'] || normalizedRow['id'] || '';
          const email = normalizedRow['email'] || normalizedRow['e-mail'] || '';
          const turmaRaw = normalizedRow['turma'] || normalizedRow['classe'] || '';
          const grupoRaw = normalizedRow['grupo'] || normalizedRow['equipe'] || '';

          return {
            tempId: `row_${Date.now()}_${index}`,
            name,
            enrollment,
            email,
            turmaRaw,
            grupoRaw,
            classId: '',
            groupId: '',
          };
        });

        const validated = validateRows(parsedRows);
        setImportRows(validated);
      } catch (err) {
        alert('Erro ao ler o arquivo. Certifique-se de que é um formato XLSX ou CSV válido.');
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Update a single field in preview
  const handleCellChange = (tempId: string, field: 'name' | 'enrollment' | 'email' | 'turmaRaw' | 'grupoRaw', value: string) => {
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

  // Delete a row from preview
  const handleDeleteRow = (tempId: string) => {
    setImportRows((prev) => {
      const filtered = prev.filter((r) => r.tempId !== tempId);
      return validateRows(filtered);
    });
  };

  // Download Empty Template (XLSX)
  const handleDownloadTemplateXlsx = () => {
    const templateData = [
      {
        nome: 'Maria Eduarda Santos',
        matrícula: '20261001',
        'e-mail': 'maria.santos@medicina.edu.br',
        turma: classes[0]?.name || 'Turma 2026.1',
        grupo: groups[0]?.name || 'Grupo 01',
      },
      {
        nome: 'João Pedro Oliveira',
        matrícula: '20261002',
        'e-mail': 'joao.oliveira@medicina.edu.br',
        turma: classes[0]?.name || 'Turma 2026.1',
        grupo: groups[1]?.name || 'Grupo 02',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estudantes');

    // Auto-width columns
    worksheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 }];

    XLSX.writeFile(workbook, 'modelo_importacao_estudantes.xlsx');
  };

  // Download Empty Template (CSV)
  const handleDownloadTemplateCsv = () => {
    const csvContent =
      'nome,matrícula,e-mail,turma,grupo\n' +
      `"Maria Eduarda Santos","20261001","maria.santos@medicina.edu.br","${classes[0]?.name || 'Turma 2026.1'}","${groups[0]?.name || 'Grupo 01'}"\n` +
      `"João Pedro Oliveira","20261002","joao.oliveira@medicina.edu.br","${classes[0]?.name || 'Turma 2026.1'}","${groups[1]?.name || 'Grupo 02'}"\n`;

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_importacao_estudantes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Confirm Import Action
  const handleConfirmImport = async () => {
    // Filter out rows with critical errors
    const validRows = importRows.filter((r) => r.errors.length === 0);

    if (validRows.length === 0) {
      alert('Nenhuma linha válida para importar. Corrija os erros destacados antes de prosseguir.');
      return;
    }

    // Check if there are warnings (e.g. existing enrollment in DB)
    const rowsWithDbDuplicates = validRows.filter((r) => r.isDuplicateInDatabase);
    if (rowsWithDbDuplicates.length > 0) {
      const proceed = confirm(
        `Atenção: ${rowsWithDbDuplicates.length} estudante(s) possuem matrículas já registradas no sistema. Eles serão importados sem sobrescrever os dados anteriores.\n\nDeseja continuar?`
      );
      if (!proceed) return;
    }

    const studentsToImport: Omit<Student, 'id'>[] = validRows.map((r) => ({
      name: r.name,
      enrollment: r.enrollment,
      classId: r.classId,
      groupId: r.groupId,
      status: 'Ativo',
    }));

    setIsProcessing(true);
    await importStudents(studentsToImport);
    setIsProcessing(false);
    setHasSubmitted(true);

    setTimeout(() => {
      onClose();
      // Reset state
      setImportRows([]);
      setFileName('');
      setHasSubmitted(false);
    }, 1200);
  };

  // Calculate statistics
  const totalRows = importRows.length;
  const invalidRowsCount = importRows.filter((r) => r.errors.length > 0).length;
  const warningsCount = importRows.filter((r) => r.warnings.length > 0).length;
  const validRowsCount = totalRows - invalidRowsCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-[#1E3A8A] dark:bg-blue-950 dark:text-blue-300 font-bold">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Importação de Alunos (XLSX / CSV)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Carregue uma planilha com as colunas: <code className="font-mono font-semibold text-slate-700 dark:text-slate-300">nome, matrícula, e-mail, turma, grupo</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top File Upload & Template Download Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Upload Area */}
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 text-center dark:border-slate-800 dark:bg-slate-800/40 flex flex-col items-center justify-center gap-3">
              <Upload className="h-8 w-8 text-[#1E3A8A] dark:text-blue-400" />
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {fileName ? `Arquivo selecionado: ${fileName}` : 'Selecione ou arraste sua planilha'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Formatos suportados: .xlsx, .xls, .csv
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Escolher Arquivo</span>
              </button>
            </div>

            {/* Template Download Area */}
            <div className="rounded-xl border border-slate-200 bg-blue-50/30 p-5 dark:border-slate-800 dark:bg-slate-800/20 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-[#1E3A8A] dark:text-blue-400" />
                  <span>Modelos de Planilha para Download</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Baixe a estrutura padronizada para preenchimento. A planilha contém exemplos de cabeçalho e dados de amostra.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleDownloadTemplateXlsx}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Baixar Modelo (.XLSX)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplateCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  <span>Baixar Modelo (.CSV)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Validation Status Bar */}
          {importRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex items-center gap-4 text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Total lido: <strong className="text-slate-900 dark:text-white">{totalRows}</strong>
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {validRowsCount} válidos
                </span>
                {warningsCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {warningsCount} com alertas
                  </span>
                )}
                {invalidRowsCount > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {invalidRowsCount} com erros
                  </span>
                )}
              </div>

              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Você pode editar as células diretamente na tabela abaixo antes de confirmar.
              </span>
            </div>
          )}

          {/* Preview Table */}
          {importRows.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="max-h-[360px] overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-100 text-[11px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-400 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 w-24">Status</th>
                      <th className="px-3 py-2.5">Nome do Aluno</th>
                      <th className="px-3 py-2.5">Matrícula</th>
                      <th className="px-3 py-2.5">E-mail</th>
                      <th className="px-3 py-2.5">Turma</th>
                      <th className="px-3 py-2.5">Grupo</th>
                      <th className="px-3 py-2.5 text-center w-16">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importRows.map((row, index) => {
                      const hasErrors = row.errors.length > 0;
                      const hasWarnings = row.warnings.length > 0;

                      return (
                        <tr
                          key={row.tempId}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                            hasErrors
                              ? 'bg-rose-50/40 dark:bg-rose-950/20'
                              : hasWarnings
                              ? 'bg-amber-50/30 dark:bg-amber-950/20'
                              : ''
                          }`}
                        >
                          {/* Status Badge */}
                          <td className="px-3 py-2 align-middle">
                            {hasErrors ? (
                              <span
                                title={row.errors.join('; ')}
                                className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-200"
                              >
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                Erro
                              </span>
                            ) : hasWarnings ? (
                              <span
                                title={row.warnings.join('; ')}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Alerta
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                Válido
                              </span>
                            )}
                          </td>

                          {/* Editable Name */}
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleCellChange(row.tempId, 'name', e.target.value)}
                              placeholder="Nome obrigatório"
                              className={`w-full rounded-lg border px-2 py-1 text-xs text-slate-900 dark:text-slate-100 font-medium ${
                                !row.name.trim()
                                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/60'
                                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                              }`}
                            />
                          </td>

                          {/* Editable Enrollment */}
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="text"
                              value={row.enrollment}
                              onChange={(e) =>
                                handleCellChange(row.tempId, 'enrollment', e.target.value)
                              }
                              placeholder="Matrícula"
                              className={`w-28 rounded-lg border px-2 py-1 text-xs font-mono font-bold ${
                                !row.enrollment.trim()
                                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/60 text-rose-900'
                                  : row.isDuplicateInFile || row.isDuplicateInDatabase
                                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                              }`}
                            />
                          </td>

                          {/* Editable Email */}
                          <td className="px-3 py-1.5 align-middle">
                            <input
                              type="email"
                              value={row.email}
                              onChange={(e) => handleCellChange(row.tempId, 'email', e.target.value)}
                              placeholder="email@med.edu.br"
                              className={`w-full rounded-lg border px-2 py-1 text-xs ${
                                row.errors.some((err) => err.includes('E-mail'))
                                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/60'
                                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
                              }`}
                            />
                          </td>

                          {/* Class Select / Text */}
                          <td className="px-3 py-1.5 align-middle">
                            <select
                              value={row.classId}
                              onChange={(e) => {
                                const selected = classes.find((c) => c.id === e.target.value);
                                handleCellChange(row.tempId, 'turmaRaw', selected?.name || e.target.value);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {classes
                                .filter((c) => !selectedSemesterId || c.semesterId === selectedSemesterId || c.id === row.classId)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </td>

                          {/* Group Select / Text */}
                          <td className="px-3 py-1.5 align-middle">
                            <select
                              value={row.groupId}
                              onChange={(e) => {
                                const selected = groups.find((g) => g.id === e.target.value);
                                handleCellChange(row.tempId, 'grupoRaw', selected?.name || e.target.value);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Delete Action */}
                          <td className="px-3 py-1.5 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.tempId)}
                              title="Excluir esta linha"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-900/40 dark:hover:text-rose-300 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-800/30">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum dado pré-visualizado ainda. Faça o upload de um arquivo .XLSX ou .CSV para visualizar, corrigir e importar os alunos.
              </p>
            </div>
          )}

          {/* Success Banner */}
          {hasSubmitted && (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Importação concluída com sucesso! Os alunos foram cadastrados no sistema.</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 p-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {validRowsCount > 0
              ? `${validRowsCount} aluno(s) pronto(s) para gravação`
              : 'Selecione uma planilha para importar'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={validRowsCount === 0 || isProcessing || hasSubmitted}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1E3A8A] px-5 py-2 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirmar Importação ({validRowsCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
