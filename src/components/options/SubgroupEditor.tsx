import React from 'react';
import { Input, Combobox, type ComboboxOption } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { SpcChartTyp } from 'types';
import { useSubgroupSize } from './useSubgroupSize';
import { Options } from 'panelcfg';
import { chartTypeHasFixedSubgroup, getChartType } from 'registry/chartTypes';

function createSubgroupOptions(startIndex: number, endIndex: number): Array<ComboboxOption<number>> {
  return Array.from({ length: endIndex - startIndex + 1 }, (_, i) => ({
    label: `${i + startIndex}`,
    value: i + startIndex,
  }));
}

export const SubgroupEditor = ({ item, value, onChange, context }: StandardEditorProps<number, Options>) => {
  const chartType = context.options.chartType || SpcChartTyp.none;
  const { subgroupSize, isDashboardVariable } = useSubgroupSize(value, chartType);

  // module.tsx hides this editor entirely for chart types locked to subgroup size 1
  // (see chartTypeHasFixedSubgroup); disabling here too is defense-in-depth for any
  // other caller. Only a dashboard-variable binding is the "normal" disabled case.
  const isDisabled = isDashboardVariable || chartTypeHasFixedSubgroup(chartType);

  // The lowest selectable subgroup size is the chart type's declared minimum:
  // most subgrouped charts start at 2 (a subgroup of 1 is an individual), but
  // charts that also work on individuals — CUSUM, EWMA — declare min 1 and so
  // offer 1 here. Unknown types keep the historical start of 2; 'none' allows 1.
  const startFrom = chartType === SpcChartTyp.none ? 1 : getChartType(chartType)?.subgroupSize.min ?? 2;

  // Generate subgroup options for the Select component
  const subgroupOptions = createSubgroupOptions(startFrom, 25);

  return (
    <div>
      {isDisabled ? (
        <Input value={subgroupSize} disabled={true} />
      ) : (
        <Combobox
          isClearable={false}
          createCustomValue={chartType === SpcChartTyp.none} // Allow custom value only for 'none' chart type
          value={subgroupSize}
          options={subgroupOptions}
          onChange={(selected) => onChange(selected.value)}
        />
      )}
    </div>
  );
};
