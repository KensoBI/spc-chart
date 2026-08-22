import {
  estimateSigma,
  getC4,
  individualsLimits,
  methodSupportsUnbiasing,
  movingRangeLimitsFromSigma,
  rangeLimitsFromSigma,
  stdDevLimitsFromSigma,
  subgroupMeanLimits,
} from './sigma';
import { calculateMovingRanges, calculateSampleStandardDeviation, chunkArray } from './common';

// Four subgroups of five, deliberately uneven so the estimators disagree.
const subgrouped = [
  10, 12, 11, 9, 13, 20, 21, 19, 22, 18, 10, 11, 10, 12, 11, 15, 30, 14, 16, 15,
];
const individuals = [5, 7, 6, 9, 5, 6, 20, 6, 7, 5];

describe('estimateSigma', () => {
  it('rbar divides the mean subgroup range by d2', () => {
    const subgroups = chunkArray(subgrouped, 5);
    const rBar = subgroups.reduce((sum, sg) => sum + (Math.max(...sg) - Math.min(...sg)), 0) / subgroups.length;
    expect(estimateSigma(subgrouped, 5, 'rbar')).toBeCloseTo(rBar / 2.326, 10);
  });

  it('sbar divides the mean subgroup standard deviation by c4 only when unbiasing', () => {
    const subgroups = chunkArray(subgrouped, 5);
    const sBar = subgroups.reduce((sum, sg) => sum + calculateSampleStandardDeviation(sg), 0) / subgroups.length;

    expect(estimateSigma(subgrouped, 5, 'sbar', true)).toBeCloseTo(sBar / getC4(5), 10);
    expect(estimateSigma(subgrouped, 5, 'sbar', false)).toBeCloseTo(sBar, 10);
  });

  it('pooled weights subgroups by degrees of freedom and unbiases by c4(d+1)', () => {
    const subgroups = chunkArray(subgrouped, 5);
    let sumSquares = 0;
    let df = 0;
    for (const sg of subgroups) {
      const s = calculateSampleStandardDeviation(sg);
      sumSquares += (sg.length - 1) * s * s;
      df += sg.length - 1;
    }
    const pooled = Math.sqrt(sumSquares / df);

    expect(estimateSigma(subgrouped, 5, 'pooled', true)).toBeCloseTo(pooled / getC4(df + 1), 10);
    expect(estimateSigma(subgrouped, 5, 'pooled', false)).toBeCloseTo(pooled, 10);
  });

  it('average moving range divides by d2(2)', () => {
    const ranges = calculateMovingRanges(individuals);
    const mrBar = ranges.reduce((sum, v) => sum + v, 0) / ranges.length;
    expect(estimateSigma(individuals, 1, 'average-mr')).toBeCloseTo(mrBar / 1.128, 10);
  });

  it('median moving range divides by d4(2) and resists a single extreme range', () => {
    // The 20 in the middle produces two huge moving ranges; the median ignores them.
    const median = estimateSigma(individuals, 1, 'median-mr')!;
    const average = estimateSigma(individuals, 1, 'average-mr')!;
    expect(median).toBeLessThan(average);

    const ranges = [...calculateMovingRanges(individuals)].sort((a, b) => a - b);
    const mid = Math.floor(ranges.length / 2);
    const medianRange = ranges.length % 2 === 0 ? (ranges[mid - 1] + ranges[mid]) / 2 : ranges[mid];
    expect(median).toBeCloseTo(medianRange / 0.954, 10);
  });

  it('returns null when there is no complete subgroup or no moving range', () => {
    expect(estimateSigma([1, 2, 3], 5, 'rbar')).toBeNull();
    expect(estimateSigma([1, 2, 3], 5, 'sbar')).toBeNull();
    expect(estimateSigma([], 1, 'average-mr')).toBeNull();
    expect(estimateSigma([7], 1, 'median-mr')).toBeNull();
  });

  it('ignores a partial trailing subgroup', () => {
    const withTail = [...subgrouped, 100, 200];
    expect(estimateSigma(withTail, 5, 'rbar')).toBeCloseTo(estimateSigma(subgrouped, 5, 'rbar')!, 10);
  });
});

describe('methodSupportsUnbiasing', () => {
  it('is true only for the methods whose constant Minitab lets you switch off', () => {
    expect(methodSupportsUnbiasing('sbar')).toBe(true);
    expect(methodSupportsUnbiasing('pooled')).toBe(true);
    expect(methodSupportsUnbiasing('rbar')).toBe(false);
    expect(methodSupportsUnbiasing('average-mr')).toBe(false);
    expect(methodSupportsUnbiasing('median-mr')).toBe(false);
  });
});

describe('limits from sigma', () => {
  it('places individuals limits at ±3σ', () => {
    expect(individualsLimits(10, 2)).toEqual({
      centerLine: 10,
      upperControlLimit: 16,
      lowerControlLimit: 4,
    });
  });

  it('narrows subgroup mean limits by √n', () => {
    const limits = subgroupMeanLimits(10, 2, 4);
    expect(limits.upperControlLimit).toBeCloseTo(13, 10);
    expect(limits.lowerControlLimit).toBeCloseTo(7, 10);
  });

  it('agrees with the tabulated D3/D4 range limits', () => {
    // R chart limits via sigma express the same 3-sigma bounds as D3·R̄ / D4·R̄
    // (D4 = 1 + 3·d3/d2), differing only by the rounding of the published
    // constants — which is exactly why the default path keeps using them.
    const subgroupSize = 5;
    const rBar = 4.2;
    const sigma = rBar / 2.326; // R̄ / d2
    const limits = rangeLimitsFromSigma(sigma, subgroupSize);
    const tabulated = 2.114 * rBar;

    expect(limits.centerLine).toBeCloseTo(rBar, 10);
    expect(Math.abs(limits.upperControlLimit - tabulated) / tabulated).toBeLessThan(0.001);
    expect(limits.lowerControlLimit).toBe(0);
  });

  it('floors the moving range lower limit at zero', () => {
    const limits = movingRangeLimitsFromSigma(3);
    expect(limits.centerLine).toBeCloseTo(1.128 * 3, 10);
    expect(limits.lowerControlLimit).toBe(0);
  });

  it('centers S chart limits on c4·σ', () => {
    const limits = stdDevLimitsFromSigma(2, 5);
    expect(limits.centerLine).toBeCloseTo(getC4(5) * 2, 10);
    expect(limits.upperControlLimit).toBeGreaterThan(limits.centerLine);
    expect(limits.lowerControlLimit).toBeGreaterThanOrEqual(0);
  });
});

describe('getC4', () => {
  it('uses the table up to 25 and the approximation beyond it', () => {
    expect(getC4(2)).toBeCloseTo(0.7979, 4);
    expect(getC4(25)).toBeCloseTo(0.9896, 4);
    expect(getC4(40)).toBeCloseTo((4 * 40 - 4) / (4 * 40 - 3), 10);
    expect(getC4(1)).toBeNaN();
  });
});
