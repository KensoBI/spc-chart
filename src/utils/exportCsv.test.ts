import { toDataFrame, FieldType } from '@grafana/data';
import { Options, ControlLine } from 'panelcfg';
import { ControlLineReducerId } from 'data/spcReducers';
import { PositionInput } from 'types';
import { buildExportCsv, resolveControlLines, ResolvedControlLine } from './exportCsv';
import { SeriesStatistics } from 'components/StatisticsTable/calculateCapabilityIndices';

function makeStat(
  overrides: Partial<SeriesStatistics> & { seriesName: string; seriesIndex: number }
): SeriesStatistics {
  return {
    n: 0,
    mean: null,
    stdDev: null,
    min: null,
    max: null,
    lcl: null,
    ucl: null,
    cp: null,
    cpk: null,
    pp: null,
    ppk: null,
    ...overrides,
  };
}

describe('buildExportCsv', () => {
  const fullStat = makeStat({
    seriesName: 'Temperature',
    seriesIndex: 0,
    n: 100,
    mean: 23.45,
    stdDev: 1.23,
    min: 20.1,
    max: 27.8,
    lcl: 19.76,
    ucl: 27.14,
    cp: 1.33,
    cpk: 1.12,
    pp: 1.28,
    ppk: 1.05,
  });

  it('should generate statistics section with all columns', () => {
    const csv = buildExportCsv([fullStat], []);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Statistics');
    expect(lines[1]).toBe('Series,n,Mean,Std Dev,Min,Max,LCL,UCL,Cp,Cpk,Pp,Ppk');
    expect(lines[2]).toBe('Temperature,100,23.45,1.23,20.1,27.8,19.76,27.14,1.33,1.12,1.28,1.05');
  });

  it('should respect visible columns filter', () => {
    const csv = buildExportCsv([fullStat], [], ['n', 'mean', 'stdDev']);
    const lines = csv.split('\n');

    expect(lines[1]).toBe('Series,n,Mean,Std Dev');
    expect(lines[2]).toBe('Temperature,100,23.45,1.23');
  });

  it('should handle null capability values', () => {
    const stat = makeStat({
      seriesName: 'Pressure',
      seriesIndex: 0,
      n: 50,
      mean: 101.2,
      stdDev: 0.85,
      min: 99.1,
      max: 103.5,
    });

    const csv = buildExportCsv([stat], []);
    const lines = csv.split('\n');

    expect(lines[2]).toBe('Pressure,50,101.2,0.85,99.1,103.5,,,,,,');
  });

  it('should escape CSV special characters in series names', () => {
    const stat = makeStat({
      seriesName: 'Temperature, "high"',
      seriesIndex: 0,
      n: 10,
    });

    const csv = buildExportCsv([stat], []);
    const lines = csv.split('\n');

    expect(lines[2]).toContain('"Temperature, ""high"""');
  });

  it('should include control lines section', () => {
    const controlLines: ResolvedControlLine[] = [
      { name: 'UCL', seriesName: 'Temperature', type: 'ucl', position: 27.14 },
      { name: 'LCL', seriesName: 'Temperature', type: 'lcl', position: 19.76 },
    ];

    const csv = buildExportCsv([fullStat], controlLines);
    const sections = csv.split('\n\n');

    expect(sections.length).toBe(2);
    const clLines = sections[1].split('\n');
    expect(clLines[0]).toBe('Control Lines');
    expect(clLines[1]).toBe('Name,Series,Type,Position');
    expect(clLines[2]).toBe('UCL,Temperature,ucl,27.14');
    expect(clLines[3]).toBe('LCL,Temperature,lcl,19.76');
  });

  it('should handle empty statistics', () => {
    const csv = buildExportCsv([], []);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Statistics');
    expect(lines[1]).toBe('Series,n,Mean,Std Dev,Min,Max,LCL,UCL,Cp,Cpk,Pp,Ppk');
    expect(lines.length).toBe(2);
  });

  it('should treat empty visibleColumns array as show all', () => {
    const csv = buildExportCsv([fullStat], [], []);
    const lines = csv.split('\n');

    expect(lines[1]).toBe('Series,n,Mean,Std Dev,Min,Max,LCL,UCL,Cp,Cpk,Pp,Ppk');
  });
});

describe('resolveControlLines', () => {
  const featureFrame = toDataFrame({
    refId: 'A',
    fields: [
      { name: 'name', type: FieldType.string, values: ['characteristic1'] },
      { name: 'usl', type: FieldType.number, values: [9] },
      { name: 'lsl', type: FieldType.number, values: [-3] },
    ],
  });

  const dataFrame = toDataFrame({
    refId: 'B',
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2, 3] },
      { name: 'value', type: FieldType.number, values: [1, 2, 3] },
    ],
  });

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

  function makeOptions(controlLines: ControlLine[], featureQueryRefIds: string[] = []): Options {
    return { controlLines, featureQueryRefIds } as unknown as Options;
  }

  it('resolves a series-based limit whose field lives in a feature frame', () => {
    const options = makeOptions(
      [
        makeControlLine({
          name: 'USL',
          reducerId: ControlLineReducerId.usl,
          positionInput: PositionInput.series,
          field: 'usl',
          seriesIndex: 0, // the feature frame in the full array
        }),
      ],
      ['A']
    );

    const resolved = resolveControlLines([featureFrame, dataFrame], options);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ name: 'USL', type: 'usl', position: 9 });
  });

  it('resolves a static limit whose seriesIndex points past the feature frame', () => {
    // The editor assigns seriesIndex against the full frame array, so with a feature
    // frame at index 0 a static limit on the data series carries seriesIndex 1.
    const options = makeOptions(
      [
        makeControlLine({
          name: 'LSL',
          reducerId: ControlLineReducerId.lsl,
          positionInput: PositionInput.static,
          position: -3,
          seriesIndex: 1,
        }),
      ],
      ['A']
    );

    const resolved = resolveControlLines([featureFrame, dataFrame], options);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ name: 'LSL', type: 'lsl', position: -3, seriesName: 'value' });
  });

  it('resolves a computed limit against data-only frames', () => {
    const frame = toDataFrame({
      refId: 'B',
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    frame.fields[1].state = { calcs: { mean: 2 } };

    const options = makeOptions(
      [makeControlLine({ name: 'Mean', reducerId: ControlLineReducerId.mean, seriesIndex: 0 })],
      ['A']
    );

    // Computed lines are indexed against data-only frames: index 0 is `frame`, not the feature frame.
    const resolved = resolveControlLines([featureFrame, frame], options);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ name: 'Mean', type: 'mean', position: 2 });
  });

  it('drops limits whose series cannot be found', () => {
    const options = makeOptions([
      makeControlLine({ positionInput: PositionInput.static, position: 1, seriesIndex: 5 }),
    ]);

    expect(resolveControlLines([dataFrame], options)).toHaveLength(0);
  });

  it('drops series-based limits whose field is missing', () => {
    const options = makeOptions([
      makeControlLine({ positionInput: PositionInput.series, field: 'does-not-exist', seriesIndex: 0 }),
    ]);

    expect(resolveControlLines([dataFrame], options)).toHaveLength(0);
  });
});
