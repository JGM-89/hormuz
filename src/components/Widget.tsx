import type { ReactNode, HTMLAttributes } from 'react';

/**
 * Shared wrapper for every panel/card in the command centre.
 * Provides consistent opaque navy chrome with colored top border.
 *
 * Variants:
 *  - "card" (default): rectangular panel with top accent border
 *  - "pill": compact inline element (for stats bar, logo)
 *
 * Severity controls the top border color:
 *  - "info" (default): cyan accent
 *  - "warn": amber
 *  - "crit": red
 *  - "nominal": green
 *  - "none": no top border
 */

interface WidgetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'card' | 'pill';
  severity?: 'info' | 'warn' | 'crit' | 'nominal' | 'none';
}

const SEVERITY_BORDER: Record<string, string> = {
  info: 'border-t-2 border-t-accent',
  warn: 'border-t-2 border-t-status-warn',
  crit: 'border-t-2 border-t-status-crit',
  nominal: 'border-t-2 border-t-status-nominal',
  none: '',
};

export default function Widget({
  children,
  variant = 'card',
  severity = 'info',
  className = '',
  ...rest
}: WidgetProps) {
  const base = 'bg-surface-0 border border-border';
  const shape = variant === 'pill' ? 'rounded-sm px-3 py-1.5' : 'rounded-sm p-2';
  const topBorder = SEVERITY_BORDER[severity] ?? SEVERITY_BORDER.info;

  return (
    <div className={`${base} ${shape} ${topBorder} ${className}`} {...rest}>
      {children}
    </div>
  );
}
