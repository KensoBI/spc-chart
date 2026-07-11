import { ControlChartData } from 'types';
import { calculateMovingRanges } from './common';

export function createXChartXmR(data: number[]): ControlChartData | null {
  const movingRanges = calculateMovingRanges(data);
  if (movingRanges.length === 0) {
    // Fewer than two observations: the moving range (and therefore the limits) is undefined.
    return null;
  }

  const xMean = data.reduce((sum, value) => sum + value, 0) / data.length;
  const mRBar = movingRanges.reduce((sum, range) => sum + range, 0) / movingRanges.length;

  const E2 = 2.66; // Constant for n=2: E2 = 3/d2 = 3/1.128

  return {
    centerLine: xMean,
    upperControlLimit: xMean + E2 * mRBar,
    lowerControlLimit: xMean - E2 * mRBar,
    data: data,
  };
}

export function createMRChartXmR(data: number[]): ControlChartData | null {
  const movingRanges = calculateMovingRanges(data);
  if (movingRanges.length === 0) {
    return null;
  }

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
