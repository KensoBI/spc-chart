import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import uPlot from 'uplot';
import { DataFrame, FieldType, dateTime, GrafanaTheme2 } from '@grafana/data';
import { UPlotConfigBuilder, Portal, useStyles2, useTheme2, ConfirmModal } from '@grafana/ui';
import { css } from '@emotion/css';
import { AnnotationFormModal } from '../Annotations/AnnotationFormModal';
import { deleteAnnotation } from '../Annotations/annotationApi';

const DEFAULT_ALERT_COLOR = '#ff0000';
const TRIANGLE_WIDTH = 8;
const TRIANGLE_HEIGHT = 6;

// Get status color and display text based on alert state
const getStatusInfo = (status?: string, theme?: GrafanaTheme2): { color: string; displayText: string } => {
  if (!status) {
    return { color: theme?.colors.text.secondary || '#999', displayText: 'Unknown' };
  }

  const normalizedStatus = status.toLowerCase();

  switch (normalizedStatus) {
    case 'alerting':
    case 'firing':
      return { color: theme?.colors.error.text || '#e02f44', displayText: 'Alerting' };
    case 'ok':
    case 'normal':
      return { color: theme?.colors.success.text || '#56a64b', displayText: 'OK' };
    case 'pending':
      return { color: theme?.colors.warning.text || '#f79520', displayText: 'Pending' };
    case 'nodata':
    case 'no_data':
      return { color: theme?.colors.info.text || '#5794f2', displayText: 'No Data' };
    case 'error':
      return { color: theme?.colors.error.text || '#e02f44', displayText: 'Error' };
    default:
      return { color: theme?.colors.text.secondary || '#999', displayText: status };
  }
};

export type AlertAnnotationsPluginProps = {
  config: UPlotConfigBuilder;
  annotations?: DataFrame[];
  timeZone?: string;
  panelId?: number;
  dashboardUID?: string;
  onAnnotationChange?: (updatedAnnotation?: { id: number; text: string; tags?: string[]; time?: number }) => void;
  newAnnotation?: { id: number; text: string; tags?: string[]; time: number } | null;
};

type AnnotationData = {
  id?: number; // annotation ID for edit/delete
  time: number;
  text?: string;
  color?: string;
  x?: number; // cached x position
  tags?: string[];
  title?: string;
  status?: string; // Alert status: Alerting, OK, Pending, NoData, Error
};

type ParsedAnnotation = {
  title?: string;
  status?: string;
  labels: Array<{ key: string; value: string }>;
  metadata: Array<{ key: string; value: string }>;
  rawText?: string;
};

// Parse annotation text to extract structured information
const parseAnnotationText = (text?: string): ParsedAnnotation => {
  if (!text) {
    return { labels: [], metadata: [] };
  }

  const labels: Array<{ key: string; value: string }> = [];
  const metadata: Array<{ key: string; value: string }> = [];
  let title: string | undefined;
  let grafanaFolder: string | undefined;
  let status: string | undefined;

  // Handle format: "alert 2 {alertname=alert 2, grafana_folder=Alerts Folder} - B=22.235924, C=1.000000"

  // Extract content inside curly braces
  const braceMatch = text.match(/\{([^}]+)\}/);
  let remainingText = text;

  if (braceMatch) {
    const braceContent = braceMatch[1];
    // Parse key=value pairs inside braces
    const bracePairs = braceContent.split(/,\s*/);
    bracePairs.forEach((pair) => {
      const match = pair.match(/^(.+?)=(.+)$/);
      if (match) {
        const [, key, value] = match;
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        if (trimmedKey === 'alertname') {
          title = trimmedValue;
        } else if (trimmedKey === 'grafana_folder') {
          grafanaFolder = trimmedValue;
        } else if (trimmedKey === 'alertstate' || trimmedKey === 'state') {
          status = trimmedValue;
        }
      }
    });

    // Remove the brace section from remaining text
    remainingText = text.replace(/\{[^}]+\}/, '').trim();
  }

  // Parse remaining key=value pairs (after the braces or the entire text if no braces)
  // Split by comma, but also handle the " - " separator
  const restParts = remainingText.split(/\s*[-,]\s*/);

  restParts.forEach((part) => {
    const match = part.trim().match(/^([A-Za-z_]\w*)=(.+)$/);
    if (match) {
      const [, key, value] = match;
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();

      // Check for status/state
      if (trimmedKey === 'alertstate' || trimmedKey === 'state') {
        if (!status) {
          status = trimmedValue;
        }
        return;
      }

      // Skip if it's a duplicate of alertname or grafana_folder
      if (trimmedKey === 'alertname' || trimmedKey === 'grafana_folder') {
        return;
      }

      // Add as label
      labels.push({ key: trimmedKey, value: trimmedValue });
    }
  });

  // Add grafana_folder to metadata if found
  if (grafanaFolder) {
    metadata.push({ key: 'Grafana Folder', value: grafanaFolder });
  }

  return { title, status, labels, metadata, rawText: text };
};

