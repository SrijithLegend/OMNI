/**
 * Google Connectors — Google Drive, Docs, Sheets, Gmail, Calendar integration.
 */

import { BaseConnector } from './base';
import type {
  ConnectorItem,
  ConnectorItemList,
  ConnectorSearchQuery,
  ConnectorSearchResult,
  ConnectorMetadata,
  ConnectorCapabilities,
  OAuthConfig,
  OAuthToken,
  ConnectionStatus,
  HealthStatus,
  SyncJob,
  ConnectorFilter,
  ConnectorType,
} from './types';

// ============== GOOGLE API TYPES ==============

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  description?: string;
  starred?: boolean;
  trashed?: boolean;
  parents?: string[];
  properties?: Record<string, string>;
  appProperties?: Record<string, string>;
  spaces?: ('drive' | 'appDataFolder' | 'photos')[];
  kind?: string;
  driveId?: string;
  hasAugmentedPermissions?: boolean;
  permissionIds?: string[];
  createdTime?: string;
  modifiedTime?: string;
  viewedByMeTime?: string;
  owners?: Array<{
    displayName: string;
    emailAddress: string;
    kind: string;
    me?: boolean;
    permissionId: string;
    photoLink?: string;
  }>;
  lastModifyingUser?: {
    displayName: string;
    emailAddress: string;
    kind: string;
    photoLink?: string;
  };
  sharedWithMeTime?: string;
  sharingUser?: {
    displayName: string;
    emailAddress: string;
    kind: string;
    photoLink?: string;
  };
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  hasThumbnail?: boolean;
  thumbnailLink?: string;
  thumbnailVersion?: number;
  viewedByMe?: boolean;
  folderColorRgb?: string;
  originalFilename?: string;
  fileExtension?: string;
  fullFileExtension?: string;
  fileSize?: string;
  quotaBytesUsed?: string;
  headRevisionId?: string;
  isAppAuthorized?: boolean;
  exportLinks?: Record<string, string>;
  shortcutDetails?: {
    targetId: string;
    targetMimeType: string;
    targetResourceKey?: string;
  };
}

interface GoogleDriveFileList {
  kind: string;
  nextPageToken?: string;
  incompleteSearch?: boolean;
  files: GoogleDriveFile[];
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

// ============== GOOGLE DRIVE CONNECTOR ==============

export class GoogleDriveConnector extends BaseConnector {
  protected apiBase = 'https://www.googleapis.com/drive/v3';
  protected uploadBase = 'https://www.googleapis.com/upload/drive/v3';
  protected user: GoogleUserInfo | null = null;

  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(
      {
        type: 'google_drive' as const,
        category: 'storage' as const,
        name: 'Google Drive Connector',
        version: '1.0.0',
      },
      config
    );
  }

  async connect(credentials?: Record<string, unknown>): Promise<boolean> {
    const token = credentials?.accessToken as string | undefined;

    if (!token && !this.token) {
      throw this.createError('auth_required', 'Google access token required');
    }

    if (token) {
      this.token = {
        accessToken: token,
        tokenType: 'bearer',
        scopes: credentials?.scopes as string[] || ['https://www.googleapis.com/auth/drive.readonly'],
      };
    }

    try {
      this.user = await this.fetchUserInfo();
      this.connectionStatus = 'connected';
      this.log('info', `Connected as ${this.user.email}`);
      this.emit('connected', this.user);
      return true;
    } catch (error) {
      this.connectionStatus = 'error';
      throw this.createError('auth_invalid', 'Failed to authenticate with Google', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    this.user = null;
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
    this.log('info', 'Disconnected from Google Drive');
  }

  async authenticate(authCode?: string): Promise<boolean> {
    if (!authCode) {
      throw this.createError('auth_invalid', 'Authorization code required');
    }

    const oauthConfig = this.getOAuthConfig()!;

    try {
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret || '',
          code: authCode,
          grant_type: 'authorization_code',
          redirect_uri: oauthConfig.redirectUri || '',
        }).toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || error.error || 'OAuth failed');
      }

