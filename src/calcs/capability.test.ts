import { SpcChartTyp } from 'types';
import { getC4, estimateSigmaWithin, calculateCapability } from './capability';

describe('getC4', () => {
  it('returns exact table values for n = 2..25', () => {
    expect(getC4(2)).toBe(0.7979);
    expect(getC4(5)).toBe(0.94);
    expect(getC4(25)).toBe(0.9896);
  });

  it('uses the 4(n-1)/(4n-3) approximation beyond the table', () => {
    expect(getC4(26)).toBeCloseTo(100 / 101, 10);
    // approaches 1 for large n
    expect(getC4(1000)).toBeGreaterThan(0.999);
    expect(getC4(1000)).toBeLessThan(1);
  });

  it('is continuous across the table boundary', () => {
    expect(Math.abs(getC4(26) - getC4(25))).toBeLessThan(0.001);
  });

  it('is undefined below n = 2', () => {
    expect(getC4(1)).toBeNaN();
  });
});

describe('estimateSigmaWithin', () => {
  // Subgroups of 2: [1,5] [3,7] [2,8] => Rbar = 14/3, sbar = sqrt(8)
  const SUBGROUPED = [1, 5, 3, 7, 2, 8];

  it('uses Rbar/d2 for Xbar-R chart types', () => {
    const expected = 14 / 3 / 1.128;
    expect(estimateSigmaWithin(SUBGROUPED, SpcChartTyp.x_XbarR, 2)).toBeCloseTo(expected, 10);
    expect(estimateSigmaWithin(SUBGROUPED, SpcChartTyp.r_XbarR, 2)).toBeCloseTo(expected, 10);
  });

  it('uses sbar/c4 for Xbar-S chart types', () => {
    // s values: sqrt(8), sqrt(8), sqrt(18) => sbar = (2*sqrt(8) + sqrt(18)) / 3
    const expected = (2 * Math.sqrt(8) + Math.sqrt(18)) / 3 / 0.7979;
    expect(estimateSigmaWithin(SUBGROUPED, SpcChartTyp.x_XbarS, 2)).toBeCloseTo(expected, 10);
    expect(estimateSigmaWithin(SUBGROUPED, SpcChartTyp.s_XbarS, 2)).toBeCloseTo(expected, 10);
  });

  it('uses the average moving range for XmR chart types', () => {
    // [10,12,11,15,13]: moving ranges [2,1,4,2] => mRbar = 2.25
    const expected = 2.25 / 1.128;
    expect(estimateSigmaWithin([10, 12, 11, 15, 13], SpcChartTyp.x_XmR, 1)).toBeCloseTo(expected, 10);
    expect(estimateSigmaWithin([10, 12, 11, 15, 13], SpcChartTyp.mR_XmR, 1)).toBeCloseTo(expected, 10);
  });

  it('ignores a partial trailing subgroup in Rbar', () => {
    // [1,5] [3,7] [2] => Rbar from complete subgroups = 4
    expect(estimateSigmaWithin([1, 5, 3, 7, 2], SpcChartTyp.x_XbarR, 2)).toBeCloseTo(4 / 1.128, 10);
  });

  it('defaults to the average moving range for individuals without a chart', () => {
    // [1,2,3,4,5]: moving ranges all 1 => mRbar = 1
    expect(estimateSigmaWithin([1, 2, 3, 4, 5], SpcChartTyp.none, 1)).toBeCloseTo(1 / 1.128, 10);
  });

  it('defaults to the pooled standard deviation for subgrouped data without a chart', () => {
    // Subgroups of 3: [1,2,3] (s^2 = 1) and [4,6,8] (s^2 = 4)
    // Sp = sqrt((2*1 + 2*4) / 4) = sqrt(2.5), d = 4, c4(5) = 0.94
    const expected = Math.sqrt(2.5) / 0.94;
    expect(estimateSigmaWithin([1, 2, 3, 4, 6, 8], SpcChartTyp.none, 3)).toBeCloseTo(expected, 10);
  });

  it('includes partial subgroups with at least two values in the pooled estimate', () => {
    // Subgroups of 3: [1,2,3] (s^2 = 1, df 2) and [4,6] (s^2 = 2, df 1)
    // Sp = sqrt((2*1 + 1*2) / 3) = sqrt(4/3), d = 3, c4(4) = 0.9213
    const expected = Math.sqrt(4 / 3) / 0.9213;
    expect(estimateSigmaWithin([1, 2, 3, 4, 6], SpcChartTyp.none, 3)).toBeCloseTo(expected, 10);
  });

  it('returns null when the estimate is undefined', () => {
    expect(estimateSigmaWithin([], SpcChartTyp.none, 1)).toBeNull();
    expect(estimateSigmaWithin([5], SpcChartTyp.none, 1)).toBeNull();
    expect(estimateSigmaWithin([5], SpcChartTyp.none, 3)).toBeNull();
    expect(estimateSigmaWithin([5], SpcChartTyp.x_XmR, 1)).toBeNull();
    expect(estimateSigmaWithin([1], SpcChartTyp.x_XbarR, 2)).toBeNull();
  });
});

describe('calculateCapability', () => {
  it('computes Cp/Cpk from within sigma and Pp/Ppk from overall sigma', () => {
    // centered process: mean 0, LSL -3, USL 3, sigma within 1, sigma overall 2
    const { cp, cpk, pp, ppk } = calculateCapability(0, 1, 2, -3, 3);

    expect(cp).toBeCloseTo(1, 10);
    expect(cpk).toBeCloseTo(1, 10);
    expect(pp).toBeCloseTo(0.5, 10);
    expect(ppk).toBeCloseTo(0.5, 10);
  });

  it('Cpk reflects an off-center process', () => {
    // mean 1: (3-1)/(3*1) = 2/3 is the nearer side
    const { cp, cpk } = calculateCapability(1, 1, 1, -3, 3);

    expect(cp).toBeCloseTo(1, 10);
    expect(cpk).toBeCloseTo(2 / 3, 10);
  });

  it('returns all nulls when mean or a spec limit is missing', () => {
    expect(calculateCapability(null, 1, 1, -3, 3)).toEqual({ cp: null, cpk: null, pp: null, ppk: null });
    expect(calculateCapability(0, 1, 1, null, 3)).toEqual({ cp: null, cpk: null, pp: null, ppk: null });
    expect(calculateCapability(0, 1, 1, -3, null)).toEqual({ cp: null, cpk: null, pp: null, ppk: null });
  });

  it('computes only the indices whose sigma is available and positive', () => {
    const withinOnly = calculateCapability(0, 1, null, -3, 3);
    expect(withinOnly.cp).toBeCloseTo(1, 10);
    expect(withinOnly.pp).toBeNull();

    const overallOnly = calculateCapability(0, null, 1, -3, 3);
    expect(overallOnly.cp).toBeNull();
    expect(overallOnly.pp).toBeCloseTo(1, 10);

    const zeroSigma = calculateCapability(0, 0, 0, -3, 3);
    expect(zeroSigma).toEqual({ cp: null, cpk: null, pp: null, ppk: null });
  });
});
