/**
 * Connector Types — Common types for all external platform connectors.
 */

// ============== CONNECTOR IDENTIFICATION ==============

export type ConnectorType =
  // Development
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  // Productivity
  | 'notion'
  | 'linear'
  | 'jira'
  | 'trello'
  | 'asana'
  | 'monday'
  // Storage
  | 'google_drive'
  | 'google_docs'
  | 'google_sheets'
  | 'dropbox'
  | 'onedrive'
  // Communication
  | 'slack'
  | 'discord'
  | 'teams'
  | 'gmail'
  // Design
  | 'figma'
  | 'canva'
  // Calendar
  | 'google_calendar'
  | 'outlook_calendar'
  // Knowledge
  | 'confluence'
  | 'coda'
  | 'airtable';

export type ConnectorCategory =
  | 'development'
  | 'productivity'
  | 'storage'
  | 'communication'
  | 'design'
  | 'calendar'
  | 'knowledge';

// ============== CAPABILITIES ==============

export interface ConnectorCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canSearch: boolean;
  canSync: boolean;
  canPreview: boolean;
  canDownload: boolean;
  canUpload: boolean;
  canDelete: boolean;
  canShare: boolean;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  supportsPAT: boolean; // Personal Access Token
  supportsWebhooks: boolean;
  supportsRealTime: boolean;
  supportsPagination: boolean;
  supportsRateLimit: boolean;
}

// ============== CONNECTOR STATUS ==============

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'expired'
  | 'revoked';

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'paused'
  | 'error'
  | 'completed';

export type HealthStatus =
  | 'healthy'
  | 'degraded'
  | 'error'
  | 'unknown'
  | 'maintenance';

// ============== OAUTH ==============

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  refreshTokenUrl?: string;
  revokeUrl?: string;
  scopes: string[];
  redirectUri?: string;
  responseType?: 'code' | 'token';
  grantType?: 'authorization_code' | 'client_credentials';
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  expiresAt?: number;
  scopes: string[];
  metadata?: Record<string, unknown>;
}

export interface OAuthState {
  state: string;
  connectorType: ConnectorType;
  returnUrl?: string;
  createdAt: number;
}

// ============== SYNC TYPES ==============

export type SyncType =
  | 'full'
  | 'incremental'
  | 'delta'
  | 'metadata_only';

export type SyncTrigger =
  | 'manual'
  | 'scheduled'
  | 'auto'
  | 'webhook'
  | 'startup';

