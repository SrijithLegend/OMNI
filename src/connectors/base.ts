/**
 * Base Connector — Abstract base class for all external platform connectors.
 *
 * Every connector must inherit from this class and implement all required methods.
 * The connector engine provides lifecycle management, error handling, and sync orchestration.
 */

import type {
  ConnectorType,
  ConnectorCategory,
  ConnectorCapabilities,
  ConnectorMetadata,
  ConnectorConstructorMetadata,
  ConnectorConfig,
  ConnectorItem,
  ConnectorItemList,
  ConnectorFilter,
  ConnectorSearchQuery,
  ConnectorSearchResult,
  OAuthToken,
  OAuthConfig,
  ConnectorError,
  ConnectorErrorCode,
  SyncJob,
  ConnectionStatus,
  HealthStatus,
} from './types';

// ============== ABSTRACT BASE CLASS ==============

export abstract class BaseConnector {
  readonly type: ConnectorType;
  readonly category: ConnectorCategory;
  readonly name: string;
  readonly version: string;

  protected config: ConnectorConfig;
  protected token: OAuthToken | null = null;
  protected connectionStatus: ConnectionStatus = 'disconnected';
  protected lastSyncAt: number | null = null;
  protected lastError: ConnectorError | null = null;

  private eventListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(metadata: ConnectorMetadata | ConnectorConstructorMetadata, config?: Partial<ConnectorConfig>) {
    this.type = metadata.type;
    this.category = metadata.category;
    this.name = metadata.name;
    this.version = metadata.version;
    this.config = { ...DEFAULT_CONNECTOR_CONFIG, ...config };
  }

  // ============== REQUIRED METHODS (Abstract) ==============

  /**
   * Connect to the external service.
   * Returns true if connection was successful.
   */
  abstract connect(credentials?: Record<string, unknown>): Promise<boolean>;

  /**
   * Disconnect from the external service.
   * Should clean up all resources and invalidate tokens.
   */
  abstract disconnect(): Promise<void>;

  /**
   * Authenticate with the external service.
   * For OAuth connectors, this completes the OAuth flow.
   */
  abstract authenticate(authCode?: string): Promise<boolean>;

  /**
   * Refresh the authentication token.
   * For OAuth connectors, this uses the refresh token.
   */
  abstract refresh(): Promise<boolean>;

  /**
   * Perform a synchronization.
   * May be full sync, incremental, or delta depending on params.
   */
  abstract sync(params?: Record<string, unknown>): Promise<SyncJob>;

  /**
   * Search for items in the connected service.
   */
  abstract search(query: ConnectorSearchQuery): Promise<ConnectorSearchResult>;

  /**
   * Read a specific item by ID.
   */
  abstract read(itemId: string): Promise<ConnectorItem | null>;

  /**
   * Write/create an item (if connector supports writes).
   * Default implementation throws not supported error.
   */
  async write(_item: Partial<ConnectorItem>): Promise<ConnectorItem> {
    throw this.createError('permission_denied', 'Write operations not supported');
  }

  /**
   * Get the current connection status.
   */
  abstract status(): Promise<ConnectionStatus>;

  /**
   * Get the permissions granted by the user.
   */
  abstract permissions(): Promise<string[]>;

  /**
   * Check the health of the connector.
   */
  abstract health(): Promise<HealthStatus>;

  /**
   * Get connector metadata.
   */
  abstract metadata(): ConnectorMetadata;

  // ============== OAUTH METHODS ==============

  /**
   * Get the OAuth authorization URL.
   * Only applicable for OAuth connectors.
   */
  async getOAuthUrl(_state: string): Promise<string> {
    throw this.createError('auth_invalid', 'OAuth not supported by this connector');
  }

  /**
   * Handle OAuth callback.
   * Only applicable for OAuth connectors.
   */
  async handleOAuthCallback(_code: string, _state: string): Promise<OAuthToken> {
    throw this.createError('auth_invalid', 'OAuth not supported by this connector');
  }

  /**
   * Get the OAuth configuration.
   */
  getOAuthConfig(): OAuthConfig | undefined {
    return undefined;
  }

  // ============== LIST METHODS ==============

  /**
   * List items from the connector.
   * Default implementation searches with empty query.
   */
  async list(filter?: ConnectorFilter): Promise<ConnectorItemList> {
    const result = await this.search({
      query: '',
      filters: filter,
      pagination: filter?.parentId ? { limit: 100 } : undefined,
    });

    return {
      items: result.items,
      total: result.total,
      hasMore: result.hasMore,
    };
  }

