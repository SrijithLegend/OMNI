/**
 * Connector Engine — Registry, lifecycle management, and sync orchestration for all connectors.
 *
 * Features:
 * - Connector registration and discovery
 * - OAuth flow management
 * - Sync queue management
 * - Background synchronization
 * - Error handling and retry logic
 * - Rate limit handling
 */

import { BaseEngine } from './base';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BaseConnector, ConnectorRegistry, type ConnectorConstructor } from '../connectors/base';
import type {
  ConnectorType,
  ConnectorMetadata,
  ConnectorItem,
  ConnectorSearchQuery,
  ConnectorSearchResult,
  ConnectorConfig,
  OAuthToken,
  ConnectorAccount,
  SyncJob,
  SyncQueueItem,
  ConnectionStatus,
  HealthStatus,
  ConnectorError,
} from '../connectors/types';

// Re-export types for convenience
export type {
  ConnectorType,
  ConnectorMetadata,
  ConnectorItem,
  ConnectorSearchQuery,
  ConnectorSearchResult,
  ConnectorConfig,
  OAuthToken,
  ConnectorAccount,
  SyncJob,
  SyncQueueItem,
  ConnectionStatus,
  HealthStatus,
  ConnectorError,
} from '../connectors/types';

// ============== TYPES ==============

export interface InstalledConnector {
  id: string;
  type: ConnectorType;
  connector: BaseConnector;
  metadata: ConnectorMetadata;
  config: ConnectorConfig;
  account?: ConnectorAccount;
  installedAt: number;
  lastSyncAt?: number;
  lastError?: ConnectorError;
}

interface ConnectorEngineState {
  connectors: Map<ConnectorType, InstalledConnector>;
  syncQueue: SyncQueueItem[];
  isProcessing: boolean;
}

// ============== AVAILABLE CONNECTORS REGISTRY ==============

const availableConnectors: ConnectorRegistry = new Map();

// Connectors will be registered here as they're implemented
// Example: availableConnectors.set('github', GitHubConnector);

// ============== ENGINE ==============

