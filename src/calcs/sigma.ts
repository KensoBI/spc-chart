import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { calculateMovingRanges, calculateSampleStandardDeviation, chunkArray } from './common';

/**
 * Process standard deviation estimators (Minitab's "Estimate" methods).
 *
 * A control chart is only as good as its sigma estimate, and which estimator is
 * correct depends on the data, not on the chart: Rbar loses precision above
 * subgroup size 8, the median moving range resists a few extreme ranges that
 * would inflate the average, and the pooled standard deviation is the most
 * precise when the process is in control. Every chart therefore declares the
 * methods it accepts (ChartTypeDefinition.sigmaMethods, first entry = default)
 * and the estimate flows from here into both the limits and Cp/Cpk.
 */
export type SigmaMethod = 'rbar' | 'sbar' | 'pooled' | 'average-mr' | 'median-mr';

/** Methods defined over subgroups of two or more observations. */
export const subgroupSigmaMethods: SigmaMethod[] = ['rbar', 'sbar', 'pooled'];

/** Methods defined over individual observations, via the pairwise moving range. */
export const individualsSigmaMethods: SigmaMethod[] = ['average-mr', 'median-mr'];

export const sigmaMethodLabels: Record<SigmaMethod, string> = {
  rbar: 'Rbar (R̄ / d₂)',
  sbar: 'Sbar (S̄ / c₄)',
  pooled: 'Pooled standard deviation',
  'average-mr': 'Average moving range',
  'median-mr': 'Median moving range',
};

/**
 * Moving ranges are always pairwise (w = 2), so their constants are fixed.
 * MEDIAN_MR_D4 is the lower-case d₄(2) that unbiases the *median* moving range —
 * unrelated to the upper-case D₄ range-chart limit multiplier in calcConst.
 */
const AVERAGE_MR_D2 = 1.128;
const MEDIAN_MR_D4 = 0.954;

/**
 * Only Sbar, the pooled standard deviation and (deferred) √MSSD divide by an
 * unbiasing constant that can be switched off. Rbar and the moving-range
 * methods divide by d₂/d₄ unconditionally — that division *is* the estimator,
 * not a bias correction, so there is nothing to toggle.
 */
export function methodSupportsUnbiasing(method: SigmaMethod): boolean {
  return method === 'sbar' || method === 'pooled';
}

/** True for methods that need subgroups; the rest read individual observations. */
export function methodNeedsSubgroups(method: SigmaMethod): boolean {
  return subgroupSigmaMethods.includes(method);
}

/**
 * Estimate the process standard deviation from raw individual observations.
 * Returns null when the estimate is undefined — too few observations, or no
 * complete subgroup for a subgroup method.
 */
export function estimateSigma(
  values: number[],
  subgroupSize: number,
  method: SigmaMethod,
  unbias = true
): number | null {
  switch (method) {
    case 'rbar':
      return sigmaFromRbar(values, subgroupSize);
    case 'sbar':
      return sigmaFromSbar(values, subgroupSize, unbias);
    case 'pooled':
      return sigmaFromPooledStdDev(values, subgroupSize, unbias);
    case 'average-mr':
      return sigmaFromAverageMovingRange(values);
    case 'median-mr':
      return sigmaFromMedianMovingRange(values);
    default:
      return null;
  }
}

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

/** Limits of a chart of individual observations: center ± 3σ̂. */
export function individualsLimits(center: number, sigma: number) {
  return {
    centerLine: center,
    upperControlLimit: center + 3 * sigma,
    lowerControlLimit: center - 3 * sigma,
  };
}

/** Limits of a chart of subgroup means: center ± 3σ̂/√n. */
export function subgroupMeanLimits(center: number, sigma: number, subgroupSize: number) {
  const spread = (3 * sigma) / Math.sqrt(subgroupSize);
  return {
    centerLine: center,
    upperControlLimit: center + spread,
    lowerControlLimit: center - spread,
  };
}

