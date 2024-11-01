import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { ControlChartData } from 'types';
import { calculateSampleStandardDeviation, chunkArray } from './common';

export function createXbarChartForXbarS(data: number[], subgroupSize: number): ControlChartData {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }

  const subgroups = chunkArray(data, subgroupSize);
  const xbarValues = subgroups.map((subgroup) => subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length);

  const xbarMean = xbarValues.reduce((sum, xbar) => sum + xbar, 0) / xbarValues.length;

  const sValues = subgroups.filter((p) => p.length > 1).map(calculateSampleStandardDeviation);
  const sMean = sValues.reduce((sum, s) => sum + s, 0) / sValues.length;

  const A3 = getControlChartConstant(subgroupSize, ControlChartConstants.a3_xbar_limit_sigma);

  return {
    centerLine: xbarMean,
    upperControlLimit: xbarMean + A3 * sMean,
    lowerControlLimit: xbarMean - A3 * sMean,
    data: xbarValues,
  };
}

export function createSChartForXbarS(data: number[], subgroupSize: number): ControlChartData {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }

  const subgroups = chunkArray(data, subgroupSize);
  const sValues = subgroups.filter((p) => p.length > 1).map(calculateSampleStandardDeviation);
  const sMean = sValues.reduce((sum, s) => sum + s, 0) / sValues.length;

  const B3 = getControlChartConstant(subgroupSize, ControlChartConstants.a3_xbar_limit_sigma);
  const B4 = getControlChartConstant(subgroupSize, ControlChartConstants.b4_sigma_ucl);

  return {
    centerLine: sMean,
    upperControlLimit: B4 * sMean,
    lowerControlLimit: B3 * sMean,
    data: sValues,
  };
}
