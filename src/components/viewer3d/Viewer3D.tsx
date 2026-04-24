/**
 * Viewer3D — Three.js interactive 3D soil profile.
 * - Fixed strata width: B+4m × L+4m (2m padding each side)
 * - Basement support: foundation starts at basementDepth + Df
 * - Click-to-select strata/foundation (synced to store)
 * - Ctrl+click for multi-select
 * - Per-tab camera state
 * - Home button for smooth reset
 */
import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Grid } from '@react-three/drei';
import { useFoundationStore } from '../../store/foundationStore';
import * as THREE from 'three';

const STRATA_COLORS = [
  '#8B7355', '#A0522D', '#CD853F', '#6B4226',
  '#D2B48C', '#8B6914', '#BC8F8F', '#A52A2A',
];
const SELECTED_EMISSIVE = new THREE.Color('#c0392b');

interface Viewer3DProps {
  tabId: string;
}

// Per-tab camera positions stored globally
const cameraStates = new Map<string, { pos: THREE.Vector3; target: THREE.Vector3 }>();

export default function Viewer3D({ tabId }: Viewer3DProps) {
  const strata = useFoundationStore((s) => s.strata);
  const foundation = useFoundationStore((s) => s.foundation);
  const conditions = useFoundationStore((s) => s.conditions);
  const selectedIds = useFoundationStore((s) => s.selectedIds);

  const totalDepth = strata.reduce((sum, s) => sum + s.thickness, 0);
  const basementDepth = conditions.hasBasement ? conditions.basementDepth : 0;

  // For cuadrada/circular/franja, L equals B. Only rectangular has independent L.
  const effectiveL = foundation.type === 'rectangular' ? foundation.L : foundation.B;
  const soilW = foundation.B + 4;
  const soilL = effectiveL + 4;
  const maxDim = Math.max(soilW, soilL, totalDepth, 4);

  // Compute orbit target from selection
  const orbitTarget = useMemo(() => {
    if (selectedIds.length === 0) {
      return new THREE.Vector3(0, -totalDepth / 2, 0);
    }
    let ySum = 0;
    let count = 0;
    let depth = 0;
    for (const s of strata) {
      const yCenter = -(depth + s.thickness / 2);
      if (selectedIds.includes(s.id)) {
        ySum += yCenter;
        count++;
      }
      depth += s.thickness;
    }
    if (selectedIds.includes('foundation')) {
      const fY = -(basementDepth + foundation.Df - 0.15);
      ySum += fY;
      count++;
    }
    return count > 0
      ? new THREE.Vector3(0, ySum / count, 0)
      : new THREE.Vector3(0, -totalDepth / 2, 0);
  }, [selectedIds, strata, foundation, totalDepth, basementDepth]);

  // Default camera position
  const saved = cameraStates.get(tabId);
  const defaultPos = saved?.pos || new THREE.Vector3(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);

  return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a1a', position: 'relative' }}>
      <Canvas
        camera={{ position: defaultPos.toArray() as [number, number, number], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onPointerMissed={() => {
          // Click on empty space clears selection
          useFoundationStore.getState().clearSelection();
        }}
      >
        <color attach="background" args={['#1a1a1a']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.8} />
        <directionalLight position={[-3, 5, -3]} intensity={0.3} />

        <Grid
          args={[20, 20]} position={[0, 0.01, 0]}
          cellSize={1} cellThickness={0.5} cellColor="#333"
          sectionSize={5} sectionThickness={1} sectionColor="#444"
          fadeDistance={30} fadeStrength={1} followCamera={false} infiniteGrid={false}
        />

        <StrataLayers
          strata={strata} soilW={soilW} soilL={soilL}
          selectedIds={selectedIds}
        />

        <FoundationMesh
          B={foundation.B}
          L={effectiveL}
          Df={foundation.Df}
          type={foundation.type}
          basementDepth={basementDepth}
          selected={selectedIds.includes('foundation')}
        />

        {conditions.hasWaterTable && (
          <WaterTablePlane
            depth={conditions.waterTableDepth}
            size={Math.max(soilW, soilL) * 1.2}
          />
        )}

        <DepthLabels strata={strata} offsetX={soilW / 2 + 0.5} basementDepth={basementDepth} />

        <CameraController tabId={tabId} target={orbitTarget} maxDim={maxDim} totalDepth={totalDepth} />
      </Canvas>

      {/* Home button */}
      <button
        onClick={() => {
          // Dispatch event that CameraController listens for
          window.dispatchEvent(new CustomEvent('camera-reset', { detail: { tabId } }));
        }}
        style={{
          position: 'absolute', top: 8, right: 8,
          width: 28, height: 28,
          background: '#3c3c3c', border: '1px solid #505050',
          color: '#ccc', cursor: 'pointer', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="Vista inicial"
      >
        ⌂
      </button>

      {/* Help text */}
      <div style={{
        position: 'absolute', bottom: 6, left: 8,
        fontSize: 9, color: '#555', pointerEvents: 'none',
      }}>
        Click: seleccionar · Ctrl+Click: multi · Izq: rotar · Der: mover · Scroll: zoom
      </div>
    </div>
  );
}

/* ─── Camera Controller ─── */
function CameraController({ tabId, target, maxDim, totalDepth }: {
  tabId: string; target: THREE.Vector3; maxDim: number; totalDepth: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const initialized = useRef(false);
  const resetTarget = useRef(false);

  // Listen for home button reset
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tabId === tabId && controlsRef.current) {
        resetTarget.current = true;
        cameraStates.delete(tabId);
      }
    };
    window.addEventListener('camera-reset', handler);
    return () => window.removeEventListener('camera-reset', handler);
  }, [tabId]);

  useFrame(() => {
    if (!controlsRef.current) return;

    // Save camera state
    cameraStates.set(tabId, {
      pos: camera.position.clone(),
      target: controlsRef.current.target.clone(),
    });

    // Smooth reset to home position
    if (resetTarget.current) {
      const homePos = new THREE.Vector3(maxDim * 1.5, maxDim * 0.8, maxDim * 1.5);
      const homeTarget = new THREE.Vector3(0, -totalDepth / 2, 0);
      camera.position.lerp(homePos, 0.08);
      controlsRef.current.target.lerp(homeTarget, 0.08);
      if (camera.position.distanceTo(homePos) < 0.1) {
        resetTarget.current = false;
      }
    }

    // Smooth orbit target follow for selection changes
    if (initialized.current && !resetTarget.current) {
      const ct = controlsRef.current.target as THREE.Vector3;
      ct.lerp(target, 0.05);
    }
  });

  return (
    <OrbitControls
      ref={(ref) => {
        controlsRef.current = ref;
        if (ref && !initialized.current) {
          const saved = cameraStates.get(tabId);
          if (saved) {
            ref.target.copy(saved.target);
          } else {
            ref.target.copy(target);
          }
          initialized.current = true;
        }
      }}
      enableDamping
      dampingFactor={0.15}
      minDistance={1}
      maxDistance={60}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
    />
  );
}

