import { toDataFrame, FieldType } from '@grafana/data';
import { Options, ControlLine } from 'panelcfg';
import { ControlLineReducerId } from 'data/spcReducers';
import { SpcChartTyp, PositionInput, AggregationType } from 'types';
import { calculateSeriesStatistics } from './calculateCapabilityIndices';

// Data series: five values with mean 3 and overall (sample) std dev sqrt(2.5) ≈ 1.581139.
// Moving ranges are all 1, so sigma-within = mRbar/d2 = 1/1.128 (Minitab individuals default).
const DATA_VALUES = [1, 2, 3, 4, 5];
const SIGMA_OVERALL = Math.sqrt(2.5);
const SIGMA_WITHIN = 1 / 1.128;

function makeOptions(controlLines: ControlLine[], featureQueryRefIds: string[] = []): Options {
  return {
    chartType: SpcChartTyp.none,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    controlLines,
    curves: [],
    featureQueryRefIds,
  } as unknown as Options;
}

function makeControlLine(overrides: Partial<ControlLine>): ControlLine {
  return {
    name: 'limit',
    field: '',
    positionInput: PositionInput.static,
    seriesIndex: 0,
    lineWidth: 4,
    lineColor: '#000',
    fillDirection: 0,
    fillOpacity: 10,
    reducerId: ControlLineReducerId.lsl,
    ...overrides,
  };
}

const dataFrame = toDataFrame({
  refId: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
    { name: 'value', type: FieldType.number, values: DATA_VALUES },
  ],
});

// Feature frame carrying the spec limits as fields, mirroring provisioning/dashboards.
const featureFrame = toDataFrame({
  refId: 'A',
  fields: [
    { name: 'name', type: FieldType.string, values: ['characteristic1'] },
    { name: 'usl', type: FieldType.number, values: [9] },
    { name: 'lsl', type: FieldType.number, values: [-3] },
  ],
});

describe('calculateSeriesStatistics — spec limits from a feature series', () => {
  const seriesControlLines: ControlLine[] = [
    // seriesIndex 0 → the feature frame in the full (unfiltered) array.
    makeControlLine({
      name: 'LSL',
      reducerId: ControlLineReducerId.lsl,
      positionInput: PositionInput.series,
      field: 'lsl',
      seriesIndex: 0,
    }),
    makeControlLine({
      name: 'USL',
      reducerId: ControlLineReducerId.usl,
      positionInput: PositionInput.series,
      field: 'usl',
      seriesIndex: 0,
    }),
  ];

  it('computes capability from feature-series LSL/USL when the full frame array is provided', () => {
    const options = makeOptions(seriesControlLines, ['A']);
    // Statistics run on the data-only frame; the full array (feature + data) is supplied separately.
    const stats = calculateSeriesStatistics([dataFrame], options, [featureFrame, dataFrame]);

    expect(stats).toHaveLength(1);
    // Cp/Cpk against sigma-within, Pp/Ppk against sigma-overall (Minitab convention).
    expect(stats[0].cp).toBeCloseTo(12 / (6 * SIGMA_WITHIN), 4);
    expect(stats[0].cpk).toBeCloseTo(6 / (3 * SIGMA_WITHIN), 4);
    expect(stats[0].pp).toBeCloseTo(12 / (6 * SIGMA_OVERALL), 4);
    expect(stats[0].ppk).toBeCloseTo(6 / (3 * SIGMA_OVERALL), 4);
  });

  it('reproduces the bug: without the feature frame the limits cannot be resolved and Cp/Cpk stay null', () => {
    const options = makeOptions(seriesControlLines, ['A']);
    // Old behaviour — only the filtered data frame is available for field resolution.
    const stats = calculateSeriesStatistics([dataFrame], options);

    expect(stats[0].cp).toBeNull();
    expect(stats[0].cpk).toBeNull();
  });
});

