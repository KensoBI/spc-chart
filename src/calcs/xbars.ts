import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { ResolvedEstimation } from 'data/estimation';
import { ControlChartData } from 'types';
import { calculateSampleStandardDeviation, chunkArray } from './common';
import { estimateSigma, stdDevLimitsFromSigma, subgroupMeanLimits } from './sigma';

function assertSubgroupSize(subgroupSize: number): void {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }
}

/**
 * Estimate the center line and limits from complete subgroups only: the control chart
 * constants assume exactly `subgroupSize` values, so a partial trailing subgroup would skew them.
 */
function completeSubgroups(data: number[], subgroupSize: number): number[][] {
  return chunkArray(data, subgroupSize).filter((subgroup) => subgroup.length === subgroupSize);
}

export function createXbarChartForXbarS(
  data: number[],
  subgroupSize: number,
  estimation?: ResolvedEstimation
): ControlChartData | null {
  assertSubgroupSize(subgroupSize);

  const subgroups = chunkArray(data, subgroupSize);
  const xbarValues = subgroups.map((subgroup) => subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length);

  const complete = completeSubgroups(data, subgroupSize);
  if (complete.length === 0) {
    return null;
  }

  const xbarMean =
    complete.reduce((sum, subgroup) => sum + subgroup.reduce((s, value) => s + value, 0) / subgroupSize, 0) /
    complete.length;
  const centerLine = estimation?.mean ?? xbarMean;

  // Default estimator and no historical sigma: keep the classic A3·S̄ form so
  // limits stay identical to the tabulated constants users already see.
  if (!estimation || estimation.isDefault) {
    const sMean =
      complete.reduce((sum, subgroup) => sum + calculateSampleStandardDeviation(subgroup), 0) / complete.length;
    const A3 = getControlChartConstant(subgroupSize, ControlChartConstants.a3_xbar_limit_sigma);
    return {
      centerLine,
      upperControlLimit: centerLine + A3 * sMean,
      lowerControlLimit: centerLine - A3 * sMean,
      data: xbarValues,
    };
  }

  const sigma = estimation.sigma ?? estimateSigma(data, subgroupSize, estimation.method, estimation.unbias);
  if (sigma == null) {
    return null;
  }

  return { ...subgroupMeanLimits(centerLine, sigma, subgroupSize), data: xbarValues };
}

export function createSChartForXbarS(
  data: number[],
  subgroupSize: number,
  estimation?: ResolvedEstimation
): ControlChartData | null {
  assertSubgroupSize(subgroupSize);

  const subgroups = chunkArray(data, subgroupSize);
  const sValues = subgroups.filter((p) => p.length > 1).map(calculateSampleStandardDeviation);

  const complete = completeSubgroups(data, subgroupSize);
  if (complete.length === 0) {
    return null;
  }

  if (!estimation || estimation.isDefault) {
    const sMean =
      complete.reduce((sum, subgroup) => sum + calculateSampleStandardDeviation(subgroup), 0) / complete.length;
    const B3 = getControlChartConstant(subgroupSize, ControlChartConstants.b3_sigma_lcl);
    const B4 = getControlChartConstant(subgroupSize, ControlChartConstants.b4_sigma_ucl);
    return {
      centerLine: sMean,
      upperControlLimit: B4 * sMean,
      lowerControlLimit: B3 * sMean,
      data: sValues,
    };
  }

  // An S chart plots spread, so a historical µ does not move it; only sigma does.
  const sigma = estimation.sigma ?? estimateSigma(data, subgroupSize, estimation.method, estimation.unbias);
  if (sigma == null) {
    return null;
  }

  return { ...stdDevLimitsFromSigma(sigma, subgroupSize), data: sValues };
}
