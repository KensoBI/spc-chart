import { SigmaMethod } from 'calcs/sigma';
import { describeEstimation, getEstimationOptions, resolveEstimation } from './estimation';

const xbarR: SigmaMethod[] = ['rbar', 'sbar', 'pooled'];
const individuals: SigmaMethod[] = ['average-mr', 'median-mr'];

describe('resolveEstimation', () => {
  it('defaults to the chart default when nothing is stored', () => {
    expect(resolveEstimation(undefined, xbarR)).toEqual({ method: 'rbar', unbias: true, isDefault: true });
  });

  it('ignores custom values while the mode is auto', () => {
    const resolved = resolveEstimation(
      { estimation: { mode: 'auto', sigmaMethod: 'pooled', historicalSigma: 3 } },
      xbarR
    );
    expect(resolved).toEqual({ method: 'rbar', unbias: true, isDefault: true });
  });

  it('applies the stored method in custom mode', () => {
    const resolved = resolveEstimation({ estimation: { mode: 'custom', sigmaMethod: 'pooled' } }, xbarR);
    expect(resolved.method).toBe('pooled');
    expect(resolved.isDefault).toBe(false);
  });

  it('falls back to the chart default when the stored method does not apply to it', () => {
    // Left behind by switching from Xbar-R to XmR: 'pooled' needs subgroups.
    const resolved = resolveEstimation({ estimation: { mode: 'custom', sigmaMethod: 'pooled' } }, individuals);
    expect(resolved.method).toBe('average-mr');
    expect(resolved.isDefault).toBe(true);
  });

  it('keeps isDefault true for the default method so classic constants are used', () => {
    const resolved = resolveEstimation({ estimation: { mode: 'custom', sigmaMethod: 'rbar' } }, xbarR);
    expect(resolved.isDefault).toBe(true);
  });

  it('treats a historical sigma as non-default even with the default method', () => {
    const resolved = resolveEstimation(
      { estimation: { mode: 'custom', sigmaMethod: 'rbar', historicalSigma: 2 } },
      xbarR
    );
    expect(resolved.sigma).toBe(2);
    expect(resolved.isDefault).toBe(false);
  });

  it('accepts a historical mean without leaving the classic limit formulas', () => {
    const resolved = resolveEstimation({ estimation: { mode: 'custom', historicalMean: 10 } }, xbarR);
    expect(resolved.mean).toBe(10);
    expect(resolved.isDefault).toBe(true);
  });

  it('rejects non-finite and non-positive historical parameters', () => {
    const resolved = resolveEstimation(
      { estimation: { mode: 'custom', historicalMean: Number.NaN, historicalSigma: 0 } },
      xbarR
    );
    expect(resolved.mean).toBeUndefined();
    expect(resolved.sigma).toBeUndefined();
  });

  it('defaults unbiasing on, and only lets methods that have a constant switch it off', () => {
    expect(resolveEstimation({ estimation: { mode: 'custom', sigmaMethod: 'sbar' } }, xbarR).unbias).toBe(true);
    expect(
      resolveEstimation({ estimation: { mode: 'custom', sigmaMethod: 'sbar', unbias: false } }, xbarR).unbias
    ).toBe(false);
    // Rbar has no optional constant: the stored flag must not disable d2.
    expect(
      resolveEstimation({ estimation: { mode: 'custom', sigmaMethod: 'rbar', unbias: false } }, xbarR).unbias
    ).toBe(true);
  });
});

describe('getEstimationOptions', () => {
  it('tolerates missing and malformed values', () => {
    expect(getEstimationOptions(undefined)).toEqual({});
    expect(getEstimationOptions({})).toEqual({});
    expect(getEstimationOptions({ estimation: 'nonsense' })).toEqual({});
  });
});

describe('describeEstimation', () => {
  it('names the estimator in force', () => {
    expect(describeEstimation({ method: 'rbar', unbias: true, isDefault: true })).toBe('Rbar (R̄ / d₂)');
  });

  it('calls out a suppressed unbiasing constant and historical parameters', () => {
    expect(describeEstimation({ method: 'sbar', unbias: false, isDefault: false })).toBe(
      'Sbar (S̄ / c₄) · no unbiasing constant'
    );
    expect(describeEstimation({ method: 'rbar', unbias: true, sigma: 2, mean: 10, isDefault: false })).toBe(
      'historical σ = 2 · historical µ = 10'
    );
  });
});
