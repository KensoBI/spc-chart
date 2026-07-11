import { createXChartXmR, createMRChartXmR } from './xmr';

// data: mean = 12.2, moving ranges [2, 1, 4, 2] => mRbar = 2.25
const DATA = [10, 12, 11, 15, 13];

describe('createXChartXmR (individuals chart)', () => {
  it('computes the center line and E2-based control limits', () => {
    const chart = createXChartXmR(DATA)!;

    expect(chart.centerLine).toBeCloseTo(12.2, 10);
    // xbar ± 2.66 * mRbar = 12.2 ± 2.66 * 2.25 = 12.2 ± 5.985
    expect(chart.upperControlLimit).toBeCloseTo(18.185, 10);
    expect(chart.lowerControlLimit).toBeCloseTo(6.215, 10);
  });

  it('plots the raw individual values', () => {
    expect(createXChartXmR(DATA)!.data).toEqual(DATA);
  });

  it('returns null when there are fewer than two observations', () => {
    expect(createXChartXmR([5])).toBeNull();
    expect(createXChartXmR([])).toBeNull();
  });
});

describe('createMRChartXmR (moving range chart)', () => {
  it('computes the center line and D3/D4-based control limits', () => {
    const chart = createMRChartXmR(DATA)!;

    expect(chart.centerLine).toBeCloseTo(2.25, 10);
    // D4(n=2) * mRbar = 3.267 * 2.25
    expect(chart.upperControlLimit).toBeCloseTo(7.35075, 10);
    // D3(n=2) = 0
    expect(chart.lowerControlLimit).toBe(0);
  });

  it('plots the moving ranges', () => {
    expect(createMRChartXmR(DATA)!.data).toEqual([2, 1, 4, 2]);
  });

  it('returns null when there are fewer than two observations', () => {
    expect(createMRChartXmR([5])).toBeNull();
    expect(createMRChartXmR([])).toBeNull();
  });
});
