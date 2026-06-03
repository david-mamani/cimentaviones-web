import { create } from 'zustand';

export interface ViewerSettings {
  strataOpacity: number;
  strataWireframe: boolean;
  strataColors: string[];
  foundationColor: string;
  foundationOpacity: number;
  waterTableColor: string;
  waterTableOpacity: number;
  showGrid: boolean;
  showLabels: boolean;
  ambientIntensity: number;
  bgColor: string;
}

const DEFAULT_STRATA_COLORS = [
  '#8B7355', '#A0522D', '#CD853F', '#6B4226',
  '#D2B48C', '#8B6914', '#BC8F8F', '#A52A2A',
];

const defaultSettings: ViewerSettings = {
  strataOpacity: 0.85,
  strataWireframe: false,
  strataColors: [...DEFAULT_STRATA_COLORS],
  foundationColor: '#7f8c8d',
  foundationOpacity: 1.0,
  waterTableColor: '#3498db',
  waterTableOpacity: 0.25,
  showGrid: true,
  showLabels: true,
  ambientIntensity: 0.6,
  bgColor: '#1a1a1a',
};

interface ViewerSettingsStore extends ViewerSettings {
  set: <K extends keyof ViewerSettings>(key: K, value: ViewerSettings[K]) => void;
  setStrataColor: (index: number, color: string) => void;
  reset: () => void;
}

export const useViewerSettings = create<ViewerSettingsStore>((set) => ({
  ...defaultSettings,
  set: (key, value) => set({ [key]: value }),
  setStrataColor: (index, color) =>
    set((state) => {
      const newColors = [...state.strataColors];
      newColors[index] = color;
      return { strataColors: newColors };
    }),
  reset: () => set({ ...defaultSettings, strataColors: [...DEFAULT_STRATA_COLORS] }),
}));
