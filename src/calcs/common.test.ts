import {
  chunkArray,
  calculateSampleStandardDeviation,
  calculateMovingRanges,
  calculateNumericRange,
} from './common';

describe('chunkArray', () => {
  it('splits an array into subgroups of the given size', () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('keeps the partial trailing subgroup', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single subgroup when size exceeds the array length', () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkArray([], 3)).toEqual([]);
  });
});

describe('calculateSampleStandardDeviation', () => {
  it('computes the sample (n-1) standard deviation', () => {
    // mean 4, squared deviations 4+0+4 = 8, 8/(3-1) = 4, sqrt = 2
    expect(calculateSampleStandardDeviation([2, 4, 6])).toBeCloseTo(2, 10);
  });

  it('matches a hand-computed value for a pair', () => {
    // mean 3, squared deviations 4+4 = 8, 8/1 = 8, sqrt(8)
    expect(calculateSampleStandardDeviation([1, 5])).toBeCloseTo(Math.sqrt(8), 10);
  });

  it('returns 0 for constant data', () => {
    expect(calculateSampleStandardDeviation([7, 7, 7, 7])).toBe(0);
  });

  it('is undefined (NaN) for fewer than two values', () => {
    expect(calculateSampleStandardDeviation([5])).toBeNaN();
    expect(calculateSampleStandardDeviation([])).toBeNaN();
  });
});

describe('calculateMovingRanges', () => {
  it('computes absolute differences of consecutive values', () => {
    expect(calculateMovingRanges([3, 1, 4, 1, 5])).toEqual([2, 3, 3, 4]);
  });

  it('returns an empty array for fewer than two values', () => {
    expect(calculateMovingRanges([42])).toEqual([]);
    expect(calculateMovingRanges([])).toEqual([]);
  });
});

describe('calculateNumericRange', () => {
  it('returns min, max and delta', () => {
    expect(calculateNumericRange([4, -2, 9, 0])).toEqual({ min: -2, max: 9, delta: 11 });
  });

  it('returns zeros for empty input', () => {
    expect(calculateNumericRange([])).toEqual({ min: 0, max: 0, delta: 0 });
  });

  it('returns zero delta for a single value', () => {
    expect(calculateNumericRange([5])).toEqual({ min: 5, max: 5, delta: 0 });
  });
});
