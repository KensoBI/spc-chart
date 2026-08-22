import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { ResolvedEstimation } from 'data/estimation';
import { ControlChartData } from 'types';
import { chunkArray } from './common';
import { estimateSigma, rangeLimitsFromSigma, subgroupMeanLimits } from './sigma';

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

const subgroupRange = (subgroup: number[]): number => Math.max(...subgroup) - Math.min(...subgroup);

export function createXbarChartForXbarR(
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

  // Default estimator and no historical sigma: keep the classic A2·R̄ form so
  // limits stay identical to the tabulated constants users already see.
  if (!estimation || estimation.isDefault) {
    const rMean = complete.reduce((sum, subgroup) => sum + subgroupRange(subgroup), 0) / complete.length;
    const A2 = getControlChartConstant(subgroupSize, ControlChartConstants.a2_xbar_limit_range);
    return {
      centerLine,
      upperControlLimit: centerLine + A2 * rMean,
      lowerControlLimit: centerLine - A2 * rMean,
      data: xbarValues,
    };
  }

  const sigma = estimation.sigma ?? estimateSigma(data, subgroupSize, estimation.method, estimation.unbias);
  if (sigma == null) {
    return null;
  }

  return { ...subgroupMeanLimits(centerLine, sigma, subgroupSize), data: xbarValues };
}

export function createRChartForXbarR(
  data: number[],
  subgroupSize: number,
  estimation?: ResolvedEstimation
): ControlChartData | null {
  assertSubgroupSize(subgroupSize);

  const subgroups = chunkArray(data, subgroupSize);
  const rValues = subgroups.filter((p) => p.length > 1).map(subgroupRange);

  const complete = completeSubgroups(data, subgroupSize);
  if (complete.length === 0) {
    return null;
  }

  if (!estimation || estimation.isDefault) {
    const rMean = complete.reduce((sum, subgroup) => sum + subgroupRange(subgroup), 0) / complete.length;
    const D3 = getControlChartConstant(subgroupSize, ControlChartConstants.d3_range_lcl);
    const D4 = getControlChartConstant(subgroupSize, ControlChartConstants.d4_range_ucl);
    return {
      centerLine: rMean,
      upperControlLimit: D4 * rMean,
      lowerControlLimit: D3 * rMean,
      data: rValues,
    };
  }

  // A range chart plots spread, so a historical µ does not move it; only sigma does.
  const sigma = estimation.sigma ?? estimateSigma(data, subgroupSize, estimation.method, estimation.unbias);
  if (sigma == null) {
    return null;
  }

  return { ...rangeLimitsFromSigma(sigma, subgroupSize), data: rValues };
}
