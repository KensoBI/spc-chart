import React, { useCallback, useMemo } from 'react';
import { css } from '@emotion/css';
import { DataFrame, FieldType, getDisplayProcessor, formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { IconButton, InteractiveTable, useStyles2 } from '@grafana/ui';
import { CellProps } from 'react-table';
import { Options } from 'panelcfg';
import { listStatisticsColumns } from 'registry/statisticsColumns';
import { calculateSeriesStatistics, SeriesStatistics } from './calculateCapabilityIndices';

interface StatisticsTableProps {
  series: DataFrame[];
  options: Options;
  theme: GrafanaTheme2;
  onExport?: () => void;
  // Full, unfiltered frame array (including feature frames) for resolving series-based spec limits.
  allSeries?: DataFrame[];
  // Pre-aggregation frames with the raw individual observations, used for capability statistics.
  rawSeries?: DataFrame[];
}

type TableRow = SeriesStatistics & { id: string };

function useFormatValue(series: DataFrame[], theme: GrafanaTheme2) {
  // Find the first numeric field
  const firstNumericField = useMemo(() => {
    for (const frame of series) {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          return field;
        }
      }
    }
    return null;
  }, [series]);

  // Create formatter based on the field
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  return useMemo(() => {
    if (firstNumericField) {
      const display = firstNumericField.display ?? getDisplayProcessor({ field: firstNumericField, theme });
      return (value: number | null): string => {
        if (value == null) {
          return '–';
        }
        return formattedValueToString(display(value));
      };
    }
    // Fallback if no numeric field found
    return (value: number | null): string => {
      if (value == null) {
        return '–';
      }
      return String(value);
    };
  }, [firstNumericField, theme]);
}

const getStyles = (theme: GrafanaTheme2) => ({
  tableWrapper: css({ width: '100%' }),
  exportRow: css({
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 0.5),
  }),
});

export const StatisticsTable: React.FC<StatisticsTableProps> = ({
  series,
  options,
  theme,
  onExport,
  allSeries,
  rawSeries,
}) => {
  const styles = useStyles2(getStyles);
  const formatValue = useFormatValue(series, theme);

  const statistics = useMemo(
    () => calculateSeriesStatistics(series, options, allSeries ?? series, rawSeries),
    [series, options, allSeries, rawSeries]
  );

  const tableData: TableRow[] = useMemo(
    // A frame can contribute several rows (one per value field), so the row index — not the
    // frame seriesIndex — is what uniquely identifies a row.
    () => statistics.map((stat, index) => ({ ...stat, id: String(index) })),
    [statistics]
  );

  const selectedColumns = options.statisticsTableColumns;
  const isColumnVisible = useCallback(
    (id: string) => !selectedColumns || selectedColumns.length === 0 || selectedColumns.includes(id),
    [selectedColumns]
  );

  const columns = useMemo(() => {
    const availabilityContext = { options, statistics };

    return [
      {
        id: 'seriesName' as const,
        header: 'Series',
        sortType: 'string' as const,
      },
      ...listStatisticsColumns().map((col) => ({
        id: col.id,
        header: col.header,
        cell: ({ row }: CellProps<TableRow>) => {
          const value = col.getValue(row.original);
          return col.formatted && typeof value !== 'string' ? formatValue(value) : value;
        },
        sortType: 'number' as const,
        visible: () => (col.isAvailable?.(availabilityContext) ?? true) && isColumnVisible(col.id),
      })),
    ];
  }, [formatValue, isColumnVisible, options, statistics]);

  if (tableData.length === 0) {
    return null;
  }

  return (
    <div className={styles.tableWrapper}>
      {onExport && (
        <div className={styles.exportRow}>
          <IconButton name="download-alt" tooltip="Export statistics to CSV" onClick={onExport} size="sm" />
        </div>
      )}
      <InteractiveTable columns={columns} data={tableData} getRowId={(row: TableRow) => row.id} />
    </div>
  );
};
