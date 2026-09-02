import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { SOIFilter } from '../components/common/SOIFilter';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  User,
  Users,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import { calculateWeeklyAverage, formatGrade } from '../services/calculationService';
import { StudentCalculatedSummary, Evaluation, Student, APGCase } from '../types';
import {
  AFYA_SALVADOR_LOGO_JPG_BASE64,
  AFYA_SALVADOR_LOGO_MAGENTA_BASE64,
  AfyaSalvadorLogo,
  AFYA_MAGENTA,
} from '../utils/afyaLogo';

export const ReportsPage: React.FC = () => {
  const {
    students,
    classes,
    groups,
    evaluations,
    cases,
    settings,
    selectedSemesterId,
    selectedSoiId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
    selectedSemester,
    getCalculatedSummaries,
    getStudentCalculatedSummary,
    getStudentTableName,
    isStudentInSelectedTable,
  } = useApp();

  // Active view tab (1. Tipo de relatório)
  const [reportType, setReportType] = useState<
    'consolidado' | 'ausencias' | 'individual'
  >('consolidado');

  // Selected student for Individual PDF report
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [exportError, setExportError] = useState('');
  const runExport = async (action: () => void | Promise<void>) => {
    setExportError('');
    try { await action(); }
    catch (error: any) {
      console.error('[Report Export Error]', error);
      setExportError(error?.message || 'Não foi possível gerar o arquivo solicitado.');
    }
  };

  const scopedClasses = classes.filter(
    (item) =>
      (!selectedSemesterId || selectedSemesterId === 'all' || item.semesterId === selectedSemesterId) &&
      (selectedSoiId === 'all' || item.soiId === selectedSoiId)
  );
  const scopedClassIds = new Set(scopedClasses.map((item) => item.id));

  // Determine eligible students based on the selected academic scope
  const targetStudents = students.filter((student) => {
    // Check semester / SOI match if scopedClasses are defined
    if (scopedClassIds.size > 0 && !scopedClassIds.has(student.classId)) {
      const stClass = classes.find((c) => c.id === student.classId);
      if (stClass && (
        (selectedSemesterId && selectedSemesterId !== 'all' && stClass.semesterId !== selectedSemesterId) ||
        (selectedSoiId !== 'all' && stClass.soiId !== selectedSoiId)
      )) {
        return false;
      }
    }
    // Check class filter on Reports page
    if (selectedClass !== 'all' && student.classId !== selectedClass) {
      return false;
    }
    // Check table filter on Reports page
    if (selectedUnit !== 'all' && selectedGroup !== 'all') {
      if (!isStudentInSelectedTable(student.id, selectedUnit, selectedGroup)) {
        return false;
      }
    }
    return true;
  });

  const studentSummaries: StudentCalculatedSummary[] = targetStudents
    .map((s) => getStudentCalculatedSummary(s.id))
    .filter((sum): sum is StudentCalculatedSummary => sum !== null);

  // Helper to format filenames with mandatory components:
  // relatorio_<turma>_<unidade>[_<mesa>].<ext>
  const generateFilename = (
    turmaStr: string,
    semestreStr: string,
    tipoRelatorioStr: string,
    extension: 'xlsx' | 'pdf',
    alunoStr?: string
  ) => {
    const sanitize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();

    const turmaClean = sanitize(turmaStr || 'medicina_2026-1');

    let unitClean = 'todas-unidades';
    if (selectedUnit === '1') unitClean = 'U1';
    else if (selectedUnit === '2') unitClean = 'U2';

    let tableClean = '';
    if (selectedGroup === 'grp_m1') tableClean = '_mesa-1';
    else if (selectedGroup === 'grp_m2') tableClean = '_mesa-2';
    else if (selectedGroup === 'grp_m3') tableClean = '_mesa-3';

    if (selectedUnit === 'all') {
      return `relatorio_${turmaClean}_todas-unidades.${extension}`;
    }

    if (alunoStr) {
      const alunoClean = sanitize(alunoStr);
      return `relatorio_${turmaClean}_${unitClean}${tableClean}_${alunoClean}.${extension}`;
    }

    return `relatorio_${turmaClean}_${unitClean}${tableClean}.${extension}`;
  };

  const getSelectedTurmaName = () => {
    if (selectedClass === 'all') return 'Todas_Turmas';
    const found = classes.find((c) => c.id === selectedClass);
    return found ? found.name : 'Turma';
  };

  // ==========================================
  // 1. RELATÓRIO CONSOLIDADO XLSX
  // ==========================================
  const handleExportConsolidatedXLSX = async () => {
    const workbook = new ExcelJS.Workbook();
    const turmaName = getSelectedTurmaName();

    // Sheet 1: Sessões e Notas Consolidadas (All required 21 columns)
    const detailSheet = workbook.addWorksheet('Sessões APG Consolidadas');

    // Title Block
    detailSheet.mergeCells('A1:U1');
    const titleCell = detailSheet.getCell('A1');
    titleCell.value = `APG — Relatório Consolidado de Notas e Avaliações (${selectedSemester})`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFC20054' }, // Afya Magenta
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Header Row (All 21 columns requested in prompt)
    const detailHeaders = [
      'aluno',
      'matrícula',
      'turma',
      'grupo',
      'semana',
      'unidade',
      'caso',
      'data',
      'presença',
      'atestado',
      'papel',
      'abertura',
      'postura',
      'desempenho',
      'fechamento',
      'nota bruta de 20',
      'média semanal',
      'nota da primeira unidade de 20',
      'média bruta da segunda unidade de 20',
      'nota ajustada da segunda unidade de 15',
      'nota final de 35',
    ];

    detailSheet.addRow([]);
    const headerRow = detailSheet.addRow(detailHeaders);
    headerRow.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Filter evaluations based on active class/group selections
    const filteredSummaries = studentSummaries;

    filteredSummaries.forEach((sum) => {
      const studentEvals = evaluations.filter((e) => e.studentId === sum.studentId);

      if (studentEvals.length === 0) {
        const emptyRowData = [
          sum.studentName,
          sum.enrollment,
          sum.className,
          sum.groupName,
          '-',
          '-',
          'Nenhuma sessão avaliada para a mesa',
          '-',
          'Não avaliado',
          'Não',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          sum.unit1Grade > 0 ? Number(sum.unit1Grade.toFixed(2)) : '-',
          sum.unit2Gross > 0 ? Number(sum.unit2Gross.toFixed(2)) : '-',
          sum.unit2Adjusted > 0 ? Number(sum.unit2Adjusted.toFixed(2)) : '-',
          sum.finalGrade > 0 ? Number(sum.finalGrade.toFixed(2)) : '-',
        ];
        const row = detailSheet.addRow(emptyRowData);
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          cell.font = { italic: true, color: { argb: 'FF64748B' } };
        });
        return;
      }

      // Map each evaluation session
      studentEvals.forEach((evalItem) => {
        const caseObj = cases.find((c) => c.id === evalItem.caseId);
        const caseTitle = caseObj?.title || `Caso APG Semana ${evalItem.week}`;

        // Get weekly average for student up to or in that week
        const sameWeekEvals = studentEvals.filter((e) => e.week === evalItem.week);
        const weeklyAvg = calculateWeeklyAverage(sameWeekEvals);

        // Scores for individual criteria
        const critAbertura = evalItem.criterionScores['crit_1'] ?? (evalItem.attendance === 'Ausente' ? 0 : null);
        const critPostura = evalItem.criterionScores['crit_2'] ?? (evalItem.attendance === 'Ausente' ? 0 : null);
        const critDesempenho = evalItem.criterionScores['crit_3'] ?? (evalItem.attendance === 'Ausente' ? 0 : null);
        const critFechamento = evalItem.criterionScores['crit_4'] ?? (evalItem.attendance === 'Ausente' ? 0 : null);

        const rowData = [
          sum.studentName,
          sum.enrollment,
          sum.className,
          sum.groupName,
          evalItem.week,
          evalItem.unit,
          caseTitle,
          evalItem.date || 'Sessão Regular',
          evalItem.attendance,
          evalItem.attendance === 'Atestado' ? 'Sim' : 'Não',
          evalItem.role,
          critAbertura !== null ? Number(critAbertura.toFixed(2)) : '-',
          critPostura !== null ? Number(critPostura.toFixed(2)) : '-',
          critDesempenho !== null ? Number(critDesempenho.toFixed(2)) : '-',
          critFechamento !== null ? Number(critFechamento.toFixed(2)) : '-',
          Number(evalItem.totalGrossScore.toFixed(2)),
          weeklyAvg !== null ? Number(weeklyAvg.toFixed(2)) : '-',
          Number(sum.unit1Grade.toFixed(2)),
          Number(sum.unit2Gross.toFixed(2)),
          Number(sum.unit2Adjusted.toFixed(2)),
          Number(sum.finalGrade.toFixed(2)),
        ];

        const row = detailSheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          // Highlight final grade column
          if (colNumber === 21) {
            cell.font = { bold: true, color: { argb: 'FF15803D' } };
          }
        });
      });
    });

    // Auto-fit column widths
    detailSheet.columns.forEach((column) => {
      column.width = 18;
    });

    // Sheet 2: Resumo Final dos Alunos
    const summarySheet = workbook.addWorksheet('Resumo dos Estudantes');
    summarySheet.mergeCells('A1:L1');
    const sumTitle = summarySheet.getCell('A1');
    sumTitle.value = `APG — Resumo de Médias Finais (${selectedSemester})`;
    sumTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC20054' } }; // Afya Magenta
    sumTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    summarySheet.addRow([]);
    const sumHeaders = [
      'Matrícula',
      'Estudante',
      'Turma',
      'Mesa 1ª Unidade',
      'Mesa 2ª Unidade',
      'Situação da Mudança',
      '1ª Unidade (Máx 20.0)',
      '2ª Unid Bruta (Máx 20.0)',
      '2ª Unid Ajustada (Máx 15.0)',
      'Nota Final (Máx 35.0)',
      'Frequência (%)',
    ];
    const sumHeaderRow = summarySheet.addRow(sumHeaders);
    sumHeaderRow.font = { bold: true };
    sumHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE7F3' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    filteredSummaries.forEach((s) => {
      const row = summarySheet.addRow([
        s.enrollment,
        s.studentName,
        s.className,
        s.unit1TableName || 'Mesa 1',
        s.unit2TableName || 'Mesa 1',
        s.tableChangeStatus || 'Permaneceu na mesma mesa',
        Number(s.unit1Grade.toFixed(2)),
        Number(s.unit2Gross.toFixed(2)),
        Number(s.unit2Adjusted.toFixed(2)),
        Number(s.finalGrade.toFixed(2)),
        `${s.attendanceRate.toFixed(1)}%`,
      ]);
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    summarySheet.columns.forEach((col) => {
      col.width = 20;
    });

    // Sheet 3: Composição Oficial das Mesas
    const tableSheet = workbook.addWorksheet('Composição das Mesas');
    tableSheet.mergeCells('A1:F1');
    const tableTitle = tableSheet.getCell('A1');
    tableTitle.value = `APG — Relatório Oficial de Composição das Mesas (${selectedSemester})`;
    tableTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    tableTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF980041' } }; // Afya Dark Magenta
    tableTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    tableSheet.addRow([]);
    const tableHeaders = [
      'Estudante',
      'Matrícula',
      'Turma',
      'Mesa 1ª Unidade (Semanas 1-8)',
      'Mesa 2ª Unidade (Semanas 9-20)',
      'Situação da Transição',
    ];
    const tableHeaderRow = tableSheet.addRow(tableHeaders);
    tableHeaderRow.font = { bold: true };
    tableHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE7F3' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    filteredSummaries.forEach((s) => {
      const row = tableSheet.addRow([
        s.studentName,
        s.enrollment,
        s.className,
        s.unit1TableName || 'Mesa 1',
        s.unit2TableName || 'Mesa 1',
        s.tableChangeStatus || 'Permaneceu na mesma mesa',
      ]);
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    tableSheet.columns.forEach((col) => {
      col.width = 25;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename(turmaName, selectedSemester, 'Relatorio_Consolidado', 'xlsx');
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // 2. RELATÓRIO DE AUSÊNCIAS E ATESTADOS XLSX
  // ==========================================
  const handleExportAbsencesXLSX = async () => {
    const workbook = new ExcelJS.Workbook();
    const turmaName = getSelectedTurmaName();
    const sheet = workbook.addWorksheet('Segunda Chamada');

    // Title Row
    sheet.mergeCells('A1:M1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `APG — Ausências, Atestados e Segunda Chamada (${selectedSemester})`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC20054' } }; // Afya Magenta
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Required Columns:
    // aluno, matrícula, turma, grupo, semana, unidade, data, caso, ausência ou atestado, justificativa, impacto no cálculo
    const headers = [
      'aluno',
      'matrícula',
      'turma',
      'grupo',
      'semana',
      'unidade',
      'data',
      'caso',
      'ausência ou atestado',
      'justificativa',
      'impacto no cálculo',
      'segunda chamada',
      'data da segunda chamada',
    ];

    sheet.addRow([]);
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Rose-100
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Gather records for filtered students
    const filteredSummaries = studentSummaries;

    filteredSummaries.forEach((sum) => {
      const studentEvals = evaluations.filter(
        (e) =>
          e.studentId === sum.studentId &&
          (e.attendance === 'Ausente' || e.attendance === 'Atestado')
      );

      studentEvals.forEach((evalItem) => {
        const caseObj = cases.find((c) => c.id === evalItem.caseId);
        const caseCode = `S${String(evalItem.week).padStart(2, '0')}P${caseObj?.problemNumber || caseObj?.caseNumber || 1}`;
        const caseTitle = `${caseCode} — ${caseObj?.title || `Caso APG Semana ${evalItem.week}`}`;

        const isAtestado = evalItem.attendance === 'Atestado';
        const impacto = isAtestado
          ? evalItem.makeupCompleted
            ? 'Segunda chamada concluída; a nota da reposição passa a compor a média.'
            : 'Atestado registrado. Nota pendente até a segunda chamada; não é abonada.'
          : 'Nota 0.0 atribuída à sessão. Mantida no denominador da média semanal da unidade.';

        const row = sheet.addRow([
          sum.studentName,
          sum.enrollment,
          sum.className,
          sum.groupName,
          evalItem.week,
          evalItem.unit,
          evalItem.date || 'Sessão Regular',
          caseTitle,
          evalItem.attendance,
          evalItem.teacherNotes || 'Sem observações registradas pelo professor',
          impacto,
          isAtestado ? (evalItem.makeupCompleted ? 'Concluída' : 'Pendente') : 'Não se aplica',
          evalItem.makeupDate || '',
        ]);

        row.eachCell((cell, colIndex) => {
          cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
          if (colIndex === 9) {
            cell.font = { bold: true, color: { argb: isAtestado ? 'FF1E40AF' : 'FF991B1B' } };
          }
        });
      });
    });

    sheet.columns.forEach((col) => {
      col.width = 22;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateFilename(
      turmaName,
      selectedSemester,
      'Relatorio_Ausencias_Atestados',
      'xlsx'
    );
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // 3. RELATÓRIO INDIVIDUAL EM PDF (jsPDF)
  // ==========================================
  const generateSingleStudentPDF = (
    doc: jsPDF,
    studentSummary: StudentCalculatedSummary,
    isFirstPage: boolean = true
  ) => {
    if (!isFirstPage) {
      doc.addPage();
    }

    const studentObj = students.find((s) => s.id === studentSummary.studentId);
    const studentEvals = evaluations
      .filter((e) => e.studentId === studentSummary.studentId)
      .sort((a, b) => a.week - b.week);

    const turmaName = studentSummary.className;

    // Header Banner (White Background with Afya Magenta Accents)
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 26, 'F');
    doc.setFillColor(194, 0, 84); // #C20054 (Bottom accent line)
    doc.rect(0, 25.2, 210, 0.8, 'F');

    // Official Afya Salvador Logo seamlessly on white background
    try {
      doc.addImage(AFYA_SALVADOR_LOGO_JPG_BASE64, 'JPEG', 142, 6, 54, 9.05);
    } catch {
      // Graceful fallback for logo in PDF
    }

    doc.setTextColor(194, 0, 84); // Afya Magenta Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.text('APG — RELATÓRIO INDIVIDUAL DE DESEMPENHO', 14, 11.5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // Slate 600 Subtitle
    doc.text(
      `${turmaName}  •  Semestre Letivo: ${selectedSemester}  •  Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`,
      14,
      18
    );

    let y = 32;

    // 1. Identificação Acadêmica e Grupo
    doc.setFillColor(254, 242, 248); // Soft pink tint
    doc.rect(14, y, 182, 28, 'F');
    doc.setDrawColor(251, 207, 232); // Rose-200 border
    doc.rect(14, y, 182, 28, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('1. Identificação Acadêmica & Grupo', 18, y + 6);

    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'bold');
    doc.text(`Estudante: `, 18, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(`${studentSummary.studentName}`, 38, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.text(`Matrícula: `, 120, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.text(`${studentSummary.enrollment}`, 138, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.text(`Turma: `, 18, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(`${studentSummary.className}`, 32, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.text(`Grupo: `, 85, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(`${studentSummary.groupName}`, 98, y + 20);

    doc.setFont('helvetica', 'bold');
    doc.text(`Semestre: `, 130, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(`${studentObj?.semestreCurso || '1º Semestre'}`, 150, y + 20);

    y += 34;

    // 2. Quadro Resumo de Notas (Unidade 1, Unidade 2, Final 35) & Frequência
    doc.setFillColor(250, 250, 252);
    doc.rect(14, y, 182, 32, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, 32, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('2. Frequência e Cálculo Oficial de Notas', 18, y + 6);

    // Box 1: U1
    doc.setFillColor(255, 255, 255);
    doc.rect(18, y + 10, 38, 17, 'F');
    doc.setDrawColor(251, 207, 232);
    doc.rect(18, y + 10, 38, 17, 'S');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text('1ª UNIDADE (MÁX 20)', 20, y + 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text(formatGrade(studentSummary.unit1Grade), 20, y + 23);

    // Box 2: U2 Bruta
    doc.setFillColor(255, 255, 255);
    doc.rect(60, y + 10, 38, 17, 'F');
    doc.setDrawColor(251, 207, 232);
    doc.rect(60, y + 10, 38, 17, 'S');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('2ª UNID BRUTA (MÁX 20)', 62, y + 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text(formatGrade(studentSummary.unit2Gross), 62, y + 23);

    // Box 3: U2 Ajustada
    doc.setFillColor(255, 255, 255);
    doc.rect(102, y + 10, 42, 17, 'F');
    doc.setDrawColor(251, 207, 232);
    doc.rect(102, y + 10, 42, 17, 'S');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('2ª UNID AJUSTADA (MÁX 15)', 104, y + 14);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(152, 0, 65); // Afya Dark Magenta
    doc.text(formatGrade(studentSummary.unit2Adjusted), 104, y + 23);

    // Box 4: NOTA FINAL
    doc.setFillColor(220, 252, 231); // Emerald tint
    doc.rect(148, y + 10, 44, 17, 'F');
    doc.setDrawColor(134, 239, 172);
    doc.rect(148, y + 10, 44, 17, 'S');
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA FINAL (MÁX 35.0)', 150, y + 14);
    doc.setFontSize(12);
    doc.setTextColor(21, 128, 61);
    doc.text(formatGrade(studentSummary.finalGrade), 150, y + 23);

    y += 38;

    // 3. Frequência Resumida & Média por Critério
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('Frequência:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Presenças: ${studentSummary.presentCount} | Ausências: ${studentSummary.absentCount} | Atestados: ${studentSummary.certificateCount} | Taxa: ${studentSummary.attendanceRate.toFixed(1)}%`,
      35,
      y
    );

    y += 6;

    // Calculate Average per Criterion (0..5)
    let sumCrit1 = 0, sumCrit2 = 0, sumCrit3 = 0, sumCrit4 = 0, countEval = 0;
    studentEvals.forEach((e) => {
      if (e.attendance === 'Presente') {
        sumCrit1 += e.criterionScores['crit_1'] ?? 0;
        sumCrit2 += e.criterionScores['crit_2'] ?? 0;
        sumCrit3 += e.criterionScores['crit_3'] ?? 0;
        sumCrit4 += e.criterionScores['crit_4'] ?? 0;
        countEval++;
      }
    });

    const avgC1 = countEval > 0 ? (sumCrit1 / countEval).toFixed(1) : '-';
    const avgC2 = countEval > 0 ? (sumCrit2 / countEval).toFixed(1) : '-';
    const avgC3 = countEval > 0 ? (sumCrit3 / countEval).toFixed(1) : '-';
    const avgC4 = countEval > 0 ? (sumCrit4 / countEval).toFixed(1) : '-';

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('Média por Critério (Escala 0 a 5.0):', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(
      `1. Abertura/Pontualidade: ${avgC1}  |  2. Postura/Grupo: ${avgC2}  |  3. Domínio Técnico: ${avgC3}  |  4. Fechamento: ${avgC4}`,
      70,
      y
    );

    y += 10;

    // 4. GRÁFICO DE EVOLUÇÃO SEMANAL (Gráfico Vetorial no jsPDF)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('3. Gráfico de Evolução Semanal de Desempenho (Semanas 1 a 20)', 14, y);

    y += 4;
    const chartX = 22;
    const chartY = y;
    const chartW = 170;
    const chartH = 32;

    // Draw Chart Background
    doc.setFillColor(254, 242, 248);
    doc.rect(chartX, chartY, chartW, chartH, 'F');
    doc.setDrawColor(251, 207, 232);
    doc.rect(chartX, chartY, chartW, chartH, 'S');

    // Horizontal Y Gridlines (0, 5, 10, 15, 20)
    doc.setDrawColor(244, 114, 182);
    doc.setLineWidth(0.15);
    for (let i = 0; i <= 4; i++) {
      const val = i * 5;
      const lineY = chartY + chartH - (val / 20) * chartH;
      doc.line(chartX, lineY, chartX + chartW, lineY);
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(`${val}`, chartX - 6, lineY + 1);
    }

    // X Axis Points for Weeks 1..20
    const xStep = chartW / 19;
    const weeklyPoints: { week: number; x: number; y: number; score: number | null }[] = [];

    for (let w = 1; w <= 20; w++) {
      const evalItem = studentEvals.find((e) => e.week === w);
      const score = evalItem ? (evalItem.attendance === 'Ausente' ? 0 : evalItem.totalGrossScore) : null;
      const posX = chartX + (w - 1) * xStep;

      if (score !== null && !isNaN(score)) {
        const posY = chartY + chartH - (Math.min(20, Math.max(0, score)) / 20) * chartH;
        weeklyPoints.push({ week: w, x: posX, y: posY, score });
      }

      // X Label
      doc.setFontSize(5.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`S${w}`, posX - 1.5, chartY + chartH + 3.5);
    }

    // Connect line segments in Afya Magenta
    doc.setDrawColor(194, 0, 84);
    doc.setLineWidth(0.8);
    for (let i = 0; i < weeklyPoints.length - 1; i++) {
      const pt1 = weeklyPoints[i];
      const pt2 = weeklyPoints[i + 1];
      if (pt2.week === pt1.week + 1) {
        doc.line(pt1.x, pt1.y, pt2.x, pt2.y);
      }
    }

    // Draw data dots
    weeklyPoints.forEach((pt) => {
      doc.setFillColor(194, 0, 84);
      doc.circle(pt.x, pt.y, 1.1, 'FD');
    });

    y += chartH + 8;

    // 5. Tabela Semanal Resumida
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('4. Histórico Semanal de Avaliações', 14, y);

    y += 4;

    // Table Header
    doc.setFillColor(253, 242, 248);
    doc.rect(14, y, 182, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(152, 0, 65); // Afya Dark Magenta
    doc.text('Semana', 16, y + 4);
    doc.text('Unidade', 30, y + 4);
    doc.text('Caso APG', 46, y + 4);
    doc.text('Papel', 110, y + 4);
    doc.text('Presença', 135, y + 4);
    doc.text('Nota Bruta (20)', 165, y + 4);

    y += 6;

    studentEvals.slice(0, 12).forEach((e, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      if (idx % 2 === 1) {
        doc.setFillColor(254, 242, 248);
        doc.rect(14, y, 182, 5.5, 'F');
      }

      const cObj = cases.find((c) => c.id === e.caseId);
      const caseTitle = cObj?.title || `Caso Semana ${e.week}`;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);

      doc.text(`Semana ${e.week}`, 16, y + 3.8);
      doc.text(`Unidade ${e.unit}`, 30, y + 3.8);
      doc.text(caseTitle.substring(0, 32), 46, y + 3.8);
      doc.text(e.role, 110, y + 3.8);
      doc.text(e.attendance, 135, y + 3.8);
      doc.text(formatGrade(e.totalGrossScore), 165, y + 3.8);

      y += 5.5;
    });

    // Page Break for Feedback / Observations if needed
    if (y > 220) {
      doc.addPage();
      y = 20;
    } else {
      y += 6;
    }

    // 6. Observações do Tutor e Pareceres Pedagógicos
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(194, 0, 84); // Afya Magenta
    doc.text('5. Observações Privadas e Pareceres Pedagógicos', 14, y);

    y += 6;

    const evalsWithFeedback = studentEvals.filter((e) => e.pedagogicalFeedback || e.teacherNotes);

    if (evalsWithFeedback.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Nenhum parecer pedagógico ou observação registrada até o momento.', 14, y);
    } else {
      evalsWithFeedback.forEach((e) => {
        if (y > 265) {
          doc.addPage();
          y = 20;
        }

        doc.setFillColor(254, 242, 248);
        doc.rect(14, y, 182, 18, 'F');
        doc.setDrawColor(251, 207, 232);
        doc.rect(14, y, 182, 18, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(194, 0, 84); // Afya Magenta
        doc.text(`Semana ${e.week} (Unidade ${e.unit}) • Papel: ${e.role}`, 18, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);

        const content = e.pedagogicalFeedback || e.teacherNotes;
        const splitText = doc.splitTextToSize(content, 174);
        doc.text(splitText.slice(0, 2), 18, y + 10);

        y += 22;
      });
    }
  };

  const handleExportIndividualPDF = (explicitStudentId?: string) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const turmaName = getSelectedTurmaName();

    const targetStudentId = explicitStudentId || selectedStudentId;
    if (targetStudentId !== 'all') {
      const summary = studentSummaries.find((s) => s.studentId === targetStudentId);
      if (summary) {
        generateSingleStudentPDF(doc, summary, true);
        doc.save(
          generateFilename(
            turmaName,
            selectedSemester,
            'Relatorio_Individual',
            'pdf',
            summary.studentName
          )
        );
      }
    } else {
      // Export all filtered students in a single PDF workbook
      if (studentSummaries.length === 0) {
        alert('Nenhum estudante encontrado com os filtros selecionados.');
        return;
      }

      filteredSummaries.forEach((summary, idx) => {
        generateSingleStudentPDF(doc, summary, idx === 0);
      });

      doc.save(
        generateFilename(
          turmaName,
          selectedSemester,
          'Relatorio_Individual_Todos_Alunos',
          'pdf'
        )
      );
    }
  };

  // Filtered summaries
  const filteredSummaries = studentSummaries.filter((s) => {
    if (selectedStudentId !== 'all' && s.studentId !== selectedStudentId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Main Export Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
            Módulo de Relatórios e Exportação Oficial
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Geração de pautas consolidadas XLSX, relatórios de atestados e boletins individuais em PDF
          </p>
        </div>

        {/* Action Buttons based on Report Tab */}
        <div className="flex flex-wrap items-center gap-2">
          {reportType === 'consolidado' && (
            <button
              onClick={() => runExport(handleExportConsolidatedXLSX)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exportar Consolidado (XLSX)</span>
            </button>
          )}

          {reportType === 'ausencias' && (
            <button
              onClick={() => runExport(handleExportAbsencesXLSX)}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-xs transition-all"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Exportar Ausências/Atestados (XLSX)</span>
            </button>
          )}

          {reportType === 'individual' && (
            <button
              onClick={() => runExport(() => handleExportIndividualPDF())}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C20054] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-900 shadow-xs transition-all"
            >
              <FileText className="h-4 w-4" />
              <span>Gerar Relatório Individual (PDF)</span>
            </button>
          )}
        </div>
      </div>
      {exportError && <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{exportError}</div>}

      {/* Filter & Report Type Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Report Tabs */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800">
          <button
            onClick={() => setReportType('consolidado')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              reportType === 'consolidado'
                ? 'bg-[#C20054] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Relatório Consolidado (XLSX)
          </button>
          <button
            onClick={() => setReportType('ausencias')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              reportType === 'ausencias'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Ausências e Atestados (XLSX)
          </button>
          <button
            onClick={() => setReportType('individual')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
              reportType === 'individual'
                ? 'bg-[#C20054] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
            }`}
          >
            Boletim Individual (PDF)
          </button>
        </div>

        {/* Global Filters: Order: 1. Tipo de Relatório (tabs above) -> 2. Turma -> 3. Unidade -> 4. Mesa -> 5. Estudante */}
        <div className="flex flex-wrap items-center gap-4">
          <SOIFilter />
          {/* 2. Turma Filter */}
          <div className="min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Turma
            </label>
            <div className="relative">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 px-3 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">Todas as Turmas</option>
                {scopedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* 3 & 4. Unidade e Mesa */}
          <UnitTableFilters
            selectedUnit={selectedUnit}
            onUnitChange={setSelectedUnit}
            selectedTable={selectedGroup}
            onTableChange={setSelectedGroup}
          />

          {/* 5. Student Filter (for Individual PDF) */}
          {reportType === 'individual' && (
            <div className="min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Estudante
              </label>
              <div className="relative">
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 px-3 pr-8 text-xs font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">Todos os Alunos (Lote)</option>
                  {studentSummaries.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentName} ({s.enrollment})
                    </option>
                  ))}
                </select>
                <User className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Table / Preview */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {(() => {
                const typeLabel =
                  reportType === 'consolidado'
                    ? 'Ata Consolidada de Avaliação'
                    : reportType === 'ausencias'
                    ? 'Relatório de Ausências e Atestados'
                    : 'Boletim Individual';
                const turmaLabel =
                  selectedClass === 'all'
                    ? 'Medicina 2026.1'
                    : classes.find((c) => c.id === selectedClass)?.name || 'Medicina 2026.1';
                const unitLabel =
                  selectedUnit === '1'
                    ? '1ª Unidade'
                    : selectedUnit === '2'
                    ? '2ª Unidade'
                    : 'Todas as unidades';
                const tableLabel =
                  selectedGroup === 'grp_m1'
                    ? 'Mesa 1'
                    : selectedGroup === 'grp_m2'
                    ? 'Mesa 2'
                    : selectedGroup === 'grp_m3'
                    ? 'Mesa 3'
                    : 'Todas as mesas';

                return `${typeLabel} — ${turmaLabel} — ${unitLabel} — ${tableLabel}`;
              })()}
            </h3>
            <span className="text-xs text-slate-400">({selectedSemester})</span>
          </div>

          <Badge variant="neutral">{filteredSummaries.length} Aluno(s) Filtrado(s)</Badge>
        </div>

        <div className="overflow-x-auto">
          {/* TAB 1: CONSOLIDADO PREVIEW */}
          {reportType === 'consolidado' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 uppercase font-bold text-[10px] tracking-wider dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Estudante</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3">Mesa U1</th>
                  <th className="px-4 py-3">Mesa U2</th>
                  <th className="px-4 py-3">1ª Unid (20.0)</th>
                  <th className="px-4 py-3">2ª Bruta (20.0)</th>
                  <th className="px-4 py-3">2ª Ajustada (15.0)</th>
                  <th className="px-4 py-3 font-bold">Nota Final (35.0)</th>
                  <th className="px-4 py-3">Frequência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredSummaries.map((s) => (
                  <tr key={s.studentId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-slate-500">{s.enrollment}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-slate-100">
                      {s.studentName}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.className}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {s.unit1TableName || getStudentTableName(s.studentId, 1)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                      {s.unit2TableName || getStudentTableName(s.studentId, 2)}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {formatGrade(s.unit1Grade)}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {formatGrade(s.unit2Gross)}
                    </td>
                    <td className="px-4 py-3 font-bold text-indigo-700 dark:text-indigo-300">
                      {formatGrade(s.unit2Adjusted)}
                    </td>
                    <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatGrade(s.finalGrade)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">
                      {s.attendanceRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 2: AUSÊNCIAS E ATESTADOS PREVIEW */}
          {reportType === 'ausencias' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50 text-rose-900 uppercase font-bold text-[10px] tracking-wider dark:bg-rose-950/40 dark:text-rose-200">
                <tr>
                  <th className="px-4 py-3">Estudante / Matrícula</th>
                  <th className="px-4 py-3">Turma / Grupo</th>
                  <th className="px-4 py-3">Semana / Unidade</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Tipo Ocorrência</th>
                  <th className="px-4 py-3">Justificativa / Observação</th>
                  <th className="px-4 py-3">Impacto nas Médias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredSummaries.flatMap((sum) => {
                  const items = evaluations.filter(
                    (e) =>
                      e.studentId === sum.studentId &&
                      (e.attendance === 'Ausente' || e.attendance === 'Atestado')
                  );

                  return items.map((evalItem) => {
                    const isAtestado = evalItem.attendance === 'Atestado';
                    return (
                      <tr
                        key={evalItem.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                          isAtestado ? 'bg-blue-50/20 dark:bg-blue-950/10' : 'bg-rose-50/20 dark:bg-rose-950/10'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900 dark:text-slate-100">{sum.studentName}</p>
                          <p className="font-mono text-[11px] text-slate-400">{sum.enrollment}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {sum.className} ({sum.groupName})
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">
                          S{evalItem.week} • U{evalItem.unit}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{evalItem.date || 'Sessão Regular'}</td>
                        <td className="px-4 py-3">
                          {isAtestado ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                              Atestado Med.
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              Ausência
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 italic">
                          {evalItem.teacherNotes || 'Sem observações'}
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          {isAtestado ? (
                            <span className="text-blue-700 font-semibold dark:text-blue-300">
                              {evalItem.makeupCompleted ? 'Segunda chamada concluída' : 'Segunda chamada pendente'}
                            </span>
                          ) : (
                            <span className="text-rose-700 font-semibold dark:text-rose-300">
                              Nota 0.0 (Entra na média)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          )}

          {/* TAB 3: INDIVIDUAL PREVIEW */}
          {reportType === 'individual' && (
            <div className="p-6 space-y-6">
              {filteredSummaries.map((sum) => {
                const sEvals = evaluations.filter((e) => e.studentId === sum.studentId);
                return (
                  <div
                    key={sum.studentId}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80 overflow-hidden"
                  >
                    {/* Afya Branded Header Banner (White Background & Magenta Accents) */}
                    <div className="bg-white dark:bg-slate-900 border-b border-pink-100 dark:border-pink-950/40 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="flex items-center">
                          <AfyaSalvadorLogo className="h-7 w-auto" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold tracking-wide uppercase text-[#C20054]">
                            APG — Relatório Individual de Desempenho
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{sum.className}</span> ({sum.groupName}) • Semestre Letivo: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedSemester}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => runExport(() => handleExportIndividualPDF(sum.studentId))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#C20054] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#980041] transition-colors shadow-xs cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Baixar PDF (Afya)</span>
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-white">
                            {sum.studentName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            Matrícula: <code className="font-mono">{sum.enrollment}</code> • Turma de Referência: <span className="font-medium text-slate-700 dark:text-slate-300">{sum.className}</span>
                          </p>
                        </div>
                        <Badge variant={sum.attendanceRate >= 75 ? 'success' : 'danger'}>
                          Frequência: {sum.attendanceRate.toFixed(1)}%
                        </Badge>
                      </div>

                      {/* Quick Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="rounded-lg bg-pink-50/50 p-2.5 border border-pink-100 dark:bg-pink-950/20 dark:border-pink-900/30">
                          <span className="text-[10px] font-bold uppercase text-slate-500">1ª Unidade</span>
                          <p className="text-sm font-black text-[#C20054]">
                            {formatGrade(sum.unit1Grade)} / 20.0
                          </p>
                        </div>

                        <div className="rounded-lg bg-pink-50/50 p-2.5 border border-pink-100 dark:bg-pink-950/20 dark:border-pink-900/30">
                          <span className="text-[10px] font-bold uppercase text-slate-500">2ª Unid Bruta</span>
                          <p className="text-sm font-black text-[#C20054]">
                            {formatGrade(sum.unit2Gross)} / 20.0
                          </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                          <span className="text-[10px] font-bold uppercase text-slate-500">2ª Unid Ajustada</span>
                          <p className="text-sm font-black text-[#980041] dark:text-pink-400">
                            {formatGrade(sum.unit2Adjusted)} / 15.0
                          </p>
                        </div>

                        <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Nota Final</span>
                          <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                            {formatGrade(sum.finalGrade)} / 35.0
                          </p>
                        </div>
                      </div>

                      {/* Registered Feedbacks */}
                      {sEvals.some((e) => e.pedagogicalFeedback) && (
                        <div className="space-y-2 pt-2">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Pareceres Pedagógicos Registrados:
                          </span>
                          {sEvals
                            .filter((e) => e.pedagogicalFeedback)
                            .map((e) => (
                              <div
                                key={e.id}
                                className="rounded-lg border border-pink-100 bg-pink-50/30 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              >
                                <span className="font-bold text-[#C20054] block mb-1">
                                  Semana {e.week} • Papel: {e.role}
                                </span>
                                <p className="whitespace-pre-line">{e.pedagogicalFeedback}</p>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
