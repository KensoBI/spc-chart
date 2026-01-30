import { StandardEditorProps, SelectableValue } from '@grafana/data';
import { Stack, RadioButtonGroup } from '@grafana/ui';

import { InputPrefix, NullsThresholdInput } from './NullsThresholdInput';
import React from 'react';

type Props = StandardEditorProps<boolean | number, { isTime: boolean }>;

export const InsertNullsEditor = ({ value, onChange, item }: Props) => {
  const isThreshold = typeof value === 'number';

  const disconnectOptions: Array<SelectableValue<boolean | number>> = React.useMemo(() => [
    {
      label: 'Never',
      value: false,
    },
    {
      label: 'Threshold',
      value: isThreshold ? value : 3600000, // 1h
    },
  ], [isThreshold, value]);

  return (
    <Stack>
      <RadioButtonGroup value={value} options={disconnectOptions} onChange={onChange} />
      {isThreshold && (
        <NullsThresholdInput
          value={value}
          onChange={onChange}
          inputPrefix={InputPrefix.GreaterThan}
          isTime={item.settings?.isTime ?? false}
        />
      )}
    </Stack>
  );
};