const getStyles = (theme: GrafanaTheme2) => ({
  tooltip: css({
    position: 'fixed',
    background: theme.colors.background.primary,
    color: theme.colors.text.primary,
    padding: 0,
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    pointerEvents: 'none',
    zIndex: theme.zIndex.tooltip,
    minWidth: '200px',
    maxWidth: '400px',
    boxShadow: theme.shadows.z3,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  tooltipHeader: css({
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  statusBadge: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.radius.default,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }),
  tooltipTimestamp: css({
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  tooltipContent: css({
    padding: theme.spacing(1.5),
  }),
  alertNameRow: css({
    display: 'flex',
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  }),
  labelRow: css({
    display: 'flex',
    marginBottom: theme.spacing(0.75),
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  }),
  labelKey: css({
    color: theme.colors.text.secondary,
    marginRight: theme.spacing(1),
    minWidth: '100px',
    flexShrink: 0,
  }),
  labelValue: css({
    color: theme.colors.text.primary,
    wordBreak: 'break-word',
  }),
  alertNameValue: css({
    color: theme.colors.text.maxContrast,
    fontWeight: theme.typography.fontWeightMedium,
    wordBreak: 'break-word',
  }),
  labelsSection: css({
    // marginBottom will be set dynamically
  }),
  metadataSection: css({
    // borderTop, paddingTop, marginTop will be set dynamically
  }),
  metadataSeparator: css({
    borderTop: `1px solid ${theme.colors.border.weak}`,
    paddingTop: theme.spacing(1.5),
    marginTop: theme.spacing(1.5),
  }),
  fallbackText: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    wordBreak: 'break-word',
  }),
  triangleContainer: css({
    position: 'fixed',
    width: TRIANGLE_WIDTH * 2,
    height: TRIANGLE_HEIGHT + 8,
    cursor: 'pointer',
    zIndex: 'auto',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  }),
  tooltipFooter: css({
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    gap: theme.spacing(1),
    justifyContent: 'flex-end',
  }),
  actionButton: css({
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      background: theme.colors.background.canvas,
      borderColor: theme.colors.border.strong,
    },
  }),
  deleteButton: css({
    color: theme.colors.error.text,
    borderColor: theme.colors.error.border,
    '&:hover': {
      background: theme.colors.error.main,
      color: theme.colors.error.contrastText,
      borderColor: theme.colors.error.main,
    },
  }),
});

export const AlertAnnotations: React.FC<AlertAnnotationsPluginProps> = ({
  annotations,
  config,
  panelId,
  dashboardUID,
  onAnnotationChange,
  newAnnotation,
}) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [plot, setPlot] = useState<uPlot>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [trianglePositions, setTrianglePositions] = useState<Array<{ x: number; y: number; color: string; annotation: AnnotationData }>>([]);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<AnnotationData | null>(null);
  const [localAnnotationUpdate, setLocalAnnotationUpdate] = useState(0); // Counter to trigger re-renders
  const annotationsRef = useRef<AnnotationData[]>();
  const localAnnotationsRef = useRef<Map<number, AnnotationData>>(new Map()); // Track locally added/modified annotations by ID
  const shouldRenderRef = useRef<boolean>(false);
  const hooksInitialized = useRef(false);

  useEffect(() => {
    if (!annotations || annotations.length === 0) {
      // Only reset if we don't have any local annotations from create/edit/delete operations
      if (!annotationsRef.current || annotationsRef.current.length === 0) {
        annotationsRef.current = [];
        shouldRenderRef.current = false;
      }
      return;
    }

    // Parse annotation frames to extract time and metadata
    const parsedAnnotations: Array<{ id?: number; time: number; text?: string; color?: string; status?: string; tags?: string[] }> = [];

    annotations.forEach((frame) => {
      const timeField = frame.fields.find((f) => f.type === FieldType.time);
      const textField = frame.fields.find((f) => f.name === 'text' || f.name === 'Text');
      const colorField = frame.fields.find((f) => f.name === 'color');
      const idField = frame.fields.find((f) => f.name === 'id');

      // Grafana alert annotations use 'newState' for the current alert state
      const statusField = frame.fields.find((f) =>
        f.name === 'newState' ||
        f.name === 'status' ||
        f.name === 'state' ||
        f.name === 'alertstate' ||
        f.name === 'alertState'
      );

      // Check tags field which might contain state information
      const tagsField = frame.fields.find((f) => f.name === 'tags');

      if (timeField && timeField.values.length > 0) {
        for (let i = 0; i < timeField.values.length; i++) {
          const timeValue = timeField.values[i];
          const color = colorField?.values[i] || DEFAULT_ALERT_COLOR;
          let status = statusField?.values[i];

          // If no status field, try to extract from tags
          if (!status && tagsField?.values[i]) {
            const tags = tagsField.values[i];
            // Tags might be an array or comma-separated string
            if (Array.isArray(tags)) {
              // Look for tags that indicate state
              const stateTag = tags.find((tag: string) =>
                tag.toLowerCase().includes('alerting') ||
                tag.toLowerCase().includes('firing') ||
                tag.toLowerCase().includes('ok') ||
                tag.toLowerCase().includes('normal') ||
                tag.toLowerCase().includes('pending')
              );
              if (stateTag) {
                status = stateTag;
              }
            }
          }

          // Extract tags
          let annotationTags: string[] | undefined;
          if (tagsField?.values[i]) {
            const tagsValue = tagsField.values[i];
            if (Array.isArray(tagsValue)) {
              annotationTags = tagsValue;
            } else if (typeof tagsValue === 'string') {
              annotationTags = tagsValue.split(',').map(t => t.trim());
            }
          }

          parsedAnnotations.push({
            id: idField?.values[i],
            time: timeValue,
            text: textField?.values[i] || 'Alert',
            color: color,
            status: status,
            tags: annotationTags,
          });
        }
      }
    });

    // Merge DataFrame annotations with local annotations
    // Local annotations (from create/edit/delete) take precedence
    const mergedAnnotations = [...parsedAnnotations];

    // Add locally created annotations that aren't in the DataFrame yet
    localAnnotationsRef.current.forEach((localAnnotation) => {
      const existsInDataFrame = parsedAnnotations.some(ann => ann.id === localAnnotation.id);
      if (!existsInDataFrame) {
        mergedAnnotations.push(localAnnotation);
      } else {
        // If it exists in DataFrame, we can remove it from local tracking
        localAnnotationsRef.current.delete(localAnnotation.id!);
      }
    });

    annotationsRef.current = mergedAnnotations;
    shouldRenderRef.current = mergedAnnotations.length > 0;
  }, [annotations]);

  // Handle newly created annotations
  useEffect(() => {
    if (newAnnotation) {
      // Check if annotation doesn't already exist in local tracking
      if (!localAnnotationsRef.current.has(newAnnotation.id)) {
        // Add new annotation to local tracking
        const newAnnotationData: AnnotationData = {
          id: newAnnotation.id,
          time: newAnnotation.time,
          text: newAnnotation.text,
          tags: newAnnotation.tags,
          color: DEFAULT_ALERT_COLOR,
        };

        localAnnotationsRef.current.set(newAnnotation.id, newAnnotationData);

        // Add to current annotations array
        if (!annotationsRef.current) {
          annotationsRef.current = [];
        }
        annotationsRef.current = [...annotationsRef.current, newAnnotationData];

        // IMPORTANT: Set this AFTER adding annotation
        shouldRenderRef.current = true;

        // Force component re-render which will trigger useLayoutEffect
        setLocalAnnotationUpdate(prev => prev + 1);

        // Trigger plot redraw after a brief delay to ensure hooks are registered
        setTimeout(() => {
          if (plot) {
            plot.redraw();
          }
        }, 10);
      }
    }
  }, [newAnnotation, plot]);

  const drawAlertAnnotations = useCallback((u: uPlot) => {
    if (!annotationsRef.current || !shouldRenderRef.current || annotationsRef.current.length === 0) {
      return;
    }

    const ctx = u.ctx;
    if (!ctx) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
    ctx.clip();

    const positions: Array<{ x: number; y: number; color: string; annotation: AnnotationData }> = [];

    // Draw vertical lines and cache positions
    annotationsRef.current.forEach((annotation) => {
      // Time values are in milliseconds
      const x = u.valToPos(annotation.time, 'x', true);
      annotation.x = x; // Cache x position

      if (x >= u.bbox.left && x <= u.bbox.left + u.bbox.width) {
        // Draw dashed vertical line
        ctx.beginPath();
        ctx.strokeStyle = annotation.color || DEFAULT_ALERT_COLOR;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(x, u.bbox.top);
        ctx.lineTo(x, u.bbox.top + u.bbox.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw triangle at the bottom of the line (on canvas)
        const triangleY = u.bbox.top + u.bbox.height - TRIANGLE_HEIGHT;
        ctx.beginPath();
        ctx.fillStyle = annotation.color || DEFAULT_ALERT_COLOR;
        ctx.moveTo(x, triangleY); // Top point
        ctx.lineTo(x - TRIANGLE_WIDTH / 2, triangleY + TRIANGLE_HEIGHT); // Bottom left
        ctx.lineTo(x + TRIANGLE_WIDTH / 2, triangleY + TRIANGLE_HEIGHT); // Bottom right
        ctx.closePath();
        ctx.fill();

        // Store position for hover detection (screen coordinates for tooltip positioning)
        const overRect = u.over.getBoundingClientRect();
        const xRatio = (x - u.bbox.left) / u.bbox.width;
        const screenX = overRect.left + xRatio * overRect.width;
        const screenY = overRect.bottom - TRIANGLE_HEIGHT;

        positions.push({
          x: screenX,
          y: screenY,
          color: annotation.color || DEFAULT_ALERT_COLOR,
          annotation,
        });
      }
    });

    ctx.restore();

    // Update triangle positions for DOM rendering
    setTrianglePositions(positions);
  }, []);

  useLayoutEffect(() => {
    // Check if we have annotations from DataFrame OR local annotations
    const hasAnnotations = !!(
      (annotations && annotations.length > 0) ||
      (annotationsRef.current && annotationsRef.current.length > 0)
    );
    shouldRenderRef.current = hasAnnotations;

    if (!hooksInitialized.current && hasAnnotations) {
      config.addHook('init', (u) => {
        setPlot(u);
      });

      config.addHook('draw', drawAlertAnnotations);

      hooksInitialized.current = true;
    } else if (hasAnnotations) {
      config.addHook('draw', drawAlertAnnotations);
    }

    return () => {
      // Don't reset shouldRenderRef if we have local annotations
      if (!(annotationsRef.current && annotationsRef.current.length > 0)) {
        shouldRenderRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, plot, drawAlertAnnotations, newAnnotation, localAnnotationUpdate]);

  // Show tooltip if hovered OR pinned
  const activeIndex = pinnedIndex ?? hoveredIndex;
  const activeAnnotation = activeIndex !== null && trianglePositions[activeIndex] ? trianglePositions[activeIndex].annotation : null;

  // Handle delete annotation
  const handleDelete = useCallback(async () => {
    if (selectedAnnotation?.id) {
      try {
        const deletedId = selectedAnnotation.id;
        await deleteAnnotation(deletedId);

        // Remove the annotation from local state
        if (annotationsRef.current) {
          annotationsRef.current = annotationsRef.current.filter(ann => ann.id !== deletedId);

          // Remove from local tracking
          localAnnotationsRef.current.delete(deletedId);

          // Force re-render
          setLocalAnnotationUpdate(prev => prev + 1);

          // Trigger a re-render by forcing the plot to redraw
          if (plot) {
            plot.redraw();
          }
        }

        setDeleteConfirmOpen(false);
        setSelectedAnnotation(null);
        setPinnedIndex(null); // Unpin the tooltip
        onAnnotationChange?.({ id: deletedId, text: '', tags: undefined });
      } catch (err) {
        console.error('Failed to delete annotation:', err);
      }
    }
  }, [selectedAnnotation, onAnnotationChange, plot]);

  // Handle edit success
  const handleEditSuccess = useCallback((updatedData?: { id: number; text: string; tags?: string[]; time?: number }) => {
    if (updatedData && annotationsRef.current) {
      // Update the local annotation data
      annotationsRef.current = annotationsRef.current.map(ann =>
        ann.id === updatedData.id
          ? { ...ann, text: updatedData.text, tags: updatedData.tags }
          : ann
      );

      // Update in local tracking (will persist across DataFrame refreshes)
      const existing = localAnnotationsRef.current.get(updatedData.id);
      if (existing) {
        localAnnotationsRef.current.set(updatedData.id, {
          ...existing,
          text: updatedData.text,
          tags: updatedData.tags,
        });
      }

      // Force re-render
      setLocalAnnotationUpdate(prev => prev + 1);

      // Trigger a re-render by forcing the plot to redraw
      if (plot) {
        plot.redraw();
      }
    }

    setEditModalOpen(false);
    setSelectedAnnotation(null);
    setPinnedIndex(null); // Unpin the tooltip
    onAnnotationChange?.(updatedData);
  }, [onAnnotationChange, plot]);

  return (
    <>
      {/* Invisible hit areas for hover detection - triangles are drawn on canvas */}
      {trianglePositions.map((pos, index) => (
        <Portal key={index}>
          <div
            data-annotation-triangle
            onClick={() => {
              if (pinnedIndex === index) {
                setPinnedIndex(null);
              } else {
                setPinnedIndex(index);
                setHoveredIndex(null);
              }
            }}
            onMouseEnter={(e) => {
              if (pinnedIndex === null) {
                setHoveredIndex(index);
                setTooltipPosition({
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            }}
            onMouseMove={(e) => {
              if (pinnedIndex === null) {
                setTooltipPosition({
                  x: e.clientX,
                  y: e.clientY,
                });
              }
            }}
            onMouseLeave={() => {
              if (pinnedIndex === null) {
                setHoveredIndex(null);
                setTooltipPosition(null);
              }
            }}
            className={styles.triangleContainer}
            style={{
              left: pos.x - TRIANGLE_WIDTH,
              top: pos.y - 4,
            }}
          />
        </Portal>
      ))}

      {/* Tooltip */}
      {activeAnnotation && (pinnedIndex !== null || tooltipPosition) && (() => {
        const parsed = parseAnnotationText(activeAnnotation.text);
        // Prefer status from annotation data over parsed text
        const finalStatus = activeAnnotation.status || parsed.status;
        const statusInfo = getStatusInfo(finalStatus, theme);

        // Calculate tooltip position - use stored position for hover, or triangle position for pinned
        const displayPosition = pinnedIndex !== null && activeIndex !== null
          ? { x: trianglePositions[activeIndex].x, y: trianglePositions[activeIndex].y }
          : tooltipPosition || { x: 0, y: 0 };

        return (
          <Portal>
            <div
              data-annotation-tooltip
              className={styles.tooltip}
              style={{
                left: displayPosition.x + 10,
                top: displayPosition.y - 40,
                pointerEvents: pinnedIndex !== null ? 'auto' : 'none',
              }}
            >
              {/* Header with timestamp and status */}
              <div className={styles.tooltipHeader}>
                <span className={styles.tooltipTimestamp}>
                  {dateTime(activeAnnotation.time).format('YYYY-MM-DD HH:mm:ss')}
                </span>
                {finalStatus && (
                  <span
                    className={styles.statusBadge}
                    style={{
                      color: statusInfo.color,
                      backgroundColor: `${statusInfo.color}15`,
                      border: `1px solid ${statusInfo.color}40`,
                    }}
                  >
                    {statusInfo.displayText}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className={styles.tooltipContent}>
                {/* Alert Name */}
                {parsed.title && (
                  <div
                    className={styles.alertNameRow}
                    style={{
                      marginBottom: parsed.labels.length > 0 || parsed.metadata.length > 0 ? theme.spacing(1.5) : 0,
                    }}
                  >
                    <span className={styles.labelKey}>Alert Name:</span>
                    <span className={styles.alertNameValue}>{parsed.title}</span>
                  </div>
                )}

                {/* Labels */}
                {parsed.labels.length > 0 && (
                  <div
                    className={styles.labelsSection}
                    style={{ marginBottom: parsed.metadata.length > 0 ? theme.spacing(1.5) : 0 }}
                  >
                    {parsed.labels.map((label, idx) => (
                      <div key={idx} className={styles.labelRow}>
                        <span className={styles.labelKey}>{label.key}:</span>
                        <span className={styles.labelValue}>{label.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                {parsed.metadata.length > 0 && (
                  <div
                    className={
                      parsed.title || parsed.labels.length > 0 ? styles.metadataSeparator : styles.metadataSection
                    }
                  >
                    {parsed.metadata.map((meta, idx) => (
                      <div
                        key={idx}
                        className={styles.labelRow}
                        style={{ marginBottom: idx < parsed.metadata.length - 1 ? theme.spacing(0.75) : 0 }}
                      >
                        <span className={styles.labelKey}>{meta.key}:</span>
                        <span className={styles.labelValue}>{meta.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fallback for raw text if no structured data */}
                {!parsed.title && parsed.labels.length === 0 && parsed.metadata.length === 0 && parsed.rawText && (
                  <div className={styles.fallbackText}>{parsed.rawText}</div>
                )}
              </div>

              {/* Footer with action buttons (only when pinned) */}
              {pinnedIndex !== null && (
                <div className={styles.tooltipFooter}>
                  <button
                    className={styles.actionButton}
                    onClick={() => {
                      setSelectedAnnotation(activeAnnotation);
                      setEditModalOpen(true);
                      setPinnedIndex(null);
                    }}
                    disabled={!activeAnnotation.id}
                  >
                    Edit
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.deleteButton}`}
                    onClick={() => {
                      setSelectedAnnotation(activeAnnotation);
                      setDeleteConfirmOpen(true);
                      setPinnedIndex(null);
                    }}
                    disabled={!activeAnnotation.id}
                  >
                    Remove
                  </button>
                  <button
                    className={styles.actionButton}
                    onClick={() => {
                      setPinnedIndex(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </Portal>
        );
      })()}

      {/* Edit Modal */}
      {editModalOpen && selectedAnnotation && (
        <AnnotationFormModal
          isOpen={editModalOpen}
          mode="edit"
          annotationId={selectedAnnotation.id}
          time={selectedAnnotation.time}
          initialText={selectedAnnotation.text}
          initialTags={selectedAnnotation.tags}
          panelId={panelId}
          dashboardUID={dashboardUID}
          onDismiss={() => {
            setEditModalOpen(false);
            setSelectedAnnotation(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && selectedAnnotation && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          title="Delete Annotation"
          body={`Are you sure you want to delete this annotation?${selectedAnnotation.text ? `\n\n"${selectedAnnotation.text}"` : ''}`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onDismiss={() => {
            setDeleteConfirmOpen(false);
            setSelectedAnnotation(null);
          }}
        />
      )}
    </>
  );
};
