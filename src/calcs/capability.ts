import { ResolvedEstimation } from 'data/estimation';
import { SpcChartTyp } from 'types';
import { estimateSigma, getC4 } from './sigma';

export { getC4 };

/**
 * Estimate the within-subgroup standard deviation of the process from the raw individual
 * observations, the way Minitab does for capability analysis:
 *
 * - Xbar-R charts: Rbar / d2
 * - Xbar-S charts: sbar / c4
 * - XmR charts:    average moving range / d2(2)
 * - no chart:      pooled standard deviation / c4(d+1) when data is subgrouped,
 *                  average moving range / d2(2) for individuals (subgroup size 1)
 *
 * When the chart carries custom estimation settings, Cp/Cpk follow the same
 * estimator as its control limits — a capability index computed from a
 * different sigma than the chart it sits under would be indefensible.
 *
 * Returns null when the estimate is undefined (not enough data).
 */
export function estimateSigmaWithin(
  values: number[],
  chartType: SpcChartTyp | string,
  subgroupSize: number,
  estimation?: ResolvedEstimation
): number | null {
  if (estimation && !estimation.isDefault) {
    return estimation.sigma ?? estimateSigma(values, subgroupSize, estimation.method, estimation.unbias);
  }

  const isChartSubgroupSize = subgroupSize >= 2 && subgroupSize <= 25;

  switch (chartType) {
    case SpcChartTyp.x_XbarR:
    case SpcChartTyp.r_XbarR:
      if (isChartSubgroupSize) {
        return estimateSigma(values, subgroupSize, 'rbar');
      }
      break;
    case SpcChartTyp.x_XbarS:
    case SpcChartTyp.s_XbarS:
      if (isChartSubgroupSize) {
        return estimateSigma(values, subgroupSize, 'sbar');
      }
      break;
    case SpcChartTyp.x_XmR:
    case SpcChartTyp.mR_XmR:
      return estimateSigma(values, 1, 'average-mr');
    default:
      break;
  }

  if (subgroupSize >= 2) {
    return estimateSigma(values, subgroupSize, 'pooled');
  }
  return estimateSigma(values, 1, 'average-mr');
}

/**
 * Capability indices as defined in standard SPC: Cp/Cpk against the within-subgroup sigma,
 * Pp/Ppk against the overall sigma. Both sigmas describe the raw individual observations —
 * specification limits apply to individual parts, never to subgroup aggregates.
 */
export function calculateCapability(
  mean: number | null,
  sigmaWithin: number | null,
  sigmaOverall: number | null,
  lsl: number | null,
  usl: number | null
): { cp: number | null; cpk: number | null; pp: number | null; ppk: number | null } {
  if (mean == null || lsl == null || usl == null) {
    return { cp: null, cpk: null, pp: null, ppk: null };
  }

  let cp: number | null = null;
  let cpk: number | null = null;
  let pp: number | null = null;
  let ppk: number | null = null;

  if (sigmaWithin != null && sigmaWithin > 0) {
    cp = (usl - lsl) / (6 * sigmaWithin);
    cpk = Math.min((usl - mean) / (3 * sigmaWithin), (mean - lsl) / (3 * sigmaWithin));
  }

  if (sigmaOverall != null && sigmaOverall > 0) {
    pp = (usl - lsl) / (6 * sigmaOverall);
    ppk = Math.min((usl - mean) / (3 * sigmaOverall), (mean - lsl) / (3 * sigmaOverall));
  }

  return { cp, cpk, pp, ppk };
}
