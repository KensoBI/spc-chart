import { DataFrame, Field, FieldType } from '@grafana/data';
import { Options, ControlLine } from 'panelcfg';
import { ControlLineReducerId } from 'data/spcReducers';
import { PositionInput, SPC_COMPANION_SERIES } from 'types';
import { estimateSigmaWithin, calculateCapability } from 'calcs/capability';
import { calculateStandardStats } from 'calcs/standard';
import { resolveEstimation } from 'data/estimation';
import { resolveExclusions } from 'data/exclusions';
import { resolveSeriesLinePosition } from 'data/seriesLimits';
import { getChartType } from 'registry/chartTypes';
import 'registry/builtinChartTypes';

export interface SeriesStatistics {
  seriesName: string;
  seriesIndex: number;
  n: number;
  mean: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  lcl: number | null;
  ucl: number | null;
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
}

/**
 * Minitab-style capability report: n, mean, stdDev (overall), min and max describe the raw
 * individual observations, Cp/Cpk use the within-subgroup sigma estimate and Pp/Ppk the overall
 * sigma — specification limits apply to individual parts, never to subgroup aggregates.
 * LCL/UCL are the control chart limits and describe the plotted chart.
 *
 * @param series      Plotted data-only frames (feature frames removed; values may be subgroup
 *                    aggregates when a chart type or aggregation is active).
 * @param options     Panel options.
 * @param allSeries   The full, unfiltered frame array (including feature frames). Used to resolve
 *                    series-based spec limits whose field lives in a feature frame that is not part
 *                    of `series`. Defaults to `series` for callers without feature queries.
 * @param rawSeries   Pre-aggregation frames holding the raw individual observations. Defaults to
 *                    `series` (correct whenever no chart type or aggregation transformed the values).
 */
export function calculateSeriesStatistics(
  series: DataFrame[],
  options: Options,
  allSeries: DataFrame[] = series,
  rawSeries?: DataFrame[]
): SeriesStatistics[] {
  // Resolve LSL/USL from control lines once, against the full frame array, so that
  // feature-series limits (whose field lives in a filtered-out feature frame) resolve correctly.
  const specLimits = resolveSpecLimits(options.controlLines, allSeries);

  // In numeric X-axis mode the X field is numeric too, but it is an index, not a measurement.
  // Exclude it so statistics describe the plotted values rather than the X positions.
  const xFieldName = options.xField;

  // Resolve each plotted frame's index in the full array once, preserving a unique mapping even
  // when frames share a refId — a refId identifies the query, not the frame (see mapToFullIndices).
  const fullIndices = mapToFullIndices(series, allSeries);

  return series.flatMap((frame, seriesIndex) => {
    // Only frames that are actually plotted contribute statistics. This mirrors the chart's
    // graphable-frame rule (prepareGraphableFields): in time mode a plotted frame needs a time
    // field; in numeric-X mode it must carry the configured X field. Feature/reference tables that
    // merely supply control-line values (e.g. a lookup of usl/lsl/nominal with no time field) are
    // skipped even when they are not declared in featureQueryRefIds.
    if (!isPlottedFrame(frame, xFieldName)) {
      return [];
    }

    // A single frame can carry several value fields (wide format, e.g. one query returning
    // `sample, part_a, part_b`); each is plotted as its own line and gets its own table row.
    // Companion series (e.g. the CUSUM lower sum) share the primary's row and are skipped.
    const valueFields = frame.fields.filter(
      (f) => f.type === FieldType.number && f.name !== xFieldName && !f.config?.custom?.[SPC_COMPANION_SERIES]
    );

    if (valueFields.length === 0) {
      return [emptyStatistics(frame.name || `Series ${seriesIndex}`, seriesIndex)];
    }

    // Extract USL/LSL for this series. Control-line seriesIndex is expressed in terms of the
    // full frame array, so map this data frame back to its index there before matching.
    const { lsl, usl } = selectSpecLimits(specLimits, fullIndices[seriesIndex]);
    // Raw frames are aligned 1:1 with the plotted frames, so position is the unique counterpart.
    const rawFrame = rawSeries?.[seriesIndex];

    return valueFields.map((numericField) => {
      // Control chart limits belong to the plotted chart, computed by doSpcCalcs.
      const chartCalcs = numericField.state?.calcs;

      // Everything else describes the raw individual observations of this same field.
      let rawField = findRawFieldByName(rawFrame, numericField.name) ?? numericField;

      // Excluded points (chartOptions.excludedPoints) drop out of the
      // capability statistics as well, Minitab-style. Against a raw frame the
      // excluded plotted point maps back to its subgroup's rows; without one
      // the values are the plotted points themselves.
      const exclusionFrame = rawFrame ?? frame;
      const exclusionSubgroup = rawFrame ? Math.max(options.subgroupSize ?? 1, 1) : 1;
      const exclusions = resolveExclusions(exclusionFrame, numericField.name, options, exclusionSubgroup);
      if (exclusions) {
        rawField = {
          ...rawField,
          values: rawField.values.filter((_: unknown, i: number) => !exclusions.rawRows.has(i)),
        };
      }

      const rawStats = calculateStandardStats(rawField);
      const mean = rawStats.mean ?? null;
      const sigmaOverall = rawStats.stdDev ?? null;

      const rawValues = rawField.values.filter((v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v));
      // Chart types may bring their own within-sigma estimator; the standard
      // Shewhart estimators in calcs/capability remain the fallback.
      const chartTypeDef = getChartType(options.chartType);
      const sigmaWithin = chartTypeDef?.estimateSigmaWithin
        ? chartTypeDef.estimateSigmaWithin(rawValues, {
            subgroupSize: options.subgroupSize,
            options,
            chartOptions: options.chartOptions,
          })
        : estimateSigmaWithin(
            rawValues,
            options.chartType,
            options.subgroupSize,
            chartTypeDef?.sigmaMethods
              ? resolveEstimation(options.chartOptions, chartTypeDef.sigmaMethods)
              : undefined
          );

      const { cp, cpk, pp, ppk } = calculateCapability(mean, sigmaWithin, sigmaOverall, lsl, usl);

      return {
        seriesName: numericField.config.displayName || numericField.name || frame.name || `Series ${seriesIndex}`,
        seriesIndex,
        n: rawStats.count ?? 0,
        mean,
        stdDev: sigmaOverall,
        min: rawStats.min ?? null,
        max: rawStats.max ?? null,
        lcl: chartCalcs?.lcl ?? null,
        ucl: chartCalcs?.ucl ?? null,
        cp,
        cpk,
        pp,
        ppk,
      };
    });
  });
}

