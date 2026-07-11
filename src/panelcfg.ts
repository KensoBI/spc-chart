import * as common from '@grafana/schema';
import { ControlLineReducerId } from 'data/spcReducers';
import { AggregationType, PositionInput, SpcChartTyp } from 'types';

export interface Options extends common.OptionsWithTimezones {
  legend: common.VizLegendOptions;
  orientation?: common.VizOrientation;
  tooltip: common.VizTooltipOptions;
  chartType: SpcChartTyp | string;
  subgroupSize: number;
  aggregationType: AggregationType;
  /** Per-chart-type parameters, keyed and interpreted by the chart type that owns them. Opaque to the panel. */
  chartOptions?: Record<string, unknown>;
  controlLines: ControlLine[];
  featureQueryRefIds: string[];
  onSeriesColorChange: (label: string, color: string) => void;
  /** Field name for numeric X-axis. When set, uses numeric X instead of time. */
  xField?: string;
  showStatisticsTable?: boolean;
  statisticsTableColumns?: string[];
}

export const defaultStatisticsTableColumns = [
  'n',
  'mean',
  'stdDev',
  'min',
  'max',
  'lcl',
  'ucl',
  'cp',
  'cpk',
  'pp',
  'ppk',
];

export interface FieldConfig extends common.GraphFieldConfig {}

export interface ControlLine {
  name: string;
  position?: number;
  field: string;
  positionInput: PositionInput;
  seriesIndex: number;
  lineWidth: number;
  lineColor: string;
  fillDirection: number;
  fillOpacity: number;
  reducerId: ControlLineReducerId | string;
}