describe('calculateSeriesStatistics — static spec limits (regression)', () => {
  it('still computes capability from static LSL/USL positions', () => {
    const controlLines: ControlLine[] = [
      makeControlLine({
        name: 'LSL',
        reducerId: ControlLineReducerId.lsl,
        positionInput: PositionInput.static,
        position: -3,
        seriesIndex: 0,
      }),
      makeControlLine({
        name: 'USL',
        reducerId: ControlLineReducerId.usl,
        positionInput: PositionInput.static,
        position: 9,
        seriesIndex: 0,
      }),
    ];
    const options = makeOptions(controlLines);
    const stats = calculateSeriesStatistics([dataFrame], options);

    expect(stats[0].cp).toBeCloseTo(12 / (6 * SIGMA_WITHIN), 4);
    expect(stats[0].cpk).toBeCloseTo(6 / (3 * SIGMA_WITHIN), 4);
    expect(stats[0].pp).toBeCloseTo(12 / (6 * SIGMA_OVERALL), 4);
  });

  it('returns null capability when only one of LSL/USL is present', () => {
    const controlLines: ControlLine[] = [
      makeControlLine({
        name: 'USL',
        reducerId: ControlLineReducerId.usl,
        positionInput: PositionInput.static,
        position: 9,
        seriesIndex: 0,
      }),
    ];
    const options = makeOptions(controlLines);
    const stats = calculateSeriesStatistics([dataFrame], options);

    expect(stats[0].cp).toBeNull();
    expect(stats[0].cpk).toBeNull();
  });
});

describe('calculateSeriesStatistics — shared feature limits across multiple data series', () => {
  it('applies a single feature-series LSL/USL to every data series as a default', () => {
    const dataFrame2 = toDataFrame({
      refId: 'C',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
        { name: 'value', type: FieldType.number, values: [2, 3, 4, 5, 6] },
      ],
    });

    const controlLines: ControlLine[] = [
      makeControlLine({
        name: 'LSL',
        reducerId: ControlLineReducerId.lsl,
        positionInput: PositionInput.series,
        field: 'lsl',
        seriesIndex: 0,
      }),
      makeControlLine({
        name: 'USL',
        reducerId: ControlLineReducerId.usl,
        positionInput: PositionInput.series,
        field: 'usl',
        seriesIndex: 0,
      }),
    ];
    const options = makeOptions(controlLines, ['A']);
    const stats = calculateSeriesStatistics([dataFrame, dataFrame2], options, [featureFrame, dataFrame, dataFrame2]);

    // both series have unit moving ranges, so both get the same sigma-within
    expect(stats[0].cp).toBeCloseTo(12 / (6 * SIGMA_WITHIN), 4);
    expect(stats[1].cp).toBeCloseTo(12 / (6 * SIGMA_WITHIN), 4);
  });
});

