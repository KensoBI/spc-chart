import { DataFrame, FieldCalcs, FieldType } from '@grafana/data';
import { Options } from 'panelcfg';
import { calculateControlCharts, calculateStandardStats } from 'calcs/standard';
import { controlLineReducers } from './spcReducers';
import { AggregationType } from 'types';
import {
  calculateMovingRanges,
  calculateNumericRange,
  calculateSampleStandardDeviation,
  chunkArray,
} from 'calcs/common';

//apply data aggregations to all series and save results in field state as FieldCalcs
export function doSpcCalcs(series: DataFrame[], options: Options): DataFrame[] {
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

        //todo check if we need time, maybe just numbers from 1 to field.length and save as not a time field type but a number?
        //for now, just calculate mean time for each subgroup
        if (updatedField.type === FieldType.time) {
          updatedField.values = aggregateSeries(updatedField.values, subgroupSize, AggregationType.Mean);
        } else if (field.type === FieldType.number) {
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

          updatedField.state.range = calculateNumericRange(updatedField.values);

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

function aggregateSeries(values: number[], subgroupSize: number, aggregationType: AggregationType): number[] {
  if (subgroupSize === 1) {
    if (aggregationType === AggregationType.MovingRange) {
      return calculateMovingRanges(values);
    }
    return values;
  }

  const subgroups = chunkArray(values, subgroupSize);

  if (aggregationType === AggregationType.Range) {
    //calculate range for each subgroup
    return subgroups.map((subgroup) => Math.max(...subgroup) - Math.min(...subgroup));
  }

  if (aggregationType === AggregationType.Mean) {
    //calculate mean for each subgroup
    return subgroups.map((subgroup) => subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length);
  }

  if (aggregationType === AggregationType.StandardDeviation) {
    //calculate standard deviation for each subgroup
    return subgroups.map(calculateSampleStandardDeviation);
  }

  return values;
}
