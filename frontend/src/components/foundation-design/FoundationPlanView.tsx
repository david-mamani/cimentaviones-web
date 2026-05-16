/**
 * FoundationPlanView — Vista en PLANTA de la cimentación.
 *
 * Muestra:
 *  - Rectángulo de la zapata B × L
 *  - Punto de aplicación de la carga (desplazado por e1, e2)
 *  - Área efectiva Meyerhof B' × L' centrada en el punto de aplicación
 *  - Acotaciones B, L, e1, e2, B', L'
 *
 * Convenciones:
 *  - B = lado en dirección X (horizontal)
 *  - L = lado en dirección Y (vertical, "hacia arriba" en pantalla)
 *  - Centro de la zapata en origen (0, 0)
 *  - Punto de aplicación: (e1, e2)
 *  - Zapata efectiva: B'×L' centrada en el punto de aplicación
 *      B' = B - 2·e1, L' = L - 2·e2
 */

interface FoundationPlanViewProps {
  B: number;
  L: number;
  e1: number;
  e2: number;
}

export default function FoundationPlanView({ B, L, e1, e2 }: FoundationPlanViewProps) {
  // Bug-safe: si dimensiones inválidas, mostrar placeholder
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

  const safeE1 = Math.max(0, Math.min(e1, B / 2 - 0.001));
  const safeE2 = Math.max(0, Math.min(e2, L / 2 - 0.001));
  const Beff = B - 2 * safeE1;
  const Leff = L - 2 * safeE2;
  const hasEccentricity = safeE1 > 0 || safeE2 > 0;

  // viewBox con margen para acotaciones (las cotas van fuera del rect)
  // En SVG el eje Y va hacia abajo: invertimos L para que dibuje hacia arriba.
  const dimMax = Math.max(B, L);
  const margin = dimMax * 0.25;  // 25% del lado mayor para etiquetas y cotas
  const vbX = -B / 2 - margin;
  const vbY = -L / 2 - margin;
  const vbW = B + 2 * margin;
  const vbH = L + 2 * margin;

  // Stroke widths relativos al tamaño (para que se vean bien a cualquier escala)
  const sw = dimMax * 0.005;
  const swThin = dimMax * 0.003;
  const fontSize = dimMax * 0.04;
  const fontSizeSmall = dimMax * 0.03;
  const tickSize = dimMax * 0.02;

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        width: '100%', height: '100%', display: 'block',
        background: 'var(--bg-viewport)',
      }}
    >
      {/* Transform: flip Y so positive y goes up */}
      <g transform="scale(1 -1)">

        {/* Zapata real B × L (rectángulo blanco con borde) */}
        <rect
          x={-B / 2}
          y={-L / 2}
          width={B}
          height={L}
          fill="rgba(120, 120, 120, 0.10)"
          stroke="var(--text-secondary)"
          strokeWidth={sw}
        />

        {/* Centroide de la zapata (cruz pequeña) */}
        <g stroke="var(--text-muted)" strokeWidth={swThin}>
          <line x1={-tickSize} y1={0} x2={tickSize} y2={0} />
          <line x1={0} y1={-tickSize} x2={0} y2={tickSize} />
        </g>

        {/* Área efectiva B' × L' (Meyerhof) — centrada en el punto de carga */}
        {hasEccentricity && Beff > 0 && Leff > 0 && (
          <rect
            x={safeE1 - Beff / 2}
            y={safeE2 - Leff / 2}
            width={Beff}
            height={Leff}
            fill="rgba(255, 140, 0, 0.20)"
            stroke="var(--accent, #ff8c00)"
            strokeWidth={sw}
            strokeDasharray={`${sw * 4} ${sw * 2}`}
          />
        )}

        {/* Punto de aplicación de la carga */}
        <g>
          {/* Línea desde el centro al punto de aplicación (solo si hay excentricidad) */}
          {hasEccentricity && (
            <line
              x1={0} y1={0}
              x2={safeE1} y2={safeE2}
              stroke="var(--accent, #ff8c00)"
              strokeWidth={swThin}
              strokeDasharray={`${sw * 2} ${sw * 2}`}
            />
          )}
          {/* Círculo en el punto de aplicación */}
          <circle
            cx={safeE1}
            cy={safeE2}
            r={tickSize * 0.8}
            fill="var(--accent, #ff8c00)"
            stroke="var(--bg-base, white)"
            strokeWidth={swThin}
          />
        </g>
      </g>

      {/* Texto y acotaciones (sin flip — SVG default Y abajo) */}
      <g fontFamily="var(--font-mono, monospace)">

        {/* Etiqueta B (debajo) */}
        <text
          x={0}
          y={L / 2 + margin * 0.5}
          textAnchor="middle"
          fontSize={fontSize}
          fill="var(--text-secondary)"
        >
          B = {B.toFixed(3)} m
        </text>

        {/* Etiqueta L (izquierda, rotada) */}
        <text
          x={-B / 2 - margin * 0.5}
          y={0}
          textAnchor="middle"
          fontSize={fontSize}
          fill="var(--text-secondary)"
          transform={`rotate(-90, ${-B / 2 - margin * 0.5}, 0)`}
        >
          L = {L.toFixed(3)} m
        </text>

        {/* Si hay excentricidad: e1, e2, B', L' */}
        {hasEccentricity && (
          <>
            {safeE1 > 0 && (
              <text
                x={safeE1 / 2}
                y={-L / 2 - tickSize}
                textAnchor="middle"
                fontSize={fontSizeSmall}
                fill="var(--accent, #ff8c00)"
              >
                e₁={safeE1.toFixed(3)}
              </text>
            )}
            {safeE2 > 0 && (
              <text
                x={B / 2 + tickSize}
                y={-safeE2 / 2}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={fontSizeSmall}
                fill="var(--accent, #ff8c00)"
              >
                e₂={safeE2.toFixed(3)}
              </text>
            )}

            {/* B', L' en la esquina inferior derecha */}
            <text
              x={B / 2 + margin * 0.3}
              y={L / 2 + margin * 0.3}
              textAnchor="end"
              fontSize={fontSizeSmall}
              fill="var(--accent, #ff8c00)"
            >
              B' = {Beff.toFixed(3)} m
            </text>
            <text
              x={B / 2 + margin * 0.3}
              y={L / 2 + margin * 0.3 + fontSizeSmall * 1.3}
              textAnchor="end"
              fontSize={fontSizeSmall}
              fill="var(--accent, #ff8c00)"
            >
              L' = {Leff.toFixed(3)} m
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
