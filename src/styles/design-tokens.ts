/**
 * Design tokens for Revit-style engineering UI.
 * Solid grays + red accents, no gradients.
 */

export const colors = {
  // Backgrounds
  bg: '#2d2d2d',
  bgPanel: '#3c3c3c',
  bgPanelHeader: '#2a2a2a',
  bgToolbar: '#333333',
  bgInput: '#353535',
  bgWorkspace: '#252525',
  bgTab: '#383838',
  bgTabActive: '#2d2d2d',
  bgHover: '#454545',

  // Borders
  border: '#505050',
  borderLight: '#5a5a5a',
  borderFocus: '#c0392b',

  // Text
  text: '#e0e0e0',
  textSecondary: '#999999',
  textMuted: '#707070',
  textWhite: '#ffffff',

  // Accent — Red
  accent: '#c0392b',
  accentHover: '#e74c3c',
  accentDark: '#a93226',
  accentBg: 'rgba(192, 57, 43, 0.15)',

  // Semantic
  success: '#27ae60',
  warning: '#f39c12',
  error: '#e74c3c',
  info: '#2980b9',

  // 3D viewer
  water: '#3498db',
  foundation: '#7f8c8d',
} as const;

export const spacing = {
  xs: '2px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  xxl: '24px',
} as const;

export const font = {
  family: "'Segoe UI', 'Roboto', system-ui, -apple-system, sans-serif",
  mono: "'Consolas', 'Courier New', monospace",
  sizeXs: '10px',
  sizeSm: '11px',
  sizeMd: '12px',
  sizeLg: '13px',
  sizeXl: '14px',
} as const;

// Panel default sizes
export const layout = {
  toolbarHeight: 40,
  statusBarHeight: 24,
  panelMinWidth: 48,
  leftPanelDefault: 300,
  rightPanelDefault: 320,
  tabHeight: 28,
} as const;
