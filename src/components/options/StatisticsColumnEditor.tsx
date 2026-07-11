import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Icon, MultiSelect, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { Options } from 'panelcfg';

const COLUMN_OPTIONS = [
  { label: 'n', value: 'n' },
  { label: 'Mean', value: 'mean' },
  { label: 'Std Dev', value: 'stdDev' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'LCL', value: 'lcl' },
  { label: 'UCL', value: 'ucl' },
  { label: 'Cp', value: 'cp' },
  { label: 'Cpk', value: 'cpk' },
  { label: 'Pp', value: 'pp' },
  { label: 'Ppk', value: 'ppk' },
];

const tooltipContent = (
  <div>
    <strong>Requirements for Cp, Cpk, Pp, Ppk to appear:</strong>
    <div>- Add both an LSL and USL control line (one alone is not enough)</div>
    <div>- Series needs ≥ 2 data points for std dev</div>
    <div>- Cp / Cpk σ-hat by chart type:</div>
    <div>&nbsp;&nbsp;· None / XmR: needs ≥ 2 data points</div>
    <div>&nbsp;&nbsp;· XbarR / XbarS: subgroup size ≥ 2</div>
  </div>
);

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    color: theme.colors.text.secondary,
    cursor: 'help',
    flexShrink: 0,
  }),
});

export const StatisticsColumnEditor = ({ value, onChange }: StandardEditorProps<string[], any, Options>) => {
  const styles = useStyles2(getStyles);

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <MultiSelect
        options={COLUMN_OPTIONS}
        value={value ?? []}
        onChange={(selected) => onChange(selected.map((s) => s.value!))}
      />
      <Tooltip content={tooltipContent} placement="right" interactive>
        <Icon name="info-circle" className={styles.icon} />
      </Tooltip>
    </Stack>
  );
};
