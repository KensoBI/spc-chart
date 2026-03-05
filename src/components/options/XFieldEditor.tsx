import React, { useMemo } from 'react';
import { Combobox, type ComboboxOption, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { FieldType, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { css } from '@emotion/css';
import { Options } from 'panelcfg';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
});

export const XFieldEditor = ({ value, onChange, context }: StandardEditorProps<string | undefined, Options>) => {
  const styles = useStyles2(getStyles);
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
    <div className={styles.wrapper}>
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
