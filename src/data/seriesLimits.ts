import { DataFrame } from '@grafana/data';
import { isValidNumber } from './aggregation';

export interface SeriesLinePosition {
  /** Constant position of the line. */
  position: number;
  /** Per-point positions, set only when the reference field carries a variable limit. */
  positionData?: Array<number | null>;
}

/**
 * Resolve the position of a "Series" control line — a line whose value is looked up from a field
 * of another query, typically a reference (feature) query supplying specification limits.
 *
 * The constant position is the field's **first** value. A reference query is a lookup, not a
 * process series, so the limit must not drift as new rows arrive at the end of it.
 *
 * When the field instead carries one value per plotted point and those values are not all the
 * same, the line becomes a variable limit: the per-point values are returned as `positionData`
 * and rendered as a stepped line, the same mechanism the attribute charts use for their
 * per-point control limits. A varying field whose length does not match the plotted points
 * cannot be aligned to them, so it falls back to the constant first value.
 */
export function resolveSeriesLinePosition(
  frame: DataFrame | undefined,
  fieldName: string | undefined,
  plottedPointCount?: number
): SeriesLinePosition | null {
  if (!frame || !fieldName) {
    return null;
  }

  const field = frame.fields.find((f) => f.name === fieldName);
  if (!field || field.values.length === 0) {
    return null;
  }

  // Gaps and non-numeric rows become null rather than dropping out, so the values stay
  // index-aligned with the plotted points.
  const values: Array<number | null> = field.values.map((value) => (isValidNumber(value) ? value : null));

  const position = values.find((value): value is number => value !== null);
  if (position === undefined) {
    return null;
  }

  const varies = values.some((value) => value !== null && value !== position);
  if (varies && plottedPointCount != null && values.length === plottedPointCount) {
    return { position, positionData: values };
  }

  return { position };
}