describe('calculateSeriesStatistics — Minitab-style report from raw observations', () => {
  // Raw process data, subgrouped in twos for an Xbar-R chart:
  // [1,5] [3,7] [2,8] => plotted subgroup means [3, 5, 5], Rbar = 14/3
  const RAW_VALUES = [1, 5, 3, 7, 2, 8];
  const RAW_MEAN = 26 / 6;
  // overall sample std dev of the raw values
  const RAW_OVERALL = Math.sqrt(RAW_VALUES.reduce((s, v) => s + (v - RAW_MEAN) ** 2, 0) / (RAW_VALUES.length - 1));
  const RBAR_SIGMA = 14 / 3 / 1.128;

  const rawFrame = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
      { name: 'value', type: FieldType.number, values: RAW_VALUES },
    ],
  });

  // What doSpcCalcs produces for the x_XbarR chart: values replaced by subgroup means,
  // chart limits cached in field state.
  const plottedFrame = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'time', type: FieldType.time, values: [1.5, 3.5, 5.5] },
      { name: 'value', type: FieldType.number, values: [3, 5, 5] },
    ],
  });
  plottedFrame.fields[1].state = { calcs: { lcl: -4.44, ucl: 13.1067, mean: 13 / 3 } };

  const controlLines: ControlLine[] = [
    makeControlLine({
      name: 'LSL',
      reducerId: ControlLineReducerId.lsl,
      positionInput: PositionInput.static,
      position: -3,
      seriesIndex: 0,
    }),
    makeControlLine({
      name: 'USL',
      reducerId: ControlLineReducerId.usl,
      positionInput: PositionInput.static,
      position: 9,
      seriesIndex: 0,
    }),
  ];

  const options = {
    chartType: SpcChartTyp.x_XbarR,
    subgroupSize: 2,
    aggregationType: AggregationType.none,
    controlLines,
    curves: [],
    featureQueryRefIds: [],
  } as unknown as Options;

  it('reports n, mean, stdDev, min and max of the raw individuals, not the plotted aggregates', () => {
    const stats = calculateSeriesStatistics([plottedFrame], options, [plottedFrame], [rawFrame]);

    expect(stats[0].n).toBe(6);
    expect(stats[0].mean).toBeCloseTo(RAW_MEAN, 10);
    expect(stats[0].stdDev).toBeCloseTo(RAW_OVERALL, 10);
    expect(stats[0].min).toBe(1);
    expect(stats[0].max).toBe(8);
  });

  it('keeps the control chart limits from the plotted chart', () => {
    const stats = calculateSeriesStatistics([plottedFrame], options, [plottedFrame], [rawFrame]);

    expect(stats[0].lcl).toBeCloseTo(-4.44, 10);
    expect(stats[0].ucl).toBeCloseTo(13.1067, 10);
  });

  it('computes Cp/Cpk from Rbar/d2 of the raw subgroups and Pp/Ppk from the raw overall sigma', () => {
    const stats = calculateSeriesStatistics([plottedFrame], options, [plottedFrame], [rawFrame]);

    expect(stats[0].cp).toBeCloseTo(12 / (6 * RBAR_SIGMA), 10);
    expect(stats[0].cpk).toBeCloseTo(
      Math.min((9 - RAW_MEAN) / (3 * RBAR_SIGMA), (RAW_MEAN + 3) / (3 * RBAR_SIGMA)),
      10
    );
    expect(stats[0].pp).toBeCloseTo(12 / (6 * RAW_OVERALL), 10);
    expect(stats[0].ppk).toBeCloseTo(
      Math.min((9 - RAW_MEAN) / (3 * RAW_OVERALL), (RAW_MEAN + 3) / (3 * RAW_OVERALL)),
      10
    );
  });

  it('capability does not depend on which chart of the pair is viewed', () => {
    const rChartOptions = { ...options, chartType: SpcChartTyp.r_XbarR } as Options;
    // For the R chart the plotted values are subgroup ranges, but capability comes from raw data.
    const plottedRanges = toDataFrame({
      refId: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [4, 4, 6] },
      ],
    });

    const stats = calculateSeriesStatistics([plottedRanges], rChartOptions, [plottedRanges], [rawFrame]);

    expect(stats[0].cp).toBeCloseTo(12 / (6 * RBAR_SIGMA), 10);
    expect(stats[0].pp).toBeCloseTo(12 / (6 * RAW_OVERALL), 10);
  });
});

