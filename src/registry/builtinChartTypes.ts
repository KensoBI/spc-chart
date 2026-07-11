import { Field } from '@grafana/data';
import { SpcChartTyp } from 'types';
import { createXChartXmR, createMRChartXmR } from 'calcs/xmr';
import { createXbarChartForXbarR, createRChartForXbarR } from 'calcs/xbarr';
import { createXbarChartForXbarS, createSChartForXbarS } from 'calcs/xbars';
import { ChartTypeDefinition, registerChartType } from './chartTypes';

// Control chart math is defined over valid observations only.
function validNumbers(field: Field): number[] {
  return field.values.filter((value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value));
}

// XmR charts operate on individual observations (subgroup of 1); the Xbar
// family is only defined for sizes 2-25 (the range covered by the
// A2/A3/B3/B4/D3/D4 constants).
const individualsSubgroupSize = { min: 1, max: 1 };
const tabulatedSubgroupSizes = { min: 2, max: 25 };

export const builtinChartTypes: ChartTypeDefinition[] = [
  {
    id: SpcChartTyp.x_XmR,
    label: 'X chart (XmR)',
    family: 'variables',
    subgroupSize: individualsSubgroupSize,
    compute: (field) => createXChartXmR(validNumbers(field)),
  },
  {
    id: SpcChartTyp.mR_XmR,
    label: 'mR chart (XmR)',
    family: 'variables',
    subgroupSize: individualsSubgroupSize,
    compute: (field) => createMRChartXmR(validNumbers(field)),
  },
  {
    id: SpcChartTyp.x_XbarR,
    label: 'X chart (Xbar-R)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    compute: (field, ctx) => createXbarChartForXbarR(validNumbers(field), ctx.subgroupSize),
  },
  {
    id: SpcChartTyp.r_XbarR,
    label: 'R chart (Xbar-R)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    compute: (field, ctx) => createRChartForXbarR(validNumbers(field), ctx.subgroupSize),
  },
  {
    id: SpcChartTyp.x_XbarS,
    label: 'X chart (Xbar-S)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    compute: (field, ctx) => createXbarChartForXbarS(validNumbers(field), ctx.subgroupSize),
  },
  {
    id: SpcChartTyp.s_XbarS,
    label: 'S chart (Xbar-S)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    compute: (field, ctx) => createSChartForXbarS(validNumbers(field), ctx.subgroupSize),
  },
];

builtinChartTypes.forEach(registerChartType);
