import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { Select, useStyles2 } from '@grafana/ui';
import { Options } from 'panelcfg';
import { SpcChartTyp } from 'types';
import { listChartTypes } from 'registry/chartTypes';
import { ProBadge } from 'components/ProBadge';

interface ChartTypeOption extends SelectableValue<string> {
  pro?: boolean;
}

const PRO_TOOLTIP = 'Unlock with SPC Chart PRO';

const getStyles = (theme: GrafanaTheme2) => ({
  option: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    width: '100%',
    // Disabled options get pointer-events: none from the Select, which would
    // also suppress the upsell tooltip on hover; re-enable it here.
    pointerEvents: 'auto',
  }),
});

/**
 * Chart type select. Renders PRO chart types (teaser stubs, see
 * registry/chartTypes) as disabled entries with a "PRO" badge, so users can
 * discover what SPC Chart PRO adds without the entries being selectable.
 */
export const ChartTypeEditor = ({ value, onChange }: StandardEditorProps<string, unknown, Options>) => {
  const styles = useStyles2(getStyles);

  const options: ChartTypeOption[] = [
    { label: 'none', value: SpcChartTyp.none },
    ...listChartTypes().map((chartType) => ({
      label: chartType.label,
      value: chartType.id,
      pro: chartType.pro,
      isDisabled: chartType.pro,
    })),
  ];

  return (
    <Select
      options={options}
      value={value ?? SpcChartTyp.none}
      onChange={(selected) => onChange(selected.value)}
      isClearable={false}
      formatOptionLabel={(option: ChartTypeOption) => (
        <div className={styles.option} title={option.pro ? PRO_TOOLTIP : undefined}>
          <span>{option.label}</span>
          {option.pro && <ProBadge />}
        </div>
      )}
    />
  );
};
