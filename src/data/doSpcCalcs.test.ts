import { toDataFrame, FieldType } from '@grafana/data';
import { Options } from 'panelcfg';
import { AggregationType, SpcChartTyp } from 'types';
import { doSpcCalcs } from './doSpcCalcs';

const MEASUREMENTS = [10, 12, 11, 13, 12, 14];
const SPEC_VALUES = [10.5, 10.5, 10.5, 11.5, 11.5, 11.5];

function makeFrames() {
  return [
    toDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
        { name: 'Bore diameter', type: FieldType.number, values: MEASUREMENTS },
      ],
    }),
    toDataFrame({
      refId: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3, 4, 5, 6] },
        { name: 'USL spec', type: FieldType.number, values: SPEC_VALUES },
      ],
    }),
  ];
}

function makeOptions(overrides: Partial<Options> = {}): Options {
  return {
    chartType: SpcChartTyp.mR_XmR,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    controlLines: [],
    featureQueryRefIds: ['B'],
    ...overrides,
  } as unknown as Options;
}

describe('doSpcCalcs — feature frames', () => {
  it('does not run the chart-type transform over a reference series', () => {
    // The mR chart turns values into moving ranges. That is meaningless for a spec limit,
    // which must keep the values the query returned.
    const [data, spec] = doSpcCalcs(makeFrames(), makeOptions());

    expect(spec.fields[1].values).toEqual(SPEC_VALUES);
    // The process series is still transformed as usual.
    expect(data.fields[1].values).not.toEqual(MEASUREMENTS);
    expect(data.fields[1].state?.calcs?.ucl).toEqual(expect.any(Number));
  });

  it('leaves no control-chart calcs on a reference series', () => {
    const [, spec] = doSpcCalcs(makeFrames(), makeOptions());

    expect(spec.fields[1].state?.calcs).toBeUndefined();
  });

  it('folds a reference series into subgroups so it stays aligned with the plotted points', () => {
    const [data, spec] = doSpcCalcs(
      makeFrames(),
      makeOptions({ chartType: SpcChartTyp.x_XbarR, subgroupSize: 3 })
    );

    // Both the plotted series and the reference series collapse to one value per subgroup.
    expect(data.fields[1].values).toHaveLength(2);
    expect(spec.fields[1].values).toEqual([10.5, 11.5]);
    // The reference frame's own time field is aggregated the same way.
    expect(spec.fields[0].values).toHaveLength(2);
  });

  it('treats every frame as process data when no feature queries are declared', () => {
    const [, spec] = doSpcCalcs(makeFrames(), makeOptions({ featureQueryRefIds: [] }));

    expect(spec.fields[1].state?.calcs).toBeDefined();
  });
});

describe('doSpcCalcs — numeric X axis is matched by name', () => {
  // Two queries that disagree on column order, the way independent SQL queries usually do.
  const frames = [
    toDataFrame({
      refId: 'A',
      fields: [
        { name: 'sample', type: FieldType.number, values: [1, 2, 3, 4] },
        { name: 'part_a', type: FieldType.number, values: [10, 11, 12, 13] },
      ],
    }),
    toDataFrame({
      refId: 'B',
      fields: [
        { name: 'part_b', type: FieldType.number, values: [20, 21, 22, 23] },
        { name: 'sample', type: FieldType.number, values: [1, 2, 3, 4] },
      ],
    }),
  ];

  it('leaves the X field untouched wherever it sits in the frame', () => {
    const opts = { ...makeOptions({ chartType: SpcChartTyp.mR_XmR, featureQueryRefIds: [] }), xField: 'sample' };
    const [a, b] = doSpcCalcs(frames, opts as Options, 'sample');

    // The X column keeps its values and gets no control-chart calcs in either frame...
    expect(a.fields[0].values).toEqual([1, 2, 3, 4]);
    expect(a.fields[0].state?.calcs).toBeUndefined();
    expect(b.fields[1].values).toEqual([1, 2, 3, 4]);
    expect(b.fields[1].state?.calcs).toBeUndefined();

    // ...while the measurement column in each is transformed as usual.
    expect(a.fields[1].state?.calcs?.ucl).toEqual(expect.any(Number));
    expect(b.fields[0].state?.calcs?.ucl).toEqual(expect.any(Number));
  });

  it('would have treated the wrong column as X under positional matching', () => {
    // Guards the regression: frame B holds `sample` at index 1, so an index derived from
    // frame A (index 0) would have marked B's measurement column as the X axis.
    const opts = { ...makeOptions({ chartType: SpcChartTyp.mR_XmR, featureQueryRefIds: [] }), xField: 'sample' };
    const [, b] = doSpcCalcs(frames, opts as Options, 'sample');

    expect(b.fields[0].name).toBe('part_b');
    expect(b.fields[0].values).not.toEqual([20, 21, 22, 23]);
  });
});
