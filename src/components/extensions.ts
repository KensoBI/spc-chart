import React from 'react';
import { DataFrame } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';
import { Options } from 'panelcfg';

/** Props handed to every plot overlay, mirroring what the built-in uPlot plugins receive. */
export interface SpcOverlayProps {
  config: UPlotConfigBuilder;
  alignedFrame: DataFrame;
  /** All plotted frames (post-calculation, including control-line frames). */
  frames: DataFrame[];
  options: Options;
}

export interface SpcMenuContext {
  options: Options;
  frames: DataFrame[];
  onOptionsChange: (options: Options) => void;
}

/** Props of the hover tooltip; a replacement component must accept exactly these. */
export interface SpcTooltipProps {
  data: DataFrame;
  focusedSeriesIdx: number | null;
  focusedPointIdx: number | null;
  frames: DataFrame[];
  timeZone: string;
  onAddAnnotation?: (time: number) => void;
  isPinned?: boolean;
  onDismiss?: () => void;
}

/**
 * Extension seams of the SPC chart panel. A wrapper panel can pass these to
 * add canvas overlays (e.g. sigma zones, rule-violation markers), context-menu
 * actions, or a custom tooltip without modifying SpcChartPanel itself.
 */
export interface SpcChartExtensions {
  plotOverlays?: Array<React.ComponentType<SpcOverlayProps>>;
  contextMenuItems?: (ctx: SpcMenuContext) => React.ReactNode;
  tooltipContent?: React.ComponentType<SpcTooltipProps>;
}
