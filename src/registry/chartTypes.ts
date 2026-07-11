import { Field } from '@grafana/data';
import { Options } from 'panelcfg';
import { AggregationType, ControlChartData } from 'types';

export type ChartTypeFamily = 'variables' | 'attribute' | 'time-weighted' | 'rare-event';

/**
 * Context handed to a chart type's compute function. Carries everything the
 * calculation may need beyond the field itself, so new chart types never
 * require changes to the calc pipeline.
 */
export interface SpcCalcContext {
  subgroupSize: number;
  aggregationType?: AggregationType;
  /** Full panel options (read-only). Absent when invoked outside the panel, e.g. from unit tests. */
  options?: Options;
  /** Per-chart-type parameter bag (Options.chartOptions). */
  chartOptions?: Record<string, unknown>;
}

export interface ChartTypeDefinition {
  /** Stable id persisted in dashboard JSON (see SpcChartTyp for the built-in values). */
  id: string;
  /** Label shown in the chart type select. */
  label: string;
  family: ChartTypeFamily;
  /** Inclusive subgroup-size bounds for which this chart type is defined. */
  subgroupSize: { min: number; max: number };
  /** Transform raw observations into the plotted series and control limits. */
  compute: (field: Field, ctx: SpcCalcContext) => ControlChartData | null;
  /**
   * Within-subgroup sigma estimate over the raw observations, used for Cp/Cpk.
   * When absent, capability falls back to the standard estimators in
   * calcs/capability (Rbar/d2, sbar/c4, moving range).
   */
  estimateSigmaWithin?: (values: number[], ctx: SpcCalcContext) => number | null;
}

const registry = new Map<string, ChartTypeDefinition>();

export function registerChartType(definition: ChartTypeDefinition): void {
  registry.set(definition.id, definition);
}

export function getChartType(id: string): ChartTypeDefinition | undefined {
  return registry.get(id);
}

/** Registered chart types in registration order. */
export function listChartTypes(): ChartTypeDefinition[] {
  return [...registry.values()];
}

/**
 * Look up a chart type and run it. Returns null for unknown ids and for
 * subgroup sizes outside the chart type's bounds, in which case the caller
 * falls back to plain aggregation.
 */
export function computeChartType(field: Field, chartTypeId: string, ctx: SpcCalcContext): ControlChartData | null {
  const chartType = getChartType(chartTypeId);
  if (!chartType) {
    return null;
  }
  if (ctx.subgroupSize < chartType.subgroupSize.min || ctx.subgroupSize > chartType.subgroupSize.max) {
    return null;
  }
  return chartType.compute(field, ctx);
}
