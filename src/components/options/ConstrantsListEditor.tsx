import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { PopoverContainer } from 'components/popover/PopoverContainer';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { Popover, usePopoverTrigger } from 'components/popover/Popover';
import { CloseButton } from 'components/popover/CloseButton';
import { MenuItem } from 'components/popover/MenuItem';
import { ConstantConfigItem, PanelOptions } from 'types';
import { Characteristic } from 'data/types';
import { InlineColorField } from 'components/InlineColorField';

const defaultColor = 'rgb(196, 22, 42)';

type Props = StandardEditorProps<ConstantConfigItem, any, PanelOptions>;

export function ConstantsListEditor({ value, onChange, context }: Props) {
  const styles = useStyles2(getStyles);
  const selectedCharacteristic = context.instanceState?.selectedCharacteristic as Characteristic | null | undefined;
  const [selectedField, setSelectedField] = React.useState<ConstantConfigItem[]>([]);

  const options = React.useMemo(() => {
    if (selectedCharacteristic == null) {
      return [];
    }
    return Object.keys(selectedCharacteristic.table).map((fieldName) => ({
      value: fieldName,
      label: fieldName,
    }));
  }, [selectedCharacteristic]);

  const setConstantConfig = (item: ConstantConfigItem | undefined) => {
    onChange({
      ...(value ?? {}),
      color: value.color,
      title: value.title,
      name: value.name,
    });
  };

  const setName = (name: string | undefined) => {
    const item: ConstantConfigItem | undefined | any =
      name != null
        ? {
            color: value?.color ?? defaultColor,
            name,
          }
        : undefined;

    setConstantConfig(item);
  };

  const setColor = (color: string) => {
    const name = value?.name;
    if (name != null) {
      value.color = color;
      setConstantConfig(value);
    }
  };

  const { popoverProps, triggerClick } = usePopoverTrigger();

  const menu = React.useMemo(() => {
    return (
      <PopoverContainer>
        {options?.map((fieldName) => (
          <MenuItem
            key={fieldName.value}
            onClick={() => {
              setSelectedField([
                ...selectedField,
                {
                  name: fieldName.label,
                  color: defaultColor,
                  title: fieldName.label,
                },
              ]);
              popoverProps.onClose();
            }}
          >
            {fieldName.value}
          </MenuItem>
        ))}
      </PopoverContainer>
    );
  }, [options, popoverProps, setSelectedField, selectedField]); // [notSelectedFields, popoverProps, setSettings, settings]);

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h5>{!options?.length ? <i>Empty</i> : <></>}</h5>
          </div>

          <Button
            //disabled={notSelectedFields.length === 0}
            onClick={triggerClick}
            icon="plus-circle"
            variant="success"
            fill="text"
            size="sm"
          >
            Add
          </Button>
        </div>

        {selectedField?.map((el, index) => (
          <div key={el.title} className={styles.row}>
            <div className={styles.fieldName}>{el.title}</div>
            <div>
              <input
                className={styles.titleInput}
                type="text"
                value={value?.title}
                onChange={() => {
                  setName(value.title);
                  //(e) => {
                  //if (settings.constantsConfig) {
                  //  settings.constantsConfig[index].title = e.target.value;
                  //}
                  //setSettings({ ...settings });
                }}
              />
            </div>
            <div className={styles.rightColumn}>
              <InlineColorField
                color={value?.color ?? defaultColor}
                onChange={(color) => {
                  setColor(color);
                  //(newColor: any) => {
                  //if (settings.constantsConfig) {
                  //  settings.constantsConfig[index].color = newColor;
                  //}
                  //setSettings({ ...settings });
                }}
              />
              <Button
                onClick={() => {
                  setSelectedField((selectedField ?? []).filter((conf) => conf.name !== el.name));
                  //setSettings({
                  //  ...settings,
                  //  constantsConfig: (settings?.constantsConfig ?? []).filter((conf) => conf.name !== el.name),
                  //});
                }}
                icon="trash-alt"
                variant="destructive"
                fill="text"
              />
            </div>
          </div>
        ))}
        <div className={styles.addButtonContainer}></div>
      </div>
      <Popover {...popoverProps}>
        <CloseButton onClick={() => popoverProps.onClose()} style={{ background: 'black', color: 'white' }} />
        {menu}
      </Popover>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      background-color: ${theme.colors.background.canvas};
      padding: ${theme.spacing(1)};
      border-radius: ${theme.shape.borderRadius(2)};
    `,
    header: css`
      display: flex;
    `,
    headerTitle: css`
      flex-grow: 1;
    `,
    titleInput: css`
      background: #0000;
      border-radius: 3px;
      box-shadow: none;
      font-weight: 600;
      padding: 0px 8px;
      resize: none;
      outline: none;
      display: block;
      -webkit-appearance: none;
      height: 100%;

      &:focus {
        background-color: ${theme.colors.background.canvas};
        box-shadow: inset 0 0 0 2px ${theme.colors.primary.border};
      }
    `,
    row: css`
      display: flex;
      gap: ${theme.spacing(0.5)};
      margin-top: ${theme.spacing(0.5)};

      & > div {
        flex: 1;
      }
    `,
    fieldName: css`
      margin-top: auto;
      margin-bottom: auto;
    `,
    rightColumn: css`
      display: flex;
      gap: ${theme.spacing(2)};
    `,
    addButtonContainer: css`
      display: flex;
      justify-content: center;
    `,
  };
};