/**
 * Whether a frame is drawn on the chart, and therefore a real measurement series rather than a
 * lookup/reference table. Mirrors the keep rule in prepareGraphableFields: numeric-X frames must
 * carry the X field; time-axis frames must have a time field.
 */
function isPlottedFrame(frame: DataFrame, xFieldName: string | undefined): boolean {
  if (xFieldName != null) {
    return frame.fields.some((f) => f.type === FieldType.number && f.name === xFieldName);
  }
  return frame.fields.some((f) => f.type === FieldType.time);
}

/** Locate a value field within the raw frame by name so each plotted field maps to its own raw data. */
function findRawFieldByName(rawFrame: DataFrame | undefined, fieldName: string): Field | undefined {
  return rawFrame?.fields.find((f) => f.type === FieldType.number && f.name === fieldName);
}

interface ResolvedSpecLimit {
  reducerId: ControlLineReducerId;
  // Index into the full frame array (the control line's configured series).
  seriesIndex: number;
  position: number;
}

/**
 * Resolve every LSL/USL control line to a numeric position, reading series-based positions from the
 * full frame array so that limits sourced from a feature query resolve to the correct field value.
 */
function resolveSpecLimits(controlLines: ControlLine[] | undefined, allSeries: DataFrame[]): ResolvedSpecLimit[] {
  if (!controlLines || controlLines.length === 0) {
    return [];
  }

  const resolved: ResolvedSpecLimit[] = [];

  for (const cl of controlLines) {
    if (cl.reducerId !== ControlLineReducerId.lsl && cl.reducerId !== ControlLineReducerId.usl) {
      continue;
    }

    const position = resolveControlLinePosition(cl, allSeries);
    if (position == null) {
      continue;
    }

    resolved.push({ reducerId: cl.reducerId, seriesIndex: cl.seriesIndex, position });
  }

  return resolved;
}

function resolveControlLinePosition(cl: ControlLine, allSeries: DataFrame[]): number | null {
  if (cl.positionInput === PositionInput.series && cl.field) {
    // Capability is computed against a single spec value; a variable limit contributes its
    // first value, matching the constant position the chart labels the line with.
    return resolveSeriesLinePosition(allSeries[cl.seriesIndex], cl.field)?.position ?? null;
  }

  return typeof cl.position === 'number' && !Number.isNaN(cl.position) ? cl.position : null;
}

/**
 * Pick the LSL/USL that apply to the data series at `dataFullIndex`: a limit configured specifically
 * for that series wins, otherwise the first resolvable limit is used as a shared default (the common
 * case of a single LSL/USL — e.g. from a feature query — applied to all series).
 */
function selectSpecLimits(
  resolved: ResolvedSpecLimit[],
  dataFullIndex: number
): { lsl: number | null; usl: number | null } {
  const pick = (reducerId: ControlLineReducerId): number | null => {
    const specific = resolved.find((r) => r.reducerId === reducerId && r.seriesIndex === dataFullIndex);
    if (specific) {
      return specific.position;
    }
    const shared = resolved.find((r) => r.reducerId === reducerId);
    return shared ? shared.position : null;
  };

  return { lsl: pick(ControlLineReducerId.lsl), usl: pick(ControlLineReducerId.usl) };
}

/**
 * Map every frame in `series` to its index in `allSeries`, preserving a unique mapping even when
 * several frames share a refId. `series` is an in-order subsequence of `allSeries` (only feature
 * frames were removed), so we consume `allSeries` left to right: each plotted frame claims the next
 * position that matches it by identity or refId. Advancing a cursor stops two frames with the same
 * refId from both resolving to the first match, which is the bug a plain `findIndex` by refId causes.
 * A frame with no match (arrays not aligned as expected) falls back to its own position in `series`.
 */
function mapToFullIndices(series: DataFrame[], allSeries: DataFrame[]): number[] {
  const indices: number[] = [];
  let cursor = 0;

  for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
    const frame = series[seriesIndex];
    let matched = -1;

    for (let j = cursor; j < allSeries.length; j++) {
      const candidate = allSeries[j];
      if (candidate === frame || (frame.refId != null && candidate.refId === frame.refId)) {
        matched = j;
        break;
      }
    }

    if (matched >= 0) {
      indices.push(matched);
      cursor = matched + 1;
    } else {
      indices.push(seriesIndex);
    }
  }

  return indices;
}

function emptyStatistics(name: string, seriesIndex: number): SeriesStatistics {
  return {
    seriesName: name,
    seriesIndex,
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
  };
}
