import React, { useState } from 'react';
import { css } from '@emotion/css';
import {
  DataFrame,
  GrafanaTheme2,
  SelectableValue,
  StandardEditorProps,
  getFieldDisplayName,
  getFrameDisplayName,
} from '@grafana/data';
import {
  Button,
  ColorPicker,
  Field,
  Icon,
  IconButton,
  Input,
  RadioButtonGroup,
  Select,
  Slider,
  Stack,
  ValuePicker,
  useStyles2,
} from '@grafana/ui';

import { PositionInput, SpcChartTyp } from 'types';
import { ControlLineReducer, ControlLineReducerId, controlLineReducers } from 'data/spcReducers';
import { ControlLine, Options } from 'panelcfg';

const defaultConstantColor = '#37872d';

export const ControlLineEditor = ({ item, value, onChange, context }: StandardEditorProps<ControlLine[], Options>) => {
  const styles = useStyles2(getStyles);
  const chartType = context.options.chartType ? context.options.chartType : SpcChartTyp.none;
  const [expandedHandles, setExpandedHandles] = useState<number[]>([]);
  const [selectedChartType, setSelectedChartType] = useState<SpcChartTyp>(chartType);

  if (chartType !== selectedChartType) {
    //selected chart type option was changed
    setSelectedChartType(chartType);

    if (chartType === SpcChartTyp.none) {
      // remove lcl, ucl if they exist
      const spcControlIds = [ControlLineReducerId.lcl, ControlLineReducerId.ucl];
      const newControlLines = value.filter((cl) => !spcControlIds.includes(cl.reducerId));

      onChange(newControlLines);
    } else {
      // add lcl, ucl, and mean for control charts
      const spcControls = controlLineReducers.filter(
        (c) =>
          c.id === ControlLineReducerId.lcl || c.id === ControlLineReducerId.ucl || c.id === ControlLineReducerId.mean
      );

      const newControlLines = spcControls.filter((r) => !value.some((cl) => r.id === cl.reducerId));
      if (newControlLines.length > 0) {
        addControlLines(newControlLines);
      }
    }
  }

  const addExpandedHandle = (handle: number) => {
    setExpandedHandles([...expandedHandles, handle]);
  };

  const removeExpandedHandles = (handle: number) => {
    setExpandedHandles(expandedHandles.filter((h) => h !== handle));
  };
  const toggleHandle = (handle: number) => {
    if (expandedHandles.includes(handle)) {
      removeExpandedHandles(handle);
    } else {
      addExpandedHandle(handle);
    }
  };

  const handleControlLineChange = (index: number, field: keyof ControlLine, fieldValue: any) => {
    const newControlLines = [...value];
    newControlLines[index] = { ...newControlLines[index], [field]: fieldValue };
    onChange(newControlLines);
  };

  const onControlLineChange = (selectedControl: SelectableValue<ControlLineReducer>) => {
    if (!selectedControl.value) {
      throw new Error('Selected SPC control is not valid.');
    }
    addControlLine(selectedControl.value);
  };

  const onRemoveControlLineByNameClick = (controlIndexToRemove: number) => {
    const newControlLines = value.filter((_, i) => i !== controlIndexToRemove);
    onChange(newControlLines);

    //remove handle and lower indexes on all expanded upper handles
    const newIndexes = expandedHandles
      .filter((h) => h !== controlIndexToRemove)
      .map((handleIndex) => (handleIndex > controlIndexToRemove ? handleIndex - 1 : handleIndex));
    setExpandedHandles(newIndexes);
  };

  const reducersOptions = controlLineReducers
    .filter((reducer) => canAddReducer(reducer))
    .map<SelectableValue<ControlLineReducer>>((i) => ({
      label: i.name,
      value: i,
      description: i.description,
    }));

  function createControlLine(reducer: ControlLineReducer, seriesIndex: number): ControlLine {
    return {
      reducerId: reducer.id,
      name: reducer.name,
      field: '',
      positionInput: PositionInput.static,
      seriesIndex: seriesIndex,
      lineWidth: 4,
      lineColor: reducer.color,
      fillDirection: 0,
      fillOpacity: 10,
      position: 0,
    };
  }

  function addControlLine(reducer: ControlLineReducer) {
    let availableIndex = getAvailableSeriesIndexForReducer(reducer.id);

    if ((!reducer.computed && !reducer.isStandard) || reducer.isStandard) {
      if (availableIndex === -1) {
        availableIndex = 0;
      }
    } else if (availableIndex === -1) {
      return;
    }

    const newControlLine = createControlLine(reducer, availableIndex);
    if (!canAddReducer(reducer, availableIndex)) {
      return;
    }

    const newControlLines = [...value, newControlLine];
    onChange(newControlLines);

    setExpandedHandles([newControlLines.length - 1]);
  }

  function addControlLines(reducers: ControlLineReducer[]) {
    const controlLines: ControlLine[] = reducers
      .map((reducer) => {
        const availableIndex = getAvailableSeriesIndexForReducer(reducer.id);

        if (canAddReducer(reducer, availableIndex)) {
          return createControlLine(reducer, availableIndex);
        }
        return null;
      })
      .filter((cl): cl is ControlLine => cl !== null && cl !== undefined);

    if (controlLines.length > 0) {
      const newControlLines = [...value, ...controlLines];
      onChange(newControlLines);
      setExpandedHandles([newControlLines.length - 1]);
    }
  }

  function getFilteredDataFramesForReducer(reducer: ControlLineReducerId): DataFrame[] {
    if (!isComputed(reducer)) {
      return context.data;
    }

    // Filter feature dataframes if reducer is computed
    const { featureQueryRefIds } = context.options;

    return context.data.filter((frame) => !featureQueryRefIds || !featureQueryRefIds.includes(frame.refId!));
  }

  function getFilteredDataFrames(): DataFrame[] {
    const { featureQueryRefIds } = context.options;
    return context.data.filter((frame) => !featureQueryRefIds || !featureQueryRefIds.includes(frame.refId!));
  }

  function getAvailableSeriesIndexForReducer(reducer: ControlLineReducerId): number {
    const usedIndex = value.filter((existingCl) => existingCl.reducerId === reducer).map((i) => i.seriesIndex);
    const allIndexes = getFilteredDataFramesForReducer(reducer).map((_, index) => index);
    const availableIndex = allIndexes.filter((i) => !usedIndex.includes(i));

    if (availableIndex.length === 0) {
      return -1;
    }
    return availableIndex[0];
  }

  function canAddReducer(reducer: ControlLineReducer, seriesIndex?: number): boolean {
    if ((!reducer.computed && !reducer.isStandard) || reducer.isStandard) {
      //standard and constant control lines are always allowed
      return true;
    }

    if (reducer.computed && chartType === SpcChartTyp.none) {
      return false;
    }

    const series = seriesIndex ?? getAvailableSeriesIndexForReducer(reducer.id);

    if (series === -1) {
      return false;
    }

    const existingClr = value.filter((cl) => cl.reducerId === reducer.id);

    if (existingClr.length >= getFilteredDataFrames().length) {
      return false;
    }

    return true;
  }

  function getControlLineDisplayName(controlLine: ControlLine): React.JSX.Element {
    const seriesData = getFilteredDataFrames();

    if (seriesData && seriesData.length > 1 && seriesData[controlLine.seriesIndex]) {
      return (
        <span>
          {controlLine.name}
          <Icon name="angle-right" className={styles.chevron} />
          {seriesData[controlLine.seriesIndex].refId}
          <Icon name="angle-right" className={styles.chevron} />
          {getFrameDisplayName(seriesData[controlLine.seriesIndex], controlLine.seriesIndex)}
        </span>
      );
    }

    if (seriesData && seriesData.length <= controlLine.seriesIndex) {
      return (
        <span>
          {controlLine.name} <Icon name="angle-right" className={styles.chevron} />
          (stale series)
        </span>
      );
    }

    return <span>{controlLine.name}</span>;
  }

  function isComputed(reducerId: ControlLineReducerId): boolean {
    const reducer = controlLineReducers.find((r) => r.id === reducerId);

    if (reducer) {
      return reducer.computed;
    }
    return false;
  }

  return (
    <>
      <div className={styles.addControlwrapper}>
        <ValuePicker
          icon="plus"
          label="Add control line"
          variant="secondary"
          menuPlacement="auto"
          isFullWidth={true}
          size="md"
          options={reducersOptions}
          onChange={(selectedControl) => onControlLineChange(selectedControl)}
        />
      </div>

      {value.map((controlLine, index) => (
        <div className={styles.controlItemWrapper} key={index}>
          <div className={styles.controlHeaderWrapper}>
            <Stack direction="column" gap={1}>
              <Stack direction="row" alignItems="center" gap={1}>
                <span></span>
                <IconButton
                  name={expandedHandles.includes(index) ? 'angle-down' : 'angle-right'}
                  onClick={() => toggleHandle(index)}
                  aria-label="Collapse"
                />{' '}
                <span className={styles.controlHeaderTitle}>{getControlLineDisplayName(controlLine)}</span>
                <span className={css({ flex: 1 })} />
                <Stack direction="row" gap={0.5}>
                  <Button
                    variant="secondary"
                    icon="trash-alt"
                    size="sm"
                    type="button"
                    onClick={() => onRemoveControlLineByNameClick(index)}
                  >
                    Remove
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </div>
          {expandedHandles.includes(index) && (
            <Stack direction="row" alignItems="center" gap={1}>
              <div className={styles.fieldContainer}>
                <Field label="Name">
                  <Input
                    placeholder={'Name'}
                    value={controlLine.name}
                    onChange={(e) => handleControlLineChange(index, 'name', e.currentTarget.value)}
                  />
                </Field>
                <Field label="Series" description="Select the series for which to calculate this control.">
                  <Select
                    placeholder="Select series"
                    isClearable={true}
                    value={controlLine.seriesIndex}
                    options={getFilteredDataFramesForReducer(controlLine.reducerId).map((frame, index) => ({
                      value: index,
                      label: `${frame.refId} > ${getFrameDisplayName(frame, index)}`,
                    }))}
                    formatOptionLabel={(option) => {
                      const label = option.label || '';
                      const parts = label.split(' > ');

                      return (
                        <div>
                          {parts[0]} {/* frame.refId */}
                          <Icon name="angle-right" className={styles.chevron} />
                          {parts[1] || ''} {/* getFrameDisplayName */}
                        </div>
                      );
                    }}
                    onChange={(value) => {
                      if (!value) {
                        return;
                      }

                      handleControlLineChange(index, 'seriesIndex', value.value);
                    }}
                  />
                </Field>
                {!isComputed(controlLine.reducerId) && (
                  <>
                    <Field label="Position input">
                      <RadioButtonGroup
                        value={controlLine.positionInput}
                        options={[
                          { label: 'Static', description: 'Manual entry', value: PositionInput.static },
                          { label: 'Series', description: 'Field from series', value: PositionInput.series },
                        ]}
                        onChange={(value) => {
                          handleControlLineChange(index, 'positionInput', value);
                        }}
                      ></RadioButtonGroup>
                    </Field>
                    {controlLine.positionInput === PositionInput.static && (
                      <Field label="Position" description="Numeric position at which the control line is drawn. ">
                        <Input
                          placeholder={'Value'}
                          type="number"
                          step="0.01"
                          value={controlLine.position}
                          onChange={(e) =>
                            handleControlLineChange(index, 'position', parseFloat(e.currentTarget.value))
                          }
                        />
                      </Field>
                    )}
                    {controlLine.positionInput === PositionInput.series && (
                      <Field label="Field" description="Select field for control line position.">
                        <Select
                          placeholder="Field"
                          isClearable={true}
                          value={controlLine.field}
                          options={getFilteredDataFramesForReducer(controlLine.reducerId)
                            .find((_f, i) => i === controlLine.seriesIndex)
                            ?.fields.map((field, index) => ({
                              value: field.name,
                              label: field.display?.name ?? `${getFieldDisplayName(field)}`,
                            }))}
                          onChange={(value) => {
                            if (!value) {
                              return;
                            }

                            handleControlLineChange(index, 'field', value.value);
                          }}
                        />
                      </Field>
                    )}
                  </>
                )}
                <Field label="Line width">
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={controlLine.lineWidth}
                    onChange={(value) => handleControlLineChange(index, 'lineWidth', value)}
                  />
                </Field>
                <Field label="Line color">
                  <div style={{ width: '18px' }}>
                    <ColorPicker
                      color={controlLine.lineColor ?? defaultConstantColor}
                      onChange={(color) => {
                        {
                          handleControlLineChange(index, 'lineColor', color);
                        }
                      }}
                    ></ColorPicker>
                  </div>
                </Field>
                <Field label="Fill">
                  <RadioButtonGroup
                    value={controlLine.fillDirection}
                    options={[
                      { description: 'Left fill', value: -1, icon: 'arrow-to-right' },
                      { description: 'No fill', value: 0, icon: 'eye-slash' },
                      { description: 'Right fill', value: 1, icon: 'arrow-from-right' },
                    ]}
                    onChange={(value) => {
                      handleControlLineChange(index, 'fillDirection', value);
                    }}
                  ></RadioButtonGroup>
                </Field>
                <Field label="Fill opacity">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={controlLine.fillOpacity}
                    onChange={(value) => handleControlLineChange(index, 'fillOpacity', value)}
                  />
                </Field>
              </div>
            </Stack>
          )}
        </div>
      ))}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    addControlwrapper: css`
      display: flex;
      flex-direction: column;
      padding-bottom: 8px;
    `,
    controlItemWrapper: css({
      flex: 1,
      position: 'relative',
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      borderColor: theme.colors.secondary.borderTransparent,
    }),
    controlHeaderWrapper: css({
      padding: theme.spacing(0.5),
      flex: 1,
      position: 'relative',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      borderColor: theme.colors.secondary.borderTransparent,
    }),
    fieldContainer: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      padding: theme.spacing(1),
    }),
    controlHeaderTitle: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.bodySmall.fontWeight,
    }),
    chevron: css({
      margin: theme.spacing(0, 0.25),
    }),
  };
};
