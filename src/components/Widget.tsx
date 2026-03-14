import type { ReactNode, HTMLAttributes } from 'react';

/**
 * Shared wrapper for every floating card on the map overlay.
 * Provides consistent glassmorphism chrome (background, blur, border, shadow, padding).
 *
 * Variants:
 *  - "card" (default): rounded-lg rectangle
 *  - "pill": rounded-full pill shape (for logo, stats bar)
 *
 * All layout decisions (positioning, spacing between widgets) are handled by
 * the parent zone containers in App.tsx — Widget only controls its own chrome.
 */

interface WidgetProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'card' | 'pill';
}

export default function Widget({ children, variant = 'card', className = '', ...rest }: WidgetProps) {
  const base = 'bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-xl';
  const shape = variant === 'pill' ? 'rounded-full px-5 py-2.5' : 'rounded-lg p-3';

  return (
    <div className={`${base} ${shape} ${className}`} {...rest}>
      {children}
    </div>
  );
}
