import React, { HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

interface ProBadgeProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
}

/**
 * Small "PRO" pill matching the look of Grafana's own upsell badges. Built
 * entirely from public theme tokens (the brand gradient, pill radius, contrast
 * text) exposed by the Apache-licensed @grafana/data and @grafana/ui packages —
 * it does not copy any Grafana application source.
 */
export function ProBadge({ text = 'PRO', className, ...htmlProps }: ProBadgeProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.badge, className)} {...htmlProps}>
      <Icon name="rocket" size="sm"  />
      {text}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  badge: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.gradients.brandHorizontal,
    color: theme.colors.primary.contrastText,
    fontWeight: theme.typography.fontWeightMedium,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),
});
