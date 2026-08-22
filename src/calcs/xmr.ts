import { ResolvedEstimation } from 'data/estimation';
import { ControlChartData } from 'types';
import { calculateMovingRanges } from './common';
import { estimateSigma, individualsLimits, movingRangeLimitsFromSigma } from './sigma';

const E2 = 2.66; // Constant for n=2: E2 = 3/d2 = 3/1.128
const D3 = 0; // Constant for n=2
const D4 = 3.267; // Constant for n=2

export function createXChartXmR(data: number[], estimation?: ResolvedEstimation): ControlChartData | null {
  const movingRanges = calculateMovingRanges(data);
  if (movingRanges.length === 0) {
    // Fewer than two observations: the moving range (and therefore the limits) is undefined.
    return null;
  }

  const dataMean = data.reduce((sum, value) => sum + value, 0) / data.length;
  const centerLine = estimation?.mean ?? dataMean;

  // Default estimator and no historical sigma: keep the classic E2·MR̄ form so
  // limits stay identical to the tabulated constants users already see.
  if (!estimation || estimation.isDefault) {
    const mRBar = movingRanges.reduce((sum, range) => sum + range, 0) / movingRanges.length;
    return {
      centerLine,
      upperControlLimit: centerLine + E2 * mRBar,
      lowerControlLimit: centerLine - E2 * mRBar,
      data: data,
    };
  }

  const sigma = estimation.sigma ?? estimateSigma(data, 1, estimation.method, estimation.unbias);
  if (sigma == null) {
    return null;
  }

  return { ...individualsLimits(centerLine, sigma), data: data };
}

export function createMRChartXmR(data: number[], estimation?: ResolvedEstimation): ControlChartData | null {
  const movingRanges = calculateMovingRanges(data);
  if (movingRanges.length === 0) {
    return null;
  }

  if (!estimation || estimation.isDefault) {
    const mRBar = movingRanges.reduce((sum, range) => sum + range, 0) / movingRanges.length;
    return {
      centerLine: mRBar,
      upperControlLimit: D4 * mRBar,
      lowerControlLimit: D3 * mRBar,
      data: movingRanges,
    };
  }

  // A moving range chart has no mean of its own: a historical µ describes the
  // individuals, so only the sigma estimate moves these limits.
  const sigma = estimation.sigma ?? estimateSigma(data, 1, estimation.method, estimation.unbias);
  if (sigma == null) {
    return null;
  }

  return { ...movingRangeLimitsFromSigma(sigma), data: movingRanges };
}
