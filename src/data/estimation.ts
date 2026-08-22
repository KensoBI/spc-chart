import { Options } from 'panelcfg';
import { methodSupportsUnbiasing, SigmaMethod, sigmaMethodLabels } from 'calcs/sigma';

/**
 * How a chart's center line and control limits are derived, persisted in panel
 * JSON under chartOptions.estimation (Minitab's Parameters + Estimate tabs).
 *
 * The engine lives in the free panel so a dashboard authored with SPC Chart PRO
 * renders identical limits for a viewer who only has the free panel; PRO adds
 * the editors that write these values.
 */
export interface EstimationOptions {
  /**
   * 'auto' (the default) ignores every other field and uses the chart's own
   * default estimator, so returning to Automatic never requires clearing the
   * custom values the user may want back.
   */
  mode?: 'auto' | 'custom';
  sigmaMethod?: SigmaMethod;
  /** Apply the unbiasing constant, where the method has one. Defaults to true. */
  unbias?: boolean;
  /** Known process mean µ. When set, it replaces the mean estimated from the data. */
  historicalMean?: number;
  /** Known process standard deviation σ. When set, no sigma is estimated at all. */
  historicalSigma?: number;
}

/** Estimation settings validated against what the active chart type supports. */
export interface ResolvedEstimation {
  method: SigmaMethod;
  unbias: boolean;
  mean?: number;
  sigma?: number;
  /**
   * True when this is exactly what the chart would do untouched: its default
   * estimator, no historical sigma. Charts keep their classic tabulated-constant
   * formulas in that case, so existing dashboards render bit-identical limits.
   */
  isDefault: boolean;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Raw estimation settings from panel JSON, shape-validated. */
export function getEstimationOptions(chartOptions: Record<string, unknown> | undefined): EstimationOptions {
  const raw = chartOptions?.estimation;
  if (raw == null || typeof raw !== 'object') {
    return {};
  }
  return raw as EstimationOptions;
}

/**
 * Resolve stored settings against the methods the active chart accepts. An
 * unsupported method (left behind by switching chart type) silently falls back
 * to the chart's default rather than producing limits from an estimator that
 * does not apply to the data.
 */
export function resolveEstimation(
  chartOptions: Record<string, unknown> | undefined,
  supportedMethods: SigmaMethod[]
): ResolvedEstimation {
  const defaultMethod = supportedMethods[0];
  const stored = getEstimationOptions(chartOptions);

  if (stored.mode !== 'custom') {
    return { method: defaultMethod, unbias: true, isDefault: true };
  }

  const method =
    stored.sigmaMethod && supportedMethods.includes(stored.sigmaMethod) ? stored.sigmaMethod : defaultMethod;
  const mean = isFiniteNumber(stored.historicalMean) ? stored.historicalMean : undefined;
  const sigma = isFiniteNumber(stored.historicalSigma) && stored.historicalSigma > 0 ? stored.historicalSigma : undefined;
  const unbias = methodSupportsUnbiasing(method) ? stored.unbias !== false : true;

  return {
    method,
    unbias,
    mean,
    sigma,
    isDefault: method === defaultMethod && sigma === undefined,
  };
}

/** Same resolution from full panel options, for callers outside the calc pipeline. */
export function resolveEstimationFromOptions(
  options: Options | undefined,
  supportedMethods: SigmaMethod[]
): ResolvedEstimation {
  return resolveEstimation(options?.chartOptions, supportedMethods);
}

/** One-line summary of what is actually in force, shown next to the editor. */
export function describeEstimation(estimation: ResolvedEstimation): string {
  const parts: string[] = [];
  if (estimation.sigma !== undefined) {
    parts.push(`historical σ = ${estimation.sigma}`);
  } else {
    parts.push(sigmaMethodLabels[estimation.method]);
    if (methodSupportsUnbiasing(estimation.method) && !estimation.unbias) {
      parts.push('no unbiasing constant');
    }
  }
  if (estimation.mean !== undefined) {
    parts.push(`historical µ = ${estimation.mean}`);
  }
  return parts.join(' · ');
}