  /**
   * List items of a specific type.
   */
  async listByType(itemType: string, parentId?: string): Promise<ConnectorItemList> {
    return this.list({
      itemTypes: [itemType as ConnectorItem['itemType']],
      parentId,
    });
  }

  // ============== VALIDATION ==============

  /**
   * Validate the connector configuration.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check required configuration
    const meta = this.metadata();

    if (!meta.displayName) {
      errors.push('Missing displayName');
    }

    if (!meta.version) {
      errors.push('Missing version');
    }

    // Check capabilities
    const caps = meta.capabilities;
    if (!caps.canRead && !caps.canWrite) {
      errors.push('Connector must support at least read or write');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate authentication state.
   */
  async validateAuth(): Promise<boolean> {
    const status = await this.status();
    return status === 'connected';
  }

  // ============== CLEANUP ==============

  /**
   * Clean up cached data.
   */
  async cleanup(): Promise<void> {
    this.lastError = null;
    this.emit('cleanup');
  }

  /**
   * Retry a failed operation.
   */
  async retry(): Promise<boolean> {
    if (!this.lastError) return false;
    if (!this.lastError.retryable) return false;

    try {
      const status = await this.status();
      if (status === 'connected') {
        await this.sync();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ============== CAPABILITIES ==============

  /**
   * Get the capabilities of this connector.
   */
  getCapabilities(): ConnectorCapabilities {
    return this.metadata().capabilities;
  }

  /**
   * Check if a capability is supported.
   */
  supports(capability: keyof ConnectorCapabilities): boolean {
    return this.getCapabilities()[capability] === true;
  }

  // ============== ERROR HANDLING ==============

  /**
   * Create a standardized error.
   */
  protected createError(
    code: ConnectorErrorCode,
    message: string,
    details?: Record<string, unknown>
  ): ConnectorError {
    const retryable = ['rate_limit_exceeded', 'timeout', 'network_error', 'server_error', 'service_unavailable'].includes(code);

    const error: ConnectorError = {
      code,
      message,
      details,
      retryable,
    };

    this.lastError = error;
    this.emit('error', error);

    return error;
  }

  /**
   * Get the last error.
   */
  getLastError(): ConnectorError | null {
    return this.lastError;
  }

  // ============== EVENT EMITTER ==============

  /**
   * Subscribe to connector events.
   */
  on(event: string, handler: (...args: unknown[]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event.
   */
  protected emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventListeners.get(event);
    if (!handlers) return;

    handlers.forEach((handler) => {
      try {
        handler(...args);
      } catch (err) {
        console.error(`[Connector:${this.type}] Event handler error:`, err);
      }
    });
  }

  // ============== UTILITY ==============

  /**
   * Get current configuration.
   */
  getConfig(): ConnectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<ConnectorConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  /**
   * Get the last sync timestamp.
   */
  getLastSyncAt(): number | null {
    return this.lastSyncAt;
  }

  /**
   * Set the last sync timestamp.
   */
  protected setLastSyncAt(timestamp: number): void {
    this.lastSyncAt = timestamp;
    this.emit('sync-completed', timestamp);
  }

  /**
   * Log a message.
   */
  protected log(level: 'info' | 'warn' | 'error' | 'debug', ...args: unknown[]): void {
    const prefix = `[${this.type} v${this.version}]`;
    switch (level) {
      case 'error':
        console.error(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'debug':
        if (import.meta.env.DEV) {
          console.debug(prefix, ...args);
        }
        break;
      default:
        console.info(prefix, ...args);
    }
  }
}

// ============== DEFAULTS ==============

const DEFAULT_CONNECTOR_CONFIG: ConnectorConfig = {
  syncInterval: 30,
  autoSync: true,
  syncOnStartup: true,
  cacheExpiry: 3600,
  maxCacheSize: 100 * 1024 * 1024,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  permissions: {
    read: true,
    write: false,
  },
  notifications: {
    onSync: false,
    onError: true,
  },
};

// ============== CONNECTOR REGISTRY TYPE ==============

export interface ConnectorConstructor {
  new (config?: Partial<ConnectorConfig>): BaseConnector;
}

export type ConnectorRegistry = Map<ConnectorType, ConnectorConstructor>;

// Re-export types for convenience
export type {
  ConnectorType,
  ConnectorCategory,
  ConnectorCapabilities,
  ConnectorMetadata,
  ConnectorConstructorMetadata,
  ConnectorConfig,
  ConnectorItem,
  ConnectorItemList,
  ConnectorFilter,
  ConnectorSearchQuery,
  ConnectorSearchResult,
  OAuthToken,
  OAuthConfig,
  ConnectorError,
  ConnectorErrorCode,
  SyncJob,
  ConnectionStatus,
  HealthStatus,
};

export { BaseConnector }