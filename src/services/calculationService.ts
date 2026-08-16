import { BaremaCriterion, Evaluation, StudentCalculatedSummary } from '../types';

/**
 * TutorNote APG - Central Calculation Engine
 * All evaluation, unit average, grade adjustment, and final grade formulas are centralized here.
 *
 * Mandatory Formula Rules:
 * 1. For each week, calculate the average of valid weekly evaluations (scale 0 to 20).
 * 2. Weeks 1 to 8 (1st Unit / U1): scale 0 to 20. U1 Grade = average of valid weeks 1..8 (Max 20.0).
 * 3. Weeks 9 to 20 (2nd Unit / U2): gross average scale 0 to 20 per week (Max 20.0).
 * 4. Adjusted U2 Grade = (Gross U2 Average * 15) / 20 (Max 15.0).
 * 5. Final Grade = U1 Grade + Adjusted U2 Grade (Max 35.0).
 * 6. Hard Limits:
 *    - Evaluation total <= 20.0
 *    - U1 Grade <= 20.0
 *    - U2 Gross <= 20.0
 *    - U2 Adjusted <= 15.0
 *    - Final Grade <= 35.0
 */

// Helper rounding function for internal 2 decimal precision
export function roundTo2Decimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Format numbers for UI display (1 decimal place)
export function formatGrade(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return roundTo2Decimals(num).toFixed(1);
}

/**
 * Calculates total gross score for a single evaluation session (max 20.0 pts)
 * Formula: Sum(Domain Scores) + AdjustmentScore, clamped between 0.0 and 20.0
 */
export function calculateEvaluationTotalScore(
  criterionScores: Record<string, number>,
  criteria: BaremaCriterion[],
  adjustmentScore: number = 0
): number {
  if (!criterionScores) return 0;

  let sum = 0;
  for (const crit of criteria) {
    const rawVal = criterionScores[crit.id] ?? 0;
    // Validate range: 0 <= rawVal <= crit.maxScore
    const clampedVal = Math.max(0, Math.min(rawVal, crit.maxScore));
    sum += clampedVal;
  }

  // Apply manual teacher adjustment (positive or negative)
  sum += Number(adjustmentScore) || 0;

  // Total max for evaluation is 20.0, minimum is 0.0
  const cappedTotal = Math.min(sum, 20.0);
  return roundTo2Decimals(Math.max(0, cappedTotal));
}

/**
 * Determines whether an evaluation is valid for average calculation.
 * Presente and Ausente are valid for calculation (Ausente counts as 0).
 * Atestado is excluded from denominator and numerator.
 * Pendente/Rascunho is excluded while not finalized.
 */
export function getEffectiveScoreForEvaluation(evalItem: Evaluation): number | null {
  if (evalItem.status === 'Pendente' || evalItem.status === 'Rascunho') {
    return null; // Not finalized
  }

  if (evalItem.attendance === 'Atestado') {
    return null; // Excluded from calculation
  }

  if (evalItem.attendance === 'Ausente') {
    return 0.0; // Score 0 for absence without certificate
  }

  // Presente: return calculated total score (clamped 0..20)
  const score = Math.max(0, Math.min(evalItem.totalGrossScore, 20.0));
  return score;
}

/**
 * Calculates weekly gross average for a student for a specific week (scale 0..20.0)
 */
export function calculateWeeklyAverage(studentEvalsForWeek: Evaluation[]): number | null {
  const validScores: number[] = [];

  for (const item of studentEvalsForWeek) {
    const score = getEffectiveScoreForEvaluation(item);
    if (score !== null) {
      validScores.push(score);
    }
  }

  if (validScores.length === 0) return null;

  const sum = validScores.reduce((acc, val) => acc + val, 0);
  const avg = sum / validScores.length;
  return roundTo2Decimals(Math.max(0, Math.min(avg, 20.0)));
}

/**
 * Interface for the output of the single central calculation function.
 */
