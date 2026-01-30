import React, { useCallback } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { GraphThresholdsStyleMode } from '@grafana/schema';
import { Combobox, type ComboboxOption } from '@grafana/ui';

type Props = StandardEditorProps<
  { mode: GraphThresholdsStyleMode },
  { options: Array<ComboboxOption<GraphThresholdsStyleMode>> }
>;

export const ThresholdsStyleEditor = ({ item, value, onChange, id }: Props) => {
  const onChangeCb = useCallback(
    (option: ComboboxOption<GraphThresholdsStyleMode>) => {
      onChange({
        mode: option.value,
      });
    },
    [onChange]
  );
  return <Combobox id={id} value={value.mode} options={item.settings?.options ?? []} onChange={onChangeCb} />;
};
