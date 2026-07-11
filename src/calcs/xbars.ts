import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { ControlChartData } from 'types';
import { calculateSampleStandardDeviation, chunkArray } from './common';

export function createXbarChartForXbarS(data: number[], subgroupSize: number): ControlChartData | null {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }

  const subgroups = chunkArray(data, subgroupSize);
  const xbarValues = subgroups.map((subgroup) => subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length);

  // Estimate the center line and limits from complete subgroups only: the control chart
  // constants assume exactly `subgroupSize` values, so a partial trailing subgroup would skew them.
  const completeSubgroups = subgroups.filter((subgroup) => subgroup.length === subgroupSize);
  if (completeSubgroups.length === 0) {
    return null;
  }

  const xbarMean =
    completeSubgroups.reduce((sum, subgroup) => sum + subgroup.reduce((s, value) => s + value, 0) / subgroupSize, 0) /
    completeSubgroups.length;

  const sMean =
    completeSubgroups.reduce((sum, subgroup) => sum + calculateSampleStandardDeviation(subgroup), 0) /
    completeSubgroups.length;

  const A3 = getControlChartConstant(subgroupSize, ControlChartConstants.a3_xbar_limit_sigma);

  return {
    centerLine: xbarMean,
    upperControlLimit: xbarMean + A3 * sMean,
    lowerControlLimit: xbarMean - A3 * sMean,
    data: xbarValues,
  };
}

export function createSChartForXbarS(data: number[], subgroupSize: number): ControlChartData | null {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }

  const subgroups = chunkArray(data, subgroupSize);
  const sValues = subgroups.filter((p) => p.length > 1).map(calculateSampleStandardDeviation);

  const completeSubgroups = subgroups.filter((subgroup) => subgroup.length === subgroupSize);
  if (completeSubgroups.length === 0) {
    return null;
  }

  const sMean =
    completeSubgroups.reduce((sum, subgroup) => sum + calculateSampleStandardDeviation(subgroup), 0) /
    completeSubgroups.length;

  const B3 = getControlChartConstant(subgroupSize, ControlChartConstants.b3_sigma_lcl);
  const B4 = getControlChartConstant(subgroupSize, ControlChartConstants.b4_sigma_ucl);

  return {
    centerLine: sMean,
    upperControlLimit: B4 * sMean,
    lowerControlLimit: B3 * sMean,
    data: sValues,
  };
}
