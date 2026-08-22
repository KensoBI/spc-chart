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
  /** Plotted values per subgroup; null marks a subgroup that could not be computed (gap). */
  data: Array<number | null>;
  /**
   * Per-point control limits for charts whose limits vary with the subgroup's
   * sample size (attribute p/np/u charts). Same length as data. When present,
   * the scalar limits above are the representative values derived from the
   * average sample size, used for labels, statistics, and fills.
   */
  upperControlLimitData?: Array<number | null>;
  lowerControlLimitData?: Array<number | null>;
  /**
   * Per-point center line for staged charts (the center jumps at each stage
   * breakpoint). Same length as data; the scalar centerLine holds the last
   * stage's value.
   */
  centerLineData?: Array<number | null>;
  /**
   * Whether the per-point limits are a smooth function of a point's position
   * rather than its own data — true for time-weighted charts (EWMA), where the
   * limits widen with the point index and are defined at every position. An
   * excluded point still lies under that envelope, so its limit slot is filled
   * from the neighbouring limit to keep the lines continuous. Attribute charts
   * leave this false: their limits depend on each point's sample size, so an
   * excluded point genuinely has none and stays a gap.
   */
  positionalLimits?: boolean;
  /**
   * Display name for the primary plotted series, overriding the field name in
   * the legend (e.g. the upper sum of a CUSUM chart). The field keeps its own
   * name, so control lines and per-field lookups are unaffected.
   */
  primarySeriesName?: string;
  /**
   * Additional plotted series derived from the same field — e.g. the upper and
   * lower sums of a CUSUM chart. Each renders as its own line, shares this
   * field's control limits (so run rules test it too), and is skipped by the
   * statistics table.
   */
  extraSeries?: ChartExtraSeries[];
}

/** One companion series of a multi-series chart type (see ControlChartData.extraSeries). */
export interface ChartExtraSeries {
  /** Series name and legend label; must be unique within the frame. */
  name: string;
  /** Plotted values; null marks a gap. Same length as the primary series. */
  data: Array<number | null>;
}

/** Marks a field materialized from ControlChartData.extraSeries; set in field.config.custom. */
export const SPC_COMPANION_SERIES = 'spcCompanionSeries';

/** Control-chart calculations cached on field.state.calcs by doSpcCalcs. */
export interface SpcFieldCalcs {
  lcl: number | null;
  ucl: number | null;
  mean: number | null;
  /** Per-point limits (variable-limit charts only); scalar lcl/ucl hold the representative values. */
  lclData?: Array<number | null>;
  uclData?: Array<number | null>;
  /** Per-point center line (staged charts only); scalar mean holds the last stage's value. */
  meanData?: Array<number | null>;
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
