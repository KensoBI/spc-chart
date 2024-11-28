export const SUBGROUP_SIZE_VARIABLE = 'subgroupsize';

export type LimitConfigItem = {
  name: string;
  color: string;
};

export enum SpcChartTyp {
  none = 'none',
  x_XmR = 'X-XmR',
  mR_XmR = 'mR-XmR',
  x_XbarR = 'X-XbarR',
  r_XbarR = 'R-XbarR',
  x_XbarS = 'X-XbarS',
  s_XbarS = 'S-XbarS',
}

export enum CurveFit {
  none = 'none',
  histogram = 'Histogram',
  gaussian = 'Gaussian',
}

export enum AggregationType {
  none = 'none',
  Mean = 'Mean',
  Range = 'Range',
  StandardDeviation = 'Standard deviation',
  MovingRange = 'Moving range',
}

export enum PositionInput {
  static = 'Static',
  series = 'Series',
}

export interface ControlChartData {
  centerLine: number;
  upperControlLimit: number;
  lowerControlLimit: number;
  data: number[];
}

export enum FieldCalcsTypes {
  last = 'last',
  first = 'first',
  min = 'min',
  max = 'max',
  none = 'none',
}