/* ─── Strata Layers ─── */
function StrataLayers({ strata, soilW, soilL, selectedIds }: {
  strata: { id: string; thickness: number; phi: number }[];
  soilW: number; soilL: number;
  selectedIds: string[];
}) {
  const toggleSelection = useFoundationStore((s) => s.toggleSelection);
  let yOffset = 0;

  return (
    <group>
      {strata.map((s, i) => {
        const y = -(yOffset + s.thickness / 2);
        yOffset += s.thickness;
        const color = STRATA_COLORS[i % STRATA_COLORS.length];
        const isSelected = selectedIds.includes(s.id);

        return (
          <group key={s.id}>
            <mesh
              position={[0, y, 0]}
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection(s.id, e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
              }}
            >
              <boxGeometry args={[soilW, s.thickness, soilL]} />
              <meshStandardMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.55 : 0.35}
                side={THREE.DoubleSide}
                emissive={isSelected ? SELECTED_EMISSIVE : undefined}
                emissiveIntensity={isSelected ? 0.3 : 0}
              />
            </mesh>
            <mesh position={[0, y, 0]}>
              <boxGeometry args={[soilW, s.thickness, soilL]} />
              <meshBasicMaterial
                color={isSelected ? '#c0392b' : color}
                wireframe
                opacity={isSelected ? 0.8 : 0.5}
                transparent
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ─── Foundation ─── */
function FoundationMesh({ B, L, Df, type, basementDepth, selected }: {
  B: number; L: number; Df: number; type: string;
  basementDepth: number; selected: boolean;
}) {
  const toggleSelection = useFoundationStore((s) => s.toggleSelection);
  const isCircular = type === 'circular';
  const padHeight = 0.3;
  // Total depth from surface: basement + Df
  const totalFoundDepth = basementDepth + Df;
  const columnWidth = Math.min(B * 0.3, 0.5);

  return (
    <group>
      {/* Foundation pad — at basementDepth + Df from surface */}
      <mesh
        position={[0, -totalFoundDepth + padHeight / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          toggleSelection('foundation', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
        }}
      >
        {isCircular ? (
          <cylinderGeometry args={[B / 2, B / 2, padHeight, 32]} />
        ) : (
          <boxGeometry args={[B, padHeight, L]} />
        )}
        <meshStandardMaterial
          color={selected ? '#e74c3c' : '#7f8c8d'}
          roughness={0.8}
          emissive={selected ? SELECTED_EMISSIVE : undefined}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>

      {/* Column — from basementDepth level down to pad top */}
      {Df > padHeight && (
        <mesh
          position={[0, -basementDepth - (Df - padHeight) / 2, 0]}
          onClick={(e) => {
            e.stopPropagation();
            toggleSelection('foundation', e.nativeEvent.ctrlKey || e.nativeEvent.metaKey);
          }}
        >
          <boxGeometry args={[columnWidth, Df - padHeight, columnWidth]} />
          <meshStandardMaterial
            color={selected ? '#e74c3c' : '#95a5a6'}
            roughness={0.7}
            emissive={selected ? SELECTED_EMISSIVE : undefined}
            emissiveIntensity={selected ? 0.3 : 0}
          />
        </mesh>
      )}

      {/* Surface level ring */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[B * 0.6, B * 0.62, 32]} />
        <meshBasicMaterial color="#c0392b" />
      </mesh>

      {/* Basement floor indicator */}
      {basementDepth > 0 && (
        <mesh position={[0, -basementDepth, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[B + 1, L + 1]} />
          <meshBasicMaterial color="#c0392b" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

/* ─── Water Table ─── */
function WaterTablePlane({ depth, size }: { depth: number; size: number }) {
  return (
    <mesh position={[0, -depth, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#3498db" transparent opacity={0.25} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─── Labels ─── */
function DepthLabels({ strata, offsetX, basementDepth }: {
  strata: { thickness: number; phi: number }[];
  offsetX: number;
  basementDepth: number;
}) {
  let yOffset = 0;

  return (
    <group>
      {/* Surface */}
      <Text position={[offsetX, 0.1, 0]} fontSize={0.15} color="#999" anchorX="left">
        0.00m (superficie)
      </Text>

      {/* Basement level */}
      {basementDepth > 0 && (
        <Text position={[offsetX, -basementDepth + 0.05, 0]} fontSize={0.15} color="#c0392b" anchorX="left">
          {`-${basementDepth.toFixed(2)}m (sótano)`}
        </Text>
      )}

      {strata.map((s, i) => {
        yOffset += s.thickness;
        return (
          <group key={`label-${i}`}>
            <Text position={[offsetX, -yOffset + 0.05, 0]} fontSize={0.13} color="#888" anchorX="left">
              {`-${yOffset.toFixed(2)}m — E${i + 1} (φ=${s.phi}°)`}
            </Text>
            <mesh position={[0, -yOffset, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[offsetX * 2, 0.015]} />
              <meshBasicMaterial color="#444" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
