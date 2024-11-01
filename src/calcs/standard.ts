import { Field, FieldCalcs, FieldType } from '@grafana/data';
import { isNumber } from 'lodash';
import { ControlChartData, SpcChartTyp } from 'types';
import { createXbarChartForXbarR, createRChartForXbarR } from './xbarr';
import { createXbarChartForXbarS, createSChartForXbarS } from './xbars';
import { createXChartXmR, createMRChartXmR } from './xmr';
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

  if (calcs.count > 0) {
    calcs.stdDev = calculateSampleStandardDeviation(data);
  }

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
  chartType: SpcChartTyp,
  subgroupSize: number
): ControlChartData | null {
  // Ignore null and non-number values
  const values = field.values.filter(
    (value) => value !== null && value !== undefined && typeof value === 'number' && !Number.isNaN(value)
  );
  const isValidSubgroupSize = (size: number) => size >= 2 && size <= 25;

  switch (chartType) {
    case SpcChartTyp.x_XbarR:
      return isValidSubgroupSize(subgroupSize) ? createXbarChartForXbarR(values, subgroupSize) : null;
    case SpcChartTyp.r_XbarR:
      return isValidSubgroupSize(subgroupSize) ? createRChartForXbarR(values, subgroupSize) : null;
    case SpcChartTyp.x_XbarS:
      return isValidSubgroupSize(subgroupSize) ? createXbarChartForXbarS(values, subgroupSize) : null;
    case SpcChartTyp.s_XbarS:
      return isValidSubgroupSize(subgroupSize) ? createSChartForXbarS(values, subgroupSize) : null;
    case SpcChartTyp.x_XmR:
      return createXChartXmR(values);
    case SpcChartTyp.mR_XmR:
      return createMRChartXmR(values);
    default:
      return null;
  }
}
