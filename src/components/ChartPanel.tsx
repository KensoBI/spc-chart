import React from 'react';
import { ChartPanelProps } from 'types';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { parseData } from 'data/parseData';
import { PanelPropsProvider } from './PanelPropsProvider';
import { TimeSeriesComponent } from './SpcChart/TimeSeriesComponent';
import { TimeseriesSettings, defaultTimeseriesSettings } from './SpcChart/types';

export function ChartPanel(props: ChartPanelProps) {
  const { data, width, height } = props;
  const styles = useStyles2(getStyles);

  const { features } = React.useMemo(() => parseData(data.series), [data.series]);

  const [selectedFeature, selectedCharacteristic] = React.useMemo(() => {
    if (features.length === 0) {
      return [null, null];
    }
    const selectedFeature = features[0];
    const keys = Object.keys(selectedFeature.characteristics);
    if (keys.length === 0) {
      return [null, null];
    }
    const selectedCharacteristic = selectedFeature.characteristics[keys[0]];
    return [selectedFeature, selectedCharacteristic];
  }, [features]);

  const settings: TimeseriesSettings = React.useMemo(() => {
    const settings = { ...defaultTimeseriesSettings };
    settings.limitConfig = {
      up: {
        name: 'usl',
        color: 'red',
      },
      down: {
        name: 'lsl',
        color: 'red',
      },
    };
    settings.constantsConfig = [
      {
        name: 'usl',
        title: 'USL',
        color: 'red',
      },
      {
        name: 'lsl',
        title: 'LSL',
        color: 'red',
      },
    ];
    return settings;
  }, []);

  return (
    <PanelPropsProvider panelProps={props}>
      <div
        className={cx(
          styles.wrapper,
          css`
            width: ${width}px;
            height: ${height}px;
          `
        )}
      >
        {selectedFeature && selectedCharacteristic && (
          <TimeSeriesComponent feature={selectedFeature} characteristic={selectedCharacteristic} settings={settings} />
        )}
      </div>
    </PanelPropsProvider>
  );
}

const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
  };
};
