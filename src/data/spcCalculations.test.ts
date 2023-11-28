import { calcMin, calcMax, calcRange, calcMean, stdDev, calcLcl } from './spcCalculations';

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
