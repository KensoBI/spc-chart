import { DataFrame, FieldType } from '@grafana/data';
import { Options } from 'panelcfg';
import { controlLineReducers } from 'data/spcReducers';
import { PositionInput } from 'types';
import { SeriesStatistics } from 'components/StatisticsTable/calculateCapabilityIndices';
import { listStatisticsColumns, StatisticsColumnDefinition } from 'registry/statisticsColumns';

export interface ResolvedControlLine {
  name: string;
  seriesName: string;
  type: string;
  position: number;
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value == null) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function csvRow(fields: Array<string | number | null | undefined>): string {
  return fields.map(escapeCsvField).join(',');
}

function getVisibleColumns(visibleColumns?: string[]): StatisticsColumnDefinition[] {
  const allColumns = listStatisticsColumns();
  if (!visibleColumns || visibleColumns.length === 0) {
    return allColumns;
  }
  return allColumns.filter((col) => visibleColumns.includes(col.id));
}

/** Everything an extra CSV section may need. options/frames are absent when the caller has none. */
export interface CsvSectionContext {
  statistics: SeriesStatistics[];
  controlLines: ResolvedControlLine[];
  options?: Options;
  frames?: DataFrame[];
}

export type CsvSectionBuilder = (ctx: CsvSectionContext) => string | null;

const csvSectionBuilders: CsvSectionBuilder[] = [];

/** Register an additional export section, appended after Statistics and Control Lines. */
export function registerCsvSection(builder: CsvSectionBuilder): void {
  csvSectionBuilders.push(builder);
}

export function buildExportCsv(
  statistics: SeriesStatistics[],
  controlLines: ResolvedControlLine[],
  visibleColumns?: string[],
  sectionContext?: { options: Options; frames: DataFrame[] }
): string {
  const sections: string[] = [];
  const cols = getVisibleColumns(visibleColumns);

  // Section 1: Statistics
  sections.push(buildStatisticsSection(statistics, cols));

  // Section 2: Control Lines (if any)
  if (controlLines.length > 0) {
    sections.push(buildControlLinesSection(controlLines));
  }

  // Registered extra sections
  for (const builder of csvSectionBuilders) {
    const section = builder({ statistics, controlLines, ...sectionContext });
    if (section) {
      sections.push(section);
    }
  }

  return sections.join('\n\n');
}

function buildStatisticsSection(statistics: SeriesStatistics[], cols: StatisticsColumnDefinition[]): string {
  const lines: string[] = [];

  // Header
  lines.push(csvRow(['Statistics']));
  lines.push(csvRow(['Series', ...cols.map((col) => col.header)]));

  // Data rows
  for (const stat of statistics) {
    lines.push(csvRow([stat.seriesName, ...cols.map((col) => col.getValue(stat))]));
  }

  return lines.join('\n');
}

function buildControlLinesSection(controlLines: ResolvedControlLine[]): string {
  const lines: string[] = [];

  lines.push(csvRow(['Control Lines']));
  lines.push(csvRow(['Name', 'Series', 'Type', 'Position']));

  for (const cl of controlLines) {
    lines.push(csvRow([cl.name, cl.seriesName, cl.type, cl.position]));
  }

  return lines.join('\n');
}

export function resolveControlLines(series: DataFrame[], options: Options): ResolvedControlLine[] {
  if (!options.controlLines || options.controlLines.length === 0) {
    return [];
  }

  const computedReducerIds = controlLineReducers.filter((r) => r.computed).map((r) => r.id);
  const resolved: ResolvedControlLine[] = [];

  // Filter out feature query series
  const dataSeries = series.filter(
    (frame) => !options.featureQueryRefIds || !options.featureQueryRefIds.includes(frame.refId!)
  );

  // In numeric X-axis mode the X field is numeric but is an index, not a measurement; skip it when
  // picking the value field so the series name and computed positions come from the plotted values.
  const xFieldName = options.xField;
  const findValueField = (frame: DataFrame) =>
    frame.fields.find((f) => f.type === FieldType.number && f.name !== xFieldName);

  for (const cl of options.controlLines) {
    const seriesIndex = cl.seriesIndex;

    let position: number | undefined;
    let seriesName: string;

    if (computedReducerIds.includes(cl.reducerId)) {
      // Computed: indexed against data-only frames; read from calcs.
      if (seriesIndex < 0 || seriesIndex >= dataSeries.length) {
        continue;
      }
      const frame = dataSeries[seriesIndex];
      // Prefer the value field carrying cached calcs (the X index field never has them).
      const numericField =
        frame.fields.find((f) => f.type === FieldType.number && f.name !== xFieldName && f.state?.calcs) ??
        findValueField(frame);
      seriesName = numericField?.config?.displayName || numericField?.name || frame.name || `Series ${seriesIndex}`;
      const calcs = numericField?.state?.calcs;
      if (calcs) {
        position = calcs[cl.reducerId];
      }
    } else if (cl.positionInput === PositionInput.series) {
      // Series-based: indexed against the full frame array (the field may live in a feature frame).
      const frame = series[seriesIndex];
      if (!frame) {
        continue;
      }
      const numericField = findValueField(frame);
      seriesName = numericField?.config?.displayName || numericField?.name || frame.name || `Series ${seriesIndex}`;
      const field = frame.fields.find((f) => f.name === cl.field);
      if (field && field.values.length > 0) {
        const lastValue = field.values[field.values.length - 1];
        if (typeof lastValue === 'number') {
          position = lastValue;
        }
      }
    } else {
      // Static position: like series-based lines, indexed against the full frame array.
      const frame = series[seriesIndex];
      if (!frame) {
        continue;
      }
      const numericField = findValueField(frame);
      seriesName = numericField?.config?.displayName || numericField?.name || frame.name || `Series ${seriesIndex}`;
      position = cl.position;
    }

    if (position != null) {
      resolved.push({
        name: cl.name,
        seriesName,
        type: cl.reducerId,
        position,
      });
    }
  }

  return resolved;
}

export function downloadCsv(csvContent: string, filename: string): void {
  // Note: When Grafana's Plugin Frontend Sandbox is enabled, the sandbox proxy
  // intercepts blob downloads and may replace the filename with a UUID.
  // This is a known sandbox limitation. To get proper filenames, administrators
  // can disable the sandbox for this plugin in Grafana settings.
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateExportFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  return `spc-statistics_${date}_${time}.csv`;
}