export interface SyncJob {
  id: string;
  connectorId: string;
  type: SyncType;
  trigger: SyncTrigger;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  itemsTotal: number;
  itemsSynced: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsDeleted: number;
  itemsUnchanged: number;
  errorCount: number;
  lastError?: string;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface SyncQueueItem {
  id: string;
  connectorId: string;
  jobType: string;
  priority: number;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
  error?: string;
  createdAt: number;
}

// ============== ITEM TYPES ==============

export type ConnectorItemType =
  // GitHub
  | 'repository'
  | 'branch'
  | 'commit'
  | 'pull_request'
  | 'issue'
  | 'release'
  | 'file'
  | 'folder'
  // Notion
  | 'page'
  | 'database'
  | 'block'
  // Google
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'form'
  // Communication
  | 'message'
  | 'channel'
  | 'thread'
  | 'conversation'
  // Tasks
  | 'task'
  | 'project'
  | 'board'
  | 'column'
  | 'comment'
  | 'label'
  // Storage
  | 'drive'
  | 'space'
  | 'team'
  // Calendar
  | 'event'
  | 'calendar'
  // Design
  | 'design'
  | 'frame'
  | 'component'
  | 'canvas'
  // Email
  | 'email'
  | 'attachment'
  | 'label'
  // Generic
  | 'item'
  | 'attachment'
  | 'user'
  | 'team'
  | 'workspace'
  | 'metadata';

export interface ConnectorItem {
  id: string;
  connectorType: ConnectorType;
  itemType: ConnectorItemType;
  parentId?: string;
  title: string;
  description?: string;
  content?: string;
  preview?: string;
  url?: string;
  thumbnail?: string;
  icon?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt?: number;
  updatedAt?: number;
  author?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  permissions?: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
  syncStatus?: SyncStatus;
  lastSyncedAt?: number;
}

export interface ConnectorItemList {
  items: ConnectorItem[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
  prevCursor?: string;
}

// ============== FILTERS & SORTING ==============

export interface ConnectorFilter {
  itemTypes?: ConnectorItemType[];
  parentId?: string;
  ids?: string[];
  search?: string;
  tags?: string[];
  authorId?: string;
  dateRange?: {
    from: number;
    to: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ConnectorSort {
  field: 'title' | 'createdAt' | 'updatedAt' | 'relevance';
  order: 'asc' | 'desc';
}

export interface ConnectorPagination {
  limit?: number;
  offset?: number;
  cursor?: string;
}

// ============== SEARCH ==============

export interface ConnectorSearchQuery {
  query: string;
  filters?: ConnectorFilter;
  sort?: ConnectorSort;
  pagination?: ConnectorPagination;
}

export interface ConnectorSearchResult {
  items: ConnectorItem[];
  total: number;
  hasMore: boolean;
  duration: number;
  connectorType: ConnectorType;
}

// ============== AUTH ==============

export interface ConnectorAuth {
  type: 'oauth' | 'api_key' | 'pat' | 'none';
  isConfigured: boolean;
  isValid: boolean;
  expiresAt?: number;
  scopes?: string[];
  lastUsed?: number;
}

export interface ConnectorAccount {
  id: string;
  connectorId: string;
  accountId: string;
  accountName?: string;
  accountEmail?: string;
  accountAvatar?: string;
  workspaceId?: string;
  workspaceName?: string;
  isPrimary: boolean;
  isActive: boolean;
  connectedAt: number;
  lastUsed?: number;
}

// ============== CONNECTOR METADATA ==============

export interface ConnectorMetadata {
  id: string;
  type: ConnectorType;
  category: ConnectorCategory;
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  website: string;
  documentation: string;
  version: string;
  capabilities: ConnectorCapabilities;
  oauthConfig?: OAuthConfig;
  defaultScopes: string[];
  requiredScopes: string[];
  optionalScopes: string[];
  rateLimit?: {
    requests: number;
    period: number;
    unit: 'second' | 'minute' | 'hour';
  };
  supportsMultipleAccounts: boolean;
}

// Minimal metadata for constructor (extends partial)
export interface ConnectorConstructorMetadata {
  type: ConnectorType;
  category: ConnectorCategory;
  name: string;
  version: string;
}

// ============== ERROR HANDLING ==============

export type ConnectorErrorCode =
  | 'auth_required'
  | 'auth_expired'
  | 'auth_revoked'
  | 'auth_invalid'
  | 'token_refresh_failed'
  | 'rate_limit_exceeded'
  | 'quota_exceeded'
  | 'permission_denied'
  | 'not_found'
  | 'already_exists'
  | 'invalid_request'
  | 'invalid_response'
  | 'network_error'
  | 'timeout'
  | 'server_error'
  | 'service_unavailable'
  | 'maintenance'
  | 'unknown';

export interface ConnectorError {
  code: ConnectorErrorCode;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfter?: number;
}

// ============== CONFIG ==============

export interface ConnectorConfig {
  syncInterval?: number; // minutes
  autoSync?: boolean;
  syncOnStartup?: boolean;
  cacheExpiry?: number; // seconds
  maxCacheSize?: number; // bytes
  maxRetries?: number;
  retryDelay?: number; // ms
  timeout?: number; // ms
  permissions?: {
    read: boolean;
    write: boolean;
  };
  notifications?: {
    onSync: boolean;
    onError: boolean;
  };
}

export const DEFAULT_CONNECTOR_CONFIG: ConnectorConfig = {
  syncInterval: 30,
  autoSync: true,
  syncOnStartup: true,
  cacheExpiry: 3600,
  maxCacheSize: 100 * 1024 * 1024, // 100MB
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

// ============== CONNECTOR CONSTRUCTOR TYPE ==============

export interface ConnectorConstructor {
  new (config?: Partial<ConnectorConfig>): unknown;
}

export type ConnectorRegistry = Map<ConnectorType, ConnectorConstructor>;
