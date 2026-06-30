import type { UUID, Timestamp } from "../types/omni";

/**
 * Settings — User preferences and configuration.
 *
 * All settings are typed and versioned for future migrations.
 */

export interface Settings {
  id: UUID;
  version: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  appearance: AppearanceSettings;
  keyboard: KeyboardSettings;
  storage: StorageSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  experimental: ExperimentalSettings;
  developer: DeveloperSettings;
}

export interface AppearanceSettings {
  theme: "dark" | "light" | "system";
  accentColor: string;
  fontSize: "sm" | "md" | "lg";
  fontFamily: "system" | "sans" | "serif" | "mono";
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  animationsEnabled: boolean;
  glassmorphismEnabled: boolean;
  density: "compact" | "comfortable" | "spacious";
  borderRadius: "sm" | "md" | "lg";
}

export interface KeyboardSettings {
  openPanel: string; // e.g. "Ctrl+Shift+O"
  captureTab: string;
  search: string;
  newProject: string;
  quickTransfer: string;
  toggleTheme: string;
  openSettings: string;
  goBack: string;
  customShortcuts: Record<string, string>;
}

export interface StorageSettings {
  backend: "chrome" | "indexeddb" | "memory";
  autoBackup: boolean;
  backupInterval: number; // hours
  maxBackups: number;
  cacheSize: number; // MB
  clearOnExit: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  rateLimitAlerts: boolean;
  transferComplete: boolean;
  connectorErrors: boolean;
  desktopNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string; // "07:00"
  };
}

export interface PrivacySettings {
  analyticsEnabled: boolean;
  errorReporting: boolean;
  cloudSync: boolean;
  maskApiKeys: boolean;
  autoClearClipboard: boolean;
  conversationRetention: number; // days
}

export interface ExperimentalSettings {
  aiComparison: boolean;
  smartRouting: boolean;
  advancedSearch: boolean;
  betaConnectors: boolean;
  performanceProfiler: boolean;
}

export interface DeveloperSettings {
  debugMode: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  showEngineStats: boolean;
  enableTestMode: boolean;
  mockData: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  id: crypto.randomUUID(),
  version: "1.0.0",
  createdAt: Date.now(),
  updatedAt: Date.now(),
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
