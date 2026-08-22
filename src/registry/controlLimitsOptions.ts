import { PanelOptionsEditorBuilder } from '@grafana/data';
import { Options } from 'panelcfg';
import { ControlLimitsTeaser } from 'components/options/ControlLimitsTeaser';
import { chartTypeSigmaMethods } from './chartTypes';

/**
 * Extension point for the "Control limits" section of the panel editor.
 *
 * The free panel adds a single read-only row reporting which sigma estimator is
 * in force (see ControlLimitsTeaser); SPC Chart PRO calls
 * registerControlLimitsOptions from its registration module to replace that row
 * with the full estimation editors. Keeping the seam here means module.tsx does
 * not need a PRO-specific edit for this feature.
 */
export type ControlLimitsOptionsAdder = (builder: PanelOptionsEditorBuilder<Options>) => void;

export const CONTROL_LIMITS_CATEGORY = ['Control limits'];

let registeredAdder: ControlLimitsOptionsAdder | null = null;

export function registerControlLimitsOptions(adder: ControlLimitsOptionsAdder): void {
  registeredAdder = adder;
}

/** Charts that declare no sigma methods (attribute charts, CUSUM…) have nothing to configure. */
export function chartTypeHasEstimationOptions(chartType: string | undefined): boolean {
  return chartTypeSigmaMethods(chartType ?? '').length > 0;
}

export function addControlLimitsOptions(builder: PanelOptionsEditorBuilder<Options>): void {
  (registeredAdder ?? addFreeControlLimitsOptions)(builder);
}

function addFreeControlLimitsOptions(builder: PanelOptionsEditorBuilder<Options>): void {
  builder.addCustomEditor({
    id: 'estimationMode',
    path: 'chartOptions.estimation.mode',
    name: 'Calculation',
    description: 'How the center line and control limits are estimated from the data.',
    editor: ControlLimitsTeaser,
    defaultValue: 'auto',
    category: CONTROL_LIMITS_CATEGORY,
    showIf: (options) => chartTypeHasEstimationOptions(options.chartType),
  });
}
