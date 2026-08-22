import { DataFrame, Field } from '@grafana/data';
import { SigmaMethod } from 'calcs/sigma';
import { Options } from 'panelcfg';
import { AggregationType, ControlChartData } from 'types';

export type ChartTypeFamily = 'variables' | 'attribute' | 'time-weighted' | 'rare-event' | 'short-run';

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
  /**
   * The frame containing the field being computed, with pre-aggregation
   * values, so chart types can read companion columns — e.g. the sample-size
   * column of attribute p/np/u charts.
   */
  frame?: DataFrame;
  /**
   * Row indices to omit from parameter ESTIMATION while still plotting them and
   * computing their limits — the Minitab "omit from estimation" model behind
   * point exclusion. Only chart types that opt in via excludesInCompute read
   * this; for the rest, exclusion is applied generically by filtering rows.
   */
  excludedEstimationRows?: ReadonlySet<number>;
}

export interface ChartTypeDefinition {
  /** Stable id persisted in dashboard JSON (see SpcChartTyp for the built-in values). */
  id: string;
  /** Label shown in the chart type select. */
  label: string;
  family: ChartTypeFamily;
  /** Inclusive subgroup-size bounds for which this chart type is defined. */
  subgroupSize: { min: number; max: number };
  /**
   * Transform raw observations into the plotted series and control limits.
   * Optional: PRO teaser stubs (see registerProChartTypeStub) carry only
   * metadata and have no compute, so the free panel can advertise them.
   */
  compute?: (field: Field, ctx: SpcCalcContext) => ControlChartData | null;
  /** True for a PRO chart type advertised in the free panel as a disabled teaser. */
  pro?: boolean;
  /**
   * Sigma estimation methods this chart accepts, most appropriate first — the
   * first entry is the chart's default and the one whose classic tabulated
   * constants it keeps using. Charts that omit this offer no estimation choice
   * (their sigma is intrinsic to the chart, e.g. attribute charts).
   */
  sigmaMethods?: SigmaMethod[];
  /**
   * Within-subgroup sigma estimate over the raw observations, used for Cp/Cpk.
   * When absent, capability falls back to the standard estimators in
   * calcs/capability (Rbar/d2, sbar/c4, moving range).
   */
  estimateSigmaWithin?: (values: number[], ctx: SpcCalcContext) => number | null;
  /**
   * Marks fields the chart consumes as auxiliary inputs rather than plotted
   * series (e.g. an attribute chart's sample-size column). Auxiliary fields
   * are skipped by chart computation and hidden from the plot.
   */
  isAuxiliaryField?: (field: Field, ctx: SpcCalcContext) => boolean;
  /**
   * True when the chart applies point exclusion inside its own compute — it
   * reads ctx.excludedEstimationRows to drop those rows from the parameter
   * estimate while still plotting them and drawing their limits (attribute
   * charts, whose per-point limit depends on each point's own sample size).
   * The pipeline then skips the generic filter-and-recompute exclusion path.
   */
  excludesInCompute?: boolean;
}

const registry = new Map<string, ChartTypeDefinition>();

export function registerChartType(definition: ChartTypeDefinition): void {
  registry.set(definition.id, definition);
}

/**
 * Register a PRO chart type as a disabled teaser (pro: true, no compute) in the
 * free panel. Skips registration when a real implementation (one with a
 * compute) already holds the id, and is itself replaced when a real
 * registration for the id arrives — so registration order does not matter.
 */
export function registerProChartTypeStub(definition: Omit<ChartTypeDefinition, 'compute' | 'pro'>): void {
  if (getChartType(definition.id)?.compute) {
    return;
  }
  registry.set(definition.id, { ...definition, pro: true });
}

export function getChartType(id: string): ChartTypeDefinition | undefined {
  return registry.get(id);
}

/** True when the chart type accepts only subgroupSize 1 (each row is already one point). */
export function chartTypeHasFixedSubgroup(id: string): boolean {
  return getChartType(id)?.subgroupSize.max === 1;
}

/** Registered chart types in registration order. */
export function listChartTypes(): ChartTypeDefinition[] {
  return [...registry.values()];
}

/** Sigma estimation methods the chart type accepts; empty when it offers no choice. */
export function chartTypeSigmaMethods(id: string): SigmaMethod[] {
  return getChartType(id)?.sigmaMethods ?? [];
}

/**
 * Look up a chart type and run it. Returns null for unknown ids and for
 * subgroup sizes outside the chart type's bounds, in which case the caller
 * falls back to plain aggregation.
 */
export function computeChartType(field: Field, chartTypeId: string, ctx: SpcCalcContext): ControlChartData | null {
  const chartType = getChartType(chartTypeId);
  if (!chartType || !chartType.compute) {
    return null;
  }
  if (ctx.subgroupSize < chartType.subgroupSize.min || ctx.subgroupSize > chartType.subgroupSize.max) {
    return null;
  }
  return chartType.compute(field, ctx);
}