describe('calculateSeriesStatistics — numeric X-axis mode', () => {
  // In numeric X mode the frame carries two numeric fields: the X index (an ascending sequence)
  // and the measurement. Statistics must describe the measurement, never the X index.
  const X_INDEX = [1, 2, 3, 4, 5];
  const MEASUREMENTS = [10, 12, 11, 13, 14];
  const MEASURE_MEAN = MEASUREMENTS.reduce((s, v) => s + v, 0) / MEASUREMENTS.length;

  const numericXFrame = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'sample', type: FieldType.number, values: X_INDEX },
      { name: 'measurement', type: FieldType.number, values: MEASUREMENTS },
    ],
  });
  // doSpcCalcs caches the control-chart limits on the measurement field, not the X index field.
  numericXFrame.fields[1].state = { calcs: { lcl: 8, ucl: 16, mean: MEASURE_MEAN } };

  const options = {
    chartType: SpcChartTyp.x_XmR,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    controlLines: [],
    curves: [],
    featureQueryRefIds: [],
    xField: 'sample',
  } as unknown as Options;

  it('computes statistics from the measurement field, not the numeric X index', () => {
    const stats = calculateSeriesStatistics([numericXFrame], options, [numericXFrame], [numericXFrame]);

    expect(stats[0].seriesName).toBe('measurement');
    expect(stats[0].n).toBe(5);
    expect(stats[0].mean).toBeCloseTo(MEASURE_MEAN, 10);
    expect(stats[0].min).toBe(10);
    expect(stats[0].max).toBe(14);
    // The X index runs 1..5 — if it leaked in, min/max would be 1/5 and the mean would be 3.
    expect(stats[0].min).not.toBe(1);
  });

  it('reads control limits from the measurement field carrying the calcs', () => {
    const stats = calculateSeriesStatistics([numericXFrame], options, [numericXFrame], [numericXFrame]);

    expect(stats[0].lcl).toBe(8);
    expect(stats[0].ucl).toBe(16);
  });
});

describe('calculateSeriesStatistics — feature lookup series without featureQueryRefIds', () => {
  // A reference/lookup table (no time field) supplies LSL/USL/nominal to control lines but is not a
  // measurement series. Even when the dashboard forgets to declare it in featureQueryRefIds, its
  // numeric columns must not become statistics rows — the chart already drops it for lacking a time field.
  const featureLookup = toDataFrame({
    refId: 'A',
    fields: [
      { name: 'name', type: FieldType.string, values: ['characteristic1'] },
      { name: 'usl', type: FieldType.number, values: [5] },
      { name: 'lsl', type: FieldType.number, values: [-4] },
      { name: 'nominal', type: FieldType.number, values: [1.2] },
    ],
  });

  const measurement = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
      { name: 'B-series', type: FieldType.number, values: [0, 1, -1, 2, 0] },
    ],
  });

  it('reports only the real measurement series, not the lookup columns', () => {
    const options = makeOptions([
      makeControlLine({
        name: 'LSL',
        reducerId: ControlLineReducerId.lsl,
        positionInput: PositionInput.series,
        field: 'lsl',
        seriesIndex: 0,
      }),
      makeControlLine({
        name: 'USL',
        reducerId: ControlLineReducerId.usl,
        positionInput: PositionInput.series,
        field: 'usl',
        seriesIndex: 0,
      }),
    ]);
    // featureQueryRefIds is intentionally empty, so the feature frame is still present in `series`.
    const stats = calculateSeriesStatistics(
      [featureLookup, measurement],
      options,
      [featureLookup, measurement],
      [featureLookup, measurement]
    );

    expect(stats.map((s) => s.seriesName)).toEqual(['B-series']);
    expect(stats).toHaveLength(1);
    expect(stats[0].n).toBe(5);
  });
});

