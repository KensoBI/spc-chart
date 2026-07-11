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

/** Control-chart calculations cached on field.state.calcs by doSpcCalcs. */
export interface SpcFieldCalcs {
  lcl: number | null;
  ucl: number | null;
  mean: number | null;
}

export type SpcViolationSeverity = 'info' | 'warning' | 'critical';

/**
 * A run-rule (out-of-control test) hit on a single plotted point. This schema
 * is a stable contract: rule engines populate it and downstream consumers
 * (overlays, annotations, external systems) read it — keep changes additive.
 */
export interface SpcViolation {
  /** Identifier of the violated rule, e.g. 'nelson-1'. */
  ruleId: string;
  /** Index of the violating point in the plotted series. */
  pointIndex: number;
  /** Index of the frame the series belongs to. */
  seriesIndex: number;
  /** X value of the point (epoch ms in time mode, X field value in numeric mode). */
  x?: number;
  severity: SpcViolationSeverity;
  message?: string;
}

export enum FieldCalcsTypes {
  last = 'last',
  first = 'first',
  min = 'min',
  max = 'max',
  none = 'none',
}
