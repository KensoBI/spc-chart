import { DataFrame, Field, FieldConfigSource, FieldType } from '@grafana/data';
import { ControlLine, Options } from 'panelcfg';
import { controlLineReducers } from 'data/spcReducers';
import { resolveSeriesLinePosition } from 'data/seriesLimits';
import { Flag, LimitAnnotation, LimitAnnotationConfig, Region } from './LimitAnnotations';
import { PositionInput } from 'types';
import {
  FieldColorModeId,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  GraphTransform,
  LineInterpolation,
} from '@grafana/schema';

/**
 * @param plottedPointCount Number of points on the plotted x-axis. A "Series" control line whose
 *                          reference field carries exactly this many differing values becomes a
 *                          variable (stepped) limit; see resolveSeriesLinePosition.
 */
export function computeControlLine(series: DataFrame[], options: Options, plottedPointCount?: number): ControlLine[] {
  const controlLines = options.controlLines.map((cl) => ({ ...cl }));

  const computedControlLines = processComputedControlLines(series, controlLines, options.featureQueryRefIds);
  const allControlLines = processNonComputedControlLines(series, computedControlLines, plottedPointCount);

  return allControlLines.filter((p) => p.position != null);
}

/**
 * The x-axis the control lines are drawn against: the first plotted frame that carries one.
 * Feature frames are not plotted, so they must not be offered here — their timestamps need not
 * match the process data's.
 */
export function findPlotXField(plottedSeries: DataFrame[], xFieldName?: string): Field | null {
  const useNumericX = xFieldName != null;

  for (let dataframe of plottedSeries) {
    if (useNumericX) {
      // Find the numeric X field by name, so frames need not agree on column order
      const field = dataframe.fields.find((f) => f.name === xFieldName && f.type === FieldType.number);
      if (field) {
        return field;
      }
    } else {
      // Find the time field
      const field = dataframe.fields.find(
        (f) => f.type === FieldType.time && (!f.state || !f.state.hideFrom || !f.state.hideFrom.viz)
      );
      if (field) {
        return field;
      }
    }
  }

  return null;
}

/**
 * @param plottedSeries Frames that are actually drawn; supplies the x-axis of the control lines.
 * @param allSeries     Full frame array including feature frames, which `seriesIndex` indexes into.
 */
export function buildControlLineFrame(
  plottedSeries: DataFrame[],
  controlLines: ControlLine[],
  defaults: FieldConfigSource,
  xFieldName?: string,
  allSeries: DataFrame[] = plottedSeries
): DataFrame[] {
  if (!controlLines.length) {
    return [];
  }

  const useNumericX = xFieldName != null;
  const xField = findPlotXField(plottedSeries, xFieldName);

  let xValues: any[] = useNumericX ? [0] : [new Date().toISOString()]; // Default values

  if (xField) {
    xValues = [...xField.values];
  }

  // Create X-axis field - use numeric type in numeric X mode, time type otherwise
  const xAxisField = {
    name: useNumericX ? xField?.name || 'x' : 'time',
    type: useNumericX ? FieldType.number : FieldType.time,
    values: xValues,
    config: {},
    state: {},
  };

  let fields: any[] = [xAxisField];

  const constantDataFrame: DataFrame = {
    name: 'control limits',
    fields,
    length: xValues.length,
  };

  const allIndexes = allSeries.map((_, index) => index);

  controlLines.forEach((cl, index) => {
    if (!allIndexes.includes(cl.seriesIndex)) {
      return;
    }

    // Stepped lines (variable-limit charts) carry one position per point;
    // constant lines repeat the scalar position across the x range.
    const stepped = cl.positionData != null && cl.positionData.length > 0;

    const custom: GraphFieldConfig = {
      transform: !stepped && xField === null ? GraphTransform.Constant : undefined, // this will allow grafana to transform this field into a constant
      lineWidth: cl.lineWidth,
      gradientMode: GraphGradientMode.None,
      lineInterpolation: stepped ? LineInterpolation.StepAfter : LineInterpolation.Smooth,
      drawStyle: GraphDrawStyle.Line,
    };

    const constant = {
      name: cl.name,
      type: FieldType.number,
      values: stepped
        ? xAxisField.values.map((_, i) => cl.positionData![i] ?? null)
        : xAxisField.values.map(() => cl.position),
      config: {
        custom,
        color: {
          mode: FieldColorModeId.Fixed,
          fixedColor: cl.lineColor,
          fillOpacity: cl.fillOpacity,
          gradientMode: GraphGradientMode.Opacity,
        },
        displayName: cl.name,
        unit: defaults.defaults.unit,
        decimals: defaults.defaults.decimals,
      },
    };

    constantDataFrame.fields.push(constant);
  });

  return [constantDataFrame];
}

