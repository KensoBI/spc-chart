import * as common from '@grafana/schema';
import { ControlLineReducerId } from 'data/spcReducers';
import { AggregationType, PositionInput, SpcChartTyp } from 'types';

export interface Options extends common.OptionsWithTimezones {
  legend: common.VizLegendOptions;
  orientation?: common.VizOrientation;
  tooltip: common.VizTooltipOptions;
  chartType: SpcChartTyp;
  subgroupSize: number;
  aggregationType: AggregationType;
  controlLines: ControlLine[];
  featureQueryRefIds: string[];
  onSeriesColorChange: (label: string, color: string) => void;
}

export interface FieldConfig extends common.GraphFieldConfig {}

export interface ControlLine {
  name: string;
  position: number;
  field: string;
  positionInput: PositionInput;
  seriesIndex: number;
  lineWidth: number;
  lineColor: string;
  fillDirection: number;
  fillOpacity: number;
  reducerId: ControlLineReducerId;
}
