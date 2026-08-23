import { DataFrame, Field } from '@grafana/data';
import { Options } from 'panelcfg';
import { AggregationType, ControlChartData } from 'types';
import { aggregateSeries } from './aggregation';
import { findXField, plottedToRawRows, removeFrameRows, ResolvedExclusions } from './exclusions';

/**
 * Staged control limits (Minitab-style "stages"): the series is split at
 * process-change breakpoints and the center line and control limits are
 * recomputed independently for each stage, rendered as stepped lines that
 * jump at each breakpoint.
 *
 * A breakpoint is identified by the plotted x value of the first point of the
 * new stage — the x survives requeries, whereas a row index would not. For
 * subgrouped charts the plotted x is the subgroup's aggregated (mean) x, so a
 * stage always starts on a subgroup boundary.
 *
 * Breakpoints are persisted in chartOptions.stages (panel JSON).
 */
export interface StageBreakpoint {
  /** Plotted x value of the first point of the stage (epoch ms in time mode, X field value in numeric mode). */
  x: number;
  /** Optional stage name, shown at the divider. */
  label?: string;
}

/** Contiguous run of plotted indices belonging to one stage; end is exclusive. */
export interface StageSegment {
  start: number;
  end: number;
  /** The breakpoint that opened this stage; undefined for the initial stage. */
  breakpoint?: StageBreakpoint;
}

/** Stage breakpoints persisted in panel JSON, shape-validated, sorted by x, deduplicated. */
export function getStages(options: Options | undefined): StageBreakpoint[] {
  const raw = options?.chartOptions?.stages;
  if (!Array.isArray(raw)) {
    return [];
  }
  const valid = raw.filter(
    (s): s is StageBreakpoint =>
      s != null &&
      typeof (s as StageBreakpoint).x === 'number' &&
      ((s as StageBreakpoint).label === undefined || typeof (s as StageBreakpoint).label === 'string')
  );
  const byX = new Map<number, StageBreakpoint>();
  for (const stage of valid) {
    byX.set(stage.x, stage);
  }
  return [...byX.values()].sort((a, b) => a.x - b.x);
}

/** The plotted x values of a frame (subgroup-aggregated when subgroupSize > 1). */
export function plottedXValues(
  frame: DataFrame,
  subgroupSize: number,
  options: Options | undefined,
  xFieldName?: string
): Array<number | null> | null {
  const xField = findXField(frame, xFieldName ?? options?.xField);
  if (!xField) {
    return null;
  }
  return subgroupSize > 1 ? aggregateSeries(xField.values, subgroupSize, AggregationType.Mean) : xField.values;
}

/**
 * Split plotted indices into stage segments: a stage starts at the first
 * point whose x is >= its breakpoint's x and runs to the next breakpoint.
 * Empty segments (breakpoints outside the data, or two breakpoints between
 * the same pair of points) are dropped.
 */
