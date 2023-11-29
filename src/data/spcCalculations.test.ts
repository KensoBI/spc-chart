import {
  calcMin,
  calcMax,
  calcRange,
  calcMean,
  stdDev,
  calcLcl,
  calcValueSampleSize,
  calcUcl,
  calculateGroupedAverage,
  calculateGroupedDifference,
  calculateGroupedStdDev,
} from './spcCalculations';

describe('calcMin', () => {
  it('should return the minimum value in the array', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcMin(field)).toBe(1);
  });
});

describe('calcMax', () => {
  it('should return the maximum value in the array', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcMax(field)).toBe(5);
  });
});

describe('calcRange', () => {
  it('should return the range of the array', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcRange(field)).toBe(4);
  });
});

describe('calcMean', () => {
  it('should return the mean of the array', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcMean(field)).toBe(3);
  });
});

describe('stdDev', () => {
  it('should return the standard deviation of the array', () => {
    const field = [1, 2, 3, 4, 5];
    expect(stdDev(field, calcMean(field))).toBe(1.4142135623730951);
  });
});

//10, 11, 10, 10, 9, 10, 11, 10, 12, 10, 11, 10, 12, 11, 11, 10, 9, 11, 12, 10, 9, 11, 10, 10, 11

describe('calcLcl-range', () => {
  it('should return the lower control limit of the array (range aggregation)', () => {
    const field = [1, 2, 3, 4, 5];
    //range LCL should be 0 up to sampleSize 6
    expect(calcLcl(field, 'range', 2)?.[0]).toBe(0.0);
    expect(calcLcl(field, 'range', 3)?.[0]).toBe(0.0);
    expect(calcLcl(field, 'range', 4)?.[0]).toBe(0.0);
    expect(calcLcl(field, 'range', 5)?.[0]).toBe(0.0);
    expect(calcLcl(field, 'range', 6)?.[0]).toBe(0.0);
    expect(calcLcl(field, 'range', 7)?.[0]).toBe(0.304);
    expect(calcLcl(field, 'range', 8)?.[0]).toBe(0.544);
  });
});

describe('calcLcl-mean', () => {
  it('should return the lower control limit of the array (mean aggregation)', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcLcl(field, 'mean', 2)).toStrictEqual([-4.52, -0.7603938623500599]);
  });
});

describe('calcLcl-mean', () => {
  it('should return the lower control limit of the array (standardDeviation aggregation)', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcLcl(field, 'standardDeviation', 2)?.[0]).toBe(4.620235708272902);
  });
});

describe('calculateGroupedAverage', () => {
  it('should return the average of the grouped array', () => {
    expect(calculateGroupedAverage([1, 2, 3, 4, 5], 2)).toStrictEqual([1, 2.5, 4.5]);
    expect(calculateGroupedAverage([1, 2], 2)).toStrictEqual([1.5]);
    expect(calculateGroupedAverage([1], 2)).toStrictEqual([1]);
    expect(calculateGroupedAverage([], 2)).toStrictEqual([]);

    expect(calculateGroupedAverage([1, 2, 2, 2, 3, 3, 3, 4, 4, 4], 3)).toStrictEqual([1, 2, 3, 4]);
    expect(calculateGroupedAverage([1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4], 4)).toStrictEqual([1, 2, 3, 4]);
  });
});

describe('calculateGroupedDifference', () => {
  it('should return the difference of the grouped array', () => {
    expect(calculateGroupedDifference([1, 2, 3, 4, 5], 2)).toStrictEqual([0, 1, 1]);
    expect(calculateGroupedDifference([1, 2], 2)).toStrictEqual([1]);
    expect(calculateGroupedDifference([1], 2)).toStrictEqual([0]);
    expect(calculateGroupedDifference([], 2)).toStrictEqual([]);

    expect(calculateGroupedDifference([1, 2, 2, 2, 3, 3, 3, 4, 4, 4], 3)).toStrictEqual([0, 0, 0, 0]);
    expect(calculateGroupedDifference([1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4], 4)).toStrictEqual([0, 0, 0, 0]);
  });
});

describe('calculateGroupedStdDev', () => {
  it('should return the standard deviation of the grouped array', () => {
    expect(calculateGroupedStdDev([1, 2, 3, 4, 5], 2)).toStrictEqual([0, 0.5, 0.5]);
    expect(calculateGroupedStdDev([1, 2], 2)).toStrictEqual([0.5]);
    expect(calculateGroupedStdDev([1], 2)).toStrictEqual([0]);
    expect(calculateGroupedStdDev([], 2)).toStrictEqual([]);

    expect(calculateGroupedStdDev([1, 1, 2, 3, 1, 2, 3, 1, 2, 3], 3)).toStrictEqual([
      0, 0.816496580927726, 0.816496580927726, 0.816496580927726,
    ]);
    expect(calculateGroupedStdDev([1, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4], 4)).toStrictEqual([
      0, 1.118033988749895, 1.118033988749895, 1.118033988749895,
    ]);
  });
});

describe('calcUcl-range', () => {
  it('should return upper control limit of the array (range aggregation)', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcUcl(field, 'range', 2)?.[0]).toBe(13.068);
    expect(calcUcl(field, 'range', 3)?.[0]).toBe(10.296);
    expect(calcUcl(field, 'range', 4)?.[0]).toBe(9.128);
  });
});

describe('calcUcl-mean', () => {
  it('should return the upper control limit of the array (mean aggregation)', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcLcl(field, 'mean', 2)).toStrictEqual([-4.52, -0.7603938623500599]);
    expect(calcLcl(field, 'mean', 7)).toStrictEqual([1.324, 1.3283995692750017]);
  });
});

describe('calcUcl-stdDev', () => {
  it('should return the upper control limit of the array (standardDeviation aggregation)', () => {
    const field = [1, 2, 3, 4, 5];
    expect(calcLcl(field, 'standardDeviation', 2)?.[0]).toBe(4.620235708272902);
    expect(calcLcl(field, 'standardDeviation', 8)?.[0]).toBe(2.5667976157071677);
  });
});

describe('calcValueSampleSize-range', () => {
  it('should return a new vector with aggregated values (range aggregation)', () => {
    const field = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(calcValueSampleSize(field, 2, 'range')).toStrictEqual([0, 1, 1, 1, 1]);
    expect(calcValueSampleSize(field, 5, 'range')).toStrictEqual([3, 4]);
  });
});
describe('calcValueSampleSize-mean', () => {
  it('should return a new vector with aggregated values (mean aggregation)', () => {
    const field = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(calcValueSampleSize(field, 2, 'mean')).toStrictEqual([1, 2.5, 4.5, 6.5, 8.5]);
    expect(calcValueSampleSize(field, 6, 'mean')).toStrictEqual([2, 6.5]);
  });
});
describe('calcValueSampleSize-stdDev', () => {
  it('should return a new vector with aggregated values (standardDeviation aggregation)', () => {
    const field = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(calcValueSampleSize(field, 2, 'standardDeviation')).toStrictEqual([0, 0.5, 0.5, 0.5, 0.5]);
    expect(calcValueSampleSize(field, 7, 'standardDeviation')).toStrictEqual([0.5, 2]);
  });
});