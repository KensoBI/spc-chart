import { Field, FieldType } from '@grafana/data';
import { SpcChartTyp } from 'types';
import { calculateStandardStats, calculateControlCharts } from './standard';

function makeField(values: unknown[], type: FieldType = FieldType.number): Field {
  return { name: 'value', type, values, config: {} } as Field;
}

describe('calculateStandardStats', () => {
  it('computes all standard statistics for clean numeric data', () => {
    const calcs = calculateStandardStats(makeField([1, 2, 3, 4, 5]));

    expect(calcs.count).toBe(5);
    expect(calcs.sum).toBe(15);
    expect(calcs.mean).toBe(3);
    expect(calcs.min).toBe(1);
    expect(calcs.max).toBe(5);
    expect(calcs.first).toBe(1);
    expect(calcs.last).toBe(5);
    expect(calcs.range).toBe(4);
    expect(calcs.diff).toBe(4);
    expect(calcs.diffperc).toBe(4);
    // sample standard deviation of 1..5 = sqrt(2.5)
    expect(calcs.stdDev).toBeCloseTo(Math.sqrt(2.5), 10);
  });

  it('ignores null and NaN values in every statistic, including stdDev', () => {
    const calcs = calculateStandardStats(makeField([null, 2, 4, null, 6, NaN]));

    expect(calcs.count).toBe(3);
    expect(calcs.mean).toBe(4);
    expect(calcs.first).toBe(2);
    expect(calcs.last).toBe(6);
    expect(calcs.min).toBe(2);
    expect(calcs.max).toBe(6);
    // sample standard deviation of [2, 4, 6] = 2; nulls must not be coerced to zeros
    expect(calcs.stdDev).toBeCloseTo(2, 10);
  });

  it('reports a null stdDev when fewer than two valid values exist', () => {
    expect(calculateStandardStats(makeField([7])).stdDev).toBeNull();
    expect(calculateStandardStats(makeField([null, 7, NaN])).stdDev).toBeNull();
  });

  it('returns empty stats for non-numeric fields', () => {
    const calcs = calculateStandardStats(makeField(['a', 'b'], FieldType.string));

    expect(calcs.count).toBe(0);
    expect(calcs.mean).toBeNull();
    expect(calcs.min).toBeNull();
    expect(calcs.max).toBeNull();
  });
});

describe('calculateControlCharts', () => {
  const values = [10, 12, 11, 15, 13];

  it('routes to the XmR individuals chart', () => {
    const chart = calculateControlCharts(makeField(values), SpcChartTyp.x_XmR, 1)!;

    expect(chart.centerLine).toBeCloseTo(12.2, 10);
    expect(chart.data).toEqual(values);
  });

  it('routes to the moving range chart', () => {
    const chart = calculateControlCharts(makeField(values), SpcChartTyp.mR_XmR, 1)!;

    expect(chart.data).toEqual([2, 1, 4, 2]);
  });

  it('filters out null and NaN values before charting', () => {
    const chart = calculateControlCharts(makeField([1, null, 3, NaN]), SpcChartTyp.x_XmR, 1)!;

    // effective data [1, 3]: mean 2, mRbar 2 => limits 2 ± 2.66 * 2
    expect(chart.centerLine).toBeCloseTo(2, 10);
    expect(chart.upperControlLimit).toBeCloseTo(7.32, 10);
    expect(chart.lowerControlLimit).toBeCloseTo(-3.32, 10);
  });

  it('rejects invalid subgroup sizes for Xbar charts', () => {
    expect(calculateControlCharts(makeField(values), SpcChartTyp.x_XbarR, 1)).toBeNull();
    expect(calculateControlCharts(makeField(values), SpcChartTyp.x_XbarR, 26)).toBeNull();
    expect(calculateControlCharts(makeField(values), SpcChartTyp.s_XbarS, 1)).toBeNull();
  });

  it('routes to the Xbar-R chart with subgrouping', () => {
    const chart = calculateControlCharts(makeField([1, 5, 3, 7, 2, 8]), SpcChartTyp.x_XbarR, 2)!;

    expect(chart.data).toEqual([3, 5, 5]);
    expect(chart.centerLine).toBeCloseTo(13 / 3, 10);
  });

  it('returns null for chart type none', () => {
    expect(calculateControlCharts(makeField(values), SpcChartTyp.none, 2)).toBeNull();
  });

  it('returns null when there is not enough data for the chart', () => {
    expect(calculateControlCharts(makeField([5]), SpcChartTyp.x_XmR, 1)).toBeNull();
    expect(calculateControlCharts(makeField([5]), SpcChartTyp.x_XbarR, 2)).toBeNull();
    expect(calculateControlCharts(makeField([]), SpcChartTyp.s_XbarS, 2)).toBeNull();
  });
});
