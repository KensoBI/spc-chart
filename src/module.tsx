import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { TimeSeriesPanel } from './TimeSeriesPanel';
import { TimezonesEditor } from './TimezonesEditor';
import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { FieldConfig, Options } from './panelcfg';
import { SpcChartTyp } from 'types';
import { SubgroupEditor } from 'components/options/SubgroupEditor';
import { AggregationTypeEditor } from 'components/options/AggregationTypeEditor';
import { ControlLineEditor } from 'components/options/ControlLineEditor';
import { migrateOptions } from 'migrations';

export const plugin = new PanelPlugin<Options, FieldConfig>(TimeSeriesPanel)
  .setMigrationHandler(migrateOptions)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    builder.addSelect({
      path: 'chartType',
      name: 'Chart type',
      description: 'Choose the type of control chart to generate',
      settings: {
        allowCustomValue: false,
        options: [
          { label: 'none', value: SpcChartTyp.none },
          { label: 'X chart (XmR)', value: SpcChartTyp.x_XmR },
          { label: 'mR chart (XmR)', value: SpcChartTyp.mR_XmR },
          { label: 'X chart (Xbar-R)', value: SpcChartTyp.x_XbarR },
          { label: 'R chart (Xbar-R)', value: SpcChartTyp.r_XbarR },
          { label: 'X chart (Xbar-S)', value: SpcChartTyp.x_XbarS },
          { label: 'S chart (Xbar-S)', value: SpcChartTyp.s_XbarS },
        ],
      },

      defaultValue: SpcChartTyp.none,
      category: ['SPC'],
    });
    builder.addCustomEditor({
      id: 'subgroupSize',
      path: 'subgroupSize',
      name: 'Subgroup size',
      description: 'The number of measurements taken within a single subgroup.',
      editor: SubgroupEditor,
      defaultValue: 1,
      category: ['SPC'],
    });

    builder.addCustomEditor({
      id: 'aggregationType',
      path: 'aggregationType',
      name: 'Aggregation type',
      description: 'Define how each subgroup is calculated.',
      editor: AggregationTypeEditor,
      defaultValue: 'none',
      showIf: (option) => option.chartType === SpcChartTyp.none,
      category: ['SPC'],
    });

    builder.addCustomEditor({
      id: 'controlLines',
      path: 'controlLines',
      name: 'Control lines',
      description: 'A control line indicates thresholds for monitoring process stability.',
      editor: ControlLineEditor,
      defaultValue: [],
      category: ['SPC'],
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, false);
    commonOptionsBuilder.addLegendOptions(builder);
    builder.addCustomEditor({
      id: 'timezone',
      name: 'Time zone',
      path: 'timezone',
      category: ['Axis'],
      editor: TimezonesEditor,
      defaultValue: undefined,
    });
  })
  //.setSuggestionsSupplier(new TimeSeriesSuggestionsSupplier())
  .setDataSupport({ annotations: true, alertStates: true });
