import React from 'react';
import { DataFrame, getFieldDisplayName, formattedValueToString, FALLBACK_COLOR, FieldType, GrafanaTheme2 } from '@grafana/data';
import { Button, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface CustomTooltipContentProps {
  data: DataFrame;
  focusedSeriesIdx: number | null;
  focusedPointIdx: number | null;
  frames: DataFrame[];
  timeZone: string;
  onAddAnnotation?: (time: number) => void;
  isPinned?: boolean;
  onDismiss?: () => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    minWidth: '200px',
  }),
  header: css({
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  timestamp: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  content: css({
    padding: theme.spacing(1.5),
  }),
  seriesRow: css({
    display: 'flex',
    alignItems: 'center',
    marginBottom: theme.spacing(0.75),
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  }),
  colorIndicator: css({
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    marginRight: theme.spacing(1),
    flexShrink: 0,
  }),
  seriesLabel: css({
    color: theme.colors.text.secondary,
    marginRight: theme.spacing(1),
    minWidth: '80px',
    flexShrink: 0,
  }),
  seriesValue: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
    wordBreak: 'break-word',
  }),
  buttonContainer: css({
    marginTop: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(1),
  }),
});

export const CustomTooltipContent: React.FC<CustomTooltipContentProps> = ({
  data,
  focusedSeriesIdx,
  focusedPointIdx,
  frames,
  timeZone,
  onAddAnnotation,
  isPinned = false,
  onDismiss,
}) => {
  const styles = useStyles2(getStyles);

  // Handle null focusedPointIdx
  if (focusedPointIdx === null) {
    return null;
  }

  // Get time value from the time field
  const timeField = data.fields[0];
  const time = timeField?.values[focusedPointIdx];
  const xVal = timeField?.display?.(time)?.text ?? '';

  // Build series data for display (similar to default tooltip)
  const series = data.fields
    .filter((f, i) => i > 0 && f.type === FieldType.number)
    .map((field, i) => {
      const display = field.display?.(field.values[focusedPointIdx]);
      return {
        color: display?.color || FALLBACK_COLOR,
        label: getFieldDisplayName(field, data, frames),
        value: display ? formattedValueToString(display) : null,
        isActive: focusedSeriesIdx === i + 1,
      };
    });

  return (
    <div className={styles.container}>
      {/* Header with timestamp */}
      <div className={styles.header}>
        <span className={styles.timestamp}>{xVal}</span>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Series data */}
        {series.map((s, idx) => (
          <div key={idx} className={styles.seriesRow}>
            <div className={styles.colorIndicator} style={{ backgroundColor: s.color }} />
            <span className={styles.seriesLabel}>{s.label}:</span>
            <span className={styles.seriesValue}>{s.value}</span>
          </div>
        ))}

        {/* Add annotation button - only show when tooltip is pinned and annotation creation is available */}
        {isPinned && onAddAnnotation && (
          <div className={styles.buttonContainer}>
            <Button
              variant="secondary"
              size="sm"
              icon="comment-alt"
              onClick={() => {
                onAddAnnotation(time);
                onDismiss?.(); // Dismiss the tooltip when opening annotation modal
              }}
              fullWidth
            >
              Add annotation
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
