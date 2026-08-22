import { DataFrame, FieldType } from '@grafana/data';

import { doSpcCalcs } from 'data/doSpcCalcs';
import 'registry/builtinChartTypes';
import { AggregationType, SpcChartTyp } from 'types';
import { Options } from 'panelcfg';
import { getStages, stageSegments } from './stages';

function makeOptions(overrides: Partial<Options> = {}): Options {
  return {
    chartType: SpcChartTyp.x_XmR,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    chartOptions: {},
    controlLines: [],
    featureQueryRefIds: [],
    ...overrides,
  } as unknown as Options;
}

function xmrFrame(values: number[]): DataFrame {
  return {
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: values.map((_, i) => (i + 1) * 1000), config: {}, state: {} },
      { name: 'value', type: FieldType.number, values, config: {}, state: {} },
    ],
    length: values.length,
  };
}

describe('stage helpers', () => {
  it('validates, sorts and deduplicates persisted breakpoints', () => {
    const options = makeOptions({
      chartOptions: {
        stages: [{ x: 5000, label: 'B' }, { x: 2000 }, { x: 5000, label: 'B2' }, { label: 'no-x' }, 'junk', null],
      },
    });
    expect(getStages(options)).toEqual([{ x: 2000 }, { x: 5000, label: 'B2' }]);
    expect(getStages(makeOptions())).toEqual([]);
    expect(getStages(undefined)).toEqual([]);
  });

  it('splits plotted indices into segments at breakpoint x values', () => {
    const x = [1000, 2000, 3000, 4000, 5000, 6000];
    expect(stageSegments(x, [{ x: 4000 }])).toEqual([
      { start: 0, end: 3, breakpoint: undefined },
      { start: 3, end: 6, breakpoint: { x: 4000 } },
    ]);
    // Breakpoint between samples starts the stage at the next point.
    expect(stageSegments(x, [{ x: 3500 }])).toEqual([
      { start: 0, end: 3, breakpoint: undefined },
      { start: 3, end: 6, breakpoint: { x: 3500 } },
    ]);
  });

  it('drops empty segments (breakpoints outside or at the first point)', () => {
    const x = [1000, 2000, 3000];
    // Breakpoint at/below the first x: the initial segment is empty.
    expect(stageSegments(x, [{ x: 1000 }])).toEqual([{ start: 0, end: 3, breakpoint: { x: 1000 } }]);
    // Breakpoint past the data contributes nothing.
    expect(stageSegments(x, [{ x: 9000 }])).toEqual([{ start: 0, end: 3, breakpoint: undefined }]);
    expect(stageSegments([], [{ x: 1000 }])).toEqual([]);
  });
});

