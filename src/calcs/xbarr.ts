import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { ControlChartData } from 'types';
import { chunkArray } from './common';

export function createXbarChartForXbarR(data: number[], subgroupSize: number): ControlChartData {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }

  const subgroups = chunkArray(data, subgroupSize);
  const xbarValues = subgroups.map((subgroup) => subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length);

  const xbarMean = xbarValues.reduce((sum, xbar) => sum + xbar, 0) / xbarValues.length;

  const rValues = subgroups
    .filter((p) => p.length > 1)
    .map((subgroup) => Math.max(...subgroup) - Math.min(...subgroup));
  const rMean = rValues.reduce((sum, r) => sum + r, 0) / rValues.length;

  const A2 = getControlChartConstant(subgroupSize, ControlChartConstants.a2_xbar_limit_range);

  return {
    centerLine: xbarMean,
    upperControlLimit: xbarMean + A2 * rMean,
    lowerControlLimit: xbarMean - A2 * rMean,
    data: xbarValues,
  };
}

export function createRChartForXbarR(data: number[], subgroupSize: number): ControlChartData {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }
  const subgroups = chunkArray(data, subgroupSize);
  const rValues = subgroups
    .filter((p) => p.length > 1)
    .map((subgroup) => Math.max(...subgroup) - Math.min(...subgroup));
  const rMean = rValues.reduce((sum, r) => sum + r, 0) / rValues.length;

  const D3 = getControlChartConstant(subgroupSize, ControlChartConstants.d3_range_lcl);
  const D4 = getControlChartConstant(subgroupSize, ControlChartConstants.d4_range_ucl);

  return {
    centerLine: rMean,
    upperControlLimit: D4 * rMean,
    lowerControlLimit: D3 * rMean,
    data: rValues,
  };
}
