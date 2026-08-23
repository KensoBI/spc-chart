import { DataFrame, Field, FieldType } from '@grafana/data';
import { Options } from 'panelcfg';
import { AggregationType, ControlChartData } from 'types';
import { aggregateSeries } from './aggregation';

/**
 * Point exclusion ("omit from calculations", Minitab-style): points listed in
 * chartOptions.excludedPoints stay plotted but drop out of the control-limit,
 * run-rule and capability calculations. A point is identified by its series
 * (field) name and its plotted x value — the x survives requeries, whereas a
 * row index would not. For subgrouped charts the plotted x is the subgroup's
 * aggregated (mean) x, and excluding the point drops the whole subgroup.
 */
export interface ExcludedPoint {
  /** Field (series) name the point belongs to. */
  series: string;
  /** Plotted x value of the point (epoch ms in time mode, X field value in numeric mode). */
  x: number;
}

/** Excluded points persisted in panel JSON, shape-validated. */
export function getExcludedPoints(options: Options | undefined): ExcludedPoint[] {
  const raw = options?.chartOptions?.excludedPoints;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (p): p is ExcludedPoint =>
      p != null && typeof (p as ExcludedPoint).series === 'string' && typeof (p as ExcludedPoint).x === 'number'
  );
}

export function excludedXSetForSeries(excluded: ExcludedPoint[], seriesName: string): Set<number> {
  const set = new Set<number>();
  for (const point of excluded) {
    if (point.series === seriesName) {
      set.add(point.x);
    }
  }
  return set;
}

/**
 * The x field of a frame: the explicit numeric X field when configured, else the time field.
 * Matched by name, so a frame may carry the X column in any position.
 */
export function findXField(frame: DataFrame, xFieldName?: string): Field | undefined {
  if (xFieldName) {
    const byName = frame.fields.find((f) => f.name === xFieldName);
    if (byName) {
      return byName;
    }
  }
  return frame.fields.find((f) => f.type === FieldType.time);
}

/**
 * Plotted indices whose x matches an excluded x. For subgrouped charts the
 * plotted x values are recomputed with the same aggregation the pipeline
 * applies to the x field, so the match is exact.
 */
export function excludedPlottedIndices(xValues: number[], subgroupSize: number, excludedX: Set<number>): number[] {
  if (excludedX.size === 0) {
    return [];
  }
  const plottedX = subgroupSize > 1 ? aggregateSeries(xValues, subgroupSize, AggregationType.Mean) : xValues;
  const indices: number[] = [];
  plottedX.forEach((x, i) => {
    if (typeof x === 'number' && excludedX.has(x)) {
      indices.push(i);
    }
  });
  return indices;
}

/** Raw-row indices covered by the given plotted (subgroup) indices. */
export function plottedToRawRows(plottedIndices: number[], subgroupSize: number, rawLength: number): Set<number> {
  const rows = new Set<number>();
  for (const index of plottedIndices) {
    if (subgroupSize === 1) {
      rows.add(index);
      continue;
    }
    const end = Math.min((index + 1) * subgroupSize, rawLength);
    for (let row = index * subgroupSize; row < end; row++) {
      rows.add(row);
    }
  }
  return rows;
}

/** Frame copy with the given row indices removed from every field. */
export function removeFrameRows(frame: DataFrame, rows: Set<number>): DataFrame {
  if (rows.size === 0) {
    return frame;
  }
  const fields = frame.fields.map((field) => ({
    ...field,
    values: field.values.filter((_: unknown, i: number) => !rows.has(i)),
  }));
  return { ...frame, fields, length: Math.max(frame.length - rows.size, 0) };
}

/** Re-expand a filtered per-point array to full length, with null at each excluded plotted index. */
export function expandWithNulls(
  filtered: Array<number | null>,
  excludedPlotted: number[],
  fullLength: number
): Array<number | null> {
  const excludedSet = new Set(excludedPlotted);
  const expanded: Array<number | null> = [];
  let j = 0;
  for (let i = 0; i < fullLength; i++) {
    expanded.push(excludedSet.has(i) ? null : filtered[j++] ?? null);
  }
  return expanded;
}

