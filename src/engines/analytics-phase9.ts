/**
 * Analytics Engine — Privacy-first analytics for Omni.
 *
 * Features: Local analytics, optional cloud sync, feature usage tracking
 * Privacy: Never captures conversation contents or sensitive information
 */

import { BaseEngine } from "./base";

// ============== TYPES ==============

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  properties: Record<string, unknown>;
  sessionId: string;
  deviceId: string;
}

export type AnalyticsEventType =
  | 'app_start'
  | 'app_stop'
  | 'project_created'
  | 'project_deleted'
  | 'project_archived'
  | 'conversation_captured'
  | 'conversation_viewed'
  | 'conversation_exported'
  | 'ai_switch_initiated'
  | 'ai_switch_completed'
  | 'ai_switch_failed'
  | 'search_performed'
  | 'search_result_clicked'
  | 'note_created'
  | 'note_updated'
  | 'note_deleted'
  | 'task_created'
  | 'task_completed'
  | 'task_deleted'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'file_deleted'
  | 'snippet_created'
  | 'clipboard_item_added'
  | 'connector_connected'
  | 'connector_disconnected'
  | 'connector_sync_started'
  | 'connector_sync_completed'
  | 'connector_sync_failed'
  | 'cloud_sync_started'
  | 'cloud_sync_completed'
  | 'cloud_sync_failed'
  | 'backup_created'
  | 'backup_restored'
  | 'cloud_storage_used'
  | 'feature_used'
  | 'keyboard_shortcut_used'
  | 'command_palette_opened'
  | 'settings_changed'
  | 'theme_changed'
  | 'subscription_started'
  | 'subscription_canceled'
  | 'subscription_upgraded'
  | 'subscription_downgraded'
  | 'error_occurred'
  | 'crash_occurred'
  | 'performance_metric';

export interface UsageStats {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  projectsCreated: number;
  conversationsCaptured: number;
  searchesPerformed: number;
  aiSwitches: number;
  connectorUsage: Record<string, number>;
  syncFrequency: number;
  featureUsage: Record<string, number>;
  crashFrequency: number;
  averagePerformanceMetrics: PerformanceMetrics;
}