export class ConnectorEngine extends BaseEngine {
  private supabase: SupabaseClient | null = null;
  private state: ConnectorEngineState = {
    connectors: new Map(),
    syncQueue: [],
    isProcessing: false,
  };
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super({ name: 'ConnectorEngine', version: '1.0.0', debug: false });
  }

  async start(): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      await this.loadInstalledConnectors();
      await this.loadSyncQueue();
    }

    // Start processing sync queue
    this.startQueueProcessing();

    // Start auto-sync timer
    this.startAutoSync();

    this.isRunning = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    this.stopQueueProcessing();
    this.stopAutoSync();

    // Disconnect all connectors
    for (const installed of this.state.connectors.values()) {
      try {
        await installed.connector.disconnect();
      } catch (err) {
        this.log('error', `Failed to disconnect ${installed.type}:`, err);
      }
    }

    this.isRunning = false;
  }

  async health(): Promise<{ ok: boolean; message: string; timestamp: number }> {
    const connected = Array.from(this.state.connectors.values()).filter(
      (c) => c.connector && 'connectionStatus' in c.connector
    ).length;
    const pending = this.state.syncQueue.filter((j) => j.status === 'pending').length;

    return {
      ok: true,
      message: `Connectors: ${connected} connected, ${pending} pending jobs`,
      timestamp: Date.now(),
    };
  }

  // ============== CONNECTOR REGISTRATION ==============

  /**
   * Register a connector type.
   */
  registerConnector(type: ConnectorType, constructor: ConnectorConstructor): void {
    availableConnectors.set(type, constructor);
    this.emit('connector-registered', type);
  }

  /**
   * Get available connector types.
   */
  getAvailableConnectors(): ConnectorType[] {
    return Array.from(availableConnectors.keys());
  }

  /**
   * Get metadata for all available connectors.
   */
  getAvailableConnectorsMetadata(): ConnectorMetadata[] {
    const types = this.getAvailableConnectors();
    return types
      .map(type => this.getConnectorMetadata(type))
      .filter((meta): meta is ConnectorMetadata => meta !== null);
  }

  /**
   * Get connector metadata for a type.
   */
  getConnectorMetadata(type: ConnectorType): ConnectorMetadata | null {
    // Return static metadata for available connectors
    const metadata = this.getStaticMetadata(type);
    return metadata;
  }

  /**
   * Get static metadata for a connector type.
   */
  private getStaticMetadata(type: ConnectorType): ConnectorMetadata | null {
    const metadata: Record<ConnectorType, ConnectorMetadata> = {
      github: {
        id: 'github',
        type: 'github',
        category: 'development',
        name: 'github',
        displayName: 'GitHub',
        description: 'Connect to GitHub repositories, issues, and pull requests',
        icon: 'github',
        color: '#333',
        website: 'https://github.com',
        documentation: 'https://docs.github.com',
        version: '1.0.0',
        capabilities: {
          canRead: true,
          canWrite: false,
          canSearch: true,
          canSync: true,
          canPreview: true,
          canDownload: true,
          canUpload: false,
          canDelete: false,
          canShare: false,
          supportsOAuth: true,
          supportsApiKey: false,
          supportsPAT: true,
          supportsWebhooks: true,
          supportsRealTime: false,
          supportsPagination: true,
          supportsRateLimit: true,
        },
        defaultScopes: ['repo', 'read:user'],
        requiredScopes: ['read:user'],
        optionalScopes: ['repo', 'gist'],
        supportsMultipleAccounts: false,
      },
      notion: {
        id: 'notion',
        type: 'notion',
        category: 'productivity',
        name: 'notion',
        displayName: 'Notion',
        description: 'Connect to Notion pages and databases',
        icon: 'notion',
        color: '#000',
        website: 'https://notion.so',
        documentation: 'https://developers.notion.com',
        version: '1.0.0',
        capabilities: {
          canRead: true,
          canWrite: false,
          canSearch: true,
          canSync: true,
          canPreview: true,
          canDownload: false,
          canUpload: false,
          canDelete: false,
          canShare: false,
          supportsOAuth: true,
          supportsApiKey: true,
          supportsPAT: false,
          supportsWebhooks: false,
          supportsRealTime: false,
          supportsPagination: true,
          supportsRateLimit: true,
        },
        defaultScopes: ['read'],
        requiredScopes: [],
        optionalScopes: ['write'],
        supportsMultipleAccounts: false,
      },
      // Add stubs for other connectors
      google_drive: this.createStubMetadata('google_drive', 'Google Drive', 'storage', '#4285F4'),
      google_docs: this.createStubMetadata('google_docs', 'Google Docs', 'productivity', '#4285F4'),
      google_sheets: this.createStubMetadata('google_sheets', 'Google Sheets', 'productivity', '#34A853'),
      google_calendar: this.createStubMetadata('google_calendar', 'Google Calendar', 'calendar', '#4285F4'),
      gmail: this.createStubMetadata('gmail', 'Gmail', 'communication', '#EA4335'),
      slack: this.createStubMetadata('slack', 'Slack', 'communication', '#4A154B'),
      discord: this.createStubMetadata('discord', 'Discord', 'communication', '#5865F2'),
      linear: this.createStubMetadata('linear', 'Linear', 'productivity', '#5E6AD2'),
      jira: this.createStubMetadata('jira', 'Jira', 'productivity', '#0052CC'),
      trello: this.createStubMetadata('trello', 'Trello', 'productivity', '#0052CC'),
      figma: this.createStubMetadata('figma', 'Figma', 'design', '#F24E1E'),
      dropbox: this.createStubMetadata('dropbox', 'Dropbox', 'storage', '#0061FF'),
      onedrive: this.createStubMetadata('onedrive', 'OneDrive', 'storage', '#0078D4'),
      confluence: this.createStubMetadata('confluence', 'Confluence', 'knowledge', '#172B4D'),
      gitlab: this.createStubMetadata('gitlab', 'GitLab', 'development', '#FC6D26'),
      bitbucket: this.createStubMetadata('bitbucket', 'Bitbucket', 'development', '#0052CC'),
      asana: this.createStubMetadata('asana', 'Asana', 'productivity', '#F06A6A'),
      monday: this.createStubMetadata('monday', 'Monday.com', 'productivity', '#FF3D57'),
      teams: this.createStubMetadata('teams', 'Microsoft Teams', 'communication', '#6264A7'),
      canva: this.createStubMetadata('canva', 'Canva', 'design', '#00C4CC'),
      outlook_calendar: this.createStubMetadata('outlook_calendar', 'Outlook Calendar', 'calendar', '#0078D4'),
      coda: this.createStubMetadata('coda', 'Coda', 'knowledge', '#F46A54'),
      airtable: this.createStubMetadata('airtable', 'Airtable', 'knowledge', '#18BFFF'),
    };

    return metadata[type] || null;
  }

  private createStubMetadata(
    type: ConnectorType,
    displayName: string,
    category: string,
    color: string
  ): ConnectorMetadata {
    return {
      id: type,
      type,
      category: category as ConnectorMetadata['category'],
      name: type,
      displayName,
      description: `Connect to ${displayName}`,
      icon: type.replace(/_/g, '-'),
      color,
      website: '#',
      documentation: '#',
      version: '1.0.0',
      capabilities: {
        canRead: true,
        canWrite: false,
        canSearch: true,
        canSync: true,
        canPreview: true,
        canDownload: false,
        canUpload: false,
        canDelete: false,
        canShare: false,
        supportsOAuth: true,
        supportsApiKey: false,
        supportsPAT: false,
        supportsWebhooks: false,
        supportsRealTime: false,
        supportsPagination: true,
        supportsRateLimit: true,
      },
      defaultScopes: [],
      requiredScopes: [],
      optionalScopes: [],
      supportsMultipleAccounts: false,
    };
  }

  // ============== INSTALLATION ==============

  /**
   * Install a connector.
   */
  async installConnector(type: ConnectorType, config?: Partial<ConnectorConfig>): Promise<InstalledConnector | null> {
    const Constructor = availableConnectors.get(type);
    if (!Constructor) {
      this.log('error', `Connector type ${type} not found`);
      return null;
    }

    const metadata = this.getConnectorMetadata(type);
    if (!metadata) {
      this.log('error', `No metadata for connector type ${type}`);
      return null;
    }

    // Create connector instance
    const connector = new Constructor(config);
    const id = crypto.randomUUID();

    const installed: InstalledConnector = {
      id,
      type,
      connector,
      metadata,
      config: { ...DEFAULT_CONNECTOR_CONFIG, ...config },
      installedAt: Date.now(),
    };

    // Save to database
    if (this.supabase) {
      await this.supabase.from('omni_connectors').upsert({
        id,
        name: metadata.name,
        description: metadata.description,
        icon: metadata.icon,
        version: metadata.version,
        enabled: true,
        config: installed.config,
      });
    }

    this.state.connectors.set(type, installed);
    this.emit('connector-installed', installed);

    return installed;
  }

  /**
   * Uninstall a connector.
   */
  async uninstallConnector(type: ConnectorType): Promise<boolean> {
    const installed = this.state.connectors.get(type);
    if (!installed) return false;

    // Disconnect
    await installed.connector.disconnect();

    // Remove from state
    this.state.connectors.delete(type);

    // Remove from database
    if (this.supabase) {
      await this.supabase.from('omni_connectors').delete().eq('name', type);
      await this.supabase.from('omni_oauth_tokens').delete().eq('connector_id', installed.id);
      await this.supabase.from('omni_connector_cache').delete().eq('connector_id', installed.id);
    }

    this.emit('connector-uninstalled', type);
    return true;
  }

  /**
   * Get all installed connectors.
   */
  getInstalledConnectors(): InstalledConnector[] {
    return Array.from(this.state.connectors.values());
  }

  /**
   * Get a specific installed connector.
   */
  getConnector(type: ConnectorType): InstalledConnector | null {
    return this.state.connectors.get(type) || null;
  }

  // ============== CONNECTION MANAGEMENT ==============

  /**
   * Initiate OAuth flow for a connector.
   */
  async initiateOAuth(type: ConnectorType): Promise<string | null> {
    const installed = this.state.connectors.get(type);
    if (!installed) return null;

    const oauthConfig = installed.connector.getOAuthConfig();
    if (!oauthConfig) {
      this.log('error', `Connector ${type} does not support OAuth`);
      return null;
    }

    // Generate state
    const state = this.generateOAuthState(type);

    // Get authorization URL
    const authUrl = await installed.connector.getOAuthUrl(state);

    // Store state for validation
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`oauth_state_${state}`, JSON.stringify({
        type,
        createdAt: Date.now(),
      }));
    }

    return authUrl;
  }

  /**
   * Handle OAuth callback.
   */
  async handleOAuthCallback(code: string, state: string): Promise<boolean> {
    // Validate state
    const storedState = sessionStorage?.getItem(`oauth_state_${state}`);
    if (!storedState) {
      this.log('error', 'Invalid OAuth state');
      return false;
    }

    const { type } = JSON.parse(storedState);

    const installed = this.state.connectors.get(type);
    if (!installed) return false;

    try {
      // Complete OAuth flow
      const token = await installed.connector.handleOAuthCallback(code, state);

      // Save token
      await this.saveToken(installed.id, token);

      // Update status
      await installed.connector.authenticate();

      // Clean up state
      sessionStorage?.removeItem(`oauth_state_${state}`);

      this.emit('connector-connected', type);
      return true;
    } catch (err) {
      this.log('error', `OAuth callback failed for ${type}:`, err);
      return false;
    }
  }

  /**
   * Connect a connector.
   */
  async connectConnector(type: ConnectorType): Promise<boolean> {
    const installed = this.state.connectors.get(type);
    if (!installed) return false;

    try {
      // Load token if available
      const token = await this.loadToken(installed.id);
      if (token) {
        // Check if token needs refresh
        if (token.expiresAt && token.expiresAt < Date.now() + 60000) {
          await installed.connector.refresh();
        } else {
          await installed.connector.authenticate();
        }
      } else {
        // No token, need OAuth
        return false;
      }

      this.emit('connector-connected', type);
      return true;
    } catch (err) {
      this.log('error', `Failed to connect ${type}:`, err);
      return false;
    }
  }

  /**
   * Disconnect a connector.
   */
  async disconnectConnector(type: ConnectorType): Promise<void> {
    const installed = this.state.connectors.get(type);
    if (!installed) return;

    await installed.connector.disconnect();

    // Remove token
    if (this.supabase) {
      await this.supabase.from('omni_oauth_tokens').delete().eq('connector_id', installed.id);
    }

    this.emit('connector-disconnected', type);
  }

  // ============== SYNC MANAGEMENT ==============

  /**
   * Queue a sync job.
   */
  async queueSync(type: ConnectorType, jobType = 'full_sync', params?: Record<string, unknown>): Promise<SyncQueueItem> {
    const installed = this.state.connectors.get(type);
    if (!installed) throw new Error(`Connector ${type} not installed`);

    const item: SyncQueueItem = {
      id: crypto.randomUUID(),
      connectorId: installed.id,
      jobType,
      priority: 5,
      params: params || {},
      status: 'pending',
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
    };

    // Save to database
    if (this.supabase) {
      await this.supabase.from('omni_sync_queue').insert({
        id: item.id,
        connector_id: item.connectorId,
        job_type: item.jobType,
        job_priority: item.priority,
        params: item.params,
        status: item.status,
        retry_count: item.retryCount,
        max_retries: item.maxRetries,
      });
    }

    this.state.syncQueue.push(item);
    this.emit('sync-queued', item);

    return item;
  }

  /**
   * Trigger immediate sync for a connector.
   */
  async syncConnector(type: ConnectorType): Promise<SyncJob | null> {
    const installed = this.state.connectors.get(type);
    if (!installed) return null;

    const status = await installed.connector.status();
    if (status !== 'connected') {
      this.log('warn', `Connector ${type} is not connected`);
      return null;
    }

    try {
      const job = await installed.connector.sync();

      // Record sync history
      if (this.supabase) {
        await this.supabase.from('omni_sync_history').insert({
          connector_id: installed.id,
          sync_type: job.type || 'full',
          triggered_by: job.trigger || 'manual',
          items_added: job.itemsAdded,
          items_updated: job.itemsUpdated,
          items_deleted: job.itemsDeleted,
          items_unchanged: job.itemsUnchanged,
          errors_count: job.errorCount,
          duration_ms: job.duration,
          sync_status: job.status === 'completed' ? 'completed' : 'partial',
          started_at: new Date(job.startedAt || Date.now()).toISOString(),
          completed_at: job.completedAt ? new Date(job.completedAt).toISOString() : null,
        });
      }

      installed.lastSyncAt = Date.now();
      this.emit('sync-completed', { type, job });

      return job;
    } catch (err) {
      this.log('error', `Sync failed for ${type}:`, err);
      return null;
    }
  }

  /**
   * Sync all connectors.
   */
  async syncAll(): Promise<Map<ConnectorType, SyncJob | null>> {
    const results = new Map<ConnectorType, SyncJob | null>();

    for (const [type, installed] of this.state.connectors) {
      const status = await installed.connector.status();
      if (status === 'connected') {
        results.set(type, await this.syncConnector(type));
      }
    }

    return results;
  }

  // ============== SEARCH ==============

  /**
   * Search across all connected connectors.
   */
  async searchAcross(query: ConnectorSearchQuery): Promise<Map<ConnectorType, ConnectorSearchResult>> {
    const results = new Map<ConnectorType, ConnectorSearchResult>();

    const searchPromises = Array.from(this.state.connectors.entries()).map(async ([type, installed]) => {
      const status = await installed.connector.status();
      if (status !== 'connected') return;

      try {
        const result = await installed.connector.search(query);
        results.set(type, result);
      } catch (err) {
        this.log('warn', `Search failed for ${type}:`, err);
      }
    });

    await Promise.all(searchPromises);
    return results;
  }

  /**
   * Search a specific connector.
   */
  async searchConnector(type: ConnectorType, query: ConnectorSearchQuery): Promise<ConnectorSearchResult | null> {
    const installed = this.state.connectors.get(type);
    if (!installed) return null;

    const status = await installed.connector.status();
    if (status !== 'connected') return null;

    return installed.connector.search(query);
  }

  // ============== ITEMS ==============

  /**
   * Read an item from a connector.
   */
  async readItem(type: ConnectorType, itemId: string): Promise<ConnectorItem | null> {
    const installed = this.state.connectors.get(type);
    if (!installed) return null;

    return installed.connector.read(itemId);
  }

  /**
   * List items from a connector.
   */
  async listItems(type: ConnectorType, filter?: Record<string, unknown>): Promise<ConnectorItem[]> {
    const installed = this.state.connectors.get(type);
    if (!installed) return [];

    const result = await installed.connector.list(filter);
    return result.items;
  }

  // ============== INTERNAL ==============

  private generateOAuthState(type: ConnectorType): string {
    const random = crypto.randomUUID();
    return `${type}:${random}`;
  }

  private async loadInstalledConnectors(): Promise<void> {
    if (!this.supabase) return;

    const { data } = await this.supabase
      .from('omni_connectors')
      .select('*')
      .eq('enabled', true);

    if (!data) return;

    for (const row of data) {
      const Constructor = availableConnectors.get(row.name as ConnectorType);
      if (!Constructor) continue;

      const metadata = this.getConnectorMetadata(row.name as ConnectorType);
      if (!metadata) continue;

      const connector = new Constructor(row.config);

      this.state.connectors.set(row.name as ConnectorType, {
        id: row.id,
        type: row.name as ConnectorType,
        connector,
        metadata,
        config: row.config,
        installedAt: new Date(row.last_sync_at || Date.now()).getTime(),
      });
    }
  }

  private async loadSyncQueue(): Promise<void> {
    if (!this.supabase) return;

    const { data } = await this.supabase
      .from('omni_sync_queue')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('job_priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (!data) return;

    this.state.syncQueue = data.map((row) => ({
      id: row.id,
      connectorId: row.connector_id,
      jobType: row.job_type,
      priority: row.job_priority,
      params: row.params,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at).getTime() : undefined,
      error: row.error_message,
      createdAt: new Date(row.created_at).getTime(),
    }));
  }

  private async loadToken(connectorId: string): Promise<OAuthToken | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from('omni_oauth_tokens')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('is_valid', true)
      .single();

    if (!data) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type,
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : undefined,
      scopes: data.scopes || [],
      metadata: data.token_metadata,
    };
  }

  private async saveToken(connectorId: string, token: OAuthToken): Promise<void> {
    if (!this.supabase) return;

    await this.supabase.from('omni_oauth_tokens').upsert({
      connector_id: connectorId,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      token_type: token.tokenType,
      expires_at: token.expiresAt ? new Date(token.expiresAt).toISOString() : null,
      scopes: token.scopes,
      token_metadata: token.metadata,
      is_valid: true,
      is_expired: false,
    });
  }

  private startQueueProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 5000);
  }

  private stopQueueProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.state.isProcessing) return;

    const pending = this.state.syncQueue.filter(
      (item) => item.status === 'pending' || (item.status === 'failed' && item.retryCount < item.maxRetries)
    );

    if (pending.length === 0) return;

    this.state.isProcessing = true;

    // Process highest priority job
    const job = pending.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt)[0];

    try {
      // Find connector
      const installed = Array.from(this.state.connectors.values()).find((c) => c.id === job.connectorId);
      if (!installed) {
        job.status = 'failed';
        job.error = 'Connector not found';
      } else {
        await this.syncConnector(installed.type);
        job.status = 'completed';
      }
    } catch (err) {
      job.retryCount++;
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : 'Unknown error';

      if (job.retryCount < job.maxRetries) {
        job.nextRetryAt = Date.now() + Math.pow(2, job.retryCount) * 1000;
        job.status = 'pending';
      }
    }

    // Update in database
    if (this.supabase) {
      await this.supabase
        .from('omni_sync_queue')
        .update({
          status: job.status,
          retry_count: job.retryCount,
          next_retry_at: job.nextRetryAt ? new Date(job.nextRetryAt).toISOString() : null,
          error_message: job.error,
        })
        .eq('id', job.id);
    }

    // Remove completed jobs from memory
    this.state.syncQueue = this.state.syncQueue.filter((item) => item.status !== 'completed');

    this.state.isProcessing = false;
  }

  private startAutoSync(): void {
    this.syncTimer = setInterval(() => {
      this.autoSync();
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async autoSync(): Promise<void> {
    for (const [type, installed] of this.state.connectors) {
      if (installed.config.autoSync && installed.config.syncInterval) {
        const lastSync = installed.lastSyncAt || 0;
        const intervalMs = installed.config.syncInterval * 60 * 1000;

        if (Date.now() - lastSync >= intervalMs) {
          const status = await installed.connector.status();
          if (status === 'connected') {
            await this.syncConnector(type);
          }
        }
      }
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

// ============== SINGLETON ==============

let _instance: ConnectorEngine | null = null;

export function getConnectorEngine(): ConnectorEngine {
  if (!_instance) {
    _instance = new ConnectorEngine();
  }
  return _instance;
}
