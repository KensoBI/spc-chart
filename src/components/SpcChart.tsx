import React, { useCallback, useMemo } from 'react';
import { PanelProps, DashboardCursorSync } from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import {
  EventBusPlugin,
  KeyboardPlugin,
  PanelContextProvider,
  TimeSeries,
  TooltipPlugin,
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

  const { frames, limitAnnotations } = useMemo(() => {
    let samplesWithCalcs = doSpcCalcs(data.series, optionsWithVars);
    const controlLines = computeControlLine(samplesWithCalcs, optionsWithVars);
    const limitAnnotations = buildLimitAnnotations(samplesWithCalcs, controlLines);
    const controlLineFrames = buildControlLineFrame(samplesWithCalcs, controlLines, fieldConfig);
    const combined = samplesWithCalcs.concat(controlLineFrames);
    const preped = prepareGraphableFields(combined, config.theme2, timeRange);

    return { frames: preped, limitAnnotations };
  }, [data.series, fieldConfig, optionsWithVars, timeRange]);

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

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
              <KeyboardPlugin config={uplotConfig} />
              {cursorSync !== DashboardCursorSync.Off && (
                <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
              )}

              <TooltipPlugin
                frames={frames}
                data={alignedFrame}
                config={uplotConfig}
                mode={options.tooltip.mode}
                timeZone={timeZone}
                sortOrder={options.tooltip.sort}
              />
            </>
          );
        }}
      </TimeSeries>
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
