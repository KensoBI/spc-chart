import { Field, FieldCalcs } from '@grafana/data';

import type { ControlLineReducer } from './spcReducers';

/**
 * Sigma-zone control lines (±1σ, ±2σ). Provided as computed control-line
 * reducers so they appear in the same "Add control line" dropdown as
 * LCL/UCL/Mean/LSL/… and inherit the whole control-line editor: per-line
 * color, width, fill direction/opacity, and per-series binding.
 *
 * ±3σ is intentionally omitted — those boundaries are exactly the LCL/UCL
 * control limits, which already exist as their own lines.
 *
 * Position is derived from the series' own control limits:
 *   sigma = (ucl - mean) / 3           (the one-sigma distance the limits imply)
 *   position = mean ± multiple · sigma
 * The `reduce` fn runs inside doSpcCalcs after the chart-type calcs have
 * populated mean/ucl, and writes each line's position into
 * field.state.calcs under the reducer id — where processComputedControlLines
 * (buildLimitAnnotations) reads it, just like every other computed line.
 *
 * These reducers are spread into the built-in `controlLineReducers` array in
 * spcReducers.ts, so they are always present with no registration ordering
 * concerns.
 */

// Sigma reducer ids double as the field.state.calcs keys the positions are
// stored under, so keep them stable: sigma1u, sigma1l, sigma2u, sigma2l.
export type SigmaMultiple = 1 | 2;
export type SigmaSign = 1 | -1;

export function sigmaReducerId(multiple: SigmaMultiple, sign: SigmaSign): string {
  return `sigma${multiple}${sign === 1 ? 'u' : 'l'}`;
}

// Zone-boundary defaults: 1σ (zone C edge) green, 2σ (zone B edge) yellow.
// The registry has no theme at module-load time, so — like the built-in
// reducers in data/spcReducers.ts — these are plain hex the user overrides
// via the editor's color picker. They map to Grafana's dark-green / yellow.
const SIGMA_ONE_COLOR = '#37872d';
const SIGMA_TWO_COLOR = '#e0b400';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function makeSigmaReducer(multiple: SigmaMultiple, sign: SigmaSign): ControlLineReducer {
  const id = sigmaReducerId(multiple, sign);
  const label = `${sign === 1 ? '+' : '−'}${multiple}σ`;

  return {
    id,
    name: label,
    description: `Draws the ${label} sigma-zone line at mean ${sign === 1 ? '+' : '−'} ${multiple}σ, derived from the control limits.`,
    computed: true,
    isStandard: false,
    color: multiple === 1 ? SIGMA_ONE_COLOR : SIGMA_TWO_COLOR,
    reduce: (field: Field): FieldCalcs => {
      const calcs = field.state?.calcs;
      const mean = calcs?.mean;
      const ucl = calcs?.ucl;
      const meanData: Array<number | null> | undefined = Array.isArray(calcs?.meanData) ? calcs?.meanData : undefined;
      const uclData: Array<number | null> | undefined = Array.isArray(calcs?.uclData) ? calcs?.uclData : undefined;

      const out: FieldCalcs = {};
      if (isNum(mean) && isNum(ucl)) {
        const sigma = (ucl - mean) / 3;
        if (sigma > 0) {
          out[id] = mean + sign * multiple * sigma;
        }
      }

      // Per-point positions when the center line or limits vary by point
      // (staged charts, variable-limit attribute charts): the sigma line then
      // renders stepped, from each point's own mean/ucl pair.
      const length = meanData?.length ?? uclData?.length ?? 0;
      if (length > 0) {
        const data: Array<number | null> = [];
        for (let i = 0; i < length; i++) {
          const meanAt = meanData ? meanData[i] : mean;
          const uclAt = uclData ? uclData[i] : ucl;
          data.push(
            isNum(meanAt) && isNum(uclAt) && uclAt - meanAt > 0
              ? meanAt + (sign * multiple * (uclAt - meanAt)) / 3
              : null
          );
        }
        out[`${id}Data`] = data;
      }

      return Object.keys(out).length > 0 ? out : {};
    },
  };
}

/** The ±1σ and ±2σ computed control-line reducers, built once at module load. */
export const sigmaControlLineReducers: ControlLineReducer[] = [
  makeSigmaReducer(1, 1),
  makeSigmaReducer(1, -1),
  makeSigmaReducer(2, 1),
  makeSigmaReducer(2, -1),
];
