/**
 * CollapsiblePanel — Side panel with resize handle and collapse toggle.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

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
          background: '#3c3c3c',
          borderLeft: side === 'right' ? '1px solid #505050' : undefined,
          borderRight: side === 'left' ? '1px solid #505050' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          writingMode: 'vertical-lr',
          fontSize: 10,
          color: '#999',
          letterSpacing: 1,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {title}
      </div>
    );
  }

  return (
    <div style={{
      width,
      background: '#3c3c3c',
      borderLeft: side === 'right' ? '1px solid #505050' : undefined,
      borderRight: side === 'left' ? '1px solid #505050' : undefined,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 26,
        background: '#2a2a2a',
        borderBottom: '1px solid #505050',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          flex: 1,
        }}>
          {title}
        </span>
        <button
          onClick={onToggle}
          style={{
            background: 'none',
            border: 'none',
            color: '#777',
            cursor: 'pointer',
            fontSize: 14,
            padding: '0 2px',
            lineHeight: 1,
          }}
          title={`Colapsar ${title}`}
        >
          {side === 'left' ? '◁' : '▷'}
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