export interface PerformanceMetrics {
  appStartupTime: number;
  searchLatency: number;
  syncLatency: number;
  captureLatency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface DailyMetrics {
  date: string;
  sessions: number;
  projectsCreated: number;
  conversationsCaptured: number;
  searches: number;
  aiSwitches: number;
  syncs: number;
  errors: number;
}

export interface AnalyticsState {
  enabled: boolean;
  cloudEnabled: boolean;
  sessionId: string;
  deviceId: string;
  userId: string | null;
}

// ============== ENGINE ==============

export class AnalyticsEngine extends BaseEngine {
  private state: AnalyticsState;
  private events: AnalyticsEvent[] = [];
  private dailyMetrics: DailyMetrics[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];
  private maxLocalEvents = 1000;
  private maxDailyMetrics = 90; // 3 months
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ name: "AnalyticsEngine", version: "1.0.0", debug: false });

    this.state = {
      enabled: true,
      cloudEnabled: false,
      sessionId: crypto.randomUUID(),
      deviceId: this.getOrCreateDeviceId(),
      userId: null,
    };
  }

  async start(): Promise<void> {
    // Load persisted data
    await this.loadFromStorage();

    // Track app start
    this.track('app_start', { startupTime: performance.now() });

    // Setup periodic flush
    this.flushInterval = setInterval(() => {
      this.flush().catch((err) => this.log("warn", "Flush failed", err));
    }, 60000); // Every minute

    this.isRunning = true;
    this.emit("ready");
  }

  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Track app stop
    this.track('app_stop', { uptime: performance.now() });

    // Final flush
    await this.flush();
    await this.saveToStorage();

    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    return {
      ok: true,
      message: `Analytics: ${this.events.length} events buffered`,
      timestamp: Date.now(),
    };
  }

  // ============== CORE METHODS ==============

  /**
   * Track an analytics event
   */
  track(type: AnalyticsEventType, properties: Record<string, unknown> = {}): void {
    if (!this.state.enabled) return;

    // Sanitize - ensure no sensitive data
    const sanitized = this.sanitizeProperties(properties);

    const event: AnalyticsEvent = {
      type,
      timestamp: Date.now(),
      properties: sanitized,
      sessionId: this.state.sessionId,
      deviceId: this.state.deviceId,
    };

    this.events.push(event);

    // Update daily metrics
    this.updateDailyMetrics(type);

    // Trim if needed
    if (this.events.length > this.maxLocalEvents) {
      this.events = this.events.slice(-this.maxLocalEvents);
    }

    this.emit('event', event);
  }

  /**
   * Track a performance metric
   */
  trackPerformance(metric: Partial<PerformanceMetrics>): void {
    if (!this.state.enabled) return;

    this.performanceMetrics.push({
      appStartupTime: metric.appStartupTime || 0,
      searchLatency: metric.searchLatency || 0,
      syncLatency: metric.syncLatency || 0,
      captureLatency: metric.captureLatency || 0,
      memoryUsage: metric.memoryUsage || 0,
      cpuUsage: metric.cpuUsage || 0,
    });

    // Keep last 100 samples
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics = this.performanceMetrics.slice(-100);
    }
  }

  /**
   * Enable or disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.saveToStorage();
    this.emit('settings-changed', { enabled });
  }

  /**
   * Enable or disable cloud sync of analytics
   */
  setCloudEnabled(enabled: boolean): void {
    this.state.cloudEnabled = enabled;
    this.saveToStorage();
    this.emit('settings-changed', { cloudEnabled: enabled });
  }

  // ============== QUERY METHODS ==============

  /**
   * Get usage statistics
   */
  getUsageStats(): UsageStats {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;
    const month = 30 * day;

    const recentEvents = this.events.filter((e) => e.timestamp > now - month);

    return {
      dailyActiveUsers: this.countUniqueDays(recentEvents, day),
      weeklyActiveUsers: this.countUniqueDays(recentEvents, week),
      monthlyActiveUsers: this.countUniqueDays(recentEvents, month),
      projectsCreated: this.countEvents(recentEvents, 'project_created'),
      conversationsCaptured: this.countEvents(recentEvents, 'conversation_captured'),
      searchesPerformed: this.countEvents(recentEvents, 'search_performed'),
      aiSwitches: this.countEvents(recentEvents, 'ai_switch_completed'),
      connectorUsage: this.groupByProperty(recentEvents.filter((e) =>
        e.type === 'connector_connected'), 'connector'),
      syncFrequency: this.countEvents(recentEvents, 'cloud_sync_completed'),
      featureUsage: this.groupByProperty(recentEvents.filter((e) =>
        e.type === 'feature_used'), 'feature'),
      crashFrequency: this.countEvents(recentEvents, 'crash_occurred'),
      averagePerformanceMetrics: this.getAveragePerformance(),
    };
  }

  /**
   * Get daily metrics for the last N days
   */
  getDailyMetrics(days = 30): DailyMetrics[] {
    return this.dailyMetrics.slice(-days);
  }

  /**
   * Get feature usage breakdown
   */
  getFeatureUsage(): Record<string, number> {
    const featureEvents = this.events.filter((e) => e.type === 'feature_used');
    return this.groupByProperty(featureEvents, 'feature');
  }

  /**
   * Get error summary
   */
  getErrorSummary(): { total: number; types: Record<string, number> } {
    const errors = this.events.filter((e) =>
      e.type === 'error_occurred' || e.type === 'crash_occurred'
    );

    const types: Record<string, number> = {};
    for (const error of errors) {
      const errorType = String(error.properties['type'] || 'unknown');
      types[errorType] = (types[errorType] || 0) + 1;
    }

    return { total: errors.length, types };
  }

  // ============== INTERNAL ==============

  private sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['email', 'password', 'token', 'key', 'secret', 'content', 'message', 'prompt'];

    for (const [key, value] of Object.entries(properties)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some((s) => lowerKey.includes(s));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.slice(0, 500) + '...[truncated]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private updateDailyMetrics(eventType: AnalyticsEventType): void {
    const today = new Date().toISOString().split('T')[0];
    let metrics = this.dailyMetrics.find((m) => m.date === today);

    if (!metrics) {
      metrics = {
        date: today,
        sessions: 0,
        projectsCreated: 0,
        conversationsCaptured: 0,
        searches: 0,
        aiSwitches: 0,
        syncs: 0,
        errors: 0,
      };
      this.dailyMetrics.push(metrics);

      // Trim old metrics
      if (this.dailyMetrics.length > this.maxDailyMetrics) {
        this.dailyMetrics = this.dailyMetrics.slice(-this.maxDailyMetrics);
      }
    }

    switch (eventType) {
      case 'app_start':
        metrics.sessions++;
        break;
      case 'project_created':
        metrics.projectsCreated++;
        break;
      case 'conversation_captured':
        metrics.conversationsCaptured++;
        break;
      case 'search_performed':
        metrics.searches++;
        break;
      case 'ai_switch_completed':
        metrics.aiSwitches++;
        break;
      case 'cloud_sync_completed':
        metrics.syncs++;
        break;
      case 'error_occurred':
      case 'crash_occurred':
        metrics.errors++;
        break;
    }
  }

  private countEvents(events: AnalyticsEvent[], type: AnalyticsEventType): number {
    return events.filter((e) => e.type === type).length;
  }

  private countUniqueDays(events: AnalyticsEvent[], duration: number): number {
    const now = Date.now();
    const recentEvents = events.filter((e) => e.timestamp > now - duration);
    const days = new Set(recentEvents.map((e) =>
      new Date(e.timestamp).toISOString().split('T')[0]
    ));
    return days.size;
  }

  private groupByProperty(events: AnalyticsEvent[], property: string): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const event of events) {
      const value = String(event.properties[property] || 'unknown');
      counts[value] = (counts[value] || 0) + 1;
    }

    return counts;
  }

  private getAveragePerformance(): PerformanceMetrics {
    if (this.performanceMetrics.length === 0) {
      return {
        appStartupTime: 0,
        searchLatency: 0,
        syncLatency: 0,
        captureLatency: 0,
        memoryUsage: 0,
        cpuUsage: 0,
      };
    }

    const sum = this.performanceMetrics.reduce(
      (acc, m) => ({
        appStartupTime: acc.appStartupTime + m.appStartupTime,
        searchLatency: acc.searchLatency + m.searchLatency,
        syncLatency: acc.syncLatency + m.syncLatency,
        captureLatency: acc.captureLatency + m.captureLatency,
        memoryUsage: acc.memoryUsage + m.memoryUsage,
        cpuUsage: acc.cpuUsage + m.cpuUsage,
      }),
      { appStartupTime: 0, searchLatency: 0, syncLatency: 0, captureLatency: 0, memoryUsage: 0, cpuUsage: 0 }
    );

    const count = this.performanceMetrics.length;
    return {
      appStartupTime: sum.appStartupTime / count,
      searchLatency: sum.searchLatency / count,
      syncLatency: sum.syncLatency / count,
      captureLatency: sum.captureLatency / count,
      memoryUsage: sum.memoryUsage / count,
      cpuUsage: sum.cpuUsage / count,
    };
  }

  private getOrCreateDeviceId(): string {
    const stored = localStorage.getItem('omni_device_id');
    if (stored) return stored;

    const id = crypto.randomUUID();
    localStorage.setItem('omni_device_id', id);
    return id;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('omni_analytics');
      if (stored) {
        const data = JSON.parse(stored);
        this.events = data.events || [];
        this.dailyMetrics = data.dailyMetrics || [];
        this.state.enabled = data.enabled ?? true;
        this.state.cloudEnabled = data.cloudEnabled ?? false;
      }
    } catch (err) {
      this.log("warn", "Failed to load analytics from storage", err);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      const data = {
        events: this.events,
        dailyMetrics: this.dailyMetrics,
        enabled: this.state.enabled,
        cloudEnabled: this.state.cloudEnabled,
      };
      localStorage.setItem('omni_analytics', JSON.stringify(data));
    } catch (err) {
      this.log("warn", "Failed to save analytics to storage", err);
    }
  }

  private async flush(): Promise<void> {
    if (!this.state.cloudEnabled || this.events.length === 0) return;

    // In a real implementation, this would send to a cloud analytics service
    // For now, we just save locally
    await this.saveToStorage();
  }
}

// ============== SINGLETON ==============

let _instance: AnalyticsEngine | null = null;

export function getAnalyticsEngine(): AnalyticsEngine {
  if (!_instance) {
    _instance = new AnalyticsEngine();
  }
  return _instance;
}

// ============== REACT HOOK ==============

import { useState, useEffect, useCallback } from 'react';

export function useAnalytics() {
  const [state, setState] = useState({
    enabled: true,
    cloudEnabled: false,
    usageStats: null as UsageStats | null,
  });

  const engine = getAnalyticsEngine();

  useEffect(() => {
    setState({
      enabled: engine['state'].enabled,
      cloudEnabled: engine['state'].cloudEnabled,
      usageStats: engine.getUsageStats(),
    });
  }, [engine]);

  const track = useCallback(
    (type: AnalyticsEventType, properties?: Record<string, unknown>) =>
      engine.track(type, properties),
    [engine]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => engine.setEnabled(enabled),
    [engine]
  );

  const setCloudEnabled = useCallback(
    (enabled: boolean) => engine.setCloudEnabled(enabled),
    [engine]
  );

  return {
    ...state,
    track,
    setEnabled,
    setCloudEnabled,
  };
}
