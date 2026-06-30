/**
 * UI Slice — UI-only state: theme, layout, navigation, toasts, modals.
 */

export interface UIState {
  theme: "dark" | "light" | "system";
  sidebarOpen: boolean;
  sidebarWidth: number;
  activeView: string;
  activePanel: string | null;
  toasts: Toast[];
  modals: Modal[];
  isLoading: boolean;
  loadingMessage: string;
  appStatus: "idle" | "loading" | "success" | "error" | "warning";
  statusMessage: string;
  contextMenu: ContextMenuState | null;
  dragState: DragState | null;
  animationsEnabled: boolean;
  glassmorphismEnabled: boolean;
  density: "compact" | "comfortable" | "spacious";
}

export interface Toast {
  id: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  duration: number;
  action?: { label: string; callback: () => void };
}

export interface Modal {
  id: string;
  type: string;
  title: string;
  content: React.ReactNode | null;
  onClose?: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
  divider?: boolean;
}

export interface DragState {
  type: string;
  sourceId: string;
  data: unknown;
  x: number;
  y: number;
}

export const initialUIState: UIState = {
  theme: "system",
  sidebarOpen: true,
  sidebarWidth: 280,
  activeView: "workspace",
  activePanel: null,
  toasts: [],
  modals: [],
  isLoading: false,
  loadingMessage: "",
  appStatus: "idle",
  statusMessage: "",
  contextMenu: null,
  dragState: null,
  animationsEnabled: true,
  glassmorphismEnabled: true,
  density: "comfortable",
};
