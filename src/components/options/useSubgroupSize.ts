import React from 'react';
import { getTemplateSrv } from '@grafana/runtime';
import { VariableWithOptions } from '@grafana/data';
import { SpcChartTyp, SUBGROUP_SIZE_VARIABLE } from 'types';
import { Options } from 'panelcfg';

function getSubgroupSizeVariable(): number {
  const variables = getTemplateSrv().getVariables();
  const subgroupSizeVarOptions = variables.find((v) => v.name.toLowerCase() === SUBGROUP_SIZE_VARIABLE) as
    | VariableWithOptions
    | undefined;

  // get and parse the current value of the variable, if it exists
  return subgroupSizeVarOptions?.current?.value ? parseInt(subgroupSizeVarOptions.current.value.toString(), 10) : NaN;
}

function useSearchParamsChange() {
  const [searchParams, setSearchParams] = React.useState(new URLSearchParams(window.location.search));

  React.useEffect(() => {
    const handleSearchParamsChange = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };

    // Add listeners for both 'pushstate' and 'popstate' events
    window.addEventListener('popstate', handleSearchParamsChange);
    window.addEventListener('pushstate', handleSearchParamsChange);

    return () => {
      // Clean up event listeners
      window.removeEventListener('popstate', handleSearchParamsChange);
      window.removeEventListener('pushstate', handleSearchParamsChange);
    };
  }, []);

  return searchParams;
}

function validateSubgroupSize(subgroupSize: number, chartType: SpcChartTyp): number {
  // When chartType === none, allow any positive number for subgroupSize
  if (chartType === SpcChartTyp.none) {
    return Math.max(subgroupSize, 1); // Only ensure it's greater than 0
  }

  if (chartType === SpcChartTyp.mR_XmR || chartType === SpcChartTyp.x_XmR) {
    return 1;
  }

  return Math.min(Math.max(subgroupSize, 2), 25);
}

export function useSubgroupSizeOptions(options: Options): { options: Options; isDashboardVariable: boolean } {
  const searchParams = useSearchParamsChange().get(`var-${SUBGROUP_SIZE_VARIABLE}`);
  const subgroupSizeVar = getSubgroupSizeVariable();

  // Check if a valid dashboard variable exists, otherwise fallback to the provided options.subgroupSize
  const isDashboardVariable = !isNaN(subgroupSizeVar);
  const computedSubgroupSize = isDashboardVariable ? subgroupSizeVar : options.subgroupSize ?? 1;

  // Validate the final subgroup size based on chartType
  const validSubgroupSize = validateSubgroupSize(computedSubgroupSize, options.chartType);

  return React.useMemo(
    () => ({
      options: {
        ...options,
        subgroupSize: validSubgroupSize, // Override the subgroupSize in the options with the valid value
      },
      isDashboardVariable,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, validSubgroupSize, isDashboardVariable, searchParams]
  );
}

export function useSubgroupSize(
  subgroupSize: number,
  chartType: SpcChartTyp
): { subgroupSize: number; isDashboardVariable: boolean } {
  const searchParams = useSearchParamsChange().get(`var-${SUBGROUP_SIZE_VARIABLE}`);
  const subgroupSizeVar = getSubgroupSizeVariable();
  const isDashboardVariable = !isNaN(subgroupSizeVar);

  // If valid dashboard variable exists, use it, otherwise fallback to the passed subgroupSize
  const computedSubgroupSize = isDashboardVariable ? subgroupSizeVar : subgroupSize;

  // Validate the final subgroup size based on chartType
  const validSubgroupSize = validateSubgroupSize(computedSubgroupSize, chartType);

  return React.useMemo(
    () => ({
      subgroupSize: validSubgroupSize,
      isDashboardVariable,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [validSubgroupSize, isDashboardVariable, searchParams]
  );
}
