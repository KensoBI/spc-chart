import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PanelProps,
  DashboardCursorSync,
  EventBus,
  FieldMatcherID,
  fieldMatchers,
  DataFrame,
  FieldType,
} from '@grafana/data';
import { config, PanelDataErrorView, locationService } from '@grafana/runtime';
import {
  ContextMenu,
  EventBusPlugin,
  KeyboardPlugin,
  MenuItem,
  PanelContextProvider,
  TimeSeries,
  TooltipPlugin2,
  usePanelContext,
  useSplitter,
  useTheme2,
  ZoomPlugin,
} from '@grafana/ui';

import { useSubgroupSizeOptions, validateSubgroupSize } from 'components/options/useSubgroupSize';
import { getExcludedPoints } from 'data/exclusions';
import { getStages } from 'data/stages';
import { doSpcCalcs } from 'data/doSpcCalcs';
import {
  buildControlLineFrame,
  buildLimitAnnotations,
  computeControlLine,
  findPlotXField,
} from 'components/ControlLines/buildLimitAnnotations';
import { LimitAnnotations } from 'components/ControlLines/LimitAnnotations';
import { AlertAnnotations } from 'components/ControlLines/AlertAnnotations';
import { CustomTooltipContent, AnnotationFormModal } from 'components/Annotations';
import { getTimezones, prepareGraphableFields } from 'utils';
import { Options } from 'panelcfg';
import { preparePlotFrame, XYFieldMatchers } from 'utils/preparePlotFrame';
import { StatisticsTable } from 'components/StatisticsTable/StatisticsTable';
import { calculateSeriesStatistics } from 'components/StatisticsTable/calculateCapabilityIndices';
import { buildExportCsv, downloadCsv, generateExportFilename, resolveControlLines } from 'utils/exportCsv';
import { SpcChartExtensions, SpcMenuPoint } from 'components/extensions';
import { PanelLocalEventBus } from 'utils/panelLocalEventBus';

interface SpcChartPanelProps extends PanelProps<Options> {
  /** Optional extension seams; see SpcChartExtensions. A wrapper panel supplies these. */
  extensions?: SpcChartExtensions;
}