describe('doSpcCalcs with stages', () => {
  // Two clearly different regimes; stage 2 starts at x=6000 (index 5).
  const regime1 = [10, 10.4, 9.8, 10.2, 10.1];
  const regime2 = [20, 20.3, 19.7, 20.2, 19.9];
  const values = [...regime1, ...regime2];

  it('recomputes XmR limits per stage and publishes stepped arrays', () => {
    const options = makeOptions({ chartOptions: { stages: [{ x: 6000, label: 'After change' }] } });

    const [frame] = doSpcCalcs([xmrFrame(values)], options);
    const [ref1] = doSpcCalcs([xmrFrame(regime1)], makeOptions());
    const [ref2] = doSpcCalcs([xmrFrame(regime2)], makeOptions());

    const calcs = frame.fields[1].state!.calcs!;
    const ref1Calcs = ref1.fields[1].state!.calcs!;
    const ref2Calcs = ref2.fields[1].state!.calcs!;

    // All points stay plotted.
    expect(frame.fields[1].values).toEqual(values);

    // Per-point arrays step at the breakpoint, matching per-stage references.
    for (let i = 0; i < 5; i++) {
      expect(calcs.meanData![i]).toBeCloseTo(ref1Calcs.mean, 10);
      expect(calcs.uclData![i]).toBeCloseTo(ref1Calcs.ucl, 10);
      expect(calcs.lclData![i]).toBeCloseTo(ref1Calcs.lcl, 10);
    }
    for (let i = 5; i < 10; i++) {
      expect(calcs.meanData![i]).toBeCloseTo(ref2Calcs.mean, 10);
      expect(calcs.uclData![i]).toBeCloseTo(ref2Calcs.ucl, 10);
      expect(calcs.lclData![i]).toBeCloseTo(ref2Calcs.lcl, 10);
    }

    // Scalars carry the LAST stage's values (the current process).
    expect(calcs.mean).toBeCloseTo(ref2Calcs.mean, 10);
    expect(calcs.ucl).toBeCloseTo(ref2Calcs.ucl, 10);
    expect(calcs.lcl).toBeCloseTo(ref2Calcs.lcl, 10);
  });

  it('emits stepped sigma-line positions per stage', () => {
    const options = makeOptions({ chartOptions: { stages: [{ x: 6000 }] } });
    const [frame] = doSpcCalcs([xmrFrame(values)], options);
    const calcs = frame.fields[1].state!.calcs!;

    const sigma1uData = calcs.sigma1uData as Array<number | null>;
    expect(sigma1uData).toHaveLength(10);
    // +1σ = mean + (ucl - mean)/3, per point.
    expect(sigma1uData[0]).toBeCloseTo(calcs.meanData![0]! + (calcs.uclData![0]! - calcs.meanData![0]!) / 3, 10);
    expect(sigma1uData[9]).toBeCloseTo(calcs.meanData![9]! + (calcs.uclData![9]! - calcs.meanData![9]!) / 3, 10);
    expect(sigma1uData[0]).not.toBeCloseTo(sigma1uData[9]!, 5);
  });

  it('composes with point exclusion: the excluded point drops out of its stage', () => {
    const withOutlier = [...regime1, 20, 20.3, 45, 20.2, 19.9]; // outlier at index 7 (x=8000)
    const options = makeOptions({
      chartOptions: { stages: [{ x: 6000 }], excludedPoints: [{ series: 'value', x: 8000 }] },
    });

    const [frame] = doSpcCalcs([xmrFrame(withOutlier)], options);
    const [ref2] = doSpcCalcs([xmrFrame([20, 20.3, 20.2, 19.9])], makeOptions());

    const calcs = frame.fields[1].state!.calcs!;
    // Stage 2 limits match the reference computed without the outlier...
    expect(calcs.mean).toBeCloseTo(ref2.fields[1].state!.calcs!.mean, 10);
    expect(calcs.ucl).toBeCloseTo(ref2.fields[1].state!.calcs!.ucl, 10);
    // ...the excluded point is dropped from that estimate, yet the constant
    // per-stage limit line stays continuous through it (same value as its
    // stage neighbours, = the stage's scalar limit).
    expect(calcs.meanData![7]).toBeCloseTo(calcs.meanData![6]!, 10);
    expect(calcs.uclData![7]).toBeCloseTo(calcs.uclData![6]!, 10);
    expect(calcs.uclData![7]).toBeCloseTo(calcs.ucl!, 10);
    // The point itself stays plotted.
    expect(frame.fields[1].values[7]).toBe(45);
  });

  it('drops the limits over a stage too small to compute, keeping the previous stage', () => {
    // Last stage has a single observation: XmR needs at least two.
    const options = makeOptions({ chartOptions: { stages: [{ x: 10000 }] } });
    const [frame] = doSpcCalcs([xmrFrame(values)], options);
    const [ref1] = doSpcCalcs([xmrFrame(values.slice(0, 9))], makeOptions());

    const calcs = frame.fields[1].state!.calcs!;
    expect(calcs.meanData![9]).toBeNull();
    expect(calcs.uclData![9]).toBeNull();
    expect(calcs.meanData![0]).toBeCloseTo(ref1.fields[1].state!.calcs!.mean, 10);
    // Scalars stay on the last stage that computed.
    expect(calcs.mean).toBeCloseTo(ref1.fields[1].state!.calcs!.mean, 10);
  });

  it('steps at subgroup boundaries for subgrouped charts', () => {
    // 4 subgroups of 2; stage 2 = subgroups 3-4, plotted at x >= mean(5000,6000).
    const subgrouped = [10, 11, 10, 12, 30, 31, 30, 32];
    const options = makeOptions({
      chartType: SpcChartTyp.x_XbarR,
      subgroupSize: 2,
      chartOptions: { stages: [{ x: 5500 }] },
    });

    const [frame] = doSpcCalcs([xmrFrame(subgrouped)], options);
    const [ref1] = doSpcCalcs(
      [xmrFrame([10, 11, 10, 12])],
      makeOptions({ chartType: SpcChartTyp.x_XbarR, subgroupSize: 2 })
    );
    const [ref2] = doSpcCalcs(
      [xmrFrame([30, 31, 30, 32])],
      makeOptions({ chartType: SpcChartTyp.x_XbarR, subgroupSize: 2 })
    );

    const calcs = frame.fields[1].state!.calcs!;
    expect(frame.fields[1].values).toEqual([10.5, 11, 30.5, 31]);
    expect(calcs.meanData![0]).toBeCloseTo(ref1.fields[1].state!.calcs!.mean, 10);
    expect(calcs.meanData![1]).toBeCloseTo(ref1.fields[1].state!.calcs!.mean, 10);
    expect(calcs.meanData![2]).toBeCloseTo(ref2.fields[1].state!.calcs!.mean, 10);
    expect(calcs.meanData![3]).toBeCloseTo(ref2.fields[1].state!.calcs!.mean, 10);
    expect(calcs.ucl).toBeCloseTo(ref2.fields[1].state!.calcs!.ucl, 10);
  });

  it('leaves the chart untouched when only one non-empty segment results', () => {
    const options = makeOptions({ chartOptions: { stages: [{ x: 99999 }] } });
    const [staged] = doSpcCalcs([xmrFrame(values)], options);
    const [baseline] = doSpcCalcs([xmrFrame(values)], makeOptions());
    expect(staged.fields[1].state!.calcs!.mean).toBeCloseTo(baseline.fields[1].state!.calcs!.mean, 10);
    expect(staged.fields[1].state!.calcs!.meanData).toBeUndefined();
  });
});
