import { createXbarChartForXbarR, createRChartForXbarR } from './xbarr';

// Subgroups of 2: [1,5] [3,7] [2,8] => means [3, 5, 5], ranges [4, 4, 6]
// grand mean = 13/3, Rbar = 14/3, A2(2) = 1.88, D3(2) = 0, D4(2) = 3.267
const DATA = [1, 5, 3, 7, 2, 8];

describe('createXbarChartForXbarR', () => {
  it('computes the grand mean and A2-based control limits', () => {
    const chart = createXbarChartForXbarR(DATA, 2)!;

    expect(chart.centerLine).toBeCloseTo(13 / 3, 10);
    expect(chart.upperControlLimit).toBeCloseTo(13 / 3 + 1.88 * (14 / 3), 10);
    expect(chart.lowerControlLimit).toBeCloseTo(13 / 3 - 1.88 * (14 / 3), 10);
  });

  it('plots the subgroup means', () => {
    expect(createXbarChartForXbarR(DATA, 2)!.data).toEqual([3, 5, 5]);
  });

  it('estimates the limits from complete subgroups only', () => {
    // [1,5] [3,7] [2] — the trailing single value is plotted but must not skew the limits.
    const chart = createXbarChartForXbarR([1, 5, 3, 7, 2], 2)!;

    expect(chart.data).toEqual([3, 5, 2]);
    // complete subgroups: means [3, 5] => grand mean 4; ranges [4, 4] => Rbar 4
    expect(chart.centerLine).toBeCloseTo(4, 10);
    expect(chart.upperControlLimit).toBeCloseTo(4 + 1.88 * 4, 10);
    expect(chart.lowerControlLimit).toBeCloseTo(4 - 1.88 * 4, 10);
  });

  it('returns null when no complete subgroup exists', () => {
    expect(createXbarChartForXbarR([1], 2)).toBeNull();
    expect(createXbarChartForXbarR([], 2)).toBeNull();
    expect(createXbarChartForXbarR([1, 2, 3], 5)).toBeNull();
  });

  it('rejects subgroup sizes outside 2..25', () => {
    expect(() => createXbarChartForXbarR(DATA, 1)).toThrow();
    expect(() => createXbarChartForXbarR(DATA, 26)).toThrow();
  });
});

describe('createRChartForXbarR', () => {
  it('computes Rbar and D3/D4-based control limits', () => {
    const chart = createRChartForXbarR(DATA, 2)!;

    expect(chart.centerLine).toBeCloseTo(14 / 3, 10);
    expect(chart.upperControlLimit).toBeCloseTo(3.267 * (14 / 3), 10);
    expect(chart.lowerControlLimit).toBe(0);
  });

  it('uses a non-zero D3 lower limit for subgroup sizes of 7 and above', () => {
    // one subgroup of 7: range 6, D3(7) = 0.076, D4(7) = 1.924
    const chart = createRChartForXbarR([1, 2, 3, 4, 5, 6, 7], 7)!;

    expect(chart.centerLine).toBeCloseTo(6, 10);
    expect(chart.lowerControlLimit).toBeCloseTo(0.076 * 6, 10);
    expect(chart.upperControlLimit).toBeCloseTo(1.924 * 6, 10);
  });

  it('plots the subgroup ranges', () => {
    expect(createRChartForXbarR(DATA, 2)!.data).toEqual([4, 4, 6]);
  });

  it('estimates the limits from complete subgroups only', () => {
    // [1,5] [3,7] [2] — singleton is not plottable as a range and must not skew Rbar.
    const chart = createRChartForXbarR([1, 5, 3, 7, 2], 2)!;

    expect(chart.data).toEqual([4, 4]);
    expect(chart.centerLine).toBeCloseTo(4, 10);
    expect(chart.upperControlLimit).toBeCloseTo(3.267 * 4, 10);
  });

  it('returns null when no complete subgroup exists', () => {
    expect(createRChartForXbarR([1], 2)).toBeNull();
    expect(createRChartForXbarR([], 2)).toBeNull();
  });
});