      const data = await response.json();

      this.token = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: data.scope?.split(' ') || oauthConfig.scopes,
      };

      return this.connect();
    } catch (error) {
      throw this.createError('auth_invalid', 'Google OAuth failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refresh(): Promise<boolean> {
    if (!this.token?.refreshToken) {
      return false;
    }

    const oauthConfig = this.getOAuthConfig()!;

    try {
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret || '',
          refresh_token: this.token.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      this.token = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.token.refreshToken,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: data.scope?.split(' ') || this.token.scopes,
      };

      return true;
    } catch (error) {
      throw this.createError('token_refresh_failed', 'Failed to refresh Google token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sync(params?: Record<string, unknown>): Promise<SyncJob> {
    const startTime = Date.now();
    const jobId = `google-drive-sync-${Date.now()}`;

    const job: SyncJob = {
      id: jobId,
      connectorId: this.type,
      type: (params?.type as SyncJob['type']) || 'incremental',
      trigger: (params?.trigger as SyncJob['trigger']) || 'manual',
      status: 'running',
      progress: 0,
      itemsTotal: 0,
      itemsSynced: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      itemsUnchanged: 0,
      errorCount: 0,
      startedAt: startTime,
    };

    try {
      if (this.connectionStatus !== 'connected') {
        await this.connect();
      }

      const files = await this.listFiles();
      job.itemsTotal = files.length;

      for (let i = 0; i < files.length; i++) {
        try {
          this.emit('item-synced', this.fileToItem(files[i]));
          job.itemsSynced++;
          job.itemsAdded++;
        } catch (error) {
          job.errorCount++;
          job.lastError = error instanceof Error ? error.message : String(error);
        }

        job.progress = Math.round((i + 1) / files.length * 100);
        this.emit('sync-progress', job);
      }

      job.status = 'completed';
      job.completedAt = Date.now();
      job.duration = job.completedAt - startTime;

      this.setLastSyncAt(Date.now());
      this.emit('sync-completed', job);

      return job;
    } catch (error) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.duration = job.completedAt - startTime;
      job.lastError = error instanceof Error ? error.message : String(error);

      throw this.createError('server_error', 'Sync failed', { job, error: job.lastError });
    }
  }

  async search(query: ConnectorSearchQuery): Promise<ConnectorSearchResult> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    const startTime = Date.now();

    try {
      const files = await this.searchFiles(query.query, query.filters, query.pagination);
      const items = files.map(f => this.fileToItem(f));

      return {
        items,
        total: items.length,
        hasMore: false,
        duration: Date.now() - startTime,
        connectorType: 'google_drive',
      };
    } catch (error) {
      throw this.createError('server_error', 'Search failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async read(itemId: string): Promise<ConnectorItem | null> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    try {
      const file = await this.fetchFile(itemId);
      const item = this.fileToItem(file);

      // Fetch content for text files
      if (this.isTextFile(file.mimeType)) {
        try {
          const content = await this.fetchFileContent(itemId, file.mimeType);
          item.content = content;
          item.preview = content?.substring(0, 500);
        } catch {
          // Content not available
        }
      }

      return item;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  async status(): Promise<ConnectionStatus> {
    if (!this.token) {
      return 'disconnected';
    }

    if (this.token.expiresAt && this.token.expiresAt < Date.now()) {
      return 'expired';
    }

    return this.connectionStatus;
  }

  async permissions(): Promise<string[]> {
    return this.token?.scopes || [];
  }

  async health(): Promise<HealthStatus> {
    try {
      if (this.connectionStatus !== 'connected') {
        await this.connect();
      }
      return 'healthy';
    } catch {
      return 'error';
    }
  }

  metadata(): ConnectorMetadata {
    return GoogleDriveConnector.getStaticMetadata();
  }

  // ============== OAUTH ==============

  async getOAuthUrl(state: string): Promise<string> {
    const config = this.getOAuthConfig()!;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri || '',
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, _state: string): Promise<OAuthToken> {
    await this.authenticate(code);
    return this.token!;
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      revokeUrl: 'https://oauth2.googleapis.com/revoke',
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${chrome?.identity?.getRedirectURL?.() || window.location.origin}/oauth/google`,
      responseType: 'code',
      grantType: 'authorization_code',
    };
  }

  // ============== LIST ==============

  async list(filter?: ConnectorFilter): Promise<ConnectorItemList> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    const parentId = filter?.parentId || 'root';

    if (parentId !== 'root') {
      return this.listFolderContents(parentId);
    }

    const files = await this.listFiles();
    const items = files.map(f => this.fileToItem(f));

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }

  // ============== GOOGLE DRIVE API METHODS ==============

  protected async fetchUserInfo(): Promise<GoogleUserInfo> {
    return this.request('GET', 'https://www.googleapis.com/oauth2/v2/userinfo') as Promise<GoogleUserInfo>;
  }

  protected async fetchFile(fileId: string): Promise<GoogleDriveFile> {
    return this.request('GET', `${this.apiBase}/files/${fileId}?fields=*`) as Promise<GoogleDriveFile>;
  }

  protected async listFiles(parentId?: string): Promise<GoogleDriveFile[]> {
    const query = parentId
      ? `'${parentId}' in parents and trashed = false`
      : 'trashed = false';

    const response = await this.request('GET', `${this.apiBase}/files?q=${encodeURIComponent(query)}&fields=*&pageSize=100`) as GoogleDriveFileList;
    return response.files || [];
  }

  protected async searchFiles(query: string, filters?: ConnectorFilter, pagination?: { limit?: number }): Promise<GoogleDriveFile[]> {
    let q = `trashed = false`;

    if (query) {
      q += ` and name contains '${query}'`;
    }

    if (filters?.parentId) {
      q += ` and '${filters.parentId}' in parents`;
    }

    if (filters?.itemTypes) {
      const mimeTypes = filters.itemTypes.map(t => this.getMimeTypeForType(t)).filter(Boolean);
      if (mimeTypes.length > 0) {
        q += ` and (${mimeTypes.map(m => `mimeType = '${m}'`).join(' or ')})`;
      }
    }

    const limit = pagination?.limit || 100;
    const response = await this.request('GET', `${this.apiBase}/files?q=${encodeURIComponent(q)}&fields=*&pageSize=${limit}`) as GoogleDriveFileList;
    return response.files || [];
  }

  protected async listFolderContents(folderId: string): Promise<ConnectorItemList> {
    const files = await this.listFiles(folderId);
    const items = files.map(f => this.fileToItem(f));

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }

  protected async fetchFileContent(fileId: string, mimeType: string): Promise<string> {
    // For Google Docs/Sheets, use export
    if (mimeType === 'application/vnd.google-apps.document') {
      const response = await this.request('GET', `${this.apiBase}/files/${fileId}/export?mimeType=text/plain`, true);
      return response as string;
    }

    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const response = await this.request('GET', `${this.apiBase}/files/${fileId}/export?mimeType=text/csv`, true);
      return response as string;
    }

    // For regular files, use alt=media
    const response = await this.request('GET', `${this.apiBase}/files/${fileId}?alt=media`, true);
    return response as string;
  }

  // ============== HELPERS ==============

  protected fileToItem(file: GoogleDriveFile): ConnectorItem {
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

    return {
      id: file.id,
      connectorType: 'google_drive',
      itemType: isFolder ? 'folder' : this.getGenericType(file.mimeType),
      parentId: file.parents?.[0],
      title: file.name,
      description: file.description,
      url: file.webViewLink,
      thumbnail: file.thumbnailLink,
      icon: this.getIconForMimeType(file.mimeType),
      metadata: {
        mimeType: file.mimeType,
        size: file.fileSize ? parseInt(file.fileSize) : undefined,
        extension: file.fileExtension,
        starred: file.starred,
        owners: file.owners?.map(o => o.emailAddress),
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      },
      tags: [file.starred ? 'starred' : ''].filter(Boolean),
      createdAt: file.createdTime ? new Date(file.createdTime).getTime() : undefined,
      updatedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : undefined,
      author: file.owners?.[0] ? {
        id: file.owners[0].permissionId,
        name: file.owners[0].displayName,
        email: file.owners[0].emailAddress,
        avatar: file.owners[0].photoLink,
      } : undefined,
      permissions: {
        canRead: true,
        canWrite: true,
        canDelete: true,
        canShare: true,
      },
    };
  }

  protected getGenericType(mimeType: string): ConnectorItem['itemType'] {
    if (mimeType.startsWith('image/')) return 'file';
    if (mimeType.startsWith('video/')) return 'file';
    if (mimeType.startsWith('audio/')) return 'file';

    switch (mimeType) {
      case 'application/vnd.google-apps.document':
        return 'document';
      case 'application/vnd.google-apps.spreadsheet':
        return 'spreadsheet';
      case 'application/vnd.google-apps.presentation':
        return 'presentation';
      case 'application/vnd.google-apps.form':
        return 'form';
      default:
        return 'file';
    }
  }

  protected getIconForMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'application/vnd.google-apps.folder':
        return 'folder';
      case 'application/vnd.google-apps.document':
        return 'document';
      case 'application/vnd.google-apps.spreadsheet':
        return 'spreadsheet';
      case 'application/vnd.google-apps.presentation':
        return 'presentation';
      case 'application/pdf':
        return 'pdf';
      case 'application/zip':
      case 'application/x-zip-compressed':
        return 'zip';
      default:
        return 'file';
    }
  }

  protected getMimeTypeForType(itemType: ConnectorItem['itemType']): string | null {
    switch (itemType) {
      case 'document':
        return 'application/vnd.google-apps.document';
      case 'spreadsheet':
        return 'application/vnd.google-apps.spreadsheet';
      case 'presentation':
        return 'application/vnd.google-apps.presentation';
      case 'form':
        return 'application/vnd.google-apps.form';
      case 'folder':
        return 'application/vnd.google-apps.folder';
      default:
        return null;
    }
  }

  protected isTextFile(mimeType: string): boolean {
    const textTypes = [
      'text/plain',
      'text/markdown',
      'text/html',
      'text/csv',
      'application/json',
      'application/xml',
      'application/javascript',
    ];

    return textTypes.some(t => mimeType.includes(t));
  }

  // ============== API REQUEST ==============

  protected async request(method: string, url: string, rawResponse = false): Promise<unknown> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (this.token?.accessToken) {
      headers['Authorization'] = `Bearer ${this.token.accessToken}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { error?: string; message?: string };

      if (response.status === 401) {
        this.connectionStatus = 'expired';
        throw this.createError('auth_expired', 'Google token expired');
      }

      if (response.status === 403) {
        throw this.createError('permission_denied', error.error || error.message || 'Permission denied');
      }

      if (response.status === 404) {
        const notFoundError = new Error('Not found') as Error & { status: number };
        notFoundError.status = 404;
        throw notFoundError;
      }

      if (response.status === 429) {
        throw this.createError('rate_limit_exceeded', 'Google rate limit exceeded');
      }

      throw this.createError('server_error', error.error || error.message || 'Google API error', {
        status: response.status,
        error,
      });
    }

    if (rawResponse) {
      return response.text();
    }

    return response.json();
  }

  // ============== STATIC METADATA ==============

  static getStaticMetadata(): ConnectorMetadata {
    const capabilities: ConnectorCapabilities = {
      canRead: true,
      canWrite: true,
      canSearch: true,
      canSync: true,
      canPreview: true,
      canDownload: true,
      canUpload: true,
      canDelete: true,
      canShare: true,
      supportsOAuth: true,
      supportsApiKey: false,
      supportsPAT: false,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportsPagination: true,
      supportsRateLimit: true,
    };

    return {
      id: 'google_drive',
      type: 'google_drive',
      category: 'storage',
      name: 'google_drive',
      displayName: 'Google Drive',
      description: 'Cloud storage and file synchronization service. Connect to files, folders, and documents.',
      icon: 'folder',
      color: '#4285f4',
      website: 'https://drive.google.com',
      documentation: 'https://developers.google.com/drive',
      version: '1.0.0',
      capabilities,
      defaultScopes: ['https://www.googleapis.com/auth/drive.readonly'],
      requiredScopes: ['https://www.googleapis.com/auth/drive.readonly'],
      optionalScopes: ['https://www.googleapis.com/auth/drive'],
      rateLimit: {
        requests: 1000,
        period: 100,
        unit: 'second',
      },
      supportsMultipleAccounts: true,
    };
  }
}

// ============== GOOGLE DOCS CONNECTOR ==============

export class GoogleDocsConnector extends GoogleDriveConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(config);
  }

  async list(filter?: ConnectorFilter): Promise<ConnectorItemList> {
    const customFilter: ConnectorFilter = {
      ...filter,
      itemTypes: ['document'],
    };
    return super.list(customFilter);
  }

  metadata(): ConnectorMetadata {
    const meta = GoogleDriveConnector.getStaticMetadata();
    return {
      ...meta,
      id: 'google_docs',
      type: 'google_docs',
      category: 'productivity',
      name: 'google_docs',
      displayName: 'Google Docs',
      description: 'Online document editor. Connect to create, edit, and collaborate on documents.',
      icon: 'document',
      color: '#4285f4',
    };
  }
}

