import { ControlChartData } from 'types';
import { calculateMovingRanges } from './common';

export function createXChartXmR(data: number[]): ControlChartData {
  const xMean = data.reduce((sum, value) => sum + value, 0) / data.length;

  const movingRanges = calculateMovingRanges(data);
  const mRBar = movingRanges.reduce((sum, range) => sum + range, 0) / movingRanges.length;

  const E2 = 2.66; // Constant for n=2 (moving range is always calculated with n=2)

  return {
    centerLine: xMean,
    upperControlLimit: xMean + (E2 * mRBar) / 1.128, // 1.128 is d2 for n=2
    lowerControlLimit: xMean - (E2 * mRBar) / 1.128,
    data: data,
  };
}

export function createMRChartXmR(data: number[]): ControlChartData {
  const movingRanges = calculateMovingRanges(data);
  const mRBar = movingRanges.reduce((sum, range) => sum + range, 0) / movingRanges.length;

  const D3 = 0; // Constant for n=2
  const D4 = 3.267; // Constant for n=2

  return {
    centerLine: mRBar,
    upperControlLimit: D4 * mRBar,
    lowerControlLimit: D3 * mRBar,
    data: movingRanges,
  };
}
