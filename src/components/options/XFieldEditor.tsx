import React, { useMemo } from 'react';
import { Combobox, type ComboboxOption } from '@grafana/ui';
import { FieldType, StandardEditorProps } from '@grafana/data';
import { Options } from 'panelcfg';

export const XFieldEditor = ({ value, onChange, context }: StandardEditorProps<string | undefined, Options>) => {
  const options = useMemo(() => {
    const fieldOptions: ComboboxOption[] = [{ label: 'Time (default)', value: '' }];

    if (context.data && context.data.length > 0) {
      const frame = context.data[0];
      frame.fields.forEach((field) => {
        if (field.type === FieldType.number) {
          fieldOptions.push({
            label: field.name,
            value: field.name,
          });
        }
      });
    }

    return fieldOptions;
  }, [context.data]);

  return (
    <Combobox
      options={options}
      value={value || ''}
      onChange={(selected) => {
        onChange(selected?.value || undefined);
      }}
      placeholder="Select X-axis field"
    />
  );
};
