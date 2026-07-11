import { Field, FieldCalcs, FieldType } from '@grafana/data';
import { isNumber } from 'lodash';
import { ControlChartData, SpcChartTyp } from 'types';
import { computeChartType } from 'registry/chartTypes';
import 'registry/builtinChartTypes';
import { calculateSampleStandardDeviation } from './common';

export function calculateStandardStats(field: Field): FieldCalcs {
  const calcs: FieldCalcs = {
    count: 0,
    sum: 0,
    mean: null,
    max: null,
    min: null,
    first: null,
    last: null,
    range: null,
    diff: null,
    diffperc: null,
  };

  const data = field.values;
  const isNumberField = field.type === FieldType.number || field.type === FieldType.time;

  if (!data || !isNumberField) {
    return calcs;
  }

  let validValueFound = false;
  const validValues: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const currentValue = data[i];

    // Ignore null and non-number values
    if (currentValue == null || Number.isNaN(currentValue)) {
      continue;
    }

    //in case first few values are not numbers...
    if (!validValueFound) {
      calcs.first = currentValue;
      calcs.max = currentValue;
      calcs.min = currentValue;
      validValueFound = true;
    }

    validValues.push(currentValue);
    calcs.last = currentValue;
    calcs.count++;
    calcs.sum += currentValue;

    if (currentValue > calcs.max!) {
      calcs.max = currentValue;
    }

    if (currentValue < calcs.min!) {
      calcs.min = currentValue;
    }
  }

  if (calcs.count > 0) {
    calcs.mean = calcs.sum / calcs.count;
  }

  // Sample standard deviation needs at least two valid values; compute it over the
  // filtered values so nulls and NaNs cannot distort it.
  calcs.stdDev = calcs.count > 1 ? calculateSampleStandardDeviation(validValues) : null;

  if (calcs.max !== null && calcs.min !== null) {
    calcs.range = calcs.max - calcs.min;
  }

  if (isNumber(calcs.first) && isNumber(calcs.last)) {
    calcs.diff = calcs.last - calcs.first;
  }

  if (isNumber(calcs.first) && isNumber(calcs.diff) && calcs.first !== 0) {
    calcs.diffperc = calcs.diff / calcs.first;
  }

  return calcs;
}

export function calculateControlCharts(
  field: Field,
  chartType: SpcChartTyp | string,
  subgroupSize: number
): ControlChartData | null {
  return computeChartType(field, chartType, { subgroupSize });
}
