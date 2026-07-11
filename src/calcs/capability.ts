import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { SpcChartTyp } from 'types';
import { calculateMovingRanges, calculateSampleStandardDeviation, chunkArray } from './common';

const D2_N2 = 1.128; // d2 for n = 2 (moving ranges are always pairwise)

/**
 * c4 unbiasing constant for the sample standard deviation: exact table values for
 * n = 2..25, and the standard approximation 4(n-1)/(4n-3) beyond the table.
 */
export function getC4(n: number): number {
  if (n < 2) {
    return NaN;
  }
  if (n <= 25) {
    return getControlChartConstant(n, ControlChartConstants.C4_xbar_sigma);
  }
  return (4 * n - 4) / (4 * n - 3);
}

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
 * Returns null when the estimate is undefined (not enough data).
 */
export function estimateSigmaWithin(values: number[], chartType: SpcChartTyp, subgroupSize: number): number | null {
  const isChartSubgroupSize = subgroupSize >= 2 && subgroupSize <= 25;

  switch (chartType) {
    case SpcChartTyp.x_XbarR:
    case SpcChartTyp.r_XbarR:
      if (isChartSubgroupSize) {
        return sigmaFromRbar(values, subgroupSize);
      }
      break;
    case SpcChartTyp.x_XbarS:
    case SpcChartTyp.s_XbarS:
      if (isChartSubgroupSize) {
        return sigmaFromSbar(values, subgroupSize);
      }
      break;
    case SpcChartTyp.x_XmR:
    case SpcChartTyp.mR_XmR:
      return sigmaFromMovingRange(values);
    default:
      break;
  }

  if (subgroupSize >= 2) {
    return sigmaFromPooledStdDev(values, subgroupSize);
  }
  return sigmaFromMovingRange(values);
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

function sigmaFromRbar(values: number[], subgroupSize: number): number | null {
  const subgroups = chunkArray(values, subgroupSize).filter((sg) => sg.length === subgroupSize);
  if (subgroups.length === 0) {
    return null;
  }
  const rBar =
    subgroups.reduce((sum, sg) => sum + (Math.max(...sg) - Math.min(...sg)), 0) / subgroups.length;
  const d2 = getControlChartConstant(subgroupSize, ControlChartConstants.d2_xbar_range);
  return rBar / d2;
}

function sigmaFromSbar(values: number[], subgroupSize: number): number | null {
  const subgroups = chunkArray(values, subgroupSize).filter((sg) => sg.length === subgroupSize);
  if (subgroups.length === 0) {
    return null;
  }
  const sBar = subgroups.reduce((sum, sg) => sum + calculateSampleStandardDeviation(sg), 0) / subgroups.length;
  return sBar / getC4(subgroupSize);
}

function sigmaFromMovingRange(values: number[]): number | null {
  const movingRanges = calculateMovingRanges(values);
  if (movingRanges.length === 0) {
    return null;
  }
  const mrBar = movingRanges.reduce((sum, v) => sum + v, 0) / movingRanges.length;
  return mrBar / D2_N2;
}

function sigmaFromPooledStdDev(values: number[], subgroupSize: number): number | null {
  // Sp = sqrt( sum((ni - 1) * si^2) / sum(ni - 1) ) over subgroups with at least two values,
  // unbiased by c4(d + 1) where d is the pooled degrees of freedom (Minitab's default estimator).
  const subgroups = chunkArray(values, subgroupSize).filter((sg) => sg.length >= 2);
  if (subgroups.length === 0) {
    return null;
  }

  let sumSquares = 0;
  let degreesOfFreedom = 0;
  for (const sg of subgroups) {
    const s = calculateSampleStandardDeviation(sg);
    sumSquares += (sg.length - 1) * s * s;
    degreesOfFreedom += sg.length - 1;
  }

  return Math.sqrt(sumSquares / degreesOfFreedom) / getC4(degreesOfFreedom + 1);
}