export function buildLimitAnnotations(series: DataFrame[], controlLines: ControlLine[]): LimitAnnotationConfig {
  if (!controlLines.length) {
    return {
      limits: [],
    };
  }

  const allIndexes = series.map((_, index) => index);
  const limits: LimitAnnotation[] = [];

  // Sort controlLines by position
  const sortedControlLines = [...controlLines].sort((a, b) => a.position! - b.position!);

  sortedControlLines.forEach((cl, index) => {
    if (!allIndexes.includes(cl.seriesIndex)) {
      return;
    }

    const flag: Flag = {
      type: 'flag',
      time: cl.position!,
      title: cl.name,
      color: cl.lineColor,
      lineWidth: cl.lineWidth,
    };
    limits.push(flag);

    if (cl.fillDirection === -1) {
      // Find the previous control line with a non-zero fillDirection
      let prevControlLine;
      for (let i = index - 1; i >= 0; i--) {
        if (sortedControlLines[i].fillDirection !== 0) {
          prevControlLine = sortedControlLines[i];
          break;
        }
      }
      // Add region from the left. A variable limit contributes its per-point positions so the
      // shaded area steps with the line instead of staying flat at the line's first value.
      const regionLeft: Region = {
        type: 'region',
        timeEnd: cl.position,
        timeStart: prevControlLine ? prevControlLine.position : undefined,
        valuesEnd: cl.positionData,
        valuesStart: prevControlLine?.positionData,
        title: cl.name,
        color: cl.lineColor,
        lineWidth: cl.lineWidth,
        fillOpacity: cl.fillOpacity,
      };
      limits.push(regionLeft);
    } else if (cl.fillDirection === 1) {
      // Find the next control line with a non-zero fillDirection
      let nextControlLine;
      for (let i = index + 1; i < sortedControlLines.length; i++) {
        if (sortedControlLines[i].fillDirection !== 0) {
          nextControlLine = sortedControlLines[i];
          break;
        }
      }

      // Add region from the right
      const regionRight: Region = {
        type: 'region',
        timeStart: cl.position,
        timeEnd: nextControlLine ? nextControlLine.position : undefined,
        valuesStart: cl.positionData,
        valuesEnd: nextControlLine?.positionData,
        title: cl.name,
        color: cl.lineColor,
        lineWidth: cl.lineWidth,
        fillOpacity: cl.fillOpacity,
      };
      limits.push(regionRight);
    }
  });

  return {
    limits,
  };
}

function processComputedControlLines(
  series: DataFrame[],
  controlLines: ControlLine[],
  featureQueryRefIds: string[]
): ControlLine[] {
  if (!controlLines || controlLines.length === 0) {
    return controlLines;
  }

  // Extract IDs of all computed reducers
  const computedReducers = controlLineReducers.filter((p) => p.computed).map((p) => p.id);

  // Filter computed control lines
  const computedControlLines = controlLines.filter((cl) => computedReducers.includes(cl.reducerId));

  // If no computed control lines, return the original array
  if (computedControlLines.length === 0) {
    return controlLines;
  }

  // Map through control lines and compute positions
  const updatedControlLines = controlLines.map((cl) => {
    if (!computedReducers.includes(cl.reducerId)) {
      return cl;
    }

    const applicableSeries = series.filter(
      (frame) => !featureQueryRefIds || !featureQueryRefIds.includes(frame.refId!)
    );

    if (cl.seriesIndex == null || cl.seriesIndex < 0 || cl.seriesIndex >= applicableSeries.length) {
      return cl; // Skip if series index is invalid
    }

    const frame = applicableSeries[cl.seriesIndex];

    // Find the target field - use specified field name if provided, otherwise find first numeric field
    let numericField;
    if (cl.field) {
      numericField = frame.fields.find(
        (field) => field.name === cl.field && field.type === FieldType.number && field.state?.calcs
      );
    } else {
      numericField = frame.fields.find((field) => field.type === FieldType.number && field.state?.calcs);
    }

    if (!numericField || !numericField.state?.calcs) {
      return cl; // Skip if no valid numeric field with cached calculations
    }

    // Assign the computed value to the position. When the statistic could not be computed
    // (insufficient data yields null), drop the line instead of falling back to the editor
    // default position, which would draw a spurious line at 0.
    const computedValue = numericField.state.calcs[cl.reducerId];

    // Variable-limit charts publish per-point positions under `<reducerId>Data`;
    // carry them so the line renders stepped instead of constant.
    const computedData = numericField.state.calcs[`${cl.reducerId}Data`];
    return {
      ...cl,
      position: computedValue ?? undefined,
      positionData: Array.isArray(computedData) ? computedData : undefined,
    };
  });

  return updatedControlLines;
}

function processNonComputedControlLines(
  series: DataFrame[],
  controlLines: ControlLine[],
  plottedPointCount?: number
): ControlLine[] {
  if (!controlLines || controlLines.length === 0) {
    return controlLines;
  }

  controlLines.forEach((cl) => {
    if (cl.positionInput !== PositionInput.series) {
      return;
    }

    // seriesIndex is expressed against the full frame array, so the reference field may live
    // in a feature frame; an out-of-range index simply yields no frame and leaves the line as is.
    const resolved = resolveSeriesLinePosition(series[cl.seriesIndex], cl.field, plottedPointCount);
    if (!resolved) {
      return;
    }

    cl.position = resolved.position;
    cl.positionData = resolved.positionData;
  });

  return controlLines;
}
