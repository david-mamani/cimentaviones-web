/**
 * IfcViewer — Visor IFC profesional con web-ifc + Three.js.
 *
 * Pipeline:
 *   1. Frontend envía datos del modelo al backend
 *   2. Backend genera archivo .ifc con ifcopenshell
 *   3. web-ifc parsea el IFC y extrae la geometría
 *   4. Three.js renderiza la geometría con materiales y colores IFC
 *
 * Features:
 *   - Visualización profesional tipo BIM
 *   - Orbit, pan, zoom con OrbitControls
 *   - Exportar IFC para abrir en Revit/ArchiCAD
 *   - Auto-actualización cuando cambian los datos del modelo
 *   - Panel de personalización (transparencia, colores, wireframe, etc.)
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as WebIFC from 'web-ifc';
import { useFoundationStore } from '../../store/foundationStore';
import { useViewerSettings } from '../../store/viewerSettingsStore';
import ViewerSettingsPanel from './ViewerSettingsPanel';

const API_BASE = '';

// IFC type IDs for identifying elements
const IFCSLAB = 1529196076;
const IFCFOOTING = 900683007;
const IFCCOLUMN = 3495092785;
const IFCBUILDINGELEMENTPROXY = 1095909175;

export default function IfcViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const ifcApiRef = useRef<WebIFC.IfcAPI | null>(null);
  const animFrameRef = useRef<number>(0);
  const initedRef = useRef(false);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);

  // Mesh tracking by IFC type for settings
  const strataMeshesRef = useRef<THREE.Mesh[]>([]);
  const foundationMeshesRef = useRef<THREE.Mesh[]>([]);
  const waterMeshesRef = useRef<THREE.Mesh[]>([]);
  const edgeMeshesRef = useRef<THREE.LineSegments[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const foundation = useFoundationStore((s) => s.foundation);
  const strata = useFoundationStore((s) => s.strata);
  const conditions = useFoundationStore((s) => s.conditions);

  const settings = useViewerSettings();

  // ── Initialize Three.js + web-ifc ──
  useEffect(() => {
    if (!containerRef.current || initedRef.current) return;
    initedRef.current = true;

    const container = containerRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.bgColor);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.01,
      200
    );
    camera.position.set(8, 6, 8);
    camera.lookAt(0, -1, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,  // needed for toDataURL() capture
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, -1, 0);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, settings.ambientIntensity);
    scene.add(ambient);
    ambientRef.current = ambient;

    const hemi = new THREE.HemisphereLight(0xddeeff, 0x776644, 0.6);
    scene.add(hemi);

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dir1.position.set(10, 15, 10);
    dir1.castShadow = true;
    scene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dir2.position.set(-10, 10, -10);
    scene.add(dir2);

    const dir3 = new THREE.DirectionalLight(0xffffff, 0.2);
    dir3.position.set(0, -10, 0);
    scene.add(dir3);

    // Grid
    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    grid.position.y = 0.001;
    grid.visible = settings.showGrid;
    scene.add(grid);
    gridRef.current = grid;

    // Axis helper
    const axes = new THREE.AxesHelper(2);
    axes.position.set(-8, 0, -8);
    scene.add(axes);

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // Init web-ifc
    const ifcApi = new WebIFC.IfcAPI();
    ifcApi.SetWasmPath('https://unpkg.com/web-ifc@0.0.77/');
    ifcApi.Init().then(() => {
      ifcApiRef.current = ifcApi;
      setReady(true);
    }).catch((err) => {
      console.error('web-ifc init failed:', err);
      setError('Error al inicializar web-ifc');
    });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      initedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── React to settings changes ──
  useEffect(() => {
    // Background color
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(settings.bgColor);
    }

    // Grid visibility
    if (gridRef.current) {
      gridRef.current.visible = settings.showGrid;
    }

    // Ambient light intensity
    if (ambientRef.current) {
      ambientRef.current.intensity = settings.ambientIntensity;
    }

    // Strata meshes — opacity, wireframe, colors
    strataMeshesRef.current.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = settings.strataOpacity;
      mat.transparent = settings.strataOpacity < 1.0;
      mat.wireframe = settings.strataWireframe;
      // Apply per-stratum color from settings
      const hexColor = settings.strataColors[i % settings.strataColors.length];
      mat.color.set(hexColor);
      mat.needsUpdate = true;
    });

    // Foundation meshes — opacity, color
    foundationMeshesRef.current.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = settings.foundationOpacity;
      mat.transparent = settings.foundationOpacity < 1.0;
      mat.color.set(settings.foundationColor);
      mat.needsUpdate = true;
    });

    // Water table meshes — opacity, color
    waterMeshesRef.current.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = settings.waterTableOpacity;
      mat.transparent = true;
      mat.color.set(settings.waterTableColor);
      mat.needsUpdate = true;
    });
  }, [settings]);

  // ── Load IFC model ──
  const loadModel = useCallback(async () => {
    if (!ready || !ifcApiRef.current || !sceneRef.current) return;

    setLoading(true);
    setError(null);

    try {
      // Clear previous meshes from scene
      const scene = sceneRef.current;
      [...strataMeshesRef.current, ...foundationMeshesRef.current, ...waterMeshesRef.current].forEach((mesh) => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      edgeMeshesRef.current.forEach((edge) => {
        scene.remove(edge);
        edge.geometry.dispose();
        (edge.material as THREE.Material).dispose();
      });
      strataMeshesRef.current = [];
      foundationMeshesRef.current = [];
      waterMeshesRef.current = [];
      edgeMeshesRef.current = [];

      // Build request
      const body = {
        foundation: {
          type: foundation.type,
          B: foundation.B,
          L: foundation.type === 'cuadrada' ? foundation.B : foundation.L,
          Df: foundation.Df,
          FS: foundation.FS,
          beta: foundation.beta,
        },
        strata: strata.map((s) => ({
          id: s.id,
          thickness: s.thickness,
          gamma: s.gamma,
          c: s.c,
          phi: s.phi,
          gammaSat: s.gammaSat,
        })),
        conditions: {
          hasWaterTable: conditions.hasWaterTable,
          waterTableDepth: conditions.waterTableDepth,
          hasBasement: conditions.hasBasement,
          basementDepth: conditions.basementDepth,
        },
      };

      // Fetch IFC from backend
      const response = await fetch(`${API_BASE}/api/export-ifc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Parse IFC with web-ifc
      const ifcApi = ifcApiRef.current;
      const modelID = ifcApi.OpenModel(data);

      // Counters for stratum ordering
      let strataIndex = 0;
      // Track processed express IDs to avoid duplicates
      const processedIDs = new Set<number>();

      // Get all meshes from the IFC
      ifcApi.StreamAllMeshes(modelID, (mesh: WebIFC.FlatMesh) => {
        const expressID = mesh.expressID;

        // Skip already-processed elements
        if (processedIDs.has(expressID)) return;
        processedIDs.add(expressID);

        const placedGeometries = mesh.geometries;

        // Determine IFC type
        let ifcType = 0;
        try {
          const lineData = ifcApi.GetLine(modelID, expressID);
          ifcType = lineData?.type ?? 0;
        } catch { /* ignore */ }

        for (let i = 0; i < placedGeometries.size(); i++) {
          const placedGeom = placedGeometries.get(i);
          const geomData = ifcApi.GetGeometry(modelID, placedGeom.geometryExpressID);

          // Extract vertex data
          const verts = ifcApi.GetVertexArray(
            geomData.GetVertexData(),
            geomData.GetVertexDataSize()
          );
          const indices = ifcApi.GetIndexArray(
            geomData.GetIndexData(),
            geomData.GetIndexDataSize()
          );

          // Create Three.js geometry
          const geometry = new THREE.BufferGeometry();

          // web-ifc vertex format: x, y, z, nx, ny, nz (6 floats per vertex)
          const positions = new Float32Array(verts.length / 2);
          const normals = new Float32Array(verts.length / 2);

          for (let j = 0; j < verts.length; j += 6) {
            const idx = j / 2;
            positions[idx] = verts[j];
            positions[idx + 1] = verts[j + 1];
            positions[idx + 2] = verts[j + 2];
            normals[idx] = verts[j + 3];
            normals[idx + 1] = verts[j + 4];
            normals[idx + 2] = verts[j + 5];
          }

          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
          geometry.setIndex(new THREE.BufferAttribute(indices, 1));

          // Determine color and opacity based on IFC type
          const ifcColor = placedGeom.color;
          let materialColor: THREE.Color;
          let opacity: number;
          let wireframe = false;

          if (ifcType === IFCSLAB) {
            // Stratum — use settings color
            const hexColor = settings.strataColors[strataIndex % settings.strataColors.length];
            materialColor = new THREE.Color(hexColor);
            opacity = settings.strataOpacity;
            wireframe = settings.strataWireframe;
          } else if (ifcType === IFCFOOTING || ifcType === IFCCOLUMN) {
            // Foundation — use settings color
            materialColor = new THREE.Color(settings.foundationColor);
            opacity = settings.foundationOpacity;
          } else if (ifcType === IFCBUILDINGELEMENTPROXY) {
            // Water table — use settings color
            materialColor = new THREE.Color(settings.waterTableColor);
            opacity = settings.waterTableOpacity;
          } else {
            // Fallback to IFC embedded color
            materialColor = new THREE.Color(ifcColor.x, ifcColor.y, ifcColor.z);
            opacity = ifcColor.w;
          }

          const mat = new THREE.MeshStandardMaterial({
            color: materialColor,
            opacity: opacity,
            transparent: opacity < 1.0,
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.7,
            wireframe: wireframe,
          });

          const mesh3d = new THREE.Mesh(geometry, mat);

          // Apply transform matrix
          const matrix = new THREE.Matrix4();
          matrix.fromArray(placedGeom.flatTransformation);
          mesh3d.applyMatrix4(matrix);

          // Track by type for settings reactivity
          if (ifcType === IFCSLAB) {
            strataMeshesRef.current.push(mesh3d);
          } else if (ifcType === IFCFOOTING || ifcType === IFCCOLUMN) {
            foundationMeshesRef.current.push(mesh3d);
          } else if (ifcType === IFCBUILDINGELEMENTPROXY) {
            waterMeshesRef.current.push(mesh3d);
          }

          scene.add(mesh3d);

          // Add edges for clean look (not for wireframe)
          if (!wireframe) {
            const edges = new THREE.EdgesGeometry(geometry, 20);
            const edgeMat = new THREE.LineBasicMaterial({
              color: 0x000000,
              opacity: 0.3,
              transparent: true,
            });
            const edgeMesh = new THREE.LineSegments(edges, edgeMat);
            edgeMesh.applyMatrix4(matrix);
            scene.add(edgeMesh);
            edgeMeshesRef.current.push(edgeMesh);
          }

          // Cleanup
          geomData.delete();
        }

        // Increment stratum index for slabs
        if (ifcType === IFCSLAB) {
          strataIndex++;
        }
      });

      ifcApi.CloseModel(modelID);

      // Auto-fit camera to model
      const allMeshes = [
        ...strataMeshesRef.current,
        ...foundationMeshesRef.current,
        ...waterMeshesRef.current,
      ];
      if (allMeshes.length > 0) {
        const tempGroup = new THREE.Group();
        allMeshes.forEach((m) => tempGroup.add(m.clone()));
        const box = new THREE.Box3().setFromObject(tempGroup);
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const dist = maxDim * 2;

          if (controlsRef.current && cameraRef.current) {
            controlsRef.current.target.copy(center);
            cameraRef.current.position.set(
              center.x + dist * 0.7,
              center.y + dist * 0.5,
              center.z + dist * 0.7
            );
            controlsRef.current.update();
          }
        }
        // Dispose cloned meshes
        tempGroup.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            (obj.material as THREE.Material).dispose();
          }
        });
      }
    } catch (err: any) {
      console.error('Error loading IFC model:', err);
      setError(err.message || 'Error al cargar el modelo IFC');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, foundation, strata, conditions]);

  // Trigger model load when data changes
  useEffect(() => {
    if (ready) {
      const timer = setTimeout(() => loadModel(), 500);
      return () => clearTimeout(timer);
    }
  }, [ready, foundation, strata, conditions, loadModel]);

  // ── Export IFC ──
  const handleExportIFC = useCallback(async () => {
    try {
      const body = {
        foundation: {
          type: foundation.type,
          B: foundation.B,
          L: foundation.type === 'cuadrada' ? foundation.B : foundation.L,
          Df: foundation.Df,
          FS: foundation.FS,
          beta: foundation.beta,
        },
        strata: strata.map((s) => ({
          id: s.id,
          thickness: s.thickness,
          gamma: s.gamma,
          c: s.c,
          phi: s.phi,
          gammaSat: s.gammaSat,
        })),
        conditions: {
          hasWaterTable: conditions.hasWaterTable,
          waterTableDepth: conditions.waterTableDepth,
          hasBasement: conditions.hasBasement,
          basementDepth: conditions.basementDepth,
        },
      };

      const response = await fetch(`${API_BASE}/api/export-ifc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cimentaviones_model.ifc';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [foundation, strata, conditions]);

  // ── Reset camera ──
  const handleResetCamera = useCallback(() => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(8, 6, 8);
      controlsRef.current.target.set(0, -1, 0);
      controlsRef.current.update();
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#1a1a2e' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Toolbar */}
      <div style={{
        position: 'absolute', top: 8, right: showSettings ? 248 : 8,
        display: 'flex', gap: 4, transition: 'right 0.2s ease',
      }}>
        <button
          onClick={handleExportIFC}
          style={{
            padding: '4px 10px', height: 28,
            background: '#2d6a4f', border: '1px solid #52796f',
            color: '#d8f3dc', cursor: 'pointer', fontSize: 11,
            borderRadius: 3, display: 'flex', alignItems: 'center', gap: 4,
          }}
          title="Exportar IFC (Revit, ArchiCAD, BlenderBIM)"
        >
          📁 Exportar IFC
        </button>
        <button
          onClick={() => loadModel()}
          style={{
            width: 28, height: 28,
            background: '#3c3c3c', border: '1px solid #505050',
            color: '#ccc', cursor: 'pointer', fontSize: 13,
            borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Recargar modelo"
        >
          ↻
        </button>
        <button
          onClick={handleResetCamera}
          style={{
            width: 28, height: 28,
            background: '#3c3c3c', border: '1px solid #505050',
            color: '#ccc', cursor: 'pointer', fontSize: 14,
            borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Vista inicial"
        >
          ⌂
        </button>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            width: 28, height: 28,
            background: showSettings ? '#c0392b' : '#3c3c3c',
            border: `1px solid ${showSettings ? '#e74c3c' : '#505050'}`,
            color: showSettings ? '#fff' : '#ccc',
            cursor: 'pointer', fontSize: 13,
            borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Configuración de visualización"
        >
          ⚙
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <ViewerSettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 14,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 32, height: 32, margin: '0 auto 8px',
              border: '3px solid #555', borderTopColor: '#c0392b',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            Generando modelo IFC...
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8,
          padding: '8px 12px', background: '#c0392b',
          color: '#fff', fontSize: 12, borderRadius: 4,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Help text */}
      <div style={{
        position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, color: '#555', pointerEvents: 'none',
      }}>
        Izq: rotar · Der: mover · Scroll: zoom
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
