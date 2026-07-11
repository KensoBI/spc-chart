import { DataFrame, FieldCalcs, FieldType } from '@grafana/data';
import { Options } from 'panelcfg';
import { calculateControlCharts, calculateStandardStats } from 'calcs/standard';
import { controlLineReducers } from './spcReducers';
import { AggregationType } from 'types';
import { calculateNumericRange, calculateSampleStandardDeviation, chunkArray } from 'calcs/common';

//apply data aggregations to all series and save results in field state as FieldCalcs
export function doSpcCalcs(series: DataFrame[], options: Options, xFieldIdx?: number): DataFrame[] {
  const subgroupSize = options.subgroupSize < 1 ? 1 : options.subgroupSize;
  const aggregationType = options.aggregationType ?? 'none';
  const standardReducers = controlLineReducers.filter((p) => p.isStandard).map((p) => p.id);

  return series.map((frame, frameIndex) => {
    const shouldCalculateStandardStats =
      options.controlLines.filter((c) => standardReducers.includes(c.reducerId)).length > 0;

    return {
      ...frame,
      fields: frame.fields.map((field) => {
        const updatedField = { ...field };

        // Check if this is the numeric X field (for trend/numeric x-axis mode)
        const isNumericXField = xFieldIdx !== undefined && frame.fields.indexOf(field) === xFieldIdx;

        // Aggregate time field or numeric X field when using subgroups
        if (updatedField.type === FieldType.time || isNumericXField) {
          updatedField.values = aggregateSeries(updatedField.values, subgroupSize, AggregationType.Mean);
          // Don't process numeric X field as a value field
          if (isNumericXField) {
            return updatedField;
          }
        }

        if (field.type === FieldType.number && !isNumericXField) {
          updatedField.state = updatedField.state || {};

          const fieldCalcs: FieldCalcs = {
            lcl: null,
            ucl: null,
            mean: null,
          };

          // replace old calculations with a new set since values may have changed due to aggregations,
          // rendering cached calculations incorrect.
          updatedField.state.calcs = fieldCalcs;

          //calculate control charts
          const controlChartData = calculateControlCharts(updatedField, options.chartType, subgroupSize);
          if (controlChartData) {
            updatedField.values = controlChartData.data;
            updatedField.state.calcs.lcl = controlChartData.lowerControlLimit;
            updatedField.state.calcs.ucl = controlChartData.upperControlLimit;
            updatedField.state.calcs.mean = controlChartData.centerLine;
          } else {
            //calculate series based on aggregation type
            updatedField.values = aggregateSeries(updatedField.values, subgroupSize, aggregationType);
          }

          // Compute the range over valid numbers only so nulls (gaps) and NaN do not distort it.
          updatedField.state.range = calculateNumericRange(updatedField.values.filter(isValidNumber));

          if (shouldCalculateStandardStats) {
            const standardStats = calculateStandardStats(updatedField);

            updatedField.state.calcs = {
              ...updatedField.state.calcs,
              ...standardStats,
            };
          }
        }

        return updatedField;
      }),
    };
  });
}

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

// Aggregate each subgroup over its valid numbers only: nulls must not coerce to 0 and NaN must
// not poison the result. A subgroup without enough valid values yields null (a gap in the chart).
function aggregateSeries(
  values: number[],
  subgroupSize: number,
  aggregationType: AggregationType
): Array<number | null> {
  if (subgroupSize === 1) {
    if (aggregationType === AggregationType.MovingRange) {
      // A moving range is only defined when both neighbours are valid numbers.
      const movingRanges: Array<number | null> = [];
      for (let i = 1; i < values.length; i++) {
        movingRanges.push(
          isValidNumber(values[i]) && isValidNumber(values[i - 1]) ? Math.abs(values[i] - values[i - 1]) : null
        );
      }
      return movingRanges;
    }
    return values;
  }

  const subgroups = chunkArray(values, subgroupSize);

  if (aggregationType === AggregationType.Range) {
    return subgroups.map((subgroup) => {
      const valid = subgroup.filter(isValidNumber);
      return valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : null;
    });
  }

  if (aggregationType === AggregationType.Mean) {
    return subgroups.map((subgroup) => {
      const valid = subgroup.filter(isValidNumber);
      return valid.length > 0 ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
    });
  }

  if (aggregationType === AggregationType.StandardDeviation) {
    return subgroups.map((subgroup) => {
      const valid = subgroup.filter(isValidNumber);
      return valid.length > 1 ? calculateSampleStandardDeviation(valid) : null;
    });
  }

  return values;
}
