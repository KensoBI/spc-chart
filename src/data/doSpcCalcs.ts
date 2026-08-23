import { DataFrame, Field, FieldCalcs, FieldType } from '@grafana/data';
import { Options } from 'panelcfg';
import { calculateStandardStats } from 'calcs/standard';
import { controlLineReducers } from './spcReducers';
import { AggregationType, ChartExtraSeries, SPC_COMPANION_SERIES } from 'types';
import { calculateNumericRange } from 'calcs/common';
import { aggregateSeries, isValidNumber } from './aggregation';
import { computeChartType, getChartType, SpcCalcContext } from 'registry/chartTypes';
import { applyExclusionsToChartData, resolveExclusions } from './exclusions';
import { applyStagesToChartData, resolveStageSegments } from './stages';
import 'registry/builtinChartTypes';

//apply data aggregations to all series and save results in field state as FieldCalcs
export function doSpcCalcs(series: DataFrame[], options: Options, xFieldName?: string): DataFrame[] {
  const subgroupSize = options.subgroupSize < 1 ? 1 : options.subgroupSize;
  const aggregationType = options.aggregationType ?? AggregationType.none;
  const standardReducers = controlLineReducers.filter((p) => p.isStandard).map((p) => p.id);

  const activeChartType = getChartType(options.chartType);

  return series.map((frame, frameIndex) => {
    // Reference (feature) queries only supply values to control lines. They are neither plotted
    // nor tabulated, so the chart-type transform must not run over them — a spec limit is not a
    // process statistic — but they still fold into subgroups like the time field does, so a
    // per-point reference value stays aligned with the point it belongs to.
    const isFeatureFrame = options.featureQueryRefIds?.includes(frame.refId!) ?? false;

    const shouldCalculateStandardStats =
      options.controlLines.filter((c) => standardReducers.includes(c.reducerId)).length > 0;

    // Per-frame context so chart types can read companion columns (with
    // pre-aggregation values) from the frame their field belongs to.
    const calcContext: SpcCalcContext = {
      subgroupSize,
      aggregationType,
      options,
      chartOptions: options.chartOptions,
      frame,
    };

    // Companion series produced by multi-series chart types (e.g. the CUSUM
    // lower sum). Collected while mapping and appended at the end of the frame
    // so every original field keeps its index (control lines reference those).
    const companionFields: Field[] = [];

    const mappedFields = frame.fields.map((field) => {
        // Auxiliary inputs of the active chart type (e.g. a sample-size
        // column) are not plotted series: leave their values untouched for
        // the chart's compute to read, and hide them from the visualization.
        if (activeChartType?.isAuxiliaryField?.(field, calcContext)) {
          return {
            ...field,
            config: {
              ...field.config,
              custom: {
                ...field.config?.custom,
                hideFrom: { viz: true, legend: true, tooltip: true },
              },
            },
          };
        }

        const updatedField = { ...field };

        // Check if this is the numeric X field (for trend/numeric x-axis mode). Matched by name
        // per frame: queries need not agree on column order for the X field to be recognised.
        const isNumericXField = xFieldName !== undefined && field.name === xFieldName;

        // Aggregate time field or numeric X field when using subgroups
        if (updatedField.type === FieldType.time || isNumericXField) {
          updatedField.values = aggregateSeries(updatedField.values, subgroupSize, AggregationType.Mean);
          // Don't process numeric X field as a value field
          if (isNumericXField) {
            return updatedField;
          }
        }

        if (isFeatureFrame && field.type === FieldType.number && !isNumericXField) {
          updatedField.values = aggregateSeries(updatedField.values, subgroupSize, AggregationType.Mean);
          return updatedField;
        }

        if (field.type === FieldType.number && !isNumericXField) {
          updatedField.state = updatedField.state || {};

          const fieldCalcs: FieldCalcs = {
            lcl: null,
            ucl: null,
            mean: null,
          };

          // replace old calculations with a new set since values may have changed due to aggregations,
          // rendering cached calculations incorrect.
          updatedField.state.calcs = fieldCalcs;

          //calculate control charts
          let controlChartData = computeChartType(updatedField, options.chartType, calcContext);

          // Excluded points (chartOptions.excludedPoints) stay plotted but
          // drop out of the calculations: the limits and center line are
          // recomputed on a copy of the frame with the excluded rows removed.
          const exclusions = controlChartData
            ? resolveExclusions(frame, field.name, options, subgroupSize, xFieldName)
            : null;

          // Stages (chartOptions.stages) split the series at process-change
          // breakpoints and recompute the limits per stage; the per-stage
          // compute already skips excluded rows, so staging and exclusion
          // compose. Without stages, exclusion alone recomputes the limits on
          // the exclusion-filtered rows.
          const stageSegments = controlChartData
            ? resolveStageSegments(frame, options, subgroupSize, xFieldName)
            : null;
          if (controlChartData && stageSegments) {
            controlChartData = applyStagesToChartData(
              controlChartData,
              (segmentFrame, segmentField) =>
                computeChartType(segmentField, options.chartType, { ...calcContext, frame: segmentFrame }),
              frame,
              field,
              stageSegments,
              subgroupSize,
              exclusions
            );
          } else if (controlChartData && exclusions) {
            if (activeChartType?.excludesInCompute) {
              // The chart applies exclusion inside its own compute: recompute
              // with the omitted rows masked out of the estimate. They stay
              // plotted and keep their own per-point limit (Minitab "omit from
              // estimation"), so the limit line does not gap at them.
              controlChartData =
                computeChartType(updatedField, options.chartType, {
                  ...calcContext,
                  excludedEstimationRows: exclusions.rawRows,
                }) ?? controlChartData;
            } else {
              controlChartData = applyExclusionsToChartData(
                controlChartData,
                (filteredFrame, filteredField) =>
                  computeChartType(filteredField, options.chartType, { ...calcContext, frame: filteredFrame }),
                frame,
                field,
                exclusions
              );
            }
          }

          if (controlChartData) {
            updatedField.values = controlChartData.data;
            updatedField.state.calcs.lcl = controlChartData.lowerControlLimit;
            updatedField.state.calcs.ucl = controlChartData.upperControlLimit;
            updatedField.state.calcs.mean = controlChartData.centerLine;
            // Variable-limit charts (attribute p/np/u) also carry per-point
            // limits; cache them so control-line rendering can draw stepped
            // lines and run rules can test against the exact per-point zones.
            if (controlChartData.lowerControlLimitData) {
              updatedField.state.calcs.lclData = controlChartData.lowerControlLimitData;
            }
            if (controlChartData.upperControlLimitData) {
              updatedField.state.calcs.uclData = controlChartData.upperControlLimitData;
            }
            // Staged charts also carry a per-point center line (it jumps at
            // each stage breakpoint), rendered as a stepped Mean line.
            if (controlChartData.centerLineData) {
              updatedField.state.calcs.meanData = controlChartData.centerLineData;
            }
            // Multi-series chart types (e.g. CUSUM) relabel the primary line
            // and emit companion lines that share this field's control limits.
            if (controlChartData.primarySeriesName) {
              updatedField.config = { ...updatedField.config, displayName: controlChartData.primarySeriesName };
            }
            for (const extra of controlChartData.extraSeries ?? []) {
              companionFields.push(makeCompanionField(updatedField, extra));
            }
          } else {
            //calculate series based on aggregation type
            updatedField.values = aggregateSeries(updatedField.values, subgroupSize, aggregationType);
          }

          // Compute the range over valid numbers only so nulls (gaps) and NaN do not distort it.
          updatedField.state.range = calculateNumericRange(updatedField.values.filter(isValidNumber));

          if (shouldCalculateStandardStats) {
            // Standard stats describe the plotted values; excluded points drop
            // out here too so mean/stdDev control lines agree with the chart.
            const excludedPlotted = new Set(exclusions?.plottedIndices ?? []);
            const statsField =
              excludedPlotted.size > 0
                ? { ...updatedField, values: updatedField.values.filter((_: unknown, i: number) => !excludedPlotted.has(i)) }
                : updatedField;
            const standardStats = calculateStandardStats(statsField);

            updatedField.state.calcs = {
              ...updatedField.state.calcs,
              ...standardStats,
            };

            // The chart's center line and limits are authoritative: standard
            // stats also emit a `mean` (the arithmetic mean of the plotted
            // values), which differs from the weighted center line of
            // attribute charts (p̄, ū) and must not overwrite it.
            if (controlChartData) {
              updatedField.state.calcs.lcl = controlChartData.lowerControlLimit;
              updatedField.state.calcs.ucl = controlChartData.upperControlLimit;
              updatedField.state.calcs.mean = controlChartData.centerLine;
            }
          }

          // Let registered computed reducers derive extra calc slots from the
          // values computed above (e.g. sigma-zone lines at mean ± Nσ from
          // lcl/ucl/mean). Each reducer writes its position under its own id,
          // which processComputedControlLines then reads like any other line.
          for (const reducer of controlLineReducers) {
            if (reducer.computed && reducer.reduce) {
              updatedField.state.calcs = {
                ...updatedField.state.calcs,
                ...reducer.reduce(updatedField, subgroupSize),
              };
            }
          }
        }

        return updatedField;
    });

    return {
      ...frame,
      fields: [...mappedFields, ...companionFields],
    };
  });
}

/**
 * Build a plotted sibling field from a companion series: it inherits the
 * primary field's type/config and control-limit calcs (so the run rules test
 * it too), takes the companion's name and values, and is flagged so the
 * statistics table skips it.
 */
function makeCompanionField(primary: Field, extra: ChartExtraSeries): Field {
  return {
    ...primary,
    name: extra.name,
    values: extra.data,
    config: {
      ...primary.config,
      displayName: extra.name,
      custom: { ...primary.config?.custom, [SPC_COMPANION_SERIES]: true },
    },
    state: {
      ...primary.state,
      calcs: { ...(primary.state?.calcs ?? {}) },
      range: calculateNumericRange(extra.data.filter(isValidNumber)),
    },
  };
}
