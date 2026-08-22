import { Field, FieldType } from '@grafana/data';

import { controlLineReducers } from './spcReducers';
import { sigmaReducerId } from './sigmaLines';

function fieldWithCalcs(mean: number | null, ucl: number | null): Field {
  return {
    name: 'value',
    type: FieldType.number,
    values: [],
    config: {},
    state: { calcs: { mean, ucl } },
  } as unknown as Field;
}

function reducerFor(multiple: 1 | 2, sign: 1 | -1) {
  const id = sigmaReducerId(multiple, sign);
  const reducer = controlLineReducers.find((r) => r.id === id);
  if (!reducer) {
    throw new Error(`sigma reducer ${id} not present`);
  }
  return reducer;
}

describe('sigma-zone control-line reducers', () => {
  it('provides exactly the ±1σ and ±2σ computed reducers (no ±3σ)', () => {
    expect(controlLineReducers.find((r) => r.id === 'sigma1u')).toBeDefined();
    expect(controlLineReducers.find((r) => r.id === 'sigma1l')).toBeDefined();
    expect(controlLineReducers.find((r) => r.id === 'sigma2u')).toBeDefined();
    expect(controlLineReducers.find((r) => r.id === 'sigma2l')).toBeDefined();
    expect(controlLineReducers.find((r) => r.id === 'sigma3u')).toBeUndefined();
    expect(controlLineReducers.find((r) => r.id === 'sigma3l')).toBeUndefined();
  });

  it('marks sigma reducers as computed, non-standard', () => {
    const r = reducerFor(1, 1);
    expect(r.computed).toBe(true);
    expect(r.isStandard).toBe(false);
  });

  // mean=50, ucl=53 → sigma = (53-50)/3 = 1
  describe('reduce derives mean ± N·sigma from the control limits', () => {
    const field = fieldWithCalcs(50, 53);

    it('+1σ = mean + sigma', () => {
      expect(reducerFor(1, 1).reduce!(field, 1)).toEqual({ sigma1u: 51 });
    });

    it('−1σ = mean − sigma', () => {
      expect(reducerFor(1, -1).reduce!(field, 1)).toEqual({ sigma1l: 49 });
    });

    it('+2σ = mean + 2·sigma', () => {
      expect(reducerFor(2, 1).reduce!(field, 1)).toEqual({ sigma2u: 52 });
    });

    it('−2σ = mean − 2·sigma', () => {
      expect(reducerFor(2, -1).reduce!(field, 1)).toEqual({ sigma2l: 48 });
    });
  });

  describe('reduce emits per-point positions when the calcs vary by point', () => {
    function fieldWithDataCalcs(calcs: Record<string, unknown>): Field {
      return { name: 'value', type: FieldType.number, values: [], config: {}, state: { calcs } } as unknown as Field;
    }

    it('steps with a staged center line (meanData + uclData)', () => {
      const field = fieldWithDataCalcs({
        mean: 20,
        ucl: 23,
        meanData: [10, 10, 20, 20],
        uclData: [13, 13, 23, 23],
      });
      const out = reducerFor(1, 1).reduce!(field, 1);
      expect(out.sigma1u).toBe(21);
      expect(out.sigma1uData).toEqual([11, 11, 21, 21]);
    });

    it('steps with variable limits only (attribute charts: uclData + scalar mean)', () => {
      const field = fieldWithDataCalcs({ mean: 50, ucl: 53, uclData: [53, 56, null] });
      const out = reducerFor(2, -1).reduce!(field, 1);
      // sigma per point: 1, 2, gap → -2σ = 48, 46, null
      expect(out.sigma2lData).toEqual([48, 46, null]);
    });

    it('nulls points whose stage could not compute', () => {
      const field = fieldWithDataCalcs({ mean: 20, ucl: 23, meanData: [10, null], uclData: [13, null] });
      expect(reducerFor(1, 1).reduce!(field, 1).sigma1uData).toEqual([11, null]);
    });
  });

  describe('reduce yields no position when limits are unusable', () => {
    it('returns {} when mean is missing', () => {
      expect(reducerFor(1, 1).reduce!(fieldWithCalcs(null, 53), 1)).toEqual({});
    });

    it('returns {} when ucl is missing', () => {
      expect(reducerFor(1, 1).reduce!(fieldWithCalcs(50, null), 1)).toEqual({});
    });

    it('returns {} when sigma is not positive (ucl ≤ mean)', () => {
      expect(reducerFor(1, 1).reduce!(fieldWithCalcs(50, 50), 1)).toEqual({});
    });

    it('returns {} when the field has no calcs', () => {
      const bare = { name: 'value', type: FieldType.number, values: [], config: {} } as Field;
      expect(reducerFor(1, 1).reduce!(bare, 1)).toEqual({});
    });
  });
});
