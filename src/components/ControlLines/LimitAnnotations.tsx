import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import uPlot from 'uplot';
import { colorManipulator } from '@grafana/data';
import { UPlotConfigBuilder, useTheme2 } from '@grafana/ui';

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
  /**
   * Per-point boundaries of a variable (stepped) limit, one value per plotted point. When set they
   * replace the corresponding scalar, so the shaded region follows the limit instead of staying
   * flat at its first value. A null entry breaks the region at that point.
   */
  valuesStart?: Array<number | null>;
  valuesEnd?: Array<number | null>;
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
  const theme = useTheme2();
  const fallbackColorRef = useRef(theme.colors.primary.main);
  const [plot, setPlot] = useState<uPlot>();
  const annotationsRef = useRef<LimitAnnotation[]>();
  const shouldRenderRef = useRef<boolean>(false);
  const bboxRef = useRef<DOMRect>();
  const hooksInitialized = useRef(false);

  useEffect(() => {
    fallbackColorRef.current = theme.colors.primary.main;
  }, [theme]);

  useEffect(() => {
    annotationsRef.current = annotations.sort((a, b) => typeToValue(b.type) - typeToValue(a.type));
  }, [annotations]);

  useLayoutEffect(() => {
    shouldRenderRef.current = annotations && annotations.length > 0;

    if (!hooksInitialized.current && shouldRenderRef.current) {
      config.addHook('init', (u) => {
        setPlot(u);
      });

      config.addHook('syncRect', (u, rect) => {
        bboxRef.current = rect;
      });

      config.addHook('draw', drawAnnotations);

      hooksInitialized.current = true;
    } else if (shouldRenderRef.current) {
      config.addHook('draw', drawAnnotations);
    }

    return () => {
      shouldRenderRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, plot]);

  const drawAnnotations = (u: uPlot) => {
    if (!annotationsRef.current || !shouldRenderRef.current) {
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
      const lineColor = entity.color ?? fallbackColorRef.current;

      if (entity.type === 'region') {
        const yKey = config.scales[1].props.scaleKey;
        const xKey = config.scales[0]?.props.scaleKey ?? 'x';
        renderRegion(ctx, u, xKey, yKey, entity, lineColor);
      }
    }
    ctx.restore();
  };

  return null;
};

/**
 * A region is bounded below by `timeStart`/`valuesStart` and above by `timeEnd`/`valuesEnd`; an
 * absent boundary runs to the edge of the plot. Constant boundaries fill as one rectangle, while a
 * variable (stepped) limit fills as a polygon that follows the limit point by point.
 */
const renderRegion = (
  ctx: CanvasRenderingContext2D,
  u: uPlot,
  xScaleKey: string,
  yScaleKey: string,
  region: Region,
  color: string
) => {
  const stepped = region.valuesStart ?? region.valuesEnd;
  const xValues = u.data?.[0] as ArrayLike<number> | undefined;

  // Per-point boundaries are indexed by plotted point, so they only mean anything while they line
  // up with the plotted x values. Anything else falls back to the flat region.
  if (stepped && xValues && xValues.length === stepped.length && xValues.length > 0) {
    renderSteppedRect(ctx, u, xScaleKey, yScaleKey, region, xValues, color);
    return;
  }

  renderRect(ctx, u, yScaleKey, region.timeStart, region.timeEnd, color, region.fillOpacity);
};

const renderSteppedRect = (
  ctx: CanvasRenderingContext2D,
  u: uPlot,
  xScaleKey: string,
  yScaleKey: string,
  region: Region,
  xValues: ArrayLike<number>,
  color: string
) => {
  const count = xValues.length;
  const left = u.bbox.left;
  const right = u.bbox.left + u.bbox.width;
  const bottom = u.bbox.top + u.bbox.height;
  const top = u.bbox.top;

  // The region spans the full plot width, stepping at each plotted point: segment i runs from
  // point i to point i+1, matching the step-after interpolation the limit line is drawn with.
  const edge = (i: number) => (i <= 0 ? left : i >= count ? right : u.valToPos(xValues[i], xScaleKey, true));

  const boundary = (
    values: Array<number | null> | undefined,
    scalar: number | undefined,
    i: number,
    edgePx: number
  ) => {
    if (values) {
      const value = values[i];
      return value == null ? null : u.valToPos(value, yScaleKey, true);
    }
    return scalar != null ? u.valToPos(scalar, yScaleKey, true) : edgePx;
  };

  const lowerAt = (i: number) => boundary(region.valuesStart, region.timeStart, i, bottom);
  const upperAt = (i: number) => boundary(region.valuesEnd, region.timeEnd, i, top);

  ctx.beginPath();
  ctx.fillStyle = colorManipulator.alpha(color, region.fillOpacity / 100);

  // Points where either boundary is missing break the region, so fill each unbroken run separately.
  let runStart: number | null = null;
  for (let i = 0; i <= count; i++) {
    const defined = i < count && lowerAt(i) != null && upperAt(i) != null;

    if (defined) {
      runStart ??= i;
      continue;
    }

    if (runStart != null) {
      appendRunPath(ctx, runStart, i - 1, edge, (j) => lowerAt(j)!, (j) => upperAt(j)!);
      runStart = null;
    }
  }

  ctx.fill();
  ctx.closePath();
};

/** Trace one unbroken run as a closed polygon: out along the lower boundary, back along the upper. */
const appendRunPath = (
  ctx: CanvasRenderingContext2D,
  from: number,
  to: number,
  edge: (i: number) => number,
  lowerAt: (i: number) => number,
  upperAt: (i: number) => number
) => {
  ctx.moveTo(edge(from), lowerAt(from));
  for (let i = from; i <= to; i++) {
    ctx.lineTo(edge(i), lowerAt(i));
    ctx.lineTo(edge(i + 1), lowerAt(i));
  }
  for (let i = to; i >= from; i--) {
    ctx.lineTo(edge(i + 1), upperAt(i));
    ctx.lineTo(edge(i), upperAt(i));
  }
  ctx.closePath();
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
