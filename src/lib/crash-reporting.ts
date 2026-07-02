/**
 * Crash Reporting System — Anonymous error tracking and reporting.
 *
 * Features: Crash capture, exception logging, opt-in reporting
 * Privacy: No sensitive data, anonymous by default
 */

import { getAnalyticsEngine } from './analytics-phase9';

// ============== TYPES ==============

export interface CrashReport {
  id: string;
  timestamp: number;
  type: 'crash' | 'exception' | 'error' | 'warning';
  message: string;
  stack?: string;
  component?: string;
  context: CrashContext;
  deviceInfo: DeviceInfo;
  recovered: boolean;
}

export interface CrashContext {
  route?: string;
  action?: string;
  projectId?: string;
  conversationId?: string;
  connectorId?: string;
  metadata: Record<string, unknown>;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  version: string;
  extensionVersion: string;
  memory: number;
  viewport: string;
  language: string;
}

export interface CrashReportingConfig {
  enabled: boolean;
  sendAutomatically: boolean;
  includeDeviceInfo: boolean;
  includeContext: boolean;
  maxReports: number;
}

// ============== CRASH REPORTING SERVICE ==============

class CrashReportingService {
  private config: CrashReportingConfig = {
    enabled: true,
    sendAutomatically: false, // Must opt-in
    includeDeviceInfo: true,
    includeContext: true,
    maxReports: 100,
  };

  private reports: CrashReport[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load stored reports
    await this.loadReports();

    // Setup global error handlers
    this.setupErrorHandlers();

    this.initialized = true;
  }

  private setupErrorHandlers(): void {
    // Handle uncaught exceptions
    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        type: 'crash',
        context: { metadata: { filename: event.filename, line: event.lineno } },
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason)),
        { type: 'crash', context: { metadata: { source: 'unhandledrejection' } } }
      );
    });

    // Handle React errors (if available)
    if (typeof window !== 'undefined') {
      const originalConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        // Extract React error info if present
        if (args.length > 0 && typeof args[0] === 'string') {
          const msg = args[0];
          if (msg.includes('Error:') || msg.includes('Warning:')) {
            this.captureMessage(msg, 'error', { metadata: {} });
          }
        }
        originalConsoleError.apply(console, args);
      };
    }
  }

  // ============== PUBLIC METHODS ==============

  /**
   * Capture an exception
   */
  captureException(
    error: Error,
    options: {
      type?: 'crash' | 'exception' | 'error';
      component?: string;
      context?: Partial<CrashContext>;
    } = {}
  ): string {
    if (!this.config.enabled) return '';

    const report: CrashReport = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: options.type || 'exception',
      message: error.message,
      stack: this.sanitizeStack(error.stack),
      component: options.component,
      context: {
        ...options.context,
        metadata: options.context?.metadata || {},
      } as CrashContext,
      deviceInfo: this.config.includeDeviceInfo ? this.getDeviceInfo() : this.getEmptyDeviceInfo(),
      recovered: false,
    };

    this.addReport(report);

    // Track with analytics
    try {
      const analytics = getAnalyticsEngine();
      analytics.track('error_occurred' as any, {
        type: report.type,
        message: report.message.slice(0, 100),
        component: report.component,
      });
    } catch {
      // Ignore analytics errors
    }

    return report.id;
  }

  /**
   * Capture a message
   */
  captureMessage(
    message: string,
    level: 'error' | 'warning' | 'info',
    context: Partial<CrashContext>
  ): string {
    if (!this.config.enabled) return '';

    const report: CrashReport = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'error',
      message,
      context: {
        ...context,
        metadata: context.metadata || {},
      } as CrashContext,
      deviceInfo: this.config.includeDeviceInfo ? this.getDeviceInfo() : this.getEmptyDeviceInfo(),
      recovered: false,
    };

    this.addReport(report);

    return report.id;
  }

  /**
   * Get all crash reports
   */
  getReports(): CrashReport[] {
    return [...this.reports].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get recent reports
   */
  getRecentReports(hours = 24): CrashReport[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.reports.filter((r) => r.timestamp > cutoff);
  }

  /**
   * Clear all reports
   */
  clearReports(): void {
    this.reports = [];
    this.saveReports();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CrashReportingConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveReports();
  }

  /**
   * Get current configuration
   */
  getConfig(): CrashReportingConfig {
    return { ...this.config };
  }

  /**
   * Mark a report as recovered
   */
  markRecovered(reportId: string): void {
    const report = this.reports.find((r) => r.id === reportId);
    if (report) {
      report.recovered = true;
      this.saveReports();
    }
  }

  /**
   * Export reports for debugging
   */
  exportReports(): string {
    return JSON.stringify({
      version: '1.0',
      exported: new Date().toISOString(),
      reports: this.reports,
    }, null, 2);
  }

  // ============== INTERNAL ==============

  private addReport(report: CrashReport): void {
    this.reports.unshift(report);

    // Trim if over limit
    if (this.reports.length > this.config.maxReports) {
      this.reports = this.reports.slice(0, this.config.maxReports);
    }

    this.saveReports();
  }

  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // Remove potentially sensitive paths
    return stack
      .replace(/\/Users\/[^/]+/g, '/Users/[user]')
      .replace(/\/home\/[^/]+/g, '/home/[user]')
      .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\[user]')
      .split('\n')
      .slice(0, 20)
      .join('\n');
  }

  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';

    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return {
      browser,
      os,
      version: browser === 'Chrome' ? ua.match(/Chrome\/(\d+)/)?.[1] || '0' : '0',
      extensionVersion: '1.0.0', // Would read from manifest
      memory: (performance as any).memory?.usedJSHeapSize || 0,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
    };
  }

  private getEmptyDeviceInfo(): DeviceInfo {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      version: '0',
      extensionVersion: '0',
      memory: 0,
      viewport: '0x0',
      language: 'en',
    };
  }

  private async loadReports(): Promise<void> {
    try {
      const stored = localStorage.getItem('omni_crash_reports');
      if (stored) {
        this.reports = JSON.parse(stored);
      }
    } catch {
      this.reports = [];
    }
  }

  private saveReports(): void {
    try {
      localStorage.setItem('omni_crash_reports', JSON.stringify(this.reports));
    } catch (err) {
      console.warn('Failed to save crash reports:', err);
    }
  }
}

