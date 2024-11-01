import React from 'react';
import { MultiSelect } from '@grafana/ui';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { Options } from 'panelcfg';

export const FeatureQueryEditor = ({ value, onChange, context }: StandardEditorProps<string[], Options>) => {
  return (
    <MultiSelect
      isClearable={true}
      isMulti={true}
      value={value?.map((v) => ({ label: v, value: v }))}
      options={context.data?.map<SelectableValue<string>>((i) => ({ label: i.refId, value: i.refId }))}
      onChange={(v) => {
        onChange(v?.map((item) => item.value).filter((val): val is string => val !== undefined));
      }}
    />
  );
};
