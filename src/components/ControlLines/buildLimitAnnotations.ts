import { DataFrame, FieldConfigSource, FieldType } from '@grafana/data';
import { ControlLine, Options } from 'panelcfg';
import { controlLineReducers } from 'data/spcReducers';
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

export function computeControlLine(series: DataFrame[], options: Options): ControlLine[] {
  const controlLines = options.controlLines.map((cl) => ({ ...cl }));

  const computedControlLines = processComputedControlLines(series, controlLines, options.featureQueryRefIds);
  const allControlLines = processNonComputedControlLines(series, computedControlLines);

  return allControlLines.filter((p) => p.position !== undefined);
}

export function buildControlLineFrame(
  series: DataFrame[],
  controlLines: ControlLine[],
  defaults: FieldConfigSource
): DataFrame[] {
  if (!controlLines.length) {
    return [];
  }

  let timeField = null;

  for (let dataframe of series) {
    timeField = dataframe.fields.find(
      (field) => field.type === FieldType.time && (!field.state || !field.state.hideFrom || !field.state.hideFrom.viz)
    );

    if (timeField) {
      break;
    }
  }

  let timeValues = [new Date().toISOString()]; // Default to current date

  if (timeField) {
    timeValues = [...timeField.values];
  }

  const timeFields = {
    name: 'time',
    type: FieldType.time,
    values: timeValues,
    config: {},
  };

  const constantDataFrame: DataFrame = {
    name: 'control limits',
    fields: [timeFields],
    length: timeValues.length,
  };

  const allIndexes = series.map((_, index) => index);

  controlLines.forEach((cl, index) => {
    if (!allIndexes.includes(cl.seriesIndex)) {
      return;
    }

    const custom: GraphFieldConfig = {
      transform: timeField === null ? GraphTransform.Constant : undefined, // this will allow grafana to transform this field into a constant
      lineWidth: cl.lineWidth,
      gradientMode: GraphGradientMode.None,
      lineInterpolation: LineInterpolation.Smooth,
      drawStyle: GraphDrawStyle.Line,
    };

    const constant = {
      name: cl.name,
      type: FieldType.number,
      values: timeFields.values.map(() => cl.position),
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
      // Add region from the left
      const regionLeft: Region = {
        type: 'region',
        timeEnd: cl.position,
        timeStart: prevControlLine ? prevControlLine.position : undefined,
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
    const numericField = frame.fields.find((field) => field.type === FieldType.number && field.state?.calcs);

    if (!numericField || !numericField.state?.calcs) {
      return cl; // Skip if no valid numeric field with cached calculations
    }

    // Assign the computed value to the position
    const computedValue = numericField.state.calcs[cl.reducerId];
    return {
      ...cl,
      position: computedValue ?? cl.position, // Keep existing position if computed value is undefined
    };
  });

  return updatedControlLines;
}

function processNonComputedControlLines(series: DataFrame[], controlLines: ControlLine[]): ControlLine[] {
  if (!controlLines || controlLines.length === 0) {
    return controlLines;
  }

  series.map((frame, frameIndex) => {
    controlLines.forEach((cl) => {
      if (cl.positionInput === PositionInput.series && cl.seriesIndex === frameIndex) {
        const field = frame.fields.find((f) => f.name === cl.field);

        if (field && field.values.length > 0) {
          const lastValue = field.values[field.values.length - 1];

          if (typeof lastValue === 'number') {
            cl.position = lastValue;
          }
        }
      }
    });
  });

  return controlLines;
}
