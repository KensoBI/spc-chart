import { createXbarChartForXbarS, createSChartForXbarS } from './xbars';

// Subgroups of 2: [1,5] [3,7] => means [3, 5], s values [sqrt(8), sqrt(8)]
// grand mean = 4, sbar = sqrt(8), A3(2) = 2.659, B3(2) = 0, B4(2) = 3.267
const DATA = [1, 5, 3, 7];
const SBAR = Math.sqrt(8);

describe('createXbarChartForXbarS', () => {
  it('computes the grand mean and A3-based control limits', () => {
    const chart = createXbarChartForXbarS(DATA, 2)!;

    expect(chart.centerLine).toBeCloseTo(4, 10);
    expect(chart.upperControlLimit).toBeCloseTo(4 + 2.659 * SBAR, 10);
    expect(chart.lowerControlLimit).toBeCloseTo(4 - 2.659 * SBAR, 10);
  });

  it('plots the subgroup means', () => {
    expect(createXbarChartForXbarS(DATA, 2)!.data).toEqual([3, 5]);
  });

  it('estimates the limits from complete subgroups only', () => {
    // [1,5] [3,7] [2] — the trailing single value is plotted but must not skew the limits.
    const chart = createXbarChartForXbarS([1, 5, 3, 7, 2], 2)!;

    expect(chart.data).toEqual([3, 5, 2]);
    expect(chart.centerLine).toBeCloseTo(4, 10);
    expect(chart.upperControlLimit).toBeCloseTo(4 + 2.659 * SBAR, 10);
  });

  it('returns null when no complete subgroup exists', () => {
    expect(createXbarChartForXbarS([1], 2)).toBeNull();
    expect(createXbarChartForXbarS([], 2)).toBeNull();
  });

  it('rejects subgroup sizes outside 2..25', () => {
    expect(() => createXbarChartForXbarS(DATA, 1)).toThrow();
    expect(() => createXbarChartForXbarS(DATA, 26)).toThrow();
  });
});

describe('createSChartForXbarS', () => {
  it('computes sbar and B3/B4-based control limits', () => {
    const chart = createSChartForXbarS(DATA, 2)!;

    expect(chart.centerLine).toBeCloseTo(SBAR, 10);
    // B4(2) = 3.267
    expect(chart.upperControlLimit).toBeCloseTo(3.267 * SBAR, 10);
    // B3(2) = 0 — a lower limit of A3(2) * sbar = 7.52 would be the old constant-lookup bug.
    expect(chart.lowerControlLimit).toBe(0);
  });

  it('uses a non-zero B3 lower limit for subgroup sizes of 6 and above', () => {
    // Subgroups of 6: [1..6] (s = sqrt(3.5)) and [2,4,..,12] (s = sqrt(14))
    const data = [1, 2, 3, 4, 5, 6, 2, 4, 6, 8, 10, 12];
    const sbar = (Math.sqrt(3.5) + Math.sqrt(14)) / 2;
    const chart = createSChartForXbarS(data, 6)!;

    expect(chart.centerLine).toBeCloseTo(sbar, 10);
    // B3(6) = 0.03, B4(6) = 1.97
    expect(chart.lowerControlLimit).toBeCloseTo(0.03 * sbar, 10);
    expect(chart.upperControlLimit).toBeCloseTo(1.97 * sbar, 10);
  });

  it('plots the subgroup standard deviations', () => {
    const chart = createSChartForXbarS(DATA, 2)!;
    expect(chart.data).toHaveLength(2);
    expect(chart.data[0]).toBeCloseTo(SBAR, 10);
    expect(chart.data[1]).toBeCloseTo(SBAR, 10);
  });

  it('estimates the limits from complete subgroups only', () => {
    const chart = createSChartForXbarS([1, 5, 3, 7, 2], 2)!;

    expect(chart.data).toHaveLength(2);
    expect(chart.centerLine).toBeCloseTo(SBAR, 10);
  });

  it('returns null when no complete subgroup exists', () => {
    expect(createSChartForXbarS([1], 2)).toBeNull();
    expect(createSChartForXbarS([], 2)).toBeNull();
  });
});