// ============== SINGLETON ==============

let _crashReporting: CrashReportingService | null = null;

export function getCrashReporting(): CrashReportingService {
  if (!_crashReporting) {
    _crashReporting = new CrashReportingService();
    _crashReporting.initialize();
  }
  return _crashReporting;
}

// ============== CONVENIENCE FUNCTIONS ==============

export function captureException(
  error: Error,
  options?: {
    type?: 'crash' | 'exception' | 'error';
    component?: string;
    context?: Partial<CrashContext>;
  }
): string {
  return getCrashReporting().captureException(error, options);
}

export function captureMessage(
  message: string,
  level: 'error' | 'warning' | 'info',
  context: Partial<CrashContext>
): string {
  return getCrashReporting().captureMessage(message, level, context);
}

// ============== REACT ERROR BOUNDARY ==============

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const reportId = captureException(error, {
      type: 'crash',
      component: errorInfo.componentStack?.split('\n')[1]?.trim(),
      context: {
        metadata: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    this.props.onError?.(error, errorInfo);

    console.error('Error caught by boundary:', error, errorInfo, reportId);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">
            Something went wrong
          </h2>
          <p className="text-slate-400 mb-6">
            An error occurred. The issue has been logged.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============== REACT HOOK ==============

import { useState, useEffect, useCallback } from 'react';

export function useCrashReporting() {
  const [reports, setReports] = useState<CrashReport[]>([]);
  const [config, setConfig] = useState<CrashReportingConfig | null>(null);

  const service = getCrashReporting();

  useEffect(() => {
    setReports(service.getReports());
    setConfig(service.getConfig());
  }, [service]);

  const updateConfig = useCallback((newConfig: Partial<CrashReportingConfig>) => {
    service.setConfig(newConfig);
    setConfig(service.getConfig());
  }, [service]);

  const clearReports = useCallback(() => {
    service.clearReports();
    setReports([]);
  }, [service]);

  return {
    reports,
    config,
    updateConfig,
    clearReports,
    captureException,
    captureMessage,
    exportReports: service.exportReports.bind(service),
  };
}
