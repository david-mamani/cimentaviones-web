
interface FoundationPlanViewProps {
  B: number;
  L: number;
  e1: number;
  e2: number;
}

export default function FoundationPlanView({ B, L, e1, e2 }: FoundationPlanViewProps) {
  if (B <= 0 || L <= 0) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', color: 'var(--text-muted)', fontSize: 12,
      }}>
        Defina B y L para visualizar la planta
      </div>
    );
  }

  const safeE1 = Math.max(0, Math.min(e1, L / 2 - 0.001));
  const safeE2 = Math.max(0, Math.min(e2, B / 2 - 0.001));
  const Beff = B - 2 * safeE2;
  const Leff = L - 2 * safeE1;
  const hasEccentricity = safeE1 > 0 || safeE2 > 0;

  const dimMax = Math.max(B, L);
  const margin = dimMax * 0.30;
  const vbX = -B / 2 - margin;
  const vbY = -L / 2 - margin;
  const vbW = B + 2 * margin;
  const vbH = L + 2 * margin;

  const sw = dimMax * 0.005;
  const swThin = dimMax * 0.003;
  const fontSize = dimMax * 0.045;
  const fontSizeSmall = dimMax * 0.034;
  const tickSize = dimMax * 0.022;

  const loadX = safeE2;
  const loadY = -safeE1;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: '100%', height: '100%', display: 'block',
        background: 'var(--bg-viewport)',
      }}
    >
      <defs>
        <marker
          id="arrow1"
          viewBox="0 0 10 10"
          refX="9" refY="5"
          markerWidth="6" markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-secondary)" />
        </marker>
      </defs>

      <g transform="scale(1 -1)">
        <rect
          x={-B / 2}
          y={-L / 2}
          width={B}
          height={L}
          fill="rgba(120, 120, 120, 0.10)"
          stroke="var(--text-secondary)"
          strokeWidth={sw}
        />
        <g stroke="var(--text-muted)" strokeWidth={swThin} strokeDasharray={`${sw * 3} ${sw * 2}`}>
          <line x1={-B / 2 - margin * 0.7} y1={0} x2={B / 2 + margin * 0.7} y2={0} />
          <line x1={0} y1={-L / 2 - margin * 0.7} x2={0} y2={L / 2 + margin * 0.7} />
        </g>

        {hasEccentricity && Beff > 0 && Leff > 0 && (
          <rect
            x={loadX - Beff / 2}
            y={loadY - Leff / 2}
            width={Beff}
            height={Leff}
            fill="rgba(255, 140, 0, 0.18)"
            stroke="var(--accent, #ff8c00)"
            strokeWidth={sw}
            strokeDasharray={`${sw * 4} ${sw * 2}`}
          />
        )}
        {hasEccentricity && (
          <g stroke="var(--accent, #ff8c00)" strokeWidth={swThin}>
            {safeE2 > 0 && (
              <line x1={0} y1={loadY} x2={loadX} y2={loadY} />
            )}
            {safeE1 > 0 && (
              <line x1={loadX} y1={0} x2={loadX} y2={loadY} />
            )}
          </g>
        )}

        <circle
          cx={loadX}
          cy={loadY}
          r={tickSize * 0.9}
          fill="var(--accent, #ff8c00)"
          stroke="var(--bg-base, white)"
          strokeWidth={swThin}
        />
      </g>

      <g fontFamily="var(--font-mono, monospace)">
        {hasEccentricity && (
          <text
            x={loadX + tickSize * 1.3}
            y={-loadY - tickSize * 0.4}
            fontSize={fontSizeSmall}
            fill="var(--accent, #ff8c00)"
          >
            Q
          </text>
        )}

        <text
          x={B / 2 + margin * 0.55}
          y={tickSize}
          fontSize={fontSize * 0.85}
          fill="var(--text-secondary)"
          textAnchor="middle"
        >
          1
        </text>
        <text
          x={tickSize * 0.6}
          y={-L / 2 - margin * 0.5}
          fontSize={fontSize * 0.85}
          fill="var(--text-secondary)"
          textAnchor="start"
        >
          2
        </text>

        <line
          x1={-B / 2} y1={-L / 2 - margin * 0.25}
          x2={B / 2} y2={-L / 2 - margin * 0.25}
          stroke="var(--text-secondary)" strokeWidth={swThin}
          markerStart="url(#arrow1)" markerEnd="url(#arrow1)"
        />
        <text
          x={0}
          y={-L / 2 - margin * 0.35}
          textAnchor="middle"
          fontSize={fontSize}
          fill="var(--text-secondary)"
        >
          B = {B.toFixed(3)}
        </text>

        <line
          x1={-B / 2 - margin * 0.25} y1={-L / 2}
          x2={-B / 2 - margin * 0.25} y2={L / 2}
          stroke="var(--text-secondary)" strokeWidth={swThin}
          markerStart="url(#arrow1)" markerEnd="url(#arrow1)"
        />
        <text
          x={-B / 2 - margin * 0.35}
          y={0}
          textAnchor="middle"
          fontSize={fontSize}
          fill="var(--text-secondary)"
          transform={`rotate(-90, ${-B / 2 - margin * 0.35}, 0)`}
        >
          L = {L.toFixed(3)}
        </text>

        {hasEccentricity && (
          <>
            <line
              x1={loadX - Beff / 2} y1={L / 2 + margin * 0.20}
              x2={loadX + Beff / 2} y2={L / 2 + margin * 0.20}
              stroke="var(--accent, #ff8c00)" strokeWidth={swThin}
              markerStart="url(#arrow1)" markerEnd="url(#arrow1)"
            />
            <text
              x={loadX}
              y={L / 2 + margin * 0.32}
              textAnchor="middle"
              fontSize={fontSizeSmall}
              fill="var(--accent, #ff8c00)"
            >
              B' = {Beff.toFixed(3)}
            </text>

            <line
              x1={B / 2 + margin * 0.20} y1={-loadY - Leff / 2}
              x2={B / 2 + margin * 0.20} y2={-loadY + Leff / 2}
              stroke="var(--accent, #ff8c00)" strokeWidth={swThin}
              markerStart="url(#arrow1)" markerEnd="url(#arrow1)"
            />
            <text
              x={B / 2 + margin * 0.32}
              y={-loadY}
              textAnchor="middle"
              fontSize={fontSizeSmall}
              fill="var(--accent, #ff8c00)"
              transform={`rotate(-90, ${B / 2 + margin * 0.32}, ${-loadY})`}
            >
              L' = {Leff.toFixed(3)}
            </text>

            {safeE2 > 0 && (
              <text
                x={safeE2 / 2}
                y={-tickSize * 0.6}
                textAnchor="middle"
                fontSize={fontSizeSmall * 0.85}
                fill="var(--accent, #ff8c00)"
              >
                e₂={safeE2.toFixed(3)}
              </text>
            )}

            {safeE1 > 0 && (
              <text
                x={loadX + tickSize * 0.6}
                y={safeE1 / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={fontSizeSmall * 0.85}
                fill="var(--accent, #ff8c00)"
              >
                e₁={safeE1.toFixed(3)}
              </text>
            )}
          </>
        )}
      </g>
    </svg>
  );
}