export interface APGGradeResult {
  unit1Grade: number; // 0.0 to 20.0
  unit2Gross: number; // 0.0 to 20.0
  unit2Adjusted: number; // 0.0 to 15.0
  finalGrade: number; // 0.0 to 35.0
  evaluatedWeeksU1: number;
  evaluatedWeeksU2: number;
}

/**
 * SINGLE CENTRAL CALCULATION FUNCTION for APG Grades
 *
 * Implements the mandatory formula:
 * 1. Unit 1 Grade = average of valid weekly scores (weeks 1 to 8) -> 0..20.0
 * 2. Unit 2 Gross = average of valid weekly scores (weeks 9 to 20) -> 0..20.0
 * 3. Unit 2 Adjusted = (Unit 2 Gross * 15) / 20 -> 0..15.0
 * 4. Final Grade = Unit 1 Grade + Unit 2 Adjusted -> 0..35.0
 * 5. Strict bounds enforcement (Max 20 for U1/U2 gross, Max 15 for U2 adj, Max 35 for Final)
 */
export function calculateAPGGrades(input: {
  u1GrossScore?: number | null;
  u2GrossScore?: number | null;
  evaluations?: Evaluation[];
}): APGGradeResult {
  let u1Gross = 0;
  let u2Gross = 0;
  let evaluatedWeeksU1 = 0;
  let evaluatedWeeksU2 = 0;

  if (input.evaluations) {
    // 1. Calculate Unit 1 (weeks 1..8)
    const u1WeeklyAvgs: number[] = [];
    for (let week = 1; week <= 8; week++) {
      const weekEvals = input.evaluations.filter((e) => e.week === week);
      const avg = calculateWeeklyAverage(weekEvals);
      if (avg !== null) u1WeeklyAvgs.push(avg);
    }
    if (u1WeeklyAvgs.length > 0) {
      const sum = u1WeeklyAvgs.reduce((a, b) => a + b, 0);
      u1Gross = sum / u1WeeklyAvgs.length;
      evaluatedWeeksU1 = u1WeeklyAvgs.length;
    }

    // 2. Calculate Unit 2 (weeks 9..20)
    const u2WeeklyAvgs: number[] = [];
    for (let week = 9; week <= 20; week++) {
      const weekEvals = input.evaluations.filter((e) => e.week === week);
      const avg = calculateWeeklyAverage(weekEvals);
      if (avg !== null) u2WeeklyAvgs.push(avg);
    }
    if (u2WeeklyAvgs.length > 0) {
      const sum = u2WeeklyAvgs.reduce((a, b) => a + b, 0);
      u2Gross = sum / u2WeeklyAvgs.length;
      evaluatedWeeksU2 = u2WeeklyAvgs.length;
    }
  } else {
    u1Gross = input.u1GrossScore ?? 0;
    u2Gross = input.u2GrossScore ?? 0;
  }

  // Enforce U1 bounds: 0.0 to 20.0
  const unit1Grade = roundTo2Decimals(Math.max(0, Math.min(u1Gross, 20.0)));

  // Enforce U2 Gross bounds: 0.0 to 20.0
  const unit2Gross = roundTo2Decimals(Math.max(0, Math.min(u2Gross, 20.0)));

  // Formula: Adjusted U2 = (U2 Gross * 15) / 20. Enforce bounds: 0.0 to 15.0
  const rawU2Adj = (unit2Gross * 15.0) / 20.0;
  const unit2Adjusted = roundTo2Decimals(Math.max(0, Math.min(rawU2Adj, 15.0)));

  // Formula: Final Grade = U1 Grade + Adjusted U2 Grade. Enforce bounds: 0.0 to 35.0
  const rawFinal = unit1Grade + unit2Adjusted;
  const finalGrade = roundTo2Decimals(Math.max(0, Math.min(rawFinal, 35.0)));

  return {
    unit1Grade,
    unit2Gross,
    unit2Adjusted,
    finalGrade,
    evaluatedWeeksU1,
    evaluatedWeeksU2,
  };
}

