import { ControlLineReducerId } from 'data/spcReducers';
import { ControlLine, Options } from 'panelcfg';
import { AggregationType, PositionInput, SpcChartTyp } from 'types';

interface OldConstantConfig {
  color: string;
  lineWidth: number;
  name: string;
  title: string;
}

interface OldSPCOptions {
  aggregation: string;
  sampleSize: number;
  nominal: number | undefined;
  lsl: number | undefined;
  usl: number | undefined;
}

// interface OldPanelOptions {
//   spcOptions: OldSPCOptions;
//   constantsConfig: {
//     items: OldConstantConfig[];
//   };
//   tooltip: VizTooltipOptions;
//   legend: VizLegendOptions;
// }

export const migrateOptions = (oldOptions: any): any => {
  // Create new panel options
  const newOptions: Options = {
    chartType: mapChartType(oldOptions.options.constantsConfig?.items, oldOptions.options.spcOptions?.aggregation),
    subgroupSize: oldOptions.options.spcOptions?.sampleSize || 1,
    aggregationType: mapAggregationType(oldOptions.options.spcOptions?.aggregation),
    controlLines: migrateControlLines(oldOptions.options.constantsConfig?.items || [], oldOptions.options.spcOptions),
    legend: oldOptions.options.legend,
    tooltip: oldOptions.options.tooltip,
    featureQueryRefIds: [],
    onSeriesColorChange: function (label: string, color: string): void {},
  };
  return newOptions;
};

function mapAggregationType(oldAggregation: string): AggregationType {
  // Map old aggregation types to new ones
  const aggregationMap: { [key: string]: AggregationType } = {
    range: AggregationType.Range,
    mean: AggregationType.Mean,
    standardDeviation: AggregationType.StandardDeviation,
  };

  return aggregationMap[oldAggregation] || AggregationType.none;
}

function mapChartType(oldConstants: OldConstantConfig[], aggregationName: string): SpcChartTyp {
  if (aggregationName === 'mean') {
    if (oldConstants.find((c) => c.name === 'ucl_Rbar' || c.name === 'lcl_Rbar')) {
      return SpcChartTyp.x_XbarR;
    }
    if (oldConstants.find((c) => c.name === 'ucl_Sbar' || c.name === 'lcl_Sbar')) {
      return SpcChartTyp.s_XbarS;
    }
  }

  if (aggregationName === 'range') {
    return SpcChartTyp.r_XbarR;
  }

  if (aggregationName === 'standardDeviation') {
    return SpcChartTyp.s_XbarS;
  }

  return SpcChartTyp.none;
}

function mapReducerType(name: string): ControlLineReducerId {
  const reducerNameMap: { [key: string]: ControlLineReducerId } = {
    nominal: ControlLineReducerId.nominal,
    lsl: ControlLineReducerId.lsl,
    usl: ControlLineReducerId.usl,
    min: ControlLineReducerId.min,
    max: ControlLineReducerId.max,
    mean: ControlLineReducerId.mean,
    range: ControlLineReducerId.range,
    lcl_Rbar: ControlLineReducerId.lcl,
    ucl_Rbar: ControlLineReducerId.ucl,
    lcl_Sbar: ControlLineReducerId.lcl,
    ucl_Sbar: ControlLineReducerId.ucl,
    lcl: ControlLineReducerId.lcl,
    ucl: ControlLineReducerId.ucl,
  };

  return reducerNameMap[name] || ControlLineReducerId.custom;
}

function mapPosition(name: string, oldOptions: OldSPCOptions | undefined): number {
  if (name === 'nominal' && oldOptions?.nominal) {
    return oldOptions.nominal;
  }

  if (name === 'lsl' && oldOptions?.lsl) {
    return oldOptions.lsl;
  }

  if (name === 'usl' && oldOptions?.usl) {
    return oldOptions.usl;
  }
  return 0;
}

function migrateControlLines(oldConstants: OldConstantConfig[], spcOptions: OldSPCOptions): ControlLine[] {
  return oldConstants.map((constant, index) => ({
    field: '',
    fillDirection: 0,
    fillOpacity: 10,
    lineColor: constant.color,
    lineWidth: constant.lineWidth,
    name: constant.title,
    position: mapPosition(constant.name, spcOptions),
    positionInput: PositionInput.static,
    reducerId: mapReducerType(constant.name),
    seriesIndex: 0,
  }));
}