describe('calculateSeriesStatistics — multiple value fields in one frame (wide format)', () => {
  // One query returns a wide frame: a numeric X index plus two measurement columns. Each measurement
  // is plotted as its own line and must get its own statistics row.
  const PART_A = [50.2, 49.8, 51.1, 49.5, 50.8];
  const PART_B = [48.5, 49.1, 47.8, 50.3, 48.9];
  const meanOf = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

  const wideFrame = toDataFrame({
    refId: 'A',
    fields: [
      { name: 'sample', type: FieldType.number, values: [1, 2, 3, 4, 5] },
      { name: 'part_a', type: FieldType.number, values: PART_A },
      { name: 'part_b', type: FieldType.number, values: PART_B },
    ],
  });
  wideFrame.fields[1].state = { calcs: { lcl: 47, ucl: 53, mean: meanOf(PART_A) } };
  wideFrame.fields[2].state = { calcs: { lcl: 45, ucl: 52, mean: meanOf(PART_B) } };

  const options = {
    chartType: SpcChartTyp.x_XmR,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    controlLines: [],
    curves: [],
    featureQueryRefIds: [],
    xField: 'sample',
  } as unknown as Options;

  it('emits one row per value field, each with its own statistics', () => {
    const stats = calculateSeriesStatistics([wideFrame], options, [wideFrame], [wideFrame]);

    expect(stats).toHaveLength(2);
    expect(stats.map((s) => s.seriesName)).toEqual(['part_a', 'part_b']);

    expect(stats[0].mean).toBeCloseTo(meanOf(PART_A), 10);
    expect(stats[0].min).toBe(49.5);
    expect(stats[0].max).toBe(51.1);
    expect(stats[0].lcl).toBe(47);
    expect(stats[0].ucl).toBe(53);

    // part_b must use its own raw values, not part_a's — this is the field-name match, not first-field.
    expect(stats[1].mean).toBeCloseTo(meanOf(PART_B), 10);
    expect(stats[1].min).toBe(47.8);
    expect(stats[1].max).toBe(50.3);
    expect(stats[1].lcl).toBe(45);
    expect(stats[1].ucl).toBe(52);
  });
});

describe('calculateSeriesStatistics — multiple frames sharing one refId', () => {
  // A single query (one refId) can return several frames — e.g. Prometheus/Loki one frame per
  // label set, or a "Partition by values" transform. Every frame keeps the query's refId, so refId
  // is NOT a unique frame key. Each frame must yield its OWN statistics, never the first frame's.
  // Both series have unit moving ranges (sigma-within = SIGMA_WITHIN) so Cp depends only on the
  // spec tolerance — that isolates which frame's limits were picked.
  const A_VALUES = [1, 2, 3, 4, 5]; // mean 3
  const B_VALUES = [10, 11, 12, 13, 14]; // mean 12
  const meanOf = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

  // Two plotted frames that share refId 'A' (only the label differs).
  const makePlotted = (name: string, values: number[]) =>
    toDataFrame({
      refId: 'A',
      name,
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5] },
        { name: 'value', type: FieldType.number, values },
      ],
    });

  const options = {
    chartType: SpcChartTyp.x_XmR,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    controlLines: [],
    curves: [],
    featureQueryRefIds: [],
  } as unknown as Options;

  it('gives each same-refId frame its own raw statistics (not the first frame\'s)', () => {
    const plottedA = makePlotted('series=a', A_VALUES);
    const plottedB = makePlotted('series=b', B_VALUES);
    const series = [plottedA, plottedB];

    // rawSeries holds CLONES: same refId and values, different object identity — this mirrors the
    // real pipeline where doSpcCalcs rebuilds every frame, so the plotted frames never match the raw
    // frames by identity and a naive find(by refId) would resolve BOTH to the first raw frame.
    const rawSeries = [makePlotted('series=a', A_VALUES), makePlotted('series=b', B_VALUES)];

    const stats = calculateSeriesStatistics(series, options, series, rawSeries);

    expect(stats).toHaveLength(2);
    // Before the fix, stats[1] borrowed the first frame's raw data → mean 3 instead of 14.
    expect(stats[0].mean).toBeCloseTo(meanOf(A_VALUES), 10);
    expect(stats[0].min).toBe(1);
    expect(stats[0].max).toBe(5);
    expect(stats[1].mean).toBeCloseTo(meanOf(B_VALUES), 10);
    expect(stats[1].min).toBe(10);
    expect(stats[1].max).toBe(14);
  });

  it('resolves per-series spec limits by position when the full array holds same-refId clones', () => {
    // Two data frames sharing refId 'A', each with its OWN spec-limit control line addressed by the
    // frame's index in the full array. If both frames collapsed onto the first slot (naive refId
    // findIndex), the second series would pick up the first series' limits.
    const plottedA = makePlotted('series=a', A_VALUES); // mean 3
    const plottedB = makePlotted('series=b', B_VALUES); // mean 12
    const series = [plottedA, plottedB];

    // allSeries is a cloned full array (same refIds, different identity) so identity lookup fails and
    // the mapping must fall back to an in-order refId walk — each frame claiming its own slot.
    const allSeries = [makePlotted('series=a', A_VALUES), makePlotted('series=b', B_VALUES)];

    const controlLines: ControlLine[] = [
      makeControlLine({ name: 'LSL0', reducerId: ControlLineReducerId.lsl, position: 0, seriesIndex: 0 }),
      makeControlLine({ name: 'USL0', reducerId: ControlLineReducerId.usl, position: 6, seriesIndex: 0 }),
      makeControlLine({ name: 'LSL1', reducerId: ControlLineReducerId.lsl, position: 8, seriesIndex: 1 }),
      makeControlLine({ name: 'USL1', reducerId: ControlLineReducerId.usl, position: 20, seriesIndex: 1 }),
    ];
    const opts = makeOptions(controlLines);

    const stats = calculateSeriesStatistics(series, opts, allSeries, series);

    // Series 0 uses [0, 6] → tolerance 6. Series 1 uses [8, 20] → tolerance 12. Both share
    // sigma-within, so Cp of series 1 is exactly double series 0.
    expect(stats).toHaveLength(2);
    expect(stats[0].cp).toBeCloseTo(6 / (6 * SIGMA_WITHIN), 4);
    // Series 1 must NOT reuse series 0's tolerance of 6 (the naive-refId bug); its own is 12.
    expect(stats[1].cp).toBeCloseTo(12 / (6 * SIGMA_WITHIN), 4);
  });
});

