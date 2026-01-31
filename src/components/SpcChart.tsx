import React, { useCallback, useMemo, useState } from 'react';
import { PanelProps, DashboardCursorSync } from '@grafana/data';
import { config, PanelDataErrorView, locationService } from '@grafana/runtime';
import {
  EventBusPlugin,
  KeyboardPlugin,
  PanelContextProvider,
  TimeSeries,
  TooltipPlugin2,
  usePanelContext,
} from '@grafana/ui';

import { useSubgroupSizeOptions } from 'components/options/useSubgroupSize';
import { doSpcCalcs } from 'data/doSpcCalcs';
import {
  buildControlLineFrame,
  buildLimitAnnotations,
  computeControlLine,
} from 'components/ControlLines/buildLimitAnnotations';
import { LimitAnnotations } from 'components/ControlLines/LimitAnnotations';
import { AlertAnnotations } from 'components/ControlLines/AlertAnnotations';
import { CustomTooltipContent, AnnotationFormModal } from 'components/Annotations';
import { getTimezones, prepareGraphableFields } from 'utils';
import { Options } from 'panelcfg';

interface SpcChartPanelProps extends PanelProps<Options> {}

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
}: SpcChartPanelProps) => {
  const { sync, eventBus } = usePanelContext();

  const optionsWithVars = useSubgroupSizeOptions(options).options;

  // Annotation creation modal state
  const [annotationModal, setAnnotationModal] = useState<{
    isOpen: boolean;
    time: number | null;
  }>({ isOpen: false, time: null });

  // Track newly created annotation to add to local state
  const [newAnnotation, setNewAnnotation] = useState<{ id: number; text: string; tags?: string[]; time: number } | null>(null);

  // Get dashboard UID from URL
  const dashboardUID = useMemo(() => {
    const path = locationService.getLocation().pathname;
    const match = path.match(/\/d\/([^/]+)/);
    return match ? match[1] : undefined;
  }, []);

  const { frames, limitAnnotations, annotations } = useMemo(() => {
    let samplesWithCalcs = doSpcCalcs(data.series, optionsWithVars);
    const controlLines = computeControlLine(samplesWithCalcs, optionsWithVars);
    const limitAnnotations = buildLimitAnnotations(samplesWithCalcs, controlLines);
    const controlLineFrames = buildControlLineFrame(samplesWithCalcs, controlLines, fieldConfig);
    const combined = samplesWithCalcs.concat(controlLineFrames);
    const preped = prepareGraphableFields(combined, config.theme2, timeRange);

    return { frames: preped, limitAnnotations, annotations: data.annotations };
  }, [data.series, data.annotations, fieldConfig, optionsWithVars, timeRange]);

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  // Annotation handlers
  const handleAddAnnotation = useCallback((time: number) => {
    setAnnotationModal({ isOpen: true, time });
  }, []);

  const handleModalDismiss = useCallback(() => {
    setAnnotationModal({ isOpen: false, time: null });
  }, []);

  const handleAnnotationSuccess = useCallback((updatedData?: { id: number; text: string; tags?: string[]; time?: number }) => {
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
  }, []);

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

  if (!frames) {
    return (
      <PanelDataErrorView
        panelId={id}
        message="No data."
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
      />
    );
  }

  return (
    <SeriesColorContextProvider onSeriesColorChange={onSeriesColorChanged}>
      <TimeSeries
        frames={frames}
        structureRev={data.structureRev}
        timeRange={timeRange}
        timeZone={timezones}
        width={width}
        height={height}
        legend={options.legend}
        options={options}
      >
        {(uplotConfig, alignedFrame) => {
          return (
            <>
              {limitAnnotations.limits && (
                <LimitAnnotations annotations={limitAnnotations.limits} config={uplotConfig} />
              )}
              <AlertAnnotations
                annotations={annotations}
                config={uplotConfig}
                timeZone={timeZone}
                panelId={id}
                dashboardUID={dashboardUID}
                onAnnotationChange={handleAnnotationSuccess}
                newAnnotation={newAnnotation}
              />
              <KeyboardPlugin config={uplotConfig} />
              {cursorSync !== DashboardCursorSync.Off && (
                <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
              )}

              <TooltipPlugin2
                config={uplotConfig}
                hoverMode={options.tooltip.mode === 'multi' ? 1 : 0}
                syncMode={cursorSync}
                render={(_plot, seriesIdxs, closestSeriesIdx, isPinned, dismiss) => {
                  // Get the focused point index from the series indices array
                  // seriesIdxs[0] is null (time field), so find the first non-null series index
                  const focusedPointIdx = seriesIdxs?.find((idx, i) => i > 0 && idx != null) ?? null;

                  if (focusedPointIdx === null) {
                    return null;
                  }

                  return (
                    <CustomTooltipContent
                      data={alignedFrame}
                      focusedSeriesIdx={closestSeriesIdx}
                      focusedPointIdx={focusedPointIdx}
                      frames={frames}
                      timeZone={timeZone}
                      onAddAnnotation={handleAddAnnotation}
                      isPinned={isPinned}
                      onDismiss={dismiss}
                    />
                  );
                }}
              />
            </>
          );
        }}
      </TimeSeries>
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
}: React.PropsWithChildren<{ onSeriesColorChange: (label: string, color: string) => void }>) {
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
    }),
    [customOnSeriesColorChange, originalContext]
  );

  return <PanelContextProvider value={customContext}>{children}</PanelContextProvider>;
}
