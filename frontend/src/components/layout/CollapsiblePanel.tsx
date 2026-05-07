/**
 * CollapsiblePanel — Side panel with resize handle and collapse toggle.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CollapsiblePanelProps {
  side: 'left' | 'right';
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  children: React.ReactNode;
}

export default function CollapsiblePanel({
  side, title, collapsed, onToggle,
  defaultWidth, minWidth = 200, maxWidth = 600,
  children,
}: CollapsiblePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = side === 'left'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [side, minWidth, maxWidth]);

  if (collapsed) {
    return (
      <div
        onClick={onToggle}
        style={{
          width: 28,
          background: 'var(--bg-surface-1)',
          borderLeft: side === 'right' ? '1px solid var(--border)' : undefined,
          borderRight: side === 'left' ? '1px solid var(--border)' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          writingMode: 'vertical-lr',
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          flexShrink: 0,
          transition: 'background var(--transition-fast)',
        }}
      >
        {title}
      </div>
    );
  }

  return (
    <div style={{
      width,
      background: 'var(--bg-surface-1)',
      borderLeft: side === 'right' ? '1px solid var(--border)' : undefined,
      borderRight: side === 'left' ? '1px solid var(--border)' : undefined,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 28,
        background: 'var(--bg-surface-1)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          flex: 1,
        }}>
          {title}
        </span>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--radius-sm)',
            transition: 'color var(--transition-fast)',
          }}
          title={`Colapsar ${title}`}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {side === 'left' ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {children}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className="resize-handle"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
          ...(side === 'left' ? { right: -2 } : { left: -2 }),
        }}
      />
    </div>
  );
}