// ============== GOOGLE SHEETS CONNECTOR ==============

export class GoogleSheetsConnector extends GoogleDriveConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(config);
  }

  async list(filter?: ConnectorFilter): Promise<ConnectorItemList> {
    const customFilter: ConnectorFilter = {
      ...filter,
      itemTypes: ['spreadsheet'],
    };
    return super.list(customFilter);
  }

  metadata(): ConnectorMetadata {
    const meta = GoogleDriveConnector.getStaticMetadata();
    return {
      ...meta,
      id: 'google_sheets',
      type: 'google_sheets',
      category: 'productivity',
      name: 'google_sheets',
      displayName: 'Google Sheets',
      description: 'Online spreadsheet editor. Connect to create, edit, and analyze data.',
      icon: 'spreadsheet',
      color: '#0f9d58',
    };
  }
}

// ============== GMAIL CONNECTOR ==============

export class GmailConnector extends BaseConnector {
  private apiBase = 'https://gmail.googleapis.com/gmail/v1';
  private user: GoogleUserInfo | null = null;

  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(
      {
        type: 'gmail' as const,
        category: 'communication' as const,
        name: 'Gmail Connector',
        version: '1.0.0',
      },
      config
    );
  }

  async connect(credentials?: Record<string, unknown>): Promise<boolean> {
    const token = credentials?.accessToken as string | undefined;

    if (!token && !this.token) {
      throw this.createError('auth_required', 'Gmail access token required');
    }

    if (token) {
      this.token = {
        accessToken: token,
        tokenType: 'bearer',
        scopes: credentials?.scopes as string[] || ['https://www.googleapis.com/auth/gmail.readonly'],
      };
    }

    try {
      this.user = await this.fetchUserInfo();
      this.connectionStatus = 'connected';
      this.log('info', `Connected Gmail for ${this.user.email}`);
      this.emit('connected', this.user);
      return true;
    } catch (error) {
      this.connectionStatus = 'error';
      throw this.createError('auth_invalid', 'Failed to authenticate Gmail', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    this.user = null;
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
  }

  async authenticate(authCode?: string): Promise<boolean> {
    if (!authCode) throw this.createError('auth_invalid', 'Authorization code required');

    const oauthConfig = this.getOAuthConfig()!;

    const response = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret || '',
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: oauthConfig.redirectUri || '',
      }).toString(),
    });

    if (!response.ok) {
      throw this.createError('auth_invalid', 'Gmail OAuth failed');
    }

    const data = await response.json();

    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: 'bearer',
      expiresIn: data.expires_in,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scopes: data.scope?.split(' ') || oauthConfig.scopes,
    };

    return this.connect();
  }

  async refresh(): Promise<boolean> {
    if (!this.token?.refreshToken) return false;

    const oauthConfig = this.getOAuthConfig()!;

    const response = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret || '',
        refresh_token: this.token.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) return false;

    const data = await response.json();

    this.token = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.token.refreshToken,
      tokenType: 'bearer',
      expiresIn: data.expires_in,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scopes: this.token.scopes,
    };

    return true;
  }

  async sync(_params?: Record<string, unknown>): Promise<SyncJob> {
    // Gmail doesn't support traditional sync - emails are fetched on-demand
    return {
      id: `gmail-sync-${Date.now()}`,
      connectorId: this.type,
      type: 'full',
      trigger: 'manual',
      status: 'completed',
      progress: 100,
      itemsTotal: 0,
      itemsSynced: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      itemsUnchanged: 0,
      errorCount: 0,
    };
  }

  async search(query: ConnectorSearchQuery): Promise<ConnectorSearchResult> {
    if (this.connectionStatus !== 'connected') await this.connect();

    const startTime = Date.now();
    const emails = await this.searchEmails(query.query, query.pagination?.limit || 50);

    return {
      items: emails.map(e => this.emailToItem(e)),
      total: emails.length,
      hasMore: false,
      duration: Date.now() - startTime,
      connectorType: 'gmail',
    };
  }

  async read(itemId: string): Promise<ConnectorItem | null> {
    if (this.connectionStatus !== 'connected') await this.connect();

    const email = await this.fetchEmail(itemId);
    return email ? this.emailToItem(email) : null;
  }

  async status(): Promise<ConnectionStatus> {
    if (!this.token) return 'disconnected';
    if (this.token.expiresAt && this.token.expiresAt < Date.now()) return 'expired';
    return this.connectionStatus;
  }

  async permissions(): Promise<string[]> { return this.token?.scopes || []; }

  async health(): Promise<HealthStatus> {
    try {
      await this.fetchUserInfo();
      return 'healthy';
    } catch {
      return 'error';
    }
  }

  metadata(): ConnectorMetadata {
    const capabilities: ConnectorCapabilities = {
      canRead: true,
      canWrite: true,
      canSearch: true,
      canSync: false,
      canPreview: true,
      canDownload: false,
      canUpload: false,
      canDelete: true,
      canShare: false,
      supportsOAuth: true,
      supportsApiKey: false,
      supportsPAT: false,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportsPagination: true,
      supportsRateLimit: true,
    };

    return {
      id: 'gmail',
      type: 'gmail',
      category: 'communication',
      name: 'gmail',
      displayName: 'Gmail',
      description: 'Email service by Google. Connect to read and send emails.',
      icon: 'email',
      color: '#ea4335',
      website: 'https://mail.google.com',
      documentation: 'https://developers.google.com/gmail',
      version: '1.0.0',
      capabilities,
      defaultScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      requiredScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      optionalScopes: ['https://www.googleapis.com/auth/gmail.send'],
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${chrome?.identity?.getRedirectURL?.() || window.location.origin}/oauth/gmail`,
      responseType: 'code',
      grantType: 'authorization_code',
    };
  }

  private async fetchUserInfo(): Promise<GoogleUserInfo> {
    return this.request('GET', 'https://www.googleapis.com/oauth2/v2/userinfo') as Promise<GoogleUserInfo>;
  }

  private async searchEmails(query: string, maxResults: number): Promise<GmailMessage[]> {
    const listResponse = await this.request('GET', `${this.apiBase}/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`) as { messages?: { id: string }[] };

    if (!listResponse.messages) return [];

    return Promise.all(
      listResponse.messages.slice(0, maxResults).map(m => this.fetchEmail(m.id))
    );
  }

  private async fetchEmail(messageId: string): Promise<GmailMessage> {
    return this.request('GET', `${this.apiBase}/users/me/messages/${messageId}`) as Promise<GmailMessage>;
  }

  private emailToItem(email: GmailMessage): ConnectorItem {
    const headers = email.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
    const from = headers.find(h => h.name === 'From')?.value || '';
    const to = headers.find(h => h.name === 'To')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value;

    return {
      id: email.id,
      connectorType: 'gmail',
      itemType: 'email',
      title: subject,
      description: from,
      url: `https://mail.google.com/mail/u/0/#inbox/${email.id}`,
      icon: 'email',
      metadata: { from, to, snippet: email.snippet, threadId: email.threadId },
      tags: email.labelIds || [],
      createdAt: date ? new Date(date).getTime() : email.internalDate ? parseInt(email.internalDate) : undefined,
    };
  }

  private async request(method: string, url: string): Promise<unknown> {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (this.token?.accessToken) headers['Authorization'] = `Bearer ${this.token.accessToken}`;

    const response = await fetch(url, { method, headers });

    if (!response.ok) {
      if (response.status === 401) {
        this.connectionStatus = 'expired';
        throw this.createError('auth_expired', 'Gmail token expired');
      }
      throw this.createError('server_error', 'Gmail API error');
    }

    return response.json();
  }
}

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    mimeType?: string;
    body?: { data?: string };
  };
}

