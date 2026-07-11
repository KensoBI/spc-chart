import { DataFrame, Field, FieldType } from '@grafana/data';
import { Options, ControlLine } from 'panelcfg';
import { ControlLineReducerId } from 'data/spcReducers';
import { PositionInput } from 'types';
import { estimateSigmaWithin, calculateCapability } from 'calcs/capability';
import { calculateStandardStats } from 'calcs/standard';
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
    const valueFields = frame.fields.filter((f) => f.type === FieldType.number && f.name !== xFieldName);

    if (valueFields.length === 0) {
      return [emptyStatistics(frame.name || `Series ${seriesIndex}`, seriesIndex)];
    }

    // Extract USL/LSL for this series. Control-line seriesIndex is expressed in terms of the
    // full frame array, so map this data frame back to its index there before matching.
    const fullIndex = indexOfFrame(allSeries, frame, seriesIndex);
    const { lsl, usl } = selectSpecLimits(specLimits, fullIndex);
    const rawFrame = findRawFrame(rawSeries, frame, seriesIndex);

    return valueFields.map((numericField) => {
      // Control chart limits belong to the plotted chart, computed by doSpcCalcs.
      const chartCalcs = numericField.state?.calcs;

      // Everything else describes the raw individual observations of this same field.
      const rawField = findRawFieldByName(rawFrame, numericField.name) ?? numericField;
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
        : estimateSigmaWithin(rawValues, options.chartType, options.subgroupSize);

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

/** Find the raw counterpart of a plotted frame by refId, falling back to position. */
function findRawFrame(
  rawSeries: DataFrame[] | undefined,
  frame: DataFrame,
  seriesIndex: number
): DataFrame | undefined {
  if (!rawSeries) {
    return undefined;
  }
  return (frame.refId != null ? rawSeries.find((f) => f.refId === frame.refId) : undefined) ?? rawSeries[seriesIndex];
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
    const frame = allSeries[cl.seriesIndex];
    if (!frame) {
      return null;
    }
    const field = frame.fields.find((f) => f.name === cl.field);
    if (field && field.values.length > 0) {
      const lastValue = field.values[field.values.length - 1];
      if (typeof lastValue === 'number' && !Number.isNaN(lastValue)) {
        return lastValue;
      }
    }
    return null;
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

/** Locate a data frame within the full frame array by identity, then refId, falling back to `fallback`. */
function indexOfFrame(allSeries: DataFrame[], frame: DataFrame, fallback: number): number {
  const byIdentity = allSeries.indexOf(frame);
  if (byIdentity >= 0) {
    return byIdentity;
  }
  if (frame.refId != null) {
    const byRefId = allSeries.findIndex((f) => f.refId === frame.refId);
    if (byRefId >= 0) {
      return byRefId;
    }
  }
  return fallback;
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
