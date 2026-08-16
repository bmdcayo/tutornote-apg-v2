import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { caseMatchesCatalogScope } from '../utils/caseCatalog';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { UnitTableFilters } from '../components/common/UnitTableFilters';
import { SOIFilter } from '../components/common/SOIFilter';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatGrade } from '../services/calculationService';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const {
    students,
    classes,
    groups,
    cases,
    sois,
    evaluations,
    settings,
    tableAllocations,
    selectedSemester,
    selectedSemesterId,
    selectedSoiId,
    selectedClass,
    setSelectedClass,
    selectedGroup,
    setSelectedGroup,
    selectedUnit,
    setSelectedUnit,
    selectedWeek,
    setSelectedWeek,
    getCalculatedSummaries,
    notifications,
    dismissNotification,
  } = useApp();

  const scopedClasses = classes.filter(
    (item) =>
      (!selectedSemesterId || selectedSemesterId === 'all' || item.semesterId === selectedSemesterId) &&
      (selectedSoiId === 'all' || item.soiId === selectedSoiId)
  );
  const scopedClassIds = new Set(scopedClasses.map((item) => item.id));
  const studentSummaries = getCalculatedSummaries().filter((summary) => {
    const student = students.find((item) => item.id === summary.studentId);
    return Boolean(student && scopedClassIds.has(student.classId));
  });

  // Filtered cases
  const filteredCases = cases.filter((c) => {
    if (!caseMatchesCatalogScope(c, selectedSemesterId, selectedSoiId, sois)) return false;
    if (selectedUnit !== 'all' && c.unit.toString() !== selectedUnit) return false;
    if (selectedWeek !== 'all' && c.week.toString() !== selectedWeek) return false;
    return true;
  });

  // Filtered evaluations
  const filteredEvaluations = evaluations.filter((e) => {
    if (!scopedClassIds.has(e.classId)) return false;
    if (selectedClass !== 'all' && e.classId !== selectedClass) return false;
    if (selectedGroup !== 'all' && e.groupId !== selectedGroup) return false;
    if (selectedUnit !== 'all' && e.unit.toString() !== selectedUnit) return false;
    if (selectedWeek !== 'all' && e.week.toString() !== selectedWeek) return false;
    return true;
  });

  // Requirement 3: S08P2 status check globally (regardless of current week filter)
  const isS08P2Finalized = useMemo(() => {
    const caseW8 = filteredCases.find((c) => c.week === 8 || c.caseNumber === 8);
    const isCaseW8Finalized = caseW8
      ? caseW8.status === 'realizado' || (caseW8 as any).status === 'finalizada'
      : false;
    const hasConcludedEvalsW8 = filteredEvaluations.some(
      (e) => e.week === 8 && e.status === 'Concluído'
    );
    return isCaseW8Finalized || hasConcludedEvalsW8;
  }, [filteredCases, filteredEvaluations]);

  const unassignedUnit2StudentsCount = useMemo(() => {
    if (students.length === 0) return 0;
    return students.filter((st) => {
      const alloc = tableAllocations.find((a) => a.studentId === st.id && a.unit === 2);
      return !alloc;
    }).length;
  }, [students, tableAllocations]);

  // Calculate aggregates
  const totalStudents = studentSummaries.length;
  const casesCompleted = filteredCases.filter((c) => c.status === 'realizado').length;
  const evalsCompleted = filteredEvaluations.filter((e) => e.status === 'Concluído').length;
  const evalsPending = filteredEvaluations.filter((e) => e.status === 'Pendente').length;

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalCertificate = 0;

  filteredEvaluations.forEach((e) => {
    if (e.attendance === 'Presente') totalPresent++;
    else if (e.attendance === 'Ausente') totalAbsent++;
    else if (e.attendance === 'Atestado') totalCertificate++;
  });

  const totalConsideredSessions = totalPresent + totalAbsent;
  const overallAttendanceRate =
    totalConsideredSessions > 0 && totalStudents > 0
      ? (totalPresent / totalConsideredSessions) * 100
      : null;

  // Average grades across summarized students
  const u1Grades = studentSummaries.map((s) => s.unit1Grade).filter((g) => g > 0);
  const avgU1 = u1Grades.length > 0 ? u1Grades.reduce((a, b) => a + b, 0) / u1Grades.length : 0;

  const u2GrossGrades = studentSummaries.map((s) => s.unit2Gross).filter((g) => g > 0);
  const avgU2Gross =
    u2GrossGrades.length > 0 ? u2GrossGrades.reduce((a, b) => a + b, 0) / u2GrossGrades.length : 0;

  const u2AdjGrades = studentSummaries.map((s) => s.unit2Adjusted).filter((g) => g > 0);
  const avgU2Adj =
    u2AdjGrades.length > 0 ? u2AdjGrades.reduce((a, b) => a + b, 0) / u2AdjGrades.length : 0;

  const finalGrades = studentSummaries.map((s) => s.finalGrade).filter((g) => g > 0);
  const avgFinal =
    finalGrades.length > 0 ? finalGrades.reduce((a, b) => a + b, 0) / finalGrades.length : 0;

  // Students requiring attention
  const studentsNeedingAttention = studentSummaries.filter((s) => s.hasAlert);

  // Weekly evolution chart data (Weeks 1 to 20)
  const weeklyEvolutionData = Array.from({ length: 20 }, (_, i) => {
    const weekNum = i + 1;
    const weekEvals = filteredEvaluations.filter(
      (e) => e.week === weekNum && e.attendance === 'Presente' && e.status === 'Concluído'
    );
    const avgScore =
      weekEvals.length > 0
        ? weekEvals.reduce((acc, curr) => acc + curr.totalGrossScore, 0) / weekEvals.length
        : null;

    return {
      semana: `Sem ${weekNum}`,
      media: avgScore !== null ? Number(avgScore.toFixed(1)) : null,
      unit: weekNum <= 8 ? 'Unid 1' : 'Unid 2',
    };
  });

  // Radar chart data for criteria
  const radarData = settings.baremaCriteria.map((crit) => {
    let totalScore = 0;
    let count = 0;
    filteredEvaluations.forEach((e) => {
      if (e.attendance === 'Presente' && e.status === 'Concluído') {
        totalScore += e.criterionScores[crit.id] ?? 0;
        count++;
      }
    });
    const avg = count > 0 ? totalScore / count : 0;
    return {
      criterio: crit.name,
      media: Number(avg.toFixed(1)),
      maximo: crit.maxScore,
    };
  });

  // Upcoming cases
  const upcomingCases = filteredCases.filter((c) => c.status === 'planejado').slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Title & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#C20054] dark:text-blue-400 tracking-tight">
            Painel de Monitoramento
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Dashboard consolidado de acompanhamento longitudinal — {selectedSemester}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filters dropdown container */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <SOIFilter compact />
            {/* 1. Turma Filter */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                Turma
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="all">Todas as Turmas</option>
                {scopedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2 & 3. Unidade e Mesa */}
            <UnitTableFilters
              selectedUnit={selectedUnit}
              onUnitChange={setSelectedUnit}
              selectedTable={selectedGroup}
              onTableChange={setSelectedGroup}
            />

            {/* 4. Semana Filter */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                Semana
              </label>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 py-1.5 px-3 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="all">Todas as Semanas</option>
                {Array.from({ length: 20 }, (_, i) => (
                  <option key={i + 1} value={(i + 1).toString()}>
                    Semana {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/relatorios"
              className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 text-sm px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800"
            >
              Exportar Relatórios
            </Link>
            <Link
              to="/avaliacoes"
              className="bg-[#C20054] hover:bg-blue-900 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
            >
              Nova Avaliação
            </Link>
          </div>
        </div>
      </div>

      {/* S08P2 & Unit 2 Table Composition Alert / Confirmation Banner */}
      {isS08P2Finalized && totalStudents > 0 && unassignedUnit2StudentsCount > 0 && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((msg, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Lembrete de Transição (S08P2 Finalizada) — {msg}
                  </h4>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400">
                    A primeira unidade (Semanas 1 a 8) foi concluída na sessão S08P2. Restam {unassignedUnit2StudentsCount} estudante(s) sem alocação de mesa para a 2ª unidade.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/composicao-mesas"
                  className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition-all"
                >
                  Configurar Mesas U2
                </Link>
                <button
                  onClick={() => dismissNotification(idx)}
                  className="text-amber-600 hover:text-amber-800 text-xs px-2"
                >
                  Ignorar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isS08P2Finalized && totalStudents > 0 && unassignedUnit2StudentsCount === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Composição da 2ª Unidade Concluída para S08P2
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                A sessão S08P2 foi finalizada e todos os estudantes já possuem alocação de mesa definida para a 2ª unidade.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/composicao-mesas"
              className="rounded-xl border border-emerald-300 bg-white dark:bg-slate-900 dark:border-emerald-800 px-3.5 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 shadow-xs hover:bg-emerald-100 transition-all"
            >
              Ver Composição
            </Link>
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Estudantes" value={totalStudents} icon={Users} variant="default" />
        <StatCard title="Casos Realizados" value={casesCompleted} icon={BookOpen} variant="info" />
        <StatCard title="Av. Concluídas" value={evalsCompleted} icon={CheckCircle2} variant="success" />
        <StatCard title="Av. Pendentes" value={evalsPending} icon={Clock} variant="warning" />
        <StatCard title="Presentes" value={totalPresent} icon={UserCheck} variant="success" />
        <StatCard title="Ausentes" value={totalAbsent} icon={UserX} variant="danger" />
        <StatCard title="Atestados" value={totalCertificate} icon={Clock} variant="info" />
        <StatCard
          title="Média 1ª Unid."
          value={`${formatGrade(avgU1)} / 20`}
          subtitle="Máximo: 20.0"
          icon={TrendingUp}
          variant="primary"
        />
        <StatCard
          title="Média Bruta 2ª Unid."
          value={`${formatGrade(avgU2Gross)} / 20`}
          subtitle="Escala: 0 a 20"
          icon={TrendingUp}
          variant="info"
        />
        <StatCard
          title="Nota Ajustada 2ª"
          value={`${formatGrade(avgU2Adj)} / 15`}
          subtitle="Ajuste: ×15 ÷20"
          icon={TrendingUp}
          variant="success"
        />
        <StatCard
          title="Nota Final Méd."
          value={`${formatGrade(avgFinal)} / 35`}
          subtitle="1ª (20) + 2ª Adj (15)"
          icon={GraduationCap}
          variant="primary"
        />
        <StatCard
          title="Frequência Geral"
          value={
            overallAttendanceRate !== null
              ? `${overallAttendanceRate.toFixed(1)}%`
              : 'Sem dados'
          }
          subtitle={
            totalStudents === 0
              ? 'Nenhum aluno cadastrado'
              : totalConsideredSessions === 0
              ? 'Nenhuma sessão realizada'
              : 'Desconsidera atestados'
          }
          icon={UserCheck}
          variant={
            overallAttendanceRate === null
              ? 'default'
              : overallAttendanceRate >= 85
              ? 'success'
              : 'warning'
          }
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Score Evolution Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Evolução Semanal da Média Bruta (0 a 20 pts)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhamento longitudinal das 20 semanas do semestre
              </p>
            </div>
            <Badge variant="primary">Sem 1 a 20</Badge>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="semana" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 20]} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="media"
                  name="Média da Turma (pts)"
                  stroke="#1e3a8a"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#1e3a8a' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Barema Criteria Radar Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Desempenho por Categoria do Barema
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Análise comparativa das 4 dimensões (Máx: 5.0 pts cada)
              </p>
            </div>
            <Badge variant="info">4 Critérios</Badge>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="criterio" stroke="#64748b" fontSize={10} />
                <PolarRadiusAxis angle={30} domain={[0, 5]} stroke="#94a3b8" fontSize={10} />
                <Radar
                  name="Média Atingida"
                  dataKey="media"
                  stroke="#2563eb"
                  fill="#3b82f6"
                  fillOpacity={0.4}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Actionable Lists Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Students Needing Attention */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Alunos Requerendo Atenção
              </h3>
            </div>
            <Badge variant="warning">{studentsNeedingAttention.length}</Badge>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {studentsNeedingAttention.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Nenhum alerta registrado.</p>
            ) : (
              studentsNeedingAttention.map((std) => (
                <div
                  key={std.studentId}
                  className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/30"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {std.studentName}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">{std.enrollment}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {std.alertReasons.map((reason, idx) => (
                      <span
                        key={idx}
                        className="rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Evaluations */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Avaliações Pendentes
              </h3>
            </div>
            <Badge variant="warning">{evalsPending}</Badge>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {evalsPending === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500 mb-1" />
                Sem pendências para a seleção atual.
              </div>
            ) : (
              filteredEvaluations
                .filter((e) => e.status === 'Pendente')
                .slice(0, 5)
                .map((e) => {
                  const student = students.find((s) => s.id === e.studentId);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          {student?.name || 'Estudante'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Semana {e.week} • Papel: {e.role}
                        </p>
                      </div>
                      <Link
                        to="/avaliacoes"
                        className="rounded-lg bg-indigo-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-800"
                      >
                        Lançar
                      </Link>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Upcoming APG Cases */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Próximos Casos APG
              </h3>
            </div>
            <Link
              to="/casos-apg"
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Ver todos
            </Link>
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {upcomingCases.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 transition-colors hover:border-indigo-300"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Caso #{c.caseNumber} • Sem {c.week} (Unid {c.unit})
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">{c.date}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">{c.title}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{c.theme}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