// ============== GOOGLE CALENDAR CONNECTOR ==============

export class GoogleCalendarConnector extends BaseConnector {
  private apiBase = 'https://www.googleapis.com/calendar/v3';
  private user: GoogleUserInfo | null = null;

  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(
      {
        type: 'google_calendar' as const,
        category: 'calendar' as const,
        name: 'Google Calendar Connector',
        version: '1.0.0',
      },
      config
    );
  }

  async connect(credentials?: Record<string, unknown>): Promise<boolean> {
    const token = credentials?.accessToken as string | undefined;

    if (!token && !this.token) {
      throw this.createError('auth_required', 'Google Calendar access token required');
    }

    if (token) {
      this.token = {
        accessToken: token,
        tokenType: 'bearer',
        scopes: credentials?.scopes as string[] || ['https://www.googleapis.com/auth/calendar.readonly'],
      };
    }

    try {
      this.user = await this.fetchUserInfo();
      this.connectionStatus = 'connected';
      this.log('info', `Connected Google Calendar for ${this.user.email}`);
      this.emit('connected', this.user);
      return true;
    } catch (error) {
      this.connectionStatus = 'error';
      throw this.createError('auth_invalid', 'Failed to authenticate Google Calendar');
    }
  }

  async disconnect(): Promise<void> {
    this.user = null;
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
  }

  async authenticate(authCode?: string): Promise<boolean> {
    if (!authCode) throw this.createError('auth_invalid', 'Authorization code required');
    // Same OAuth flow as Gmail
    const gmail = new GmailConnector();
    gmail.getOAuthConfig = () => this.getOAuthConfig();
    await gmail.authenticate(authCode);
    this.token = gmail['token'];
    return this.connect();
  }

  async refresh(): Promise<boolean> {
    if (!this.token?.refreshToken) return false;
    try {
      const oauthConfig = this.getOAuthConfig()!;
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret || '',
          refresh_token: this.token.refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });
      const data = await response.json();
      this.token = {
        accessToken: data.access_token,
        refreshToken: this.token.refreshToken,
        tokenType: 'bearer',
        expiresIn: data.expires_in,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: this.token.scopes,
      };
      return true;
    } catch {
      return false;
    }
  }

  async sync(): Promise<SyncJob> {
    return { id: '', connectorId: '', type: 'full', trigger: 'manual', status: 'completed', progress: 100, itemsTotal: 0, itemsSynced: 0, itemsAdded: 0, itemsUpdated: 0, itemsDeleted: 0, itemsUnchanged: 0, errorCount: 0 };
  }

  async search(query: ConnectorSearchQuery): Promise<ConnectorSearchResult> {
    if (this.connectionStatus !== 'connected') await this.connect();
    const startTime = Date.now();
    const events = await this.searchEvents(query.query, query.pagination?.limit || 50);
    return {
      items: events.map(e => this.eventToItem(e)),
      total: events.length,
      hasMore: false,
      duration: Date.now() - startTime,
      connectorType: 'google_calendar',
    };
  }

  async read(itemId: string): Promise<ConnectorItem | null> {
    if (this.connectionStatus !== 'connected') await this.connect();
    const [calendarId, eventId] = itemId.split('/');
    const event = await this.fetchEvent(calendarId || 'primary', eventId);
    return event ? this.eventToItem(event) : null;
  }

  async status(): Promise<ConnectionStatus> {
    if (!this.token) return 'disconnected';
    if (this.token.expiresAt && this.token.expiresAt < Date.now()) return 'expired';
    return this.connectionStatus;
  }

  async permissions(): Promise<string[]> { return this.token?.scopes || []; }

  async health(): Promise<HealthStatus> {
    try { await this.fetchUserInfo(); return 'healthy'; } catch { return 'error'; }
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'google_calendar',
      type: 'google_calendar',
      category: 'calendar',
      name: 'google_calendar',
      displayName: 'Google Calendar',
      description: 'Calendar scheduling service. Connect to manage events and schedules.',
      icon: 'calendar',
      color: '#4285f4',
      website: 'https://calendar.google.com',
      documentation: 'https://developers.google.com/calendar',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: false, canPreview: false,
        canDownload: false, canUpload: false, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: false, supportsPAT: false, supportsWebhooks: false,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      requiredScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      optionalScopes: ['https://www.googleapis.com/auth/calendar.events'],
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${chrome?.identity?.getRedirectURL?.() || window.location.origin}/oauth/google-calendar`,
      responseType: 'code',
    };
  }

  private async fetchUserInfo(): Promise<GoogleUserInfo> {
    return this.request('GET', 'https://www.googleapis.com/oauth2/v2/userinfo') as Promise<GoogleUserInfo>;
  }

  private async searchEvents(query: string, maxResults: number): Promise<GoogleCalendarEvent[]> {
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const response = await this.request('GET', `${this.apiBase}/calendars/primary/events?q=${encodeURIComponent(query)}&timeMin=${timeMin}&timeMax=${timeMax}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`) as { items: GoogleCalendarEvent[] };
    return response.items || [];
  }

  private async fetchEvent(calendarId: string, eventId: string): Promise<GoogleCalendarEvent | null> {
    try {
      return this.request('GET', `${this.apiBase}/calendars/${calendarId}/events/${eventId}`) as Promise<GoogleCalendarEvent>;
    } catch {
      return null;
    }
  }

  private eventToItem(event: GoogleCalendarEvent): ConnectorItem {
    return {
      id: `primary/${event.id}`,
      connectorType: 'google_calendar',
      itemType: 'event',
      title: event.summary || 'Untitled Event',
      description: event.description,
      url: event.htmlLink,
      icon: 'event',
      metadata: {
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        location: event.location,
        status: event.status,
        attendees: event.attendees?.map(a => a.email),
      },
      tags: [],
      createdAt: event.created ? new Date(event.created).getTime() : undefined,
      updatedAt: event.updated ? new Date(event.updated).getTime() : undefined,
    };
  }

  private async request(method: string, url: string): Promise<unknown> {
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (this.token?.accessToken) headers['Authorization'] = `Bearer ${this.token.accessToken}`;

    const response = await fetch(url, { method, headers });
    if (!response.ok) {
      if (response.status === 401) { this.connectionStatus = 'expired'; throw this.createError('auth_expired', 'Token expired'); }
      throw this.createError('server_error', 'API error');
    }
    return response.json();
  }
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  attendees?: Array<{ email: string; responseStatus?: string }>;
}

// ============== EXPORTS ==============

export function createGoogleConnector(type: ConnectorType): BaseConnector | null {
  switch (type) {
    case 'google_drive':
      return new GoogleDriveConnector();
    case 'google_docs':
      return new GoogleDocsConnector();
    case 'google_sheets':
      return new GoogleSheetsConnector();
    case 'gmail':
      return new GmailConnector();
    case 'google_calendar':
      return new GoogleCalendarConnector();
    default:
      return null;
  }
}
