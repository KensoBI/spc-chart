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

/** A plotted point, as identified when the context menu was opened. */
export interface SpcMenuPoint {
  /** Field (series) name of the point's series in the aligned frame. */
  seriesName: string;
  /** X value of the point (epoch ms in time mode, X field value in numeric mode). */
  x: number;
  /** Row index in the aligned frame. */
  dataIdx: number;
}

export interface SpcMenuContext {
  options: Options;
  frames: DataFrame[];
  onOptionsChange: (options: Options) => void;
  /**
   * The plotted point nearest the cursor when the menu was opened (uPlot
   * snaps hover to the nearest point), or null when no point was hovered.
   */
  point?: SpcMenuPoint | null;
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
  /** Current panel options; a pinned tooltip needs these to offer point actions. */
  options?: Options;
  /** Persist a panel-options change made from a pinned-tooltip point action. */
  onOptionsChange?: (options: Options) => void;
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
