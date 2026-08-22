import {
  chartTypeHasFixedSubgroup,
  computeChartType,
  getChartType,
  registerChartType,
  registerProChartTypeStub,
} from './chartTypes';
import { proChartTypeStubs } from './proChartTypeStubs';

const anyField = { name: 'v', type: 'number', values: [1, 2, 3], config: {} } as any;
const ctx = { subgroupSize: 1 };

describe('PRO chart type stubs', () => {
  it('registers every stub as a disabled teaser (pro, no compute)', () => {
    for (const stub of proChartTypeStubs) {
      const registered = getChartType(stub.id);
      expect(registered).toBeDefined();
      expect(registered!.pro).toBe(true);
      expect(registered!.compute).toBeUndefined();
    }
  });

  it('exposes the six attribute chart types with subgroup size locked to 1', () => {
    expect(proChartTypeStubs.map((s) => s.id)).toEqual([
      'p-attribute',
      'np-attribute',
      'c-attribute',
      'u-attribute',
      'laney-p-attribute',
      'laney-u-attribute',
    ]);
    for (const stub of proChartTypeStubs) {
      expect(chartTypeHasFixedSubgroup(stub.id)).toBe(true);
    }
  });

  it('computeChartType falls back (null) for a teaser stub', () => {
    expect(computeChartType(anyField, 'p-attribute', ctx)).toBeNull();
  });

  it('does not clobber a real implementation already registered under the id', () => {
    const id = 'test-real-chart';
    registerChartType({
      id,
      label: 'Real',
      family: 'attribute',
      subgroupSize: { min: 1, max: 1 },
      compute: () => ({ centerLine: 0, upperControlLimit: 1, lowerControlLimit: -1, data: [0] }),
    });
    registerProChartTypeStub({ id, label: 'Stub', family: 'attribute', subgroupSize: { min: 1, max: 1 } });

    const registered = getChartType(id)!;
    expect(registered.pro).toBeUndefined();
    expect(registered.compute).toBeDefined();
    expect(registered.label).toBe('Real');
  });

  it('a real registration replaces an existing stub', () => {
    const id = 'test-stub-then-real';
    registerProChartTypeStub({ id, label: 'Stub', family: 'attribute', subgroupSize: { min: 1, max: 1 } });
    expect(getChartType(id)!.pro).toBe(true);

    registerChartType({
      id,
      label: 'Real',
      family: 'attribute',
      subgroupSize: { min: 1, max: 1 },
      compute: () => ({ centerLine: 0, upperControlLimit: 1, lowerControlLimit: -1, data: [0] }),
    });
    const registered = getChartType(id)!;
    expect(registered.pro).toBeUndefined();
    expect(registered.compute).toBeDefined();
  });
});
