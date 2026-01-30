import React from 'react';
import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { Stack, RadioButtonGroup } from '@grafana/ui';
import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';

type Props = StandardEditorProps<boolean | number, { isTime: boolean }>;

export const SpanNullsEditor = ({ value, onChange, item }: Props) => {
  const isThreshold = typeof value === 'number';

  const gapsOptions: Array<SelectableValue<boolean | number>> = React.useMemo(() => [
    {
      label: 'Never',
      value: false,
    },
    {
      label: 'Always',
      value: true,
    },
    {
      label: 'Threshold',
      value: isThreshold ? value : 3600000, // 1h
    },
  ], [isThreshold, value]);

  return (
    <Stack>
      <RadioButtonGroup value={value} options={gapsOptions} onChange={onChange} />
      {isThreshold && (
        <NullsThresholdInput
          value={value}
          onChange={onChange}
          inputPrefix={InputPrefix.LessThan}
          isTime={item.settings?.isTime ?? false}
        />
      )}
    </Stack>
  );
};
