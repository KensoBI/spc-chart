import { ControlChartConstants, ControlChartConstantLookupTable, getControlChartConstant } from './calcConst';

describe('getControlChartConstant', () => {
  it('returns the requested constant for a given subgroup size', () => {
    expect(getControlChartConstant(2, ControlChartConstants.d2_xbar_range)).toBe(1.128);
    expect(getControlChartConstant(5, ControlChartConstants.a2_xbar_limit_range)).toBe(0.577);
    expect(getControlChartConstant(6, ControlChartConstants.b3_sigma_lcl)).toBe(0.03);
    expect(getControlChartConstant(7, ControlChartConstants.d3_range_lcl)).toBe(0.076);
  });
});

describe('control chart constants table', () => {
  it('covers subgroup sizes 2 through 25 with 9 constants each', () => {
    for (let n = 2; n <= 25; n++) {
      expect(ControlChartConstantLookupTable[n]).toHaveLength(9);
    }
  });

  // Published values from standard SPC tables (ASTM STP 15D / Montgomery,
  // "Introduction to Statistical Quality Control", appendix VI).
  it.each([
    // n, c4, d2, d3, A2, A3, B3, B4, D3, D4
    [2, 0.7979, 1.128, 0.853, 1.88, 2.659, 0.0, 3.267, 0.0, 3.267],
    [5, 0.94, 2.326, 0.864, 0.577, 1.427, 0.0, 2.089, 0.0, 2.114],
    [10, 0.9727, 3.078, 0.797, 0.308, 0.975, 0.284, 1.716, 0.223, 1.777],
    [25, 0.9896, 3.931, 0.708, 0.153, 0.606, 0.565, 1.435, 0.459, 1.541],
  ])('matches the published table row for n=%i', (n, c4, d2, d3, a2, a3, b3, b4, D3, D4) => {
    expect(getControlChartConstant(n, ControlChartConstants.C4_xbar_sigma)).toBe(c4);
    expect(getControlChartConstant(n, ControlChartConstants.d2_xbar_range)).toBe(d2);
    expect(getControlChartConstant(n, ControlChartConstants.d3_range_limit)).toBe(d3);
    expect(getControlChartConstant(n, ControlChartConstants.a2_xbar_limit_range)).toBe(a2);
    expect(getControlChartConstant(n, ControlChartConstants.a3_xbar_limit_sigma)).toBe(a3);
    expect(getControlChartConstant(n, ControlChartConstants.b3_sigma_lcl)).toBe(b3);
    expect(getControlChartConstant(n, ControlChartConstants.b4_sigma_ucl)).toBe(b4);
    expect(getControlChartConstant(n, ControlChartConstants.d3_range_lcl)).toBe(D3);
    expect(getControlChartConstant(n, ControlChartConstants.d4_range_ucl)).toBe(D4);
  });

  // The derived constants are defined in terms of c4, d2 and d3. Verify every row of the
  // table is internally consistent with those definitions (published values are rounded to
  // three decimals, hence the tolerance).
  const TOLERANCE = 0.005;

  it('satisfies A2 = 3 / (d2 * sqrt(n)) for every n', () => {
    for (let n = 2; n <= 25; n++) {
      const d2 = getControlChartConstant(n, ControlChartConstants.d2_xbar_range);
      const a2 = getControlChartConstant(n, ControlChartConstants.a2_xbar_limit_range);
      expect(Math.abs(a2 - 3 / (d2 * Math.sqrt(n)))).toBeLessThan(TOLERANCE);
    }
  });

  it('satisfies A3 = 3 / (c4 * sqrt(n)) for every n', () => {
    for (let n = 2; n <= 25; n++) {
      const c4 = getControlChartConstant(n, ControlChartConstants.C4_xbar_sigma);
      const a3 = getControlChartConstant(n, ControlChartConstants.a3_xbar_limit_sigma);
      expect(Math.abs(a3 - 3 / (c4 * Math.sqrt(n)))).toBeLessThan(TOLERANCE);
    }
  });

  it('satisfies B3 = max(0, 1 - 3*sqrt(1-c4^2)/c4) and B4 = 1 + 3*sqrt(1-c4^2)/c4 for every n', () => {
    for (let n = 2; n <= 25; n++) {
      const c4 = getControlChartConstant(n, ControlChartConstants.C4_xbar_sigma);
      const b3 = getControlChartConstant(n, ControlChartConstants.b3_sigma_lcl);
      const b4 = getControlChartConstant(n, ControlChartConstants.b4_sigma_ucl);
      const term = (3 * Math.sqrt(1 - c4 * c4)) / c4;
      expect(Math.abs(b3 - Math.max(0, 1 - term))).toBeLessThan(TOLERANCE);
      expect(Math.abs(b4 - (1 + term))).toBeLessThan(TOLERANCE);
    }
  });

  it('satisfies D3 = max(0, 1 - 3*d3/d2) and D4 = 1 + 3*d3/d2 for every n', () => {
    for (let n = 2; n <= 25; n++) {
      const d2 = getControlChartConstant(n, ControlChartConstants.d2_xbar_range);
      const d3 = getControlChartConstant(n, ControlChartConstants.d3_range_limit);
      const D3 = getControlChartConstant(n, ControlChartConstants.d3_range_lcl);
      const D4 = getControlChartConstant(n, ControlChartConstants.d4_range_ucl);
      const term = (3 * d3) / d2;
      expect(Math.abs(D3 - Math.max(0, 1 - term))).toBeLessThan(TOLERANCE);
      expect(Math.abs(D4 - (1 + term))).toBeLessThan(TOLERANCE);
    }
  });

  it('has monotonically increasing d2 and c4, and decreasing A2 and A3', () => {
    for (let n = 3; n <= 25; n++) {
      expect(getControlChartConstant(n, ControlChartConstants.d2_xbar_range)).toBeGreaterThan(
        getControlChartConstant(n - 1, ControlChartConstants.d2_xbar_range)
      );
      expect(getControlChartConstant(n, ControlChartConstants.C4_xbar_sigma)).toBeGreaterThan(
        getControlChartConstant(n - 1, ControlChartConstants.C4_xbar_sigma)
      );
      expect(getControlChartConstant(n, ControlChartConstants.a2_xbar_limit_range)).toBeLessThan(
        getControlChartConstant(n - 1, ControlChartConstants.a2_xbar_limit_range)
      );
      expect(getControlChartConstant(n, ControlChartConstants.a3_xbar_limit_sigma)).toBeLessThan(
        getControlChartConstant(n - 1, ControlChartConstants.a3_xbar_limit_sigma)
      );
    }
  });
});
