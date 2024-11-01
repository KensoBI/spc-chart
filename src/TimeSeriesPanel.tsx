import React, { useMemo } from 'react';
import { PanelProps, DashboardCursorSync } from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
//import { TooltipDisplayMode, VizOrientation } from '@grafana/schema';
import { EventBusPlugin, KeyboardPlugin, TimeSeries, usePanelContext } from '@grafana/ui';
//import { TimeRange2, TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';

//import { VizTooltip } from '@grafana/ui'
import { Options } from './panelcfg';
// import { AnnotationsPlugin2 } from './plugins/AnnotationsPlugin2';
// import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
// import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
// import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getTimezones, prepareGraphableFields } from './utils';
import { useSubgroupSizeOptions } from 'components/options/useSubgroupSize';
import { doSpcCalcs } from 'data/doSpcCalcs';
import {
  buildControlLineFrame,
  buildLimitAnnotations,
  computeControlLine,
} from 'components/ControlLines/buildLimitAnnotations';
import { LimitAnnotations } from 'components/ControlLines/LimitAnnotations';

interface TimeSeriesPanelProps extends PanelProps<Options> {}

export const TimeSeriesPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  // onChangeTimeRange,
  // replaceVariables,
  id,
}: TimeSeriesPanelProps) => {
  const {
    sync,
    //eventsScope,
    //canAddAnnotations,
    // onThresholdsChange,
    // canEditThresholds,
    // showThresholds,
    // dataLinkPostProcessor,
    eventBus,
  } = usePanelContext();

  const optionsWithVars = useSubgroupSizeOptions(options).options;

  const { frames, limitAnnotations } = useMemo(() => {
    let samplesWithCalcs = doSpcCalcs(data.series, optionsWithVars);

    const controlLines = computeControlLine(samplesWithCalcs, optionsWithVars);
    const limitAnnotations = buildLimitAnnotations(samplesWithCalcs, controlLines);
    const controlLineFrames = buildControlLineFrame(samplesWithCalcs, controlLines);

    const preped = prepareGraphableFields(samplesWithCalcs, config.theme2, timeRange);
    const allFrames = preped.concat(controlLineFrames);

    return { frames: allFrames, limitAnnotations };
  }, [data.series, optionsWithVars, timeRange]);

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);

  //const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
  //const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  if (!frames) {
    return (
      <PanelDataErrorView
        panelId={id}
        message="No data."
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
        //suggestions={suggestions?.suggestions}
      />
    );
  }

  return (
    <TimeSeries
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timezones}
      width={width}
      height={height}
      legend={options.legend}
      options={options}
      //replaceVariables={replaceVariables}
      //dataLinkPostProcessor={dataLinkPostProcessor}
      //cursorSync={cursorSync}
    >
      {(uplotConfig, alignedFrame) => {
        return (
          <>
            {limitAnnotations.limits && <LimitAnnotations annotations={limitAnnotations.limits} config={uplotConfig} />}
            <KeyboardPlugin config={uplotConfig} />
            {cursorSync !== DashboardCursorSync.Off && (
              <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
            )}
          </>
        );
      }}
    </TimeSeries>
  );
};