/**
 * Calculates Unit 1 grade (Semanas 1 a 8). Max 20.0 points.
 */
export function calculateUnit1Grade(studentEvals: Evaluation[]): {
  unit1Grade: number;
  evaluatedWeeksCount: number;
} {
  const result = calculateAPGGrades({ evaluations: studentEvals });
  return {
    unit1Grade: result.unit1Grade,
    evaluatedWeeksCount: result.evaluatedWeeksU1,
  };
}

/**
 * Calculates Unit 2 gross average and adjusted grade (Semanas 9 a 20).
 */
export function calculateUnit2Grade(studentEvals: Evaluation[]): {
  unit2Gross: number;
  unit2Adjusted: number;
  evaluatedWeeksCount: number;
} {
  const result = calculateAPGGrades({ evaluations: studentEvals });
  return {
    unit2Gross: result.unit2Gross,
    unit2Adjusted: result.unit2Adjusted,
    evaluatedWeeksCount: result.evaluatedWeeksU2,
  };
}

/**
 * Calculates student final summary using the central calculateAPGGrades function.
 */
export function calculateStudentSummary(
  studentId: string,
  studentName: string,
  enrollment: string,
  className: string,
  groupName: string,
  allStudentEvals: Evaluation[],
  lowScoreThreshold = 14.0,
  maxAbsencesThreshold = 2,
  unit1TableName?: string,
  unit2TableName?: string,
  tableChangeStatus?: 'Permaneceu na mesma mesa' | 'Mudou de mesa' | 'Segunda unidade não definida'
): StudentCalculatedSummary {
  const grades = calculateAPGGrades({ evaluations: allStudentEvals });

  // Attendance breakdown
  let presentCount = 0;
  let absentCount = 0;
  let certificateCount = 0;
  let pendingCount = 0;

  for (const e of allStudentEvals) {
    if (e.status === 'Pendente') {
      pendingCount++;
      continue;
    }
    if (e.attendance === 'Presente') presentCount++;
    else if (e.attendance === 'Ausente') absentCount++;
    else if (e.attendance === 'Atestado') certificateCount++;
  }

  const totalSessionsConsidered = presentCount + absentCount; // Atestados don't penalize attendance %
  const attendanceRate =
    totalSessionsConsidered > 0
      ? roundTo2Decimals((presentCount / totalSessionsConsidered) * 100)
      : 0;

  // Alerts
  const alertReasons: string[] = [];
  if (absentCount >= maxAbsencesThreshold) {
    alertReasons.push(`${absentCount} ausência(s) sem atestado`);
  }
  if (grades.evaluatedWeeksU1 > 0 && grades.unit1Grade < lowScoreThreshold) {
    alertReasons.push(
      `Média da 1ª Unidade (${formatGrade(grades.unit1Grade)}) abaixo de ${lowScoreThreshold}`
    );
  }
  if (grades.evaluatedWeeksU2 > 0 && grades.unit2Gross < lowScoreThreshold) {
    alertReasons.push(
      `Média da 2ª Unidade (${formatGrade(grades.unit2Gross)}) abaixo de ${lowScoreThreshold}`
    );
  }
  if (pendingCount > 0) {
    alertReasons.push(`${pendingCount} avaliação(ões) pendente(s)`);
  }

  return {
    studentId,
    studentName,
    enrollment,
    className,
    groupName,
    unit1TableName,
    unit2TableName,
    tableChangeStatus,
    unit1Grade: grades.unit1Grade,
    unit2Gross: grades.unit2Gross,
    unit2Adjusted: grades.unit2Adjusted,
    finalGrade: grades.finalGrade,
    evaluatedWeeksCount: grades.evaluatedWeeksU1 + grades.evaluatedWeeksU2,
    presentCount,
    absentCount,
    certificateCount,
    pendingCount,
    attendanceRate,
    hasAlert: alertReasons.length > 0,
    alertReasons,
  };
}
