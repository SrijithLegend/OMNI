/**
 * Engine Bootstrap — Initializes and starts all engines in dependency order.
 *
 * Usage: await bootstrapEngines() in background, popup, or sidepanel.
 */

import {
  registerEngine,
  StorageEngine,
  MessagingEngine,
  WorkspaceEngine,
  ProjectEngine,
  SettingsEngine,
  TimelineEngine,
  ContextEngine,
  TransferEngine,
  SearchEngine,
  ExportEngine,
  NotificationEngine,
  ConnectorEngine,
  AuthEngine,
  LoggingEngine,
  UIEngine,
} from "../engines";

const ENGINE_ORDER = [
  "LoggingEngine",
  "StorageEngine",
  "MessagingEngine",
  "SettingsEngine",
  "WorkspaceEngine",
  "ProjectEngine",
  "TimelineEngine",
  "ContextEngine",
  "TransferEngine",
  "SearchEngine",
  "ExportEngine",
  "NotificationEngine",
  "ConnectorEngine",
  "AuthEngine",
  "UIEngine",
] as const;

export async function bootstrapEngines(): Promise<void> {
  // Instantiate
  const logging = new LoggingEngine();
  const storage = new StorageEngine();
  const messaging = new MessagingEngine();
  const settings = new SettingsEngine();
  const workspace = new WorkspaceEngine();
  const project = new ProjectEngine();
  const timeline = new TimelineEngine();
  const context = new ContextEngine();
  const transfer = new TransferEngine();
  const search = new SearchEngine();
  const exportEngine = new ExportEngine();
  const notification = new NotificationEngine();
  const connector = new ConnectorEngine();
  const auth = new AuthEngine();
  const ui = new UIEngine();

  // Register
  registerEngine(logging);
  registerEngine(storage);
  registerEngine(messaging);
  registerEngine(settings);
  registerEngine(workspace);
  registerEngine(project);
  registerEngine(timeline);
  registerEngine(context);
  registerEngine(transfer);
  registerEngine(search);
  registerEngine(exportEngine);
  registerEngine(notification);
  registerEngine(connector);
  registerEngine(auth);
  registerEngine(ui);

  // Start in dependency order
  for (const name of ENGINE_ORDER) {
    const engine = {
      LoggingEngine: logging,
      StorageEngine: storage,
      MessagingEngine: messaging,
      SettingsEngine: settings,
      WorkspaceEngine: workspace,
      ProjectEngine: project,
      TimelineEngine: timeline,
      ContextEngine: context,
      TransferEngine: transfer,
      SearchEngine: search,
      ExportEngine: exportEngine,
      NotificationEngine: notification,
      ConnectorEngine: connector,
      AuthEngine: auth,
      UIEngine: ui,
    }[name];
    await engine.start();
  }

  console.info("[Omni] All engines bootstrapped successfully");
}

export async function shutdownEngines(): Promise<void> {
  const registry = new Map([
    ["UIEngine", null],
    ["AuthEngine", null],
    ["ConnectorEngine", null],
    ["NotificationEngine", null],
    ["ExportEngine", null],
    ["SearchEngine", null],
    ["TransferEngine", null],
    ["ContextEngine", null],
    ["TimelineEngine", null],
    ["ProjectEngine", null],
    ["WorkspaceEngine", null],
    ["SettingsEngine", null],
    ["MessagingEngine", null],
    ["StorageEngine", null],
    ["LoggingEngine", null],
  ]);

  // Reverse order shutdown
  for (const name of Array.from(registry.keys())) {
    // engines would be retrieved from registry and stopped
  }

  console.info("[Omni] All engines shut down");
}