/**
 * Limits of a range chart expressed through σ̂: CL = d₂σ̂, UCL = (d₂ + 3d₃)σ̂,
 * LCL = (d₂ − 3d₃)σ̂ floored at zero. Used when the range chart's sigma comes
 * from somewhere other than R̄ itself (another estimator, or a historical σ).
 */
export function rangeLimitsFromSigma(sigma: number, subgroupSize: number) {
  const d2 = getControlChartConstant(subgroupSize, ControlChartConstants.d2_xbar_range);
  const d3 = getControlChartConstant(subgroupSize, ControlChartConstants.d3_range_limit);
  return {
    centerLine: d2 * sigma,
    upperControlLimit: (d2 + 3 * d3) * sigma,
    lowerControlLimit: Math.max(0, (d2 - 3 * d3) * sigma),
  };
}

/** Range-chart limits for the pairwise moving range of individuals (w = 2). */
export function movingRangeLimitsFromSigma(sigma: number) {
  const d3 = getControlChartConstant(2, ControlChartConstants.d3_range_limit);
  return {
    centerLine: AVERAGE_MR_D2 * sigma,
    upperControlLimit: (AVERAGE_MR_D2 + 3 * d3) * sigma,
    lowerControlLimit: Math.max(0, (AVERAGE_MR_D2 - 3 * d3) * sigma),
  };
}

/**
 * Limits of a standard-deviation chart expressed through σ̂: CL = c₄σ̂,
 * UCL/LCL = (c₄ ± 3√(1 − c₄²))σ̂, the lower limit floored at zero.
 */
export function stdDevLimitsFromSigma(sigma: number, subgroupSize: number) {
  const c4 = getC4(subgroupSize);
  const spread = 3 * Math.sqrt(1 - c4 * c4) * sigma;
  return {
    centerLine: c4 * sigma,
    upperControlLimit: c4 * sigma + spread,
    lowerControlLimit: Math.max(0, c4 * sigma - spread),
  };
}

/** Complete subgroups only: the constants assume exactly `subgroupSize` values. */
function completeSubgroups(values: number[], subgroupSize: number): number[][] {
  return chunkArray(values, subgroupSize).filter((subgroup) => subgroup.length === subgroupSize);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function sigmaFromRbar(values: number[], subgroupSize: number): number | null {
  const subgroups = completeSubgroups(values, subgroupSize);
  if (subgroups.length === 0) {
    return null;
  }
  const rBar = subgroups.reduce((sum, sg) => sum + (Math.max(...sg) - Math.min(...sg)), 0) / subgroups.length;
  return rBar / getControlChartConstant(subgroupSize, ControlChartConstants.d2_xbar_range);
}

function sigmaFromSbar(values: number[], subgroupSize: number, unbias: boolean): number | null {
  const subgroups = completeSubgroups(values, subgroupSize);
  if (subgroups.length === 0) {
    return null;
  }
  const sBar = subgroups.reduce((sum, sg) => sum + calculateSampleStandardDeviation(sg), 0) / subgroups.length;
  return unbias ? sBar / getC4(subgroupSize) : sBar;
}

function sigmaFromPooledStdDev(values: number[], subgroupSize: number, unbias: boolean): number | null {
  // Sp = sqrt( sum((ni - 1) * si^2) / sum(ni - 1) ) over subgroups with at least two
  // values, unbiased by c4(d + 1) where d is the pooled degrees of freedom.
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

  const pooled = Math.sqrt(sumSquares / degreesOfFreedom);
  return unbias ? pooled / getC4(degreesOfFreedom + 1) : pooled;
}

function sigmaFromAverageMovingRange(values: number[]): number | null {
  const movingRanges = calculateMovingRanges(values);
  if (movingRanges.length === 0) {
    return null;
  }
  const mrBar = movingRanges.reduce((sum, v) => sum + v, 0) / movingRanges.length;
  return mrBar / AVERAGE_MR_D2;
}

function sigmaFromMedianMovingRange(values: number[]): number | null {
  const movingRanges = calculateMovingRanges(values);
  if (movingRanges.length === 0) {
    return null;
  }
  return median(movingRanges) / MEDIAN_MR_D4;
}
