import React from 'react';
import { Input, Select } from '@grafana/ui';
import { StandardEditorProps } from '@grafana/data';
import { SpcChartTyp } from 'types';
import { useSubgroupSize } from './useSubgroupSize';
import { Options } from 'panelcfg';

function createSubgroupOptions(startIndex: number, endIndex: number): Array<{ label: string; value: number }> {
  return Array.from({ length: endIndex - startIndex + 1 }, (_, i) => ({
    label: `${i + startIndex}`,
    value: i + startIndex,
  }));
}

export const SubgroupEditor = ({ item, value, onChange, context }: StandardEditorProps<number, Options>) => {
  const chartType = context.options.chartType || SpcChartTyp.none;
  const { subgroupSize, isDashboardVariable } = useSubgroupSize(value, chartType);

  // Set whether the input should be disabled based on chart type and dashboard variable
  const isDisabled = isDashboardVariable || chartType === SpcChartTyp.mR_XmR || chartType === SpcChartTyp.x_XmR;

  // Set the starting point of options
  const startFrom = chartType === SpcChartTyp.none ? 1 : 2;

  // Generate subgroup options for the Select component
  const subgroupOptions = createSubgroupOptions(startFrom, 25);

  return (
    <div>
      {isDisabled ? (
        <Input value={subgroupSize} disabled={true} />
      ) : (
        <Select
          isClearable={false}
          allowCustomValue={chartType === SpcChartTyp.none} // Allow custom value only for 'none' chart type
          value={subgroupSize}
          options={subgroupOptions}
          onChange={(selected) => onChange(selected.value)}
        />
      )}
    </div>
  );
};
