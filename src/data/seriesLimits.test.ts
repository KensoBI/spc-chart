import { toDataFrame, FieldType } from '@grafana/data';
import { resolveSeriesLinePosition } from './seriesLimits';

function frameWith(values: unknown[], name = 'usl') {
  return toDataFrame({
    refId: 'A',
    fields: [
      { name: 'time', type: FieldType.time, values: values.map((_, i) => i + 1) },
      { name, values },
    ],
  });
}

describe('resolveSeriesLinePosition', () => {
  it('takes the first value, not the last', () => {
    // A reference query is a lookup: appending rows must not move the limit.
    expect(resolveSeriesLinePosition(frameWith([10.5, 11.5, 12.5]), 'usl', undefined)?.position).toBe(10.5);
  });

  it('leaves a constant reference series as a single position', () => {
    const resolved = resolveSeriesLinePosition(frameWith([10.5, 10.5, 10.5]), 'usl', 3);
    expect(resolved).toEqual({ position: 10.5 });
  });

  it('becomes a variable limit when the values differ and align 1:1 with the plotted points', () => {
    const resolved = resolveSeriesLinePosition(frameWith([10.5, 10.5, 11.0, 11.0]), 'usl', 4);
    expect(resolved?.position).toBe(10.5);
    expect(resolved?.positionData).toEqual([10.5, 10.5, 11.0, 11.0]);
  });

  it('keeps gaps index-aligned instead of dropping them', () => {
    const resolved = resolveSeriesLinePosition(frameWith([10.5, null, 11.0]), 'usl', 3);
    expect(resolved?.positionData).toEqual([10.5, null, 11.0]);
  });

  it('starts from the first numeric value when the series opens with a gap', () => {
    const resolved = resolveSeriesLinePosition(frameWith([null, 11.0, 12.0]), 'usl', 3);
    expect(resolved?.position).toBe(11.0);
  });

  it('falls back to a constant when varying values cannot be aligned to the plotted points', () => {
    // Three limit values against 24 plotted points cannot be matched up, and a line that
    // stops after three points is worse than a constant one.
    const resolved = resolveSeriesLinePosition(frameWith([10.5, 11.0, 11.5]), 'usl', 24);
    expect(resolved).toEqual({ position: 10.5 });
  });

  it('never returns positionData when the plotted point count is unknown', () => {
    const resolved = resolveSeriesLinePosition(frameWith([10.5, 11.0]), 'usl');
    expect(resolved).toEqual({ position: 10.5 });
  });

  it('returns null for a missing frame, field, or numeric value', () => {
    expect(resolveSeriesLinePosition(undefined, 'usl')).toBeNull();
    expect(resolveSeriesLinePosition(frameWith([10.5]), undefined)).toBeNull();
    expect(resolveSeriesLinePosition(frameWith([10.5]), 'nope')).toBeNull();
    expect(resolveSeriesLinePosition(frameWith([]), 'usl')).toBeNull();
    expect(resolveSeriesLinePosition(frameWith(['a', 'b']), 'usl')).toBeNull();
  });
});
