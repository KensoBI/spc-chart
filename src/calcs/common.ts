import { NumericRange } from '@grafana/data';

export function chunkArray(array: number[], size: number): number[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export function calculateSampleStandardDeviation(subgroup: number[]): number {
  const mean = subgroup.reduce((sum, value) => sum + value, 0) / subgroup.length;
  const squaredDifferences = subgroup.map((value) => Math.pow(value - mean, 2));
  const stdDev = Math.sqrt(squaredDifferences.reduce((sum, value) => sum + value, 0) / (subgroup.length - 1));
  return stdDev;
}

export function calculateMovingRanges(data: number[]): number[] {
  const movingRanges = [];
  for (let i = 1; i < data.length; i++) {
    movingRanges.push(Math.abs(data[i] - data[i - 1]));
  }
  return movingRanges;
}

export function calculateNumericRange(values: number[]): NumericRange {
  if (values.length === 0) {
    return { delta: 0, min: 0, max: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const delta = max - min;

  return {
    delta,
    max,
    min,
  };
}
