
import { MetricData, PaceAnalysis, PeriodContext } from '../types';

// Metrics that are averages/rates and should NOT be treated as accumulated over time
const SNAPSHOT_METRICS = [
  'cpl', 'cac', 'ltv', 'roas', 'cpmql', 
  'response_time', 'ticket', 'no_show_rate',
  'connection_rate', 'conversion_rate', 
  'conv_conn_meet', 'conversion_conn_meet', // Handling variations in naming
  'conv_meet_sale', 'conversion_meet_sale'
];

const isSnapshotMetric = (id: string) => {
  return SNAPSHOT_METRICS.includes(id) || id.includes('_rate') || id.includes('conversion_');
};

/**
 * Calculates the Pace, Projection, and Status based on the rules in the PDF (Page 2).
 */
export const calculatePace = (metric: MetricData, context: PeriodContext): PaceAnalysis => {
  const { value: REALIZED_ACUM, goal: META_MES, id } = metric;
  const { currentDay: DIA_ATUAL_INDEX, totalDays: TOTAL_DIAS_MES } = context;

  const isSnapshot = isSnapshotMetric(id);

  // --- Logic for Snapshot Metrics (Average/Rate) ---
  if (isSnapshot) {
    // For rates, "Provisioned" (Ideal Pace) is just the Goal itself (constant target).
    // You don't "accumulate" CPL or Conversion Rate.
    const PROVISIONADO_SNAPSHOT = META_MES;

    // Deviation is just simple difference
    const deviation = REALIZED_ACUM - META_MES;

    // Projection for a rate is assumed to be the current rate (unless we have trend data, which we assume linear here)
    const PROJECAO_FINAL = REALIZED_ACUM; 
    
    // Percent of Goal
    const PROJECAO_PERCENT = META_MES > 0 ? (REALIZED_ACUM / META_MES) * 100 : 0;

    // Determine status
    // Note: Inversion (lower is better) is handled in the UI (MetricCard), 
    // but here we provide the raw 'isOnTrack' based on standard "Higher is Better".
    // MetricCard will invert the check if `inverse` prop is true.
    const isOnTrack = PROJECAO_PERCENT >= 95; 

    return {
      realized: REALIZED_ACUM,
      goal: META_MES,
      provisioned: PROVISIONADO_SNAPSHOT, // Pointer stays at 100% of goal
      projection: PROJECAO_FINAL,
      projectionPercent: PROJECAO_PERCENT,
      deviation,
      isOnTrack
    };
  }

  // --- Logic for Accumulated Metrics (Totals) ---

  // 1. Provisionado acumulado até hoje (pace ideal)
  // PROVISIONADO_ACUM = META_MES × (DIA_ATUAL_INDEX / TOTAL_DIAS_MES)
  const PROVISIONADO_ACUM = META_MES * (DIA_ATUAL_INDEX / TOTAL_DIAS_MES);

  // 2. Desvio vs pace
  // DESVIO_ABSOLUTO = REALIZADO_ACUM – PROVISIONADO_ACUM
  const deviation = REALIZED_ACUM - PROVISIONADO_ACUM;

  // 3. Projeção de fechamento
  // RITMO_DIARIO_ATUAL = REALIZADO_ACUM / DIA_ATUAL_INDEX
  const RITMO_DIARIO_ATUAL = DIA_ATUAL_INDEX > 0 ? REALIZED_ACUM / DIA_ATUAL_INDEX : 0;
  
  // PROJECAO_FINAL = RITMO_DIARIO_ATUAL × TOTAL_DIAS_MES
  const PROJECAO_FINAL = RITMO_DIARIO_ATUAL * TOTAL_DIAS_MES;
  
  // PROJECAO_%_META = PROJECAO_FINAL / META_MES
  const PROJECAO_PERCENT = META_MES > 0 ? (PROJECAO_FINAL / META_MES) * 100 : 0;

  // Determine status (Simple logic: if projection >= 95% of goal, it's green)
  const isOnTrack = PROJECAO_PERCENT >= 95;

  return {
    realized: REALIZED_ACUM,
    goal: META_MES,
    provisioned: PROVISIONADO_ACUM,
    projection: PROJECAO_FINAL,
    projectionPercent: PROJECAO_PERCENT,
    deviation,
    isOnTrack
  };
};

export const formatValue = (val: number, type: MetricData['unit'], prefix = '', suffix = ''): string => {
  if (type === 'currency') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  }
  if (type === 'percentage') {
    return `${val.toFixed(1)}%`;
  }
  if (type === 'time') {
    const hours = Math.floor(val / 60);
    const mins = Math.floor(val % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }
  return `${prefix}${new Intl.NumberFormat('pt-BR').format(Math.round(val))}${suffix}`;
};
