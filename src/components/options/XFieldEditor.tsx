import React, { useMemo } from 'react';
import { Combobox, type ComboboxOption, Icon, Tooltip } from '@grafana/ui';
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Combobox
        options={options}
        value={value || ''}
        onChange={(selected) => {
          onChange(selected?.value || undefined);
        }}
        placeholder="Select X-axis field"
      />
      <Tooltip
        content={
          <div>
            Choose X-axis type:
            <br />
            <br />
            <strong>Time (default):</strong> Use for time series data
            <br />
            <strong>Numeric field:</strong> Must be increasing numeric values (e.g., 1, 2, 3...). Use for
            indexed/sequential data.
          </div>
        }
      >
        <Icon name="info-circle" size="sm" />
      </Tooltip>
    </div>
  );
};