describe('calculateSeriesStatistics — excluded points', () => {
  // Same Xbar-R fixture as the Minitab-style report: raw [1,5] [3,7] [2,8],
  // plotted subgroup means [3, 5, 5] at aggregated times [1.5, 3.5, 5.5].
  const rawFrame = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
      { name: 'value', type: FieldType.number, values: [1, 5, 3, 7, 2, 8] },
    ],
  });
  const plottedFrame = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'time', type: FieldType.time, values: [1.5, 3.5, 5.5] },
      { name: 'value', type: FieldType.number, values: [3, 5, 5] },
    ],
  });
  plottedFrame.fields[1].state = { calcs: { lcl: -4.44, ucl: 13.1067, mean: 13 / 3 } };

  it('drops the excluded subgroup from the raw-observation statistics', () => {
    const options = {
      chartType: SpcChartTyp.x_XbarR,
      subgroupSize: 2,
      aggregationType: AggregationType.none,
      controlLines: [],
      curves: [],
      featureQueryRefIds: [],
      // Middle subgroup (raw rows at times 3 and 4) plots at x = 3.5.
      chartOptions: { excludedPoints: [{ series: 'value', x: 3.5 }] },
    } as unknown as Options;

    const stats = calculateSeriesStatistics([plottedFrame], options, [plottedFrame], [rawFrame]);

    // Remaining raw observations: [1, 5, 2, 8]
    expect(stats[0].n).toBe(4);
    expect(stats[0].mean).toBeCloseTo(4, 10);
    expect(stats[0].min).toBe(1);
    expect(stats[0].max).toBe(8);
  });

  it('ignores exclusions recorded for other series', () => {
    const options = {
      chartType: SpcChartTyp.x_XbarR,
      subgroupSize: 2,
      aggregationType: AggregationType.none,
      controlLines: [],
      curves: [],
      featureQueryRefIds: [],
      chartOptions: { excludedPoints: [{ series: 'other', x: 3.5 }] },
    } as unknown as Options;

    const stats = calculateSeriesStatistics([plottedFrame], options, [plottedFrame], [rawFrame]);

    expect(stats[0].n).toBe(6);
    expect(stats[0].mean).toBeCloseTo(26 / 6, 10);
  });
});
