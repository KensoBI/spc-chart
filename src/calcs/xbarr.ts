import { ControlChartConstants, getControlChartConstant } from 'data/calcConst';
import { ControlChartData } from 'types';
import { chunkArray } from './common';

export function createXbarChartForXbarR(data: number[], subgroupSize: number): ControlChartData | null {
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

  const rMean =
    completeSubgroups.reduce((sum, subgroup) => sum + (Math.max(...subgroup) - Math.min(...subgroup)), 0) /
    completeSubgroups.length;

  const A2 = getControlChartConstant(subgroupSize, ControlChartConstants.a2_xbar_limit_range);

  return {
    centerLine: xbarMean,
    upperControlLimit: xbarMean + A2 * rMean,
    lowerControlLimit: xbarMean - A2 * rMean,
    data: xbarValues,
  };
}

export function createRChartForXbarR(data: number[], subgroupSize: number): ControlChartData | null {
  if (subgroupSize > 25 || subgroupSize < 2) {
    throw new Error('Subgroup size must be between 2 and 25.');
  }
  const subgroups = chunkArray(data, subgroupSize);
  const rValues = subgroups
    .filter((p) => p.length > 1)
    .map((subgroup) => Math.max(...subgroup) - Math.min(...subgroup));

  const completeSubgroups = subgroups.filter((subgroup) => subgroup.length === subgroupSize);
  if (completeSubgroups.length === 0) {
    return null;
  }

  const rMean =
    completeSubgroups.reduce((sum, subgroup) => sum + (Math.max(...subgroup) - Math.min(...subgroup)), 0) /
    completeSubgroups.length;

  const D3 = getControlChartConstant(subgroupSize, ControlChartConstants.d3_range_lcl);
  const D4 = getControlChartConstant(subgroupSize, ControlChartConstants.d4_range_ucl);

  return {
    centerLine: rMean,
    upperControlLimit: D4 * rMean,
    lowerControlLimit: D3 * rMean,
    data: rValues,
  };
}
