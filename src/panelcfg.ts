// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Generated by:
//     public/app/plugins/gen.go
// Using jennies:
//     TSTypesJenny
//     PluginTsTypesJenny
//
// Run 'make gen-cue' from repository root to regenerate.

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
