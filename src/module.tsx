import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder, TooltipDisplayMode } from '@grafana/ui';

import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { defaultStatisticsTableColumns, FieldConfig, Options } from './panelcfg';
import { StatisticsColumnEditor } from 'components/options/StatisticsColumnEditor';
import { SpcChartTyp } from 'types';
import { SubgroupEditor } from 'components/options/SubgroupEditor';
import { AggregationTypeEditor } from 'components/options/AggregationTypeEditor';
import { ControlLineEditor } from 'components/options/ControlLineEditor';
import { migrateOptions } from 'migrations';
import { listChartTypes } from 'registry/chartTypes';
import 'registry/builtinChartTypes';
import { TimezonesEditor } from 'components/options/TimezonesEditor';
import { XFieldEditor } from 'components/options/XFieldEditor';
import { SpcChartPanel } from 'components/SpcChart';
import { SortOrder } from '@grafana/schema';

export const plugin = new PanelPlugin<Options, FieldConfig>(SpcChartPanel)
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
          ...listChartTypes().map((chartType) => ({ label: chartType.label, value: chartType.id as SpcChartTyp })),
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

    builder.addBooleanSwitch({
      path: 'showStatisticsTable',
      name: 'Show statistics table',
      description: 'Display a table with SPC statistics below the chart',
      defaultValue: false,
      category: ['Statistics Table'],
    });

    builder.addCustomEditor({
      id: 'statisticsTableColumns',
      path: 'statisticsTableColumns',
      name: 'Visible columns',
      description: 'Choose which columns to display in the statistics table',
      editor: StatisticsColumnEditor,
      defaultValue: defaultStatisticsTableColumns,
      showIf: (option) => option.showStatisticsTable === true,
      category: ['Statistics Table'],
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, false, {
      tooltip: {
        mode: TooltipDisplayMode.Multi,
        sort: SortOrder.None,
      },
    });

    commonOptionsBuilder.addLegendOptions(builder);
    builder.addCustomEditor({
      id: 'xField',
      name: 'X-axis field',
      path: 'xField',
      category: ['Axis'],
      editor: XFieldEditor,
      defaultValue: undefined,
    });
    builder.addCustomEditor({
      id: 'timezone',
      name: 'Time zone',
      path: 'timezone',
      category: ['Axis'],
      editor: TimezonesEditor,
      defaultValue: undefined,
      showIf: (options) => !options.xField,
    });
  })
  .setDataSupport({ annotations: true, alertStates: true });