export function stageSegments(plottedX: Array<number | null>, breakpoints: StageBreakpoint[]): StageSegment[] {
  const n = plottedX.length;
  if (n === 0) {
    return [];
  }
  const starts: Array<{ index: number; breakpoint?: StageBreakpoint }> = [{ index: 0 }];
  for (const breakpoint of breakpoints) {
    const index = plottedX.findIndex((x) => typeof x === 'number' && x >= breakpoint.x);
    if (index >= 0) {
      starts.push({ index, breakpoint });
    }
  }
  const segments: StageSegment[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : n;
    if (end > start) {
      segments.push({ start, end, breakpoint: starts[i].breakpoint });
    }
  }
  return segments;
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Fill the excluded slots inside one stage from their nearest neighbour within
 * the same stage, so a positional per-point limit line (EWMA) stays continuous
 * across an excluded point instead of gapping. Mutates `arr` in place.
 */
function fillStageGaps(arr: Array<number | null>, segment: StageSegment, excluded: Set<number>, fullLength: number): void {
  const end = Math.min(segment.end, fullLength);
  let last: number | null = null;
  for (let i = segment.start; i < end; i++) {
    if (arr[i] != null) {
      last = arr[i];
    } else if (excluded.has(i)) {
      arr[i] = last;
    }
  }
  let next: number | null = null;
  for (let i = end - 1; i >= segment.start; i--) {
    if (arr[i] != null) {
      next = arr[i];
    } else if (excluded.has(i)) {
      arr[i] = next;
    }
  }
}

/**
 * Recompute the chart limits per stage, keeping the full plotted data. The
 * per-stage values are published as full-length per-point arrays
 * (centerLineData/upper/lowerControlLimitData) so the lines render stepped;
 * the scalar centerLine/limits carry the LAST stage's values (the current
 * process), which labels, statistics and sigma-line scalars represent.
 *
 * Rows excluded via point exclusion drop out of their stage's compute, and
 * their per-point limit entries stay null — same gap semantics as exclusion
 * without stages. Stages whose compute is not possible (too few points) keep
 * null limits over their span.
 */
export function applyStagesToChartData(
  controlChartData: ControlChartData,
  computeSegment: (segmentFrame: DataFrame, segmentField: Field) => ControlChartData | null,
  frame: DataFrame,
  field: Field,
  segments: StageSegment[],
  subgroupSize: number,
  exclusions: ResolvedExclusions | null
): ControlChartData {
  const fullLength = controlChartData.data.length;
  const fieldIndex = frame.fields.indexOf(field);
  const rawLength = field.values.length;

  const centerLineData: Array<number | null> = new Array(fullLength).fill(null);
  const upperControlLimitData: Array<number | null> = new Array(fullLength).fill(null);
  const lowerControlLimitData: Array<number | null> = new Array(fullLength).fill(null);

  const excludedPlotted = new Set(exclusions?.plottedIndices ?? []);
  let centerLine = controlChartData.centerLine;
  let upperControlLimit = controlChartData.upperControlLimit;
  let lowerControlLimit = controlChartData.lowerControlLimit;
  let anyStageComputed = false;

  for (const segment of segments) {
    // Keep only this stage's rows, minus any excluded rows within it.
    const plottedIndices: number[] = [];
    for (let i = segment.start; i < segment.end && i < fullLength; i++) {
      if (!excludedPlotted.has(i)) {
        plottedIndices.push(i);
      }
    }
    const keepRows = plottedToRawRows(plottedIndices, subgroupSize, rawLength);
    const dropRows = new Set<number>();
    for (let row = 0; row < rawLength; row++) {
      if (!keepRows.has(row)) {
        dropRows.add(row);
      }
    }
    const segmentFrame = removeFrameRows(frame, dropRows);
    const segmentField = segmentFrame.fields[fieldIndex];
    if (!segmentField || plottedIndices.length === 0) {
      continue;
    }
    const result = computeSegment(segmentFrame, segmentField);
    if (!result || !isFiniteNum(result.centerLine)) {
      continue;
    }

    // Stitch the stage's values into the full-length arrays.
    if (result.upperControlLimitData != null || result.lowerControlLimitData != null) {
      // Variable-limit charts (attribute p/np/u): each point carries its own
      // limit, indexed against the stage's non-excluded points in order, so an
      // excluded point genuinely has no limit and stays a null gap.
      plottedIndices.forEach((plottedIndex, j) => {
        centerLineData[plottedIndex] = result.centerLine;
        const upper = result.upperControlLimitData ? result.upperControlLimitData[j] : result.upperControlLimit;
        const lower = result.lowerControlLimitData ? result.lowerControlLimitData[j] : result.lowerControlLimit;
        upperControlLimitData[plottedIndex] = isFiniteNum(upper) ? upper : null;
        lowerControlLimitData[plottedIndex] = isFiniteNum(lower) ? lower : null;
      });
      // Positional per-point limits (EWMA) are defined across excluded points
      // too: fill each excluded slot within this stage from its neighbour so
      // the widening envelope stays continuous.
      if (result.positionalLimits) {
        fillStageGaps(centerLineData, segment, excludedPlotted, fullLength);
        fillStageGaps(upperControlLimitData, segment, excludedPlotted, fullLength);
        fillStageGaps(lowerControlLimitData, segment, excludedPlotted, fullLength);
      }
    } else {
      // Constant-per-stage limits (I-MR, Xbar, CUSUM…): the decision line is a
      // property of the whole stage, so fill its entire span — excluded points
      // included — keeping the line continuous. Those points were still
      // dropped from the estimate above; they are only omitted from the calc,
      // not from the drawn limit.
      for (let i = segment.start; i < segment.end && i < fullLength; i++) {
        centerLineData[i] = result.centerLine;
        upperControlLimitData[i] = isFiniteNum(result.upperControlLimit) ? result.upperControlLimit : null;
        lowerControlLimitData[i] = isFiniteNum(result.lowerControlLimit) ? result.lowerControlLimit : null;
      }
    }

    centerLine = result.centerLine;
    upperControlLimit = result.upperControlLimit;
    lowerControlLimit = result.lowerControlLimit;
    anyStageComputed = true;
  }

  if (!anyStageComputed) {
    return controlChartData;
  }

  return {
    ...controlChartData,
    centerLine,
    upperControlLimit,
    lowerControlLimit,
    centerLineData,
    upperControlLimitData,
    lowerControlLimitData,
  };
}

/**
 * Resolve the configured stages of a frame into plotted-index segments, or
 * null when staging does not apply (no breakpoints, or fewer than 2 segments).
 */
export function resolveStageSegments(
  frame: DataFrame,
  options: Options | undefined,
  subgroupSize: number,
  xFieldName?: string
): StageSegment[] | null {
  const breakpoints = getStages(options);
  if (breakpoints.length === 0) {
    return null;
  }
  const plottedX = plottedXValues(frame, subgroupSize, options, xFieldName);
  if (!plottedX) {
    return null;
  }
  const segments = stageSegments(plottedX, breakpoints);
  return segments.length >= 2 ? segments : null;
}