/**
 * Re-expand a filtered per-point array to full length, filling each excluded
 * index from the nearest neighbour instead of leaving a null gap. Used for
 * positional limits (EWMA), where the limit envelope is defined at every point
 * even when that point is excluded, so the drawn lines stay continuous.
 */
export function expandWithFill(
  filtered: Array<number | null>,
  excludedPlotted: number[],
  fullLength: number
): Array<number | null> {
  const expanded = expandWithNulls(filtered, excludedPlotted, fullLength);
  const excludedSet = new Set(excludedPlotted);
  // Carry the previous limit forward across excluded slots...
  let last: number | null = null;
  for (let i = 0; i < fullLength; i++) {
    if (expanded[i] != null) {
      last = expanded[i];
    } else if (excludedSet.has(i)) {
      expanded[i] = last;
    }
  }
  // ...then back-fill any leading excluded slots that had no previous neighbour.
  let next: number | null = null;
  for (let i = fullLength - 1; i >= 0; i--) {
    if (expanded[i] != null) {
      next = expanded[i];
    } else if (excludedSet.has(i)) {
      expanded[i] = next;
    }
  }
  return expanded;
}

/** Exclusions of one series resolved against its frame's rows. */
export interface ResolvedExclusions {
  /** Plotted (post-aggregation) indices excluded from calculations. */
  plottedIndices: number[];
  /** Raw row indices to remove before computing limits/statistics. */
  rawRows: Set<number>;
}

/**
 * Resolve the excluded points of a series to concrete indices of its frame,
 * or null when nothing applies (the overwhelmingly common case).
 */
export function resolveExclusions(
  frame: DataFrame,
  fieldName: string,
  options: Options | undefined,
  subgroupSize: number,
  xFieldName?: string
): ResolvedExclusions | null {
  const excludedX = excludedXSetForSeries(getExcludedPoints(options), fieldName);
  if (excludedX.size === 0) {
    return null;
  }
  const xField = findXField(frame, xFieldName ?? options?.xField);
  if (!xField) {
    return null;
  }
  const plottedIndices = excludedPlottedIndices(xField.values, subgroupSize, excludedX);
  if (plottedIndices.length === 0) {
    return null;
  }
  const rawLength = frame.fields.find((f) => f.name === fieldName)?.values.length ?? xField.values.length;
  return { plottedIndices, rawRows: plottedToRawRows(plottedIndices, subgroupSize, rawLength) };
}

/**
 * Recompute a chart's limits without the excluded rows, keeping the full
 * plotted data. Per-point limit arrays are re-expanded with null gaps at the
 * excluded positions. Returns the original data when the filtered compute is
 * not possible (e.g. too few remaining points).
 */
export function applyExclusionsToChartData(
  controlChartData: ControlChartData,
  computeFiltered: (filteredFrame: DataFrame, filteredField: Field) => ControlChartData | null,
  frame: DataFrame,
  field: Field,
  exclusions: ResolvedExclusions
): ControlChartData {
  const filteredFrame = removeFrameRows(frame, exclusions.rawRows);
  const fieldIndex = frame.fields.indexOf(field);
  const filteredField = filteredFrame.fields[fieldIndex];
  if (!filteredField) {
    return controlChartData;
  }
  const filtered = computeFiltered(filteredFrame, filteredField);
  if (!filtered) {
    return controlChartData;
  }
  const fullLength = controlChartData.data.length;
  // Positional limits (EWMA) stay continuous through an excluded point; limits
  // that depend on the point's own data (attribute charts) gap at it.
  const expand = filtered.positionalLimits ? expandWithFill : expandWithNulls;
  return {
    ...controlChartData,
    centerLine: filtered.centerLine,
    upperControlLimit: filtered.upperControlLimit,
    lowerControlLimit: filtered.lowerControlLimit,
    upperControlLimitData: filtered.upperControlLimitData
      ? expand(filtered.upperControlLimitData, exclusions.plottedIndices, fullLength)
      : undefined,
    lowerControlLimitData: filtered.lowerControlLimitData
      ? expand(filtered.lowerControlLimitData, exclusions.plottedIndices, fullLength)
      : undefined,
  };
}
