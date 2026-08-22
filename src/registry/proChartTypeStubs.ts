import { ChartTypeDefinition, registerProChartTypeStub } from './chartTypes';

/**
 * Chart types implemented by SPC Chart PRO, registered here as disabled
 * teasers so the free panel advertises them in the chart-type select. They
 * carry only metadata (no `compute`); SPC Chart PRO re-registers the same ids
 * with real implementations, replacing these stubs.
 *
 * Keep the ids and labels in sync with SPC Chart PRO's attribute chart
 * definitions — the id is the persisted dashboard value and the join key.
 */
export const proChartTypeStubs: Array<Omit<ChartTypeDefinition, 'compute' | 'pro'>> = [
  { id: 'p-attribute', label: 'p chart (proportion defective)', family: 'attribute', subgroupSize: { min: 1, max: 1 } },
  { id: 'np-attribute', label: 'np chart (count defective)', family: 'attribute', subgroupSize: { min: 1, max: 1 } },
  { id: 'c-attribute', label: 'c chart (defect count)', family: 'attribute', subgroupSize: { min: 1, max: 1 } },
  { id: 'u-attribute', label: 'u chart (defects per unit)', family: 'attribute', subgroupSize: { min: 1, max: 1 } },
  { id: 'laney-p-attribute', label: 'Laney p′ chart', family: 'attribute', subgroupSize: { min: 1, max: 1 } },
  { id: 'laney-u-attribute', label: 'Laney u′ chart', family: 'attribute', subgroupSize: { min: 1, max: 1 } },
];

export function registerProChartTypeStubs(): void {
  proChartTypeStubs.forEach(registerProChartTypeStub);
}

registerProChartTypeStubs();
