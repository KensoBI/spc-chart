import { DataFrame, FieldType } from '@grafana/data';

import { doSpcCalcs } from 'data/doSpcCalcs';
import 'registry/builtinChartTypes';
import { AggregationType, PositionInput, SpcChartTyp } from 'types';
import { ControlLine, Options } from 'panelcfg';
import { ControlLineReducerId } from 'data/spcReducers';
import {
  excludedPlottedIndices,
  expandWithNulls,
  getExcludedPoints,
  plottedToRawRows,
  removeFrameRows,
  resolveExclusions,
} from './exclusions';

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

describe('exclusion helpers', () => {
  it('validates the persisted shape', () => {
    const options = makeOptions({
      chartOptions: {
        excludedPoints: [{ series: 'value', x: 2000 }, { series: 'value' }, 'junk', null, { series: 5, x: 1 }],
      },
    });
    expect(getExcludedPoints(options)).toEqual([{ series: 'value', x: 2000 }]);
    expect(getExcludedPoints(makeOptions())).toEqual([]);
    expect(getExcludedPoints(undefined)).toEqual([]);
  });

  it('matches plotted indices through subgroup aggregation of the x values', () => {
    // Subgroups of 2: plotted x = mean of member timestamps.
    const xValues = [1000, 2000, 3000, 4000, 5000, 6000];
    expect(excludedPlottedIndices(xValues, 2, new Set([3500]))).toEqual([1]);
    expect(excludedPlottedIndices(xValues, 1, new Set([3000, 6000]))).toEqual([2, 5]);
    expect(excludedPlottedIndices(xValues, 1, new Set([999]))).toEqual([]);
  });

  it('expands plotted indices to raw subgroup rows', () => {
    expect([...plottedToRawRows([1], 2, 6)].sort()).toEqual([2, 3]);
    expect([...plottedToRawRows([2], 3, 7)].sort()).toEqual([6]);
    expect([...plottedToRawRows([0, 2], 1, 3)].sort()).toEqual([0, 2]);
  });

  it('removes rows from every field of a frame', () => {
    const filtered = removeFrameRows(xmrFrame([10, 20, 30]), new Set([1]));
    expect(filtered.fields[0].values).toEqual([1000, 3000]);
    expect(filtered.fields[1].values).toEqual([10, 30]);
    expect(filtered.length).toBe(2);
  });

  it('re-expands filtered arrays with null gaps', () => {
    expect(expandWithNulls([1, 3], [1], 3)).toEqual([1, null, 3]);
    expect(expandWithNulls([1], [0, 2], 3)).toEqual([null, 1, null]);
  });

  it('resolves to null when nothing is excluded for the series', () => {
    const frame = xmrFrame([10, 20, 30]);
    expect(resolveExclusions(frame, 'value', makeOptions(), 1)).toBeNull();
    const other = makeOptions({ chartOptions: { excludedPoints: [{ series: 'other', x: 2000 }] } });
    expect(resolveExclusions(frame, 'value', other, 1)).toBeNull();
  });
});

describe('doSpcCalcs with excluded points', () => {
  it('keeps the excluded point plotted but recomputes XmR limits without it', () => {
    const values = [10, 10.4, 9.8, 10.2, 25, 10.1, 9.9, 10.3];
    const outlierX = 5000; // x of the 25 outlier
    const options = makeOptions({
      chartOptions: { excludedPoints: [{ series: 'value', x: outlierX }] },
    });

    const [withExclusion] = doSpcCalcs([xmrFrame(values)], options);
    const [baseline] = doSpcCalcs([xmrFrame(values)], makeOptions());
    const [reference] = doSpcCalcs([xmrFrame(values.filter((v) => v !== 25))], makeOptions());

    const excludedField = withExclusion.fields[1];
    // All points, including the excluded one, remain plotted.
    expect(excludedField.values).toEqual(values);
    // Limits match a chart computed without the excluded observation...
    const referenceCalcs = reference.fields[1].state!.calcs!;
    expect(excludedField.state!.calcs!.mean).toBeCloseTo(referenceCalcs.mean, 10);
    expect(excludedField.state!.calcs!.ucl).toBeCloseTo(referenceCalcs.ucl, 10);
    expect(excludedField.state!.calcs!.lcl).toBeCloseTo(referenceCalcs.lcl, 10);
    // ...and differ from the limits with the outlier included.
    expect(excludedField.state!.calcs!.ucl).toBeLessThan(baseline.fields[1].state!.calcs!.ucl!);
  });

  it('drops the whole subgroup for subgrouped charts', () => {
    const values = [10, 11, 30, 31, 10, 11, 9, 10];
    const options = makeOptions({
      chartType: SpcChartTyp.x_XbarR,
      subgroupSize: 2,
      // Second subgroup (rows 2-3) plots at x = mean(3000, 4000).
      chartOptions: { excludedPoints: [{ series: 'value', x: 3500 }] },
    });

    const [frame] = doSpcCalcs([xmrFrame(values)], options);
    const [reference] = doSpcCalcs(
      [xmrFrame([10, 11, 10, 11, 9, 10])],
      makeOptions({ chartType: SpcChartTyp.x_XbarR, subgroupSize: 2 })
    );

    const field = frame.fields[1];
    // Full plotted series: 4 subgroup means, the excluded one still shown.
    expect(field.values).toEqual([10.5, 30.5, 10.5, 9.5]);
    expect(field.state!.calcs!.mean).toBeCloseTo(reference.fields[1].state!.calcs!.mean, 10);
    expect(field.state!.calcs!.ucl).toBeCloseTo(reference.fields[1].state!.calcs!.ucl, 10);
  });

  it('excludes the point from standard statistics too', () => {
    const values = [10, 10.4, 9.8, 10.2, 25, 10.1, 9.9, 10.3];
    const maxLine: ControlLine = {
      name: 'max',
      reducerId: ControlLineReducerId.max,
      field: 'value',
      positionInput: PositionInput.static,
      seriesIndex: 0,
      lineWidth: 1,
      lineColor: 'red',
      fillDirection: 0,
      fillOpacity: 0,
    };
    const options = makeOptions({
      controlLines: [maxLine],
      chartOptions: { excludedPoints: [{ series: 'value', x: 5000 }] },
    });

    const [frame] = doSpcCalcs([xmrFrame(values)], options);
    expect(frame.fields[1].state!.calcs!.max).toBeCloseTo(10.4, 10);
  });
});
