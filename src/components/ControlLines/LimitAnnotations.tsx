import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import uPlot from 'uplot';
import { colorManipulator } from '@grafana/data';
import { UPlotConfigBuilder } from '@grafana/ui';

const DEFAULT_TIMESERIES_FLAG_COLOR = '#03839e';

export type AnnotationBase = {
  title?: string;
  color?: string;
  lineWidth?: number;
};

export type Flag = AnnotationBase & {
  type: 'flag';
  time: number;
};

export type Region = AnnotationBase & {
  type: 'region';
  timeStart?: number;
  timeEnd?: number;
  fillOpacity: number;
};

export interface LimitAnnotationConfig {
  limits: LimitAnnotation[];
}
export type LimitAnnotation = Flag | Region;

export type AnnotationsPluginProps = {
  config: UPlotConfigBuilder;
  annotations: LimitAnnotation[];
};

export function isLimitAnnotation(value: any): value is LimitAnnotation {
  return (value?.type === 'flag' && typeof value?.time === 'number') || value?.type === 'region';
}

export function isLimitAnnotationArray(value: any): value is LimitAnnotation[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const en of value) {
    if (!isLimitAnnotation(en)) {
      return false;
    }
  }
  return true;
}

export const LimitAnnotations: React.FC<AnnotationsPluginProps> = ({ annotations, config }) => {
  const [plot, setPlot] = useState<uPlot>();
  const annotationsRef = useRef<LimitAnnotation[]>();
  const bboxRef = useRef<DOMRect>();

  useEffect(() => {
    annotationsRef.current = annotations.sort((a, b) => typeToValue(b.type) - typeToValue(a.type));
  }, [annotations]);

  useLayoutEffect(() => {
    config.addHook('init', (u) => {
      setPlot(u);
    });

    config.addHook('syncRect', (u, rect) => {
      bboxRef.current = rect;
    });

    config.addHook('draw', (u) => {
      if (!annotationsRef.current) {
        return;
      }

      const ctx = u.ctx;
      if (!ctx) {
        return;
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
      ctx.clip();

      for (let i = 0; i < annotationsRef.current.length; i++) {
        const entity = annotationsRef.current[i];
        const lineColor = entity.color ?? DEFAULT_TIMESERIES_FLAG_COLOR;

        if (entity.type === 'region') {
          const yKey = config.scales[1].props.scaleKey;
          renderRect(ctx, u, yKey, entity.timeStart, entity.timeEnd, lineColor, entity.fillOpacity);
        }
      }
      ctx.restore();
    });

    return;
  }, [config, plot]);

  return null;
};

const renderRect = (
  ctx: CanvasRenderingContext2D,
  u: uPlot,
  yScaleKey: string,
  valStart: number | undefined,
  valEnd: number | undefined,
  color: string,
  opacity: number
) => {
  const y0 = valStart != null ? u.valToPos(valStart, yScaleKey, true) : u.bbox.top + u.bbox.height;
  const y1 = valEnd != null ? u.valToPos(valEnd, yScaleKey, true) : u.bbox.top;
  const fillOpacity = opacity / 100;
  ctx.beginPath();
  ctx.fillStyle = colorManipulator.alpha(color, fillOpacity);
  ctx.rect(u.bbox.left, y0, u.bbox.width, y1 - y0);
  ctx.fill();
  ctx.closePath();
};

const typeToValue = (type: LimitAnnotation['type']) => {
  switch (type) {
    case 'flag':
      return 2;
    case 'region':
      return 1;
    default:
      return 0;
  }
};
