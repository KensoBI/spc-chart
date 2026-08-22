import { Field } from '@grafana/data';
import { SpcChartTyp } from 'types';
import { createXChartXmR, createMRChartXmR } from 'calcs/xmr';
import { createXbarChartForXbarR, createRChartForXbarR } from 'calcs/xbarr';
import { createXbarChartForXbarS, createSChartForXbarS } from 'calcs/xbars';
import { individualsSigmaMethods, SigmaMethod } from 'calcs/sigma';
import { resolveEstimation } from 'data/estimation';
import { ChartTypeDefinition, registerChartType, SpcCalcContext } from './chartTypes';

// Control chart math is defined over valid observations only.
function validNumbers(field: Field): number[] {
  return field.values.filter((value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value));
}

// XmR charts operate on individual observations (subgroup of 1); the Xbar
// family is only defined for sizes 2-25 (the range covered by the
// A2/A3/B3/B4/D3/D4 constants).
const individualsSubgroupSize = { min: 1, max: 1 };
const tabulatedSubgroupSizes = { min: 2, max: 25 };

// Each pair leads with the estimator the chart is named for — Xbar-R with R̄/d₂,
// Xbar-S with S̄/c₄ — and offers the alternatives Minitab allows.
const xbarRSigmaMethods: SigmaMethod[] = ['rbar', 'sbar', 'pooled'];
const xbarSSigmaMethods: SigmaMethod[] = ['sbar', 'rbar', 'pooled'];

const estimationFor = (ctx: SpcCalcContext, methods: SigmaMethod[]) => resolveEstimation(ctx.chartOptions, methods);

export const builtinChartTypes: ChartTypeDefinition[] = [
  {
    id: SpcChartTyp.x_XmR,
    label: 'X chart (XmR)',
    family: 'variables',
    subgroupSize: individualsSubgroupSize,
    sigmaMethods: individualsSigmaMethods,
    compute: (field, ctx) => createXChartXmR(validNumbers(field), estimationFor(ctx, individualsSigmaMethods)),
  },
  {
    id: SpcChartTyp.mR_XmR,
    label: 'mR chart (XmR)',
    family: 'variables',
    subgroupSize: individualsSubgroupSize,
    sigmaMethods: individualsSigmaMethods,
    compute: (field, ctx) => createMRChartXmR(validNumbers(field), estimationFor(ctx, individualsSigmaMethods)),
  },
  {
    id: SpcChartTyp.x_XbarR,
    label: 'X chart (Xbar-R)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    sigmaMethods: xbarRSigmaMethods,
    compute: (field, ctx) =>
      createXbarChartForXbarR(validNumbers(field), ctx.subgroupSize, estimationFor(ctx, xbarRSigmaMethods)),
  },
  {
    id: SpcChartTyp.r_XbarR,
    label: 'R chart (Xbar-R)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    sigmaMethods: xbarRSigmaMethods,
    compute: (field, ctx) =>
      createRChartForXbarR(validNumbers(field), ctx.subgroupSize, estimationFor(ctx, xbarRSigmaMethods)),
  },
  {
    id: SpcChartTyp.x_XbarS,
    label: 'X chart (Xbar-S)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    sigmaMethods: xbarSSigmaMethods,
    compute: (field, ctx) =>
      createXbarChartForXbarS(validNumbers(field), ctx.subgroupSize, estimationFor(ctx, xbarSSigmaMethods)),
  },
  {
    id: SpcChartTyp.s_XbarS,
    label: 'S chart (Xbar-S)',
    family: 'variables',
    subgroupSize: tabulatedSubgroupSizes,
    sigmaMethods: xbarSSigmaMethods,
    compute: (field, ctx) =>
      createSChartForXbarS(validNumbers(field), ctx.subgroupSize, estimationFor(ctx, xbarSSigmaMethods)),
  },
];

builtinChartTypes.forEach(registerChartType);
