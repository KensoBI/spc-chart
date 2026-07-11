import { AggregationType } from 'types';
import { calculateSampleStandardDeviation, chunkArray } from 'calcs/common';

export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

// Aggregate each subgroup over its valid numbers only: nulls must not coerce to 0 and NaN must
// not poison the result. A subgroup without enough valid values yields null (a gap in the chart).
export function aggregateSeries(
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
