import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue, StandardEditorProps } from '@grafana/data';
import { Select, useStyles2 } from '@grafana/ui';
import { Options } from 'panelcfg';
import { describeEstimation, resolveEstimation } from 'data/estimation';
import { chartTypeSigmaMethods } from 'registry/chartTypes';
import { ProBadge } from 'components/ProBadge';

interface ModeOption extends SelectableValue<string> {
  pro?: boolean;
}

const PRO_TOOLTIP = 'Choose the sigma estimator and historical parameters with SPC Chart PRO';

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
  summary: css({
    marginTop: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});

/**
 * Free-panel view of the control-limit calculation: the free engine honours
 * whatever estimator a dashboard carries, so this row reports which one is in
 * force — the question an auditor asks — and advertises that changing it is a
 * PRO feature. SPC Chart PRO replaces this row with the real editors via
 * registerControlLimitsOptions.
 */
export const ControlLimitsTeaser = ({ value, onChange, context }: StandardEditorProps<string, unknown, Options>) => {
  const styles = useStyles2(getStyles);
  const methods = chartTypeSigmaMethods(context.options?.chartType ?? '');
  const estimation = methods.length > 0 ? resolveEstimation(context.options?.chartOptions, methods) : null;

  const options: ModeOption[] = [
    { label: 'Automatic', value: 'auto' },
    { label: 'Custom…', value: 'custom', pro: true, isDisabled: true },
  ];

  return (
    <>
      {/*
       * Not migrated to Combobox: this row needs a custom option renderer (the
       * PRO badge) and a disabled option that still shows its upsell tooltip,
       * neither of which Combobox supports. Revisit once it does.
       */}
      {/* eslint-disable-next-line deprecation/deprecation, @typescript-eslint/no-deprecated */}
      <Select
        options={options}
        value={value ?? 'auto'}
        onChange={(selected) => onChange(selected.value)}
        isClearable={false}
        formatOptionLabel={(option: ModeOption) => (
          <div className={styles.option} title={option.pro ? PRO_TOOLTIP : undefined}>
            <span>{option.label}</span>
            {option.pro && <ProBadge />}
          </div>
        )}
      />
      {estimation && <div className={styles.summary}>{describeEstimation(estimation)}</div>}
    </>
  );
};
