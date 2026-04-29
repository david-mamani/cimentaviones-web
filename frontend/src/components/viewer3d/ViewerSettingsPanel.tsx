/**
 * ViewerSettingsPanel — CAD-styled panel to control 3D visualization.
 * Appears as an overlay when the settings button is clicked.
 */
import { useViewerSettings } from '../../store/viewerSettingsStore';
import { useFoundationStore } from '../../store/foundationStore';

interface ViewerSettingsPanelProps {
  onClose: () => void;
}

export default function ViewerSettingsPanel({ onClose }: ViewerSettingsPanelProps) {
  const settings = useViewerSettings();
  const strata = useFoundationStore((s) => s.strata);

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 240, background: '#2a2a2a', borderLeft: '1px solid #505050',
      overflowY: 'auto', zIndex: 20, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 10px', borderBottom: '1px solid #505050', background: '#333',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#ddd', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          ⚙ Visualización 3D
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: '0 4px',
        }}>✕</button>
      </div>

      <div style={{ padding: 10, flex: 1 }}>

        {/* ─── Estratos ─── */}
        <SectionHeader title="Estratos" />

        <SliderControl
          label="Opacidad"
          value={settings.strataOpacity}
          min={0.05} max={1} step={0.05}
          onChange={(v) => settings.set('strataOpacity', v)}
        />

        <CheckboxControl
          label="Mostrar wireframe"
          checked={settings.strataWireframe}
          onChange={(v) => settings.set('strataWireframe', v)}
        />

        {/* Per-stratum colors */}
        <p style={{ fontSize: 9, color: '#777', marginTop: 8, marginBottom: 4 }}>Colores por estrato:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {strata.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
              <span style={{ fontSize: 9, color: '#888', width: 16 }}>E{i + 1}</span>
              <input
                type="color"
                value={settings.strataColors[i % settings.strataColors.length]}
                onChange={(e) => settings.setStrataColor(i, e.target.value)}
                style={{ width: 28, height: 18, border: '1px solid #505050', background: 'none', cursor: 'pointer', padding: 0 }}
              />
            </div>
          ))}
        </div>

        {/* ─── Cimentación ─── */}
        <SectionHeader title="Cimentación" />

        <ColorControl
          label="Color"
          value={settings.foundationColor}
          onChange={(v) => settings.set('foundationColor', v)}
        />

        <SliderControl
          label="Opacidad"
          value={settings.foundationOpacity}
          min={0.1} max={1} step={0.05}
          onChange={(v) => settings.set('foundationOpacity', v)}
        />

        {/* ─── Nivel Freático ─── */}
        <SectionHeader title="Nivel Freático" />

        <ColorControl
          label="Color"
          value={settings.waterTableColor}
          onChange={(v) => settings.set('waterTableColor', v)}
        />

        <SliderControl
          label="Opacidad"
          value={settings.waterTableOpacity}
          min={0.05} max={0.8} step={0.05}
          onChange={(v) => settings.set('waterTableOpacity', v)}
        />

        {/* ─── Escena ─── */}
        <SectionHeader title="Escena" />

        <CheckboxControl
          label="Mostrar grilla"
          checked={settings.showGrid}
          onChange={(v) => settings.set('showGrid', v)}
        />

        <CheckboxControl
          label="Mostrar etiquetas"
          checked={settings.showLabels}
          onChange={(v) => settings.set('showLabels', v)}
        />

        <SliderControl
          label="Luz ambiental"
          value={settings.ambientIntensity}
          min={0.1} max={1.5} step={0.1}
          onChange={(v) => settings.set('ambientIntensity', v)}
        />

        <ColorControl
          label="Fondo"
          value={settings.bgColor}
          onChange={(v) => settings.set('bgColor', v)}
        />
      </div>

      {/* Reset button */}
      <div style={{ padding: 10, borderTop: '1px solid #505050' }}>
        <button
          className="cad-btn"
          onClick={settings.reset}
          style={{ width: '100%', fontSize: 10 }}
        >
          ↻ Restablecer valores
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function SectionHeader({ title }: { title: string }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, color: '#c0392b', marginTop: 12, marginBottom: 6,
      textTransform: 'uppercase', letterSpacing: 0.5,
      borderBottom: '1px solid #3c3c3c', paddingBottom: 4,
    }}>
      {title}
    </p>
  );
}

function SliderControl({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: '#999' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#c0392b', fontFamily: 'Consolas, monospace' }}>
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#c0392b', height: 4 }}
      />
    </div>
  );
}

function CheckboxControl({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 10, color: '#999', cursor: 'pointer', marginBottom: 4,
    }}>
      <input
        type="checkbox"
        className="cad-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

function ColorControl({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: '#999', flex: 1 }}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 36, height: 18, border: '1px solid #505050', background: 'none', cursor: 'pointer', padding: 0 }}
      />
      <span style={{ fontSize: 9, color: '#555', fontFamily: 'Consolas, monospace' }}>{value}</span>
    </div>
  );
}