export const SpcChartPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  id,
  onOptionsChange,
  onChangeTimeRange,
  extensions,
}: SpcChartPanelProps) => {
  const { sync, eventsScope, eventBus: panelEventBus } = usePanelContext();

  const optionsWithVars = useSubgroupSizeOptions(options).options;

  // Point exclusions and stages are keyed by the plotted X value, which for a
  // subgrouped chart is the subgroup's aggregated X. Changing the effective
  // subgroup size — via the Subgroup size editor or a chart-type switch that
  // changes it — re-groups the data, so those X keys no longer match any point:
  // the features would silently do nothing while still cluttering their editors.
  // Clear them when the saved subgroup size changes. This reads the saved size,
  // not the dashboard-variable-resolved one, so a runtime variable change never
  // wipes saved analysis (the subgroup editor is disabled in that mode anyway).
  const savedSubgroupSize = validateSubgroupSize(options.subgroupSize, options.chartType);
  const prevSubgroupSizeRef = useRef(savedSubgroupSize);
  useEffect(() => {
    if (prevSubgroupSizeRef.current === savedSubgroupSize) {
      return;
    }
    prevSubgroupSizeRef.current = savedSubgroupSize;
    if (getExcludedPoints(options).length > 0 || getStages(options).length > 0) {
      onOptionsChange({
        ...options,
        chartOptions: { ...options.chartOptions, excludedPoints: [], stages: [] },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSubgroupSize]);

  // Annotation creation modal state
  const [annotationModal, setAnnotationModal] = useState<{
    isOpen: boolean;
    time: number | null;
  }>({ isOpen: false, time: null });

  // Track newly created annotation to add to local state
  const [newAnnotation, setNewAnnotation] = useState<{
    id: number;
    text: string;
    tags?: string[];
    time: number;
  } | null>(null);

  // Get dashboard UID from URL
  const dashboardUID = useMemo(() => {
    const path = locationService.getLocation().pathname;
    const match = path.match(/\/d\/([^/]+)/);
    return match ? match[1] : undefined;
  }, []);

  // Numeric X-axis mode, keyed by field name throughout. The name is matched per frame rather
  // than resolved to one column index, so queries may return the X column in any position and
  // may be returned in any order — a reference query that has no X column at all no longer
  // decides the mode for the whole panel just by being the first query.
  const xFieldName = useMemo(() => {
    const name = optionsWithVars.xField;
    if (!name) {
      return undefined;
    }
    const found = data.series.some((frame) =>
      frame?.fields?.some((f) => f && f.name === name && f.type === FieldType.number)
    );
    return found ? name : undefined;
  }, [optionsWithVars.xField, data.series]);

  const useNumericX = xFieldName != null;

  // See PanelLocalEventBus: keeps the panel from reacting to its own cursor events, and to
  // hover events whose X value is measured in something other than this chart's X axis.
  const eventBus = useMemo(
    () => new PanelLocalEventBus(panelEventBus, useNumericX ? 'numeric' : 'time'),
    [panelEventBus, useNumericX]
  );

  // Full, post-calculation frame array (including feature frames): needed to resolve
  // series-based control lines whose value comes from a feature-series field.
  const samplesWithCalcs = useMemo(
    () => doSpcCalcs(data.series, optionsWithVars, xFieldName),
    [data.series, optionsWithVars, xFieldName]
  );

  // Post-calculation, feature-filtered frames: the process data series.
  const samples = useMemo(() => {
    if (optionsWithVars.featureQueryRefIds) {
      return samplesWithCalcs.filter((frame) => !optionsWithVars.featureQueryRefIds.includes(frame.refId!));
    }
    return samplesWithCalcs;
  }, [samplesWithCalcs, optionsWithVars.featureQueryRefIds]);

  // Pre-aggregation data frames: capability statistics are computed from the raw
  // individual observations, not from the plotted subgroup aggregates.
  const rawSamples = useMemo(() => {
    if (optionsWithVars.featureQueryRefIds) {
      return data.series.filter((frame) => !optionsWithVars.featureQueryRefIds.includes(frame.refId!));
    }
    return data.series;
  }, [data.series, optionsWithVars.featureQueryRefIds]);

  const { frames, limitAnnotations, annotations } = useMemo(() => {
    // Feature frames supply control-line values but are not process data: they resolve the lines
    // (hence samplesWithCalcs below, which seriesIndex is expressed against) and are then left out
    // of the plot, so a reference series is drawn as its control line and not as a series of its own.
    const plottedPointCount = findPlotXField(samples, xFieldName)?.values.length;
    const controlLines = computeControlLine(samplesWithCalcs, optionsWithVars, plottedPointCount);
    const limitAnnotations = buildLimitAnnotations(samplesWithCalcs, controlLines);
    const controlLineFrames = buildControlLineFrame(samples, controlLines, fieldConfig, xFieldName, samplesWithCalcs);
    const combined = samples.concat(controlLineFrames);
    const preped = prepareGraphableFields(combined, config.theme2, useNumericX ? undefined : timeRange, xFieldName);

    return { frames: preped, limitAnnotations, annotations: data.annotations };
  }, [samples, samplesWithCalcs, data.annotations, fieldConfig, optionsWithVars, timeRange, xFieldName, useNumericX]);

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  // Callback to prepare frames for plotting with numeric X-axis
  // This mirrors Grafana's Trend panel implementation
  const preparePlotFrameCallback = useCallback(
    (frames: DataFrame[], dimFields: XYFieldMatchers): DataFrame | null => {
      // Override the X field matcher to use our numeric field
      const modifiedDimFields = {
        ...dimFields,
        x: fieldMatchers.get(FieldMatcherID.byName).get(optionsWithVars.xField!),
      };

      // Call our preparePlotFrame function with modified dimFields
      const result = preparePlotFrame(frames, modifiedDimFields);
      return result ?? null;
    },
    [optionsWithVars.xField]
  );

  // Annotation handlers
  const handleAddAnnotation = useCallback((time: number) => {
    setAnnotationModal({ isOpen: true, time });
  }, []);

  const handleModalDismiss = useCallback(() => {
    setAnnotationModal({ isOpen: false, time: null });
  }, []);

  const handleAnnotationSuccess = useCallback(
    (updatedData?: { id: number; text: string; tags?: string[]; time?: number }) => {
      if (updatedData) {
        // Check if this is a newly created annotation (has time in the data)
        if (updatedData.time !== undefined) {
          // Set the new annotation
          setNewAnnotation({
            id: updatedData.id,
            text: updatedData.text,
            tags: updatedData.tags,
            time: updatedData.time,
          });

          // Clear the new annotation after a short delay to allow processing
          setTimeout(() => {
            setNewAnnotation(null);
          }, 100);
        }
        // For edit/delete, local state is already updated in AlertAnnotations
      }
    },
    []
  );

  //this will change color of all control lines with that name. I am not sure why they use label instead of field. Can't really do anything until this changes in Grafana's PanelContext.
  const onSeriesColorChanged = (label: string, color: string) => {
    const controlLineExists = optionsWithVars.controlLines.some((cl) => cl.name === label);
    if (controlLineExists) {
      const updatedOptions = {
        ...optionsWithVars,
        controlLines: optionsWithVars.controlLines.map((cl) => {
          if (cl.name === label) {
            return {
              ...cl,
              lineColor: color,
            };
          }
          return cl;
        }),
      };

      onOptionsChange(updatedOptions);
    }
  };

  const theme = useTheme2();
  const showTable = optionsWithVars.showStatisticsTable === true;
  const TooltipContent = extensions?.tooltipContent ?? CustomTooltipContent;

  const handleExport = useCallback(() => {
    const statistics = calculateSeriesStatistics(samples, optionsWithVars, samplesWithCalcs, rawSamples);
    const controlLines = resolveControlLines(samplesWithCalcs, optionsWithVars);
    const csv = buildExportCsv(statistics, controlLines, optionsWithVars.statisticsTableColumns, {
      options: optionsWithVars,
      frames: samplesWithCalcs,
    });
    downloadCsv(csv, generateExportFilename());
  }, [samples, optionsWithVars, samplesWithCalcs, rawSamples]);

  const [chartHeight, setChartHeight] = useState(Math.round(height * 0.75));

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
    direction: 'column',
    initialSize: 0.75,
  });

  // Track the actual pixel height of the primary pane via ResizeObserver
  // so the chart size is correct on initial render (not just after drag).
  useEffect(() => {
    if (!showTable) {
      return;
    }
    const el = primaryProps.ref.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartHeight(Math.round(entry.contentRect.height));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [primaryProps.ref, showTable]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; point: SpcMenuPoint | null } | null>(null);

  // Last point the tooltip focused; a right-click snapshots it so menu
  // extensions can act on the point (see SpcMenuContext.point).
  const hoveredPointRef = useRef<SpcMenuPoint | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, point: hoveredPointRef.current });
  }, []);

  if (!frames || frames.length === 0) {
    return (
      <PanelDataErrorView
        panelId={id}
        message={useNumericX ? 'No data. Numeric X-axis requires ascending numeric values.' : 'No data.'}
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={!useNumericX}
        needsNumberField={true}
      />
    );
  }

  return (
    <SeriesColorContextProvider onSeriesColorChange={onSeriesColorChanged} eventBus={eventBus}>
      <div {...containerProps} style={{ height, width }} onContextMenu={handleContextMenu}>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            renderMenuItems={() => (
              <>
                <MenuItem label="Download CSV" icon="download-alt" onClick={handleExport} />
                {extensions?.contextMenuItems?.({
                  options: optionsWithVars,
                  frames,
                  onOptionsChange,
                  point: contextMenu.point,
                })}
              </>
            )}
          />
        )}
        <div
          {...primaryProps}
          style={{ ...primaryProps.style, overflow: 'hidden', minHeight: 0, ...(!showTable && { flexGrow: 1 }) }}
        >
          <TimeSeries
            frames={frames}
            structureRev={data.structureRev}
            timeRange={timeRange}
            timeZone={timezones}
            width={width}
            height={showTable ? chartHeight : height}
            legend={options.legend}
            options={options}
            {...(useNumericX && { preparePlotFrame: preparePlotFrameCallback })}
          >
            {(uplotConfig, alignedFrame) => {
              return (
                <>
                  {limitAnnotations.limits && (
                    <LimitAnnotations annotations={limitAnnotations.limits} config={uplotConfig} />
                  )}
                  {extensions?.plotOverlays?.map((Overlay, index) => (
                    <Overlay
                      key={index}
                      config={uplotConfig}
                      alignedFrame={alignedFrame}
                      frames={frames}
                      options={optionsWithVars}
                    />
                  ))}
                  {!useNumericX && ((annotations && annotations.length > 0) || newAnnotation) && (
                    <AlertAnnotations
                      annotations={annotations}
                      config={uplotConfig}
                      timeZone={timeZone}
                      panelId={id}
                      dashboardUID={dashboardUID}
                      onAnnotationChange={handleAnnotationSuccess}
                      newAnnotation={newAnnotation}
                    />
                  )}
                  <KeyboardPlugin config={uplotConfig} />
                  {!useNumericX && <ZoomPlugin config={uplotConfig} onZoom={onChangeTimeRange} />}
                  {cursorSync !== DashboardCursorSync.Off && (
                    <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
                  )}

                  <TooltipPlugin2
                    config={uplotConfig}
                    hoverMode={options.tooltip.mode === 'multi' ? 1 : 0}
                    syncMode={cursorSync}
                    syncScope={eventsScope}
                    render={(_plot, seriesIdxs, closestSeriesIdx, isPinned, dismiss) => {
                      // Get the focused point index from the series indices array
                      // seriesIdxs[0] is null (time field), so find the first non-null series index
                      const focusedPointIdx = seriesIdxs?.find((idx, i) => i > 0 && idx != null) ?? null;

                      // Remember the hovered point so a right-click can act on it.
                      const hoveredX = focusedPointIdx != null ? alignedFrame.fields[0]?.values[focusedPointIdx] : null;
                      const hoveredField = closestSeriesIdx != null ? alignedFrame.fields[closestSeriesIdx] : undefined;
                      hoveredPointRef.current =
                        focusedPointIdx != null && hoveredField && typeof hoveredX === 'number'
                          ? { seriesName: hoveredField.name, x: hoveredX, dataIdx: focusedPointIdx }
                          : null;

                      if (focusedPointIdx === null) {
                        return null;
                      }

                      return (
                        <TooltipContent
                          data={alignedFrame}
                          focusedSeriesIdx={closestSeriesIdx}
                          focusedPointIdx={focusedPointIdx}
                          frames={frames}
                          timeZone={timeZone}
                          onAddAnnotation={useNumericX ? undefined : handleAddAnnotation}
                          isPinned={isPinned}
                          onDismiss={dismiss}
                          options={optionsWithVars}
                          onOptionsChange={onOptionsChange}
                        />
                      );
                    }}
                  />
                </>
              );
            }}
          </TimeSeries>
        </div>
        {showTable && <div {...splitterProps} />}
        {showTable && (
          <div
            {...secondaryProps}
            style={{
              ...secondaryProps.style,
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              minHeight: 0,
            }}
          >
            <StatisticsTable
              series={samples}
              options={optionsWithVars}
              theme={theme}
              onExport={handleExport}
              allSeries={samplesWithCalcs}
              rawSeries={rawSamples}
            />
          </div>
        )}
      </div>
      {annotationModal.isOpen && annotationModal.time !== null && (
        <AnnotationFormModal
          isOpen={annotationModal.isOpen}
          time={annotationModal.time}
          panelId={id}
          dashboardUID={dashboardUID}
          onDismiss={handleModalDismiss}
          onSuccess={handleAnnotationSuccess}
        />
      )}
    </SeriesColorContextProvider>
  );
};

function SeriesColorContextProvider({
  children,
  onSeriesColorChange,
  eventBus,
}: React.PropsWithChildren<{ onSeriesColorChange: (label: string, color: string) => void; eventBus: EventBus }>) {
  const originalContext = usePanelContext();

  // calls both our custom implementation as well as and original function
  const customOnSeriesColorChange = useCallback(
    (label: string, color: string) => {
      if (onSeriesColorChange) {
        onSeriesColorChange(label, color);
      }

      if (originalContext.onSeriesColorChange) {
        originalContext.onSeriesColorChange(label, color);
      }
    },
    [onSeriesColorChange, originalContext]
  );

  const customContext = React.useMemo(
    () => ({
      ...originalContext,
      onSeriesColorChange: customOnSeriesColorChange,
      // GraphNG reads the bus off the panel context, so the self-filtering wrapper has to
      // be installed here too — not only on the EventBusPlugin we render ourselves.
      eventBus,
    }),
    [customOnSeriesColorChange, originalContext, eventBus]
  );

  return <PanelContextProvider value={customContext}>{children}</PanelContextProvider>;
}
