import React from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { AggregationType } from 'types';
import { useSubgroupSize } from './useSubgroupSize';
import { Options } from 'panelcfg';

type AggregationOption = {
  name: AggregationType;
  subgroupSize: number;
};

const aggregationOptions: AggregationOption[] = [
  {
    name: AggregationType.none,
    subgroupSize: 1,
  },
  {
    name: AggregationType.MovingRange,
    subgroupSize: 1,
  },
  {
    name: AggregationType.Mean,
    subgroupSize: 2,
  },
  {
    name: AggregationType.Range,
    subgroupSize: 2,
  },
  {
    name: AggregationType.StandardDeviation,
    subgroupSize: 2,
  },
];

export const AggregationTypeEditor = ({ value, onChange, context }: StandardEditorProps<string, Options>) => {
  const { subgroupSize } = useSubgroupSize(context.options.subgroupSize, context.options.chartType);

  // filter aggregation options based on the subgroup size
  const selectOptions = aggregationOptions.filter((aggregation) =>
    subgroupSize === 1
      ? aggregation.subgroupSize === 1
      : subgroupSize >= aggregation.subgroupSize && aggregation.subgroupSize !== 1
  );

  // if the current value is not in the filtered options, set it to the first available option
  if (!selectOptions.some((option) => option.name === value)) {
    onChange(selectOptions[0].name);
  }

  return (
    <Select
      isClearable={false}
      value={value}
      options={selectOptions.map<SelectableValue<string>>((i) => ({ label: i.name, value: i.name }))}
      onChange={(value) => {
        onChange(value.value);
      }}
    />
  );
};
