
import { create } from 'zustand';

export type TabType = '2d' | '3d' | 'charts' | 'results' | 'foundation-design' | 'settlement' | 'compare-settlements';

type AddTabFn = (type: TabType, slot?: 'left' | 'right') => void;
type CaptureView3DFn = () => string | null;

interface WorkspaceStore {
  addTab: AddTabFn | null;
  registerAddTab: (fn: AddTabFn) => void;
  unregisterAddTab: () => void;

  captureView3D: CaptureView3DFn | null;
  registerCaptureView3D: (fn: CaptureView3DFn) => void;
  unregisterCaptureView3D: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  addTab: null,
  registerAddTab: (fn) => set({ addTab: fn }),
  unregisterAddTab: () => set({ addTab: null }),

  captureView3D: null,
  registerCaptureView3D: (fn) => set({ captureView3D: fn }),
  unregisterCaptureView3D: () => set({ captureView3D: null }),
}));
