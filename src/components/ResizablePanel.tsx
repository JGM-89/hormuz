import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';

interface ResizablePanelProps {
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  storageKey: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export default function ResizablePanel({
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  storageKey,
  title,
  icon,
  children,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(`panel-${storageKey}-width`);
    return stored ? Math.min(Math.max(parseInt(stored), minWidth), maxWidth) : defaultWidth;
  });
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(`panel-${storageKey}-collapsed`) === 'true';
  });
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(`panel-${storageKey}-width`, String(width));
  }, [width, storageKey]);

  useEffect(() => {
    localStorage.setItem(`panel-${storageKey}-collapsed`, String(collapsed));
  }, [collapsed, storageKey]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (e: MouseEvent) => {
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width, side, minWidth, maxWidth]);

  if (collapsed) {
    return (
      <div
        className="flex flex-col items-center bg-surface-0 border-border py-3 gap-3"
        style={{
          width: 40,
          [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          className="text-text-dim hover:text-accent transition-colors p-1.5 rounded-sm hover:bg-surface-2"
          aria-label={`Expand ${title} panel`}
          title={`Expand ${title}`}
        >
          {icon}
        </button>
        <div
          className="label-caps writing-mode-vertical"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {title}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="relative flex flex-col bg-surface-0 overflow-hidden"
      style={{
        width,
        [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid var(--color-border)',
      }}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-accent">{icon}</span>
          <span className="label-caps">{title}</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="text-text-dim hover:text-text-primary transition-colors p-1 rounded-sm hover:bg-surface-2"
          aria-label={`Collapse ${title} panel`}
          title="Collapse"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            {side === 'left' ? (
              <path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* Resize handle */}
      <div
        className={`absolute top-0 ${side === 'left' ? 'right-0' : 'left-0'} w-1 h-full cursor-col-resize hover:bg-accent/30 transition-colors ${dragging ? 'bg-accent/50' : ''}`}
        onMouseDown={onMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title} panel`}
      />
    </div>
  );
}
