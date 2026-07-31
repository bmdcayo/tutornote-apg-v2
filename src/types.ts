export type AttendanceStatus = 'Presente' | 'Ausente' | 'Atestado';
export type SessionRole = 'Coordenador' | 'Secretário' | 'Membro';
export type EvaluationStatus = 'Concluído' | 'Pendente' | 'Rascunho';
export type CaseStatus = 'planejado' | 'realizado' | 'cancelado';
export type StudentStatus = 'Ativo' | 'Trancado' | 'Atenção' | 'Inativo';

export interface BaremaCriterion {
  id: string;
  name: string;
  maxScore: number;
  description?: string;
}

/** Tabela public.alunos no Supabase (NÃO possui coluna turma_id nem email) */
export interface Aluno {
  id: string; // UUID
  nome: string;
  matricula: string;
  semestre_curso?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Tabela public.alocacoes_mesa no Supabase */
export interface AlocacaoMesa {
  id: string; // UUID
  aluno_id: string; // UUID
  turma_id: string; // UUID
  mesa_id: string; // UUID
  unidade: 1 | 2;
  data_inicio?: string | null;
  data_fim?: string | null;
  alterado_por?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Tabela public.mesas no Supabase */
export interface Mesa {
  id: string; // UUID
  nome: string;
  turma_id: string; // Vínculo real da mesa com a turma
  limite_estudantes?: number;
}

/** Tabela public.turmas no Supabase */
export interface Turma {
  id: string; // UUID
  nome: string;
  semestre_id: string;
  professor_id: string;
  curso?: string | null;
  modulo?: string | null;
  created_at?: string;
  semestres?: {
    id: string;
    nome: string;
    data_inicio?: string | null;
    data_fim?: string | null;
    ativo?: boolean;
  } | null;
  professor?: {
    id: string;
    nome: string;
    email?: string | null;
    papel?: string | null;
  } | null;
}

export interface Student {
  id: string; // UUID real do public.alunos.id
  name: string;
  enrollment: string; // Matrícula
  classId: string; // Derivado da mesa alocada (alocacoes_mesa -> mesas -> turmas)
  groupId: string; // Derivado da alocação de mesa da 1ª unidade
  email?: string;
  status: StudentStatus;
  ativo?: boolean;
  semestreCurso?: string;
  avatarUrl?: string;
  notes?: string;
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "Grupo A", "Grupo B"
  classId: string;
  limitStudents: number;
}

export interface Class {
  id: string;
  name: string; // e.g. "Turma Med-2026.1 APG"
  semesterId: string;
  soiId?: string;
  yearSemester: string; // e.g. "2026.1"
  responsibleTeacher: string;
}

export interface SOI {
  id: string;
  semesterId: string;
  name: string;
  code: string;
  active: boolean;
  createdAt?: string;
}

export interface Semester {
  id: string;
  name: string; // e.g. "2026.1"
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface APGCase {
  id: string;
  soiId?: string;
  semesterId?: string;
  soiCode?: string;
  soiName?: string;
  createdBy?: string;
  classId?: string;
  problemNumber?: 1 | 2;
  caseNumber: number; // e.g. 1
  week: number; // 1 to 20
  unit: 1 | 2; // Automatically calculated: 1..8 -> 1, 9..20 -> 2
  title: string;
  theme: string;
  date: string;
  time: string;
  room: string;
  description: string;
  learningObjectives: string[];
  teacherInstructions: string;
  status: CaseStatus;
}

export interface EvaluationScore {
  criterionId: string;
  score: number;
}

export interface Evaluation {
  id: string;
  studentId: string;
  classId: string;
  groupId: string;
  week: number; // 1..20
  unit: 1 | 2;
  caseId: string;
  date: string;
  role: SessionRole;
  attendance: AttendanceStatus;
  criterionScores: Record<string, number>; // criterionId -> score (0..5)
  rubricChecks?: Record<string, boolean>; // rubricItemId -> checked
  totalGrossScore: number; // Max 20.0
  performanceTags: string[];
  teacherNotes: string;
  pedagogicalFeedback: string;
  status: EvaluationStatus;
  updatedAt: string;
  makeupRequired?: boolean;
  makeupCompleted?: boolean;
  originalAbsenceDate?: string;
  makeupDate?: string;
}

export interface CaseClassTableAssignment {
  id?: string;
  caseId: string;
  classId: string;
  groupId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  institution: string;
  course: string;
  responsibleTeacher: string;
  currentSemester: string;
  baremaCriteria: BaremaCriterion[];
  maxBaremaScore: number;
  maxStudentsPerGroup: number;
  absencePolicy: string;
  certificatePolicy: string;
  lowScoreAlertThreshold: number; // e.g. 14.0
  maxAbsencesAlertThreshold: number; // e.g. 2
}

export interface StudentCalculatedSummary {
  studentId: string;
  studentName: string;
  enrollment: string;
  className: string;
  groupName: string; // Current/U1 group or default
  unit1TableName?: string; // Mesa da 1ª Unidade
  unit2TableName?: string; // Mesa da 2ª Unidade
  tableChangeStatus?: 'Permaneceu na mesma mesa' | 'Mudou de mesa' | 'Segunda unidade não definida';
  unit1Grade: number; // max 20.0
  unit2Gross: number; // max 20.0
  unit2Adjusted: number; // max 15.0
  finalGrade: number; // max 35.0
  evaluatedWeeksCount: number;
  presentCount: number;
  absentCount: number;
  certificateCount: number;
  pendingCount: number;
  attendanceRate: number; // %
  hasAlert: boolean;
  alertReasons: string[];
}

export interface TableAllocation {
  id: string;
  studentId: string;
  classId: string;
  groupId: string; // ID for Mesa 1, Mesa 2, or Mesa 3
  unit: 1 | 2;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  changedBy?: string;
}

export interface TableAllocationChangeLog {
  id: string;
  studentId: string;
  classId: string;
  previousGroupId?: string;
  newGroupId: string;
  unit: 1 | 2;
  date: string;
  changedBy: string;
}
