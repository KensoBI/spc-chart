import { Options } from 'panelcfg';
import { SpcChartTyp } from 'types';
import { SeriesStatistics } from 'components/StatisticsTable/calculateCapabilityIndices';

export interface StatisticsColumnAvailabilityContext {
  options: Options;
  statistics: SeriesStatistics[];
}

export interface StatisticsColumnDefinition {
  /** Stable id, persisted in Options.statisticsTableColumns. */
  id: string;
  /** Column header in the table, the column editor and the CSV export. */
  header: string;
  /** Value for a row; rows carry the SeriesStatistics of one plotted series. */
  getValue: (stat: SeriesStatistics) => number | string | null;
  /** Whether the value is a measurement formatted with the panel's display processor (unit, decimals). */
  formatted: boolean;
  /** Data-driven gate applied on top of the user's visible-column selection. */
  isAvailable?: (ctx: StatisticsColumnAvailabilityContext) => boolean;
}

const hasCapabilityData = ({ statistics }: StatisticsColumnAvailabilityContext) =>
  statistics.some((s) => s.cp != null);

const hasControlLimits = ({ options }: StatisticsColumnAvailabilityContext) => options.chartType !== SpcChartTyp.none;

const registry: StatisticsColumnDefinition[] = [
  { id: 'n', header: 'n', getValue: (stat) => stat.n, formatted: false },
  { id: 'mean', header: 'Mean', getValue: (stat) => stat.mean, formatted: true },
  { id: 'stdDev', header: 'Std Dev', getValue: (stat) => stat.stdDev, formatted: true },
  { id: 'min', header: 'Min', getValue: (stat) => stat.min, formatted: true },
  { id: 'max', header: 'Max', getValue: (stat) => stat.max, formatted: true },
  { id: 'lcl', header: 'LCL', getValue: (stat) => stat.lcl, formatted: true, isAvailable: hasControlLimits },
  { id: 'ucl', header: 'UCL', getValue: (stat) => stat.ucl, formatted: true, isAvailable: hasControlLimits },
  { id: 'cp', header: 'Cp', getValue: (stat) => stat.cp, formatted: true, isAvailable: hasCapabilityData },
  { id: 'cpk', header: 'Cpk', getValue: (stat) => stat.cpk, formatted: true, isAvailable: hasCapabilityData },
  { id: 'pp', header: 'Pp', getValue: (stat) => stat.pp, formatted: true, isAvailable: hasCapabilityData },
  { id: 'ppk', header: 'Ppk', getValue: (stat) => stat.ppk, formatted: true, isAvailable: hasCapabilityData },
];

/** Statistics-table columns in display order. */
export function listStatisticsColumns(): StatisticsColumnDefinition[] {
  return [...registry];
}

/** Register an additional column. Re-registering an existing id replaces it. */
export function registerStatisticsColumn(definition: StatisticsColumnDefinition): void {
  const existing = registry.findIndex((col) => col.id === definition.id);
  if (existing >= 0) {
    registry[existing] = definition;
  } else {
    registry.push(definition);
  }
}
