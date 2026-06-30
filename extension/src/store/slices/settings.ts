/**
 * Settings Slice — Reactive state for all user settings.
 */

export interface SettingsSlice {
  version: string;
  appearance: AppearanceState;
  keyboard: KeyboardState;
  storage: StorageState;
  notifications: NotificationState;
  privacy: PrivacyState;
  experimental: ExperimentalState;
  developer: DeveloperState;
}

export interface AppearanceState {
  theme: "dark" | "light" | "system";
  accentColor: string;
  fontSize: string;
  fontFamily: string;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  animationsEnabled: boolean;
  glassmorphismEnabled: boolean;
  density: string;
  borderRadius: string;
}

export interface KeyboardState {
  openPanel: string;
  captureTab: string;
  search: string;
  newProject: string;
  quickTransfer: string;
  toggleTheme: string;
  openSettings: string;
  goBack: string;
  customShortcuts: Record<string, string>;
}

export interface StorageState {
  backend: string;
  autoBackup: boolean;
  backupInterval: number;
  maxBackups: number;
  cacheSize: number;
  clearOnExit: boolean;
}

export interface NotificationState {
  enabled: boolean;
  sound: boolean;
  rateLimitAlerts: boolean;
  transferComplete: boolean;
  connectorErrors: boolean;
  desktopNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export interface PrivacyState {
  analyticsEnabled: boolean;
  errorReporting: boolean;
  cloudSync: boolean;
  maskApiKeys: boolean;
  autoClearClipboard: boolean;
  conversationRetention: number;
}

export interface ExperimentalState {
  aiComparison: boolean;
  smartRouting: boolean;
  advancedSearch: boolean;
  betaConnectors: boolean;
  performanceProfiler: boolean;
}

export interface DeveloperState {
  debugMode: boolean;
  logLevel: string;
  showEngineStats: boolean;
  enableTestMode: boolean;
  mockData: boolean;
}

export const initialSettingsSlice: SettingsSlice = {
  version: "1.0.0",
  appearance: {
    theme: "system",
    accentColor: "#7c3aed",
    fontSize: "md",
    fontFamily: "system",
    sidebarCollapsed: false,
    sidebarWidth: 280,
    animationsEnabled: true,
    glassmorphismEnabled: true,
    density: "comfortable",
    borderRadius: "md",
  },
  keyboard: {
    openPanel: "Ctrl+Shift+O",
    captureTab: "Ctrl+Shift+C",
    search: "Ctrl+K",
    newProject: "Ctrl+Shift+N",
    quickTransfer: "Ctrl+Shift+T",
    toggleTheme: "Ctrl+Shift+L",
    openSettings: "Ctrl+,",
    goBack: "Alt+Left",
    customShortcuts: {},
  },
  storage: {
    backend: "chrome",
    autoBackup: true,
    backupInterval: 24,
    maxBackups: 7,
    cacheSize: 50,
    clearOnExit: false,
  },
  notifications: {
    enabled: true,
    sound: false,
    rateLimitAlerts: true,
    transferComplete: true,
    connectorErrors: true,
    desktopNotifications: false,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
  },
  privacy: {
    analyticsEnabled: true,
    errorReporting: true,
    cloudSync: false,
    maskApiKeys: true,
    autoClearClipboard: false,
    conversationRetention: 30,
  },
  experimental: {
    aiComparison: false,
    smartRouting: false,
    advancedSearch: false,
    betaConnectors: false,
    performanceProfiler: false,
  },
  developer: {
    debugMode: false,
    logLevel: "warn",
    showEngineStats: false,
    enableTestMode: false,
    mockData: false,
  },
};
