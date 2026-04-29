/**
 * Viewer2D — Technical section cut view (Revit-style).
 * Shows:
 * - Strata layers as colored bands with hatch patterns
 * - Foundation (solid gray)
 * - Water table (blue dashed line)
 * - Dimension lines and level annotations
 * - Property table for each stratum
 * - Click to select (synced with store)
 * - Pan & zoom with mouse
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { useFoundationStore } from '../../store/foundationStore';
import { useViewerSettings } from '../../store/viewerSettingsStore';

export default function Viewer2D() {
  const strata = useFoundationStore((s) => s.strata);
  const foundation = useFoundationStore((s) => s.foundation);
  const conditions = useFoundationStore((s) => s.conditions);
  const selectedIds = useFoundationStore((s) => s.selectedIds);
  const toggleSelection = useFoundationStore((s) => s.toggleSelection);
  const clearSelection = useFoundationStore((s) => s.clearSelection);
  const strataColors = useViewerSettings((s) => s.strataColors);

  const containerRef = useRef<HTMLDivElement>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 12, h: 10 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0 });

  const totalDepth = strata.reduce((sum, s) => sum + s.thickness, 0);
  const basementDepth = conditions.hasBasement ? conditions.basementDepth : 0;
  const totalH = totalDepth;

  // Soil block width: B + 4m (2m padding each side)
  const soilW = foundation.B + 4;
  const halfW = soilW / 2;

  // Auto-fit viewBox only on initial mount
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      const margin = 2;
      const labelSpace = 5;
      setViewBox({
        x: -halfW - margin - labelSpace,
        y: -margin,
        w: soilW + margin * 2 + labelSpace + 8,
        h: totalH + margin * 2 + 1,
      });
      hasInitialized.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan — right-click only
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setIsPanning(true);
      setPanStart({
        x: e.clientX, y: e.clientY,
        vx: viewBox.x, vy: viewBox.y,
      });
    }
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    const dx = (e.clientX - panStart.x) * scaleX;
    const dy = (e.clientY - panStart.y) * scaleY;
    setViewBox(v => ({
      ...v,
      x: panStart.vx - dx,
      y: panStart.vy - dy,
    }));
  }, [isPanning, panStart, viewBox.w, viewBox.h]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // Zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(v => {
      const newW = v.w * factor;
      const newH = v.h * factor;
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
    });
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: '#1a1a1a', cursor: isPanning ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        style={{ display: 'block' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) clearSelection();
        }}
      >
        <defs>
          {/* Hatch patterns for strata */}
          {strata.map((_, i) => (
            <pattern key={i} id={`hatch-${i}`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="4" stroke={strataColors[i % strataColors.length]} strokeWidth="0.3" opacity="0.4" />
            </pattern>
          ))}
        </defs>

        {/* ─── Surface line ─── */}
        <line x1={-halfW - 3} y1={0} x2={halfW + 3} y2={0} stroke="#666" strokeWidth="0.05" strokeDasharray="0.2 0.1" />
        <text x={halfW + 0.5} y={-0.15} fontSize="0.35" fill="#999" fontFamily="Consolas, monospace">NTN 0.00</text>

        {/* ─── Ground surface hatching ─── */}
        {Array.from({ length: Math.ceil(soilW / 0.4) + 6 }).map((_, i) => {
          const x = -halfW - 1 + i * 0.4;
          return <line key={`gs-${i}`} x1={x} y1={0} x2={x - 0.3} y2={-0.3} stroke="#555" strokeWidth="0.03" />;
        })}

        {/* ─── Strata layers ─── */}
        {(() => {
          let yOff = 0;
          return strata.map((s, i) => {
            const y = yOff;
            yOff += s.thickness;
            const isSelected = selectedIds.includes(s.id);
            const color = strataColors[i % strataColors.length];
            return (
              <g key={s.id}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(s.id, e.ctrlKey || e.metaKey);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Fill */}
                <rect x={-halfW} y={y} width={soilW} height={s.thickness}
                  fill={color} opacity={isSelected ? 0.5 : 0.25}
                  stroke={isSelected ? '#c0392b' : '#555'}
                  strokeWidth={isSelected ? 0.08 : 0.03}
                />
                {/* Hatch */}
                <rect x={-halfW} y={y} width={soilW} height={s.thickness}
                  fill={`url(#hatch-${i})`}
                />
                {/* Layer boundary */}
                <line x1={-halfW} y1={yOff} x2={halfW} y2={yOff}
                  stroke="#555" strokeWidth="0.03" strokeDasharray="0.15 0.08" />

                {/* Right-side level label */}
                <text x={halfW + 0.5} y={yOff - 0.15} fontSize="0.3" fill="#888" fontFamily="Consolas, monospace">
                  -{yOff.toFixed(2)}m
                </text>

                {/* Stratum center label */}
                <text x={-halfW + 0.3} y={y + s.thickness / 2 + 0.12} fontSize="0.28" fill="#ccc" fontFamily="Segoe UI, sans-serif" fontWeight="600">
                  E{i + 1}
                </text>
              </g>
            );
          });
        })()}

        {/* ─── Foundation ─── */}
        {(() => {
          // Foundation top at basementDepth, pad at basementDepth + Df
          const fTop = basementDepth + foundation.Df;
          const padH = 0.3;
          const colW = Math.min(foundation.B * 0.3, 0.5);
          const colStartY = basementDepth;
          const colEndY = fTop - padH;
          const colH = colEndY - colStartY;
          const isSelected = selectedIds.includes('foundation');
          const fColor = isSelected ? '#e74c3c' : '#7f8c8d';

          return (
            <g
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection('foundation', e.ctrlKey || e.metaKey);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Column — from basement level to pad */}
              {colH > 0 && (
                <rect x={-colW / 2} y={colStartY} width={colW} height={colH}
                  fill={isSelected ? '#e74c3c' : '#95a5a6'} stroke="#333" strokeWidth="0.04" />
              )}
              {/* Pad */}
              <rect x={-foundation.B / 2} y={fTop - padH} width={foundation.B} height={padH}
                fill={fColor} stroke="#333" strokeWidth="0.04" />

              {/* Df dimension — measured from basement level */}
              <line x1={-foundation.B / 2 - 0.6} y1={basementDepth} x2={-foundation.B / 2 - 0.6} y2={fTop}
                stroke="#c0392b" strokeWidth="0.03" />
              <line x1={-foundation.B / 2 - 0.7} y1={basementDepth} x2={-foundation.B / 2 - 0.5} y2={basementDepth}
                stroke="#c0392b" strokeWidth="0.03" />
              <line x1={-foundation.B / 2 - 0.7} y1={fTop} x2={-foundation.B / 2 - 0.5} y2={fTop}
                stroke="#c0392b" strokeWidth="0.03" />
              <text x={-foundation.B / 2 - 1.2} y={(basementDepth + fTop) / 2 + 0.12} fontSize="0.28" fill="#c0392b" fontFamily="Consolas, monospace" textAnchor="middle"
                transform={`rotate(-90, ${-foundation.B / 2 - 1.2}, ${(basementDepth + fTop) / 2})`}
              >
                Df={foundation.Df}m
              </text>

              {/* B dimension */}
              <line x1={-foundation.B / 2} y1={fTop + 0.4} x2={foundation.B / 2} y2={fTop + 0.4}
                stroke="#c0392b" strokeWidth="0.03" />
              <line x1={-foundation.B / 2} y1={fTop + 0.3} x2={-foundation.B / 2} y2={fTop + 0.5}
                stroke="#c0392b" strokeWidth="0.03" />
              <line x1={foundation.B / 2} y1={fTop + 0.3} x2={foundation.B / 2} y2={fTop + 0.5}
                stroke="#c0392b" strokeWidth="0.03" />
              <text x={0} y={fTop + 0.75} fontSize="0.28" fill="#c0392b" fontFamily="Consolas, monospace" textAnchor="middle">
                B={foundation.B}m
              </text>
            </g>
          );
        })()}

        {/* ─── Basement level indicator ─── */}
        {basementDepth > 0 && (
          <>
            <line x1={-halfW} y1={basementDepth} x2={halfW} y2={basementDepth}
              stroke="#c0392b" strokeWidth="0.05" strokeDasharray="0.3 0.15" />
            <text x={halfW + 0.5} y={basementDepth - 0.15} fontSize="0.3" fill="#c0392b" fontFamily="Consolas, monospace">
              -{basementDepth.toFixed(2)}m (sótano)
            </text>
          </>
        )}

        {/* ─── Water table (pointer events disabled so strata are clickable underneath) ─── */}
        {conditions.hasWaterTable && (
          <g pointerEvents="none">
            <line x1={-halfW - 1} y1={conditions.waterTableDepth} x2={halfW + 1} y2={conditions.waterTableDepth}
              stroke="#3498db" strokeWidth="0.06" strokeDasharray="0.4 0.2" />
            <text x={halfW + 0.5} y={conditions.waterTableDepth - 0.15} fontSize="0.3" fill="#3498db" fontFamily="Consolas, monospace">
              NF -{conditions.waterTableDepth.toFixed(2)}m
            </text>
            {/* Water fill below NF */}
            <rect x={-halfW} y={conditions.waterTableDepth}
              width={soilW}
              height={Math.max(0, totalH - conditions.waterTableDepth)}
              fill="#3498db" opacity={0.06}
            />
          </g>
        )}

        {/* ─── Properties table (right side, with real cell borders) ─── */}
        {(() => {
          const tableX = halfW + 3.5;
          const colWidths = [0.5, 0.7, 0.6, 0.6, 0.6, 0.65];
          const totalTableW = colWidths.reduce((a, b) => a + b, 0);
          const rowH = 0.4;
          const headerLabels = ['N°', 'h(m)', 'γ', 'c', 'φ', 'γsat'];
          const headerY = 0.4;

          return (
            <g>
              <text x={tableX} y={headerY - 0.25} fontSize="0.3" fill="#999" fontFamily="Segoe UI" fontWeight="700">
                PROPIEDADES
              </text>

              {/* Header row background */}
              <rect x={tableX} y={headerY - 0.05} width={totalTableW} height={rowH}
                fill="#3a3a3a" stroke="#555" strokeWidth="0.02" />

              {/* Header cells */}
              {(() => {
                let cx = tableX;
                return headerLabels.map((label, ci) => {
                  const x = cx;
                  cx += colWidths[ci];
                  return (
                    <g key={`hdr-${ci}`}>
                      {ci > 0 && <line x1={x} y1={headerY - 0.05} x2={x} y2={headerY - 0.05 + rowH} stroke="#555" strokeWidth="0.02" />}
                      <text x={x + colWidths[ci] / 2} y={headerY + 0.22} fontSize="0.2" fill="#999" fontFamily="Consolas" textAnchor="middle">{label}</text>
                    </g>
                  );
                });
              })()}

              {/* Data rows */}
              {strata.map((s, i) => {
                const ry = headerY - 0.05 + rowH * (i + 1);
                const isSelected = selectedIds.includes(s.id);
                const values = [String(i + 1), s.thickness.toFixed(1), String(s.gamma), String(s.c), `${s.phi}°`, String(s.gammaSat)];

                return (
                  <g key={s.id}
                    onClick={(e) => { e.stopPropagation(); toggleSelection(s.id, e.ctrlKey || e.metaKey); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Row background */}
                    <rect x={tableX} y={ry} width={totalTableW} height={rowH}
                      fill={isSelected ? '#4a2020' : '#2a2a2a'}
                      stroke={isSelected ? '#c0392b' : '#444'} strokeWidth="0.02" />

                    {/* Color swatch in first cell */}
                    <rect x={tableX + 0.05} y={ry + 0.08} width={0.2} height={0.22}
                      fill={strataColors[i % strataColors.length]} opacity={0.7} />

                    {/* Cell values */}
                    {(() => {
                      let cx = tableX;
                      return values.map((val, ci) => {
                        const x = cx;
                        cx += colWidths[ci];
                        return (
                          <g key={`cell-${ci}`}>
                            {ci > 0 && <line x1={x} y1={ry} x2={x} y2={ry + rowH} stroke="#444" strokeWidth="0.02" />}
                            <text x={x + colWidths[ci] / 2} y={ry + 0.26}
                              fontSize="0.2" fill={isSelected ? '#e0e0e0' : '#aaa'}
                              fontFamily="Consolas" textAnchor="middle">
                              {ci === 0 ? '' : val}
                            </text>
                          </g>
                        );
                      });
                    })()}
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
