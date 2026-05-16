/**
 * Workspace Store — Manages tab operations and cross-component function registry.
 *
 * Replaces fragile window globals (__workspaceAddTab, __captureView3D)
 * with a type-safe Zustand store that components register/consume from.
 *
 * Providers:
 *   - Workspace.tsx  → registers addTab()
 *   - IfcViewer.tsx  → registers captureView3D()
 *
 * Consumers:
 *   - Toolbar/AppShell → calls addTab()
 *   - OutputPanel      → calls captureView3D()
 */

import { create } from 'zustand';

export type TabType = '2d' | '3d' | 'charts' | 'results' | 'foundation-design';

type AddTabFn = (type: TabType, slot?: 'left' | 'right') => void;
type CaptureView3DFn = () => string | null;

interface WorkspaceStore {
  /** Function to add a tab — registered by Workspace on mount */
  addTab: AddTabFn | null;
  registerAddTab: (fn: AddTabFn) => void;
  unregisterAddTab: () => void;

  /** Function to capture the 3D view — registered by IfcViewer when ready */
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
