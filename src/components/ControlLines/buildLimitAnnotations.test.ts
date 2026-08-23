import { toDataFrame, FieldType, FieldConfigSource } from '@grafana/data';
import { GraphDrawStyle, LineInterpolation } from '@grafana/schema';
import { ControlLine, Options } from 'panelcfg';
import { ControlLineReducerId } from 'data/spcReducers';
import { AggregationType, PositionInput, SpcChartTyp } from 'types';
import { buildControlLineFrame, buildLimitAnnotations, computeControlLine } from './buildLimitAnnotations';

const MEASUREMENTS = [10.02, 9.96, 10.08, 9.99];

// Frame 0 is the process data, frames 1 and 2 are reference (feature) queries supplying limits.
const dataFrame = toDataFrame({
  refId: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
    { name: 'Bore diameter', type: FieldType.number, values: MEASUREMENTS },
  ],
});

const constantSpecFrame = toDataFrame({
  refId: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
    { name: 'USL spec', type: FieldType.number, values: [10.15, 10.15, 10.15, 10.15] },
  ],
});

const variableSpecFrame = toDataFrame({
  refId: 'C',
  fields: [
    { name: 'time', type: FieldType.time, values: [1, 2, 3, 4] },
    { name: 'LSL spec', type: FieldType.number, values: [9.85, 9.85, 9.9, 9.9] },
  ],
});

const allFrames = [dataFrame, constantSpecFrame, variableSpecFrame];
const plottedFrames = [dataFrame];

const fieldConfig: FieldConfigSource = { defaults: {}, overrides: [] };

function makeControlLine(overrides: Partial<ControlLine>): ControlLine {
  return {
    name: 'limit',
    field: '',
    positionInput: PositionInput.series,
    seriesIndex: 0,
    lineWidth: 2,
    lineColor: '#C4162A',
    fillDirection: 0,
    fillOpacity: 10,
    reducerId: ControlLineReducerId.usl,
    ...overrides,
  };
}

function makeOptions(controlLines: ControlLine[]): Options {
  return {
    chartType: SpcChartTyp.none,
    subgroupSize: 1,
    aggregationType: AggregationType.none,
    controlLines,
    featureQueryRefIds: ['B', 'C'],
  } as unknown as Options;
}

const uslLine = makeControlLine({
  name: 'USL',
  reducerId: ControlLineReducerId.usl,
  field: 'USL spec',
  seriesIndex: 1,
  fillDirection: 1,
});

const lslLine = makeControlLine({
  name: 'LSL',
  reducerId: ControlLineReducerId.lsl,
  field: 'LSL spec',
  seriesIndex: 2,
  lineColor: '#37872D',
  fillDirection: -1,
});

describe('computeControlLine — series-positioned lines', () => {
  it('resolves a constant reference series to a single position', () => {
    const [line] = computeControlLine(allFrames, makeOptions([uslLine]), MEASUREMENTS.length);

    expect(line.position).toBe(10.15);
    expect(line.positionData).toBeUndefined();
  });

  it('turns a varying reference series into a variable limit', () => {
    const [line] = computeControlLine(allFrames, makeOptions([lslLine]), MEASUREMENTS.length);

    expect(line.position).toBe(9.85);
    expect(line.positionData).toEqual([9.85, 9.85, 9.9, 9.9]);
  });

  it('drops a line whose reference field does not exist', () => {
    const missing = makeControlLine({ field: 'nope', seriesIndex: 1, position: undefined });

    expect(computeControlLine(allFrames, makeOptions([missing]), MEASUREMENTS.length)).toHaveLength(0);
  });
});

describe('buildControlLineFrame — reference limits are drawn as control lines', () => {
  it('draws both lines in their configured color against the plotted x-axis', () => {
    const controlLines = computeControlLine(allFrames, makeOptions([uslLine, lslLine]), MEASUREMENTS.length);
    const [frame] = buildControlLineFrame(plottedFrames, controlLines, fieldConfig, undefined, allFrames);

    const [x, usl, lsl] = frame.fields;
    // The x-axis comes from the plotted frame, never from a feature frame.
    expect(x.values).toEqual([1, 2, 3, 4]);

    expect(usl.config.color).toMatchObject({ fixedColor: '#C4162A' });
    expect(usl.values).toEqual([10.15, 10.15, 10.15, 10.15]);
    expect(usl.config.custom).toMatchObject({
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Smooth,
    });

    expect(lsl.config.color).toMatchObject({ fixedColor: '#37872D' });
    // Variable limit: one value per plotted point, drawn stepped.
    expect(lsl.values).toEqual([9.85, 9.85, 9.9, 9.9]);
    expect(lsl.config.custom).toMatchObject({ lineInterpolation: LineInterpolation.StepAfter });
  });

  it('keeps seriesIndex indexed against the full frame array', () => {
    // Only one frame is plotted, but seriesIndex 1 and 2 must still resolve to the feature frames.
    const controlLines = computeControlLine(allFrames, makeOptions([uslLine, lslLine]), MEASUREMENTS.length);
    const [frame] = buildControlLineFrame(plottedFrames, controlLines, fieldConfig, undefined, allFrames);

    expect(frame.fields.map((f) => f.name)).toEqual(['time', 'USL', 'LSL']);
  });
});

describe('buildLimitAnnotations — fill regions of a variable limit', () => {
  it('gives the region the per-point boundary so the fill steps with the line', () => {
    const controlLines = computeControlLine(allFrames, makeOptions([uslLine, lslLine]), MEASUREMENTS.length);
    const { limits } = buildLimitAnnotations(allFrames, controlLines);

    const regions = limits.filter((l) => l.type === 'region');
    const lsl = regions.find((r) => r.title === 'LSL')!;
    const usl = regions.find((r) => r.title === 'USL')!;

    // LSL fills downwards: it is the region's upper boundary, and it varies.
    expect(lsl.valuesEnd).toEqual([9.85, 9.85, 9.9, 9.9]);
    // Nothing below it, so the lower boundary runs to the bottom of the plot.
    expect(lsl.valuesStart).toBeUndefined();
    expect(lsl.timeStart).toBeUndefined();

    // USL fills upwards from a constant limit: no per-point boundary, just the scalar.
    expect(usl.valuesStart).toBeUndefined();
    expect(usl.timeStart).toBe(10.15);
  });

  it('leaves regions of constant limits untouched', () => {
    const controlLines = computeControlLine(allFrames, makeOptions([uslLine]), MEASUREMENTS.length);
    const { limits } = buildLimitAnnotations(allFrames, controlLines);

    const region = limits.find((l) => l.type === 'region')!;
    expect(region.valuesStart).toBeUndefined();
    expect(region.valuesEnd).toBeUndefined();
    expect(region.timeStart).toBe(10.15);
  });
});
