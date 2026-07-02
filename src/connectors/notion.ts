/**
 * Notion Connector — Full Notion API integration.
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
} from './types';

// ============== NOTION API TYPES ==============

interface NotionUser {
  id: string;
  object: 'user';
  name: string | null;
  avatar_url: string | null;
  type: 'person' | 'bot';
  person?: {
    email: string;
  };
}

interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  icon: {
    type: 'emoji' | 'external' | 'file';
    emoji?: string;
    external?: { url: string };
  } | null;
  cover: {
    type: 'external' | 'file';
    external?: { url: string };
  } | null;
  parent: {
    type: 'database_id' | 'page_id' | 'workspace';
    database_id?: string;
    page_id?: string;
    workspace?: boolean;
  };
  properties: Record<string, unknown>;
  url: string;
  public_url?: string;
}

interface NotionDatabase {
  id: string;
  object: 'database';
  created_time: string;
  last_edited_time: string;
  title: Array<{
    type: 'text';
    text: {
      content: string;
      link: string | null;
    };
    plain_text: string;
  }>;
  description: Array<{
    type: 'text';
    text: {
      content: string;
    };
    plain_text: string;
  }>;
  icon: {
    type: 'emoji' | 'external' | 'file';
    emoji?: string;
    external?: { url: string };
  } | null;
  cover: {
    type: 'external' | 'file';
    external?: { url: string };
  } | null;
  parent: {
    type: 'page_id' | 'workspace';
    page_id?: string;
    workspace?: boolean;
  };
  url: string;
  properties: Record<string, unknown>;
}

interface NotionBlock {
  id: string;
  object: 'block';
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  type: string;
  [key: string]: unknown;
}

interface NotionSearchResult {
  object: 'list';
  results: Array<NotionPage | NotionDatabase>;
  next_cursor: string | null;
  has_more: boolean;
  query: string | null;
  page_size: number;
}

interface NotionQueryDatabaseResponse {
  object: 'list';
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
}

interface NotionBlockChildrenResponse {
  object: 'list';
  results: NotionBlock[];
  next_cursor: string | null;
  has_more: boolean;
}

// ============== NOTION CONNECTOR ==============

export class NotionConnector extends BaseConnector {
  private apiBase = 'https://api.notion.com/v1';
  private botUser: NotionUser | null = null;
  private notionVersion = '2022-06-28';

  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(
      {
        type: 'notion' as const,
        category: 'productivity' as const,
        name: 'Notion Connector',
        version: '1.0.0',
      },
      config
    );
  }

  // ============== REQUIRED ABSTRACT METHODS ==============

  async connect(credentials?: Record<string, unknown>): Promise<boolean> {
    const token = credentials?.accessToken as string | undefined;

    if (!token && !this.token) {
      throw this.createError('auth_required', 'Notion access token required');
    }

    if (token) {
      this.token = {
        accessToken: token,
        tokenType: 'bearer',
        scopes: credentials?.scopes as string[] || [],
      };
    }

    try {
      this.botUser = await this.fetchBotUser();
      this.connectionStatus = 'connected';
      this.log('info', `Connected to Notion workspace`);
      this.emit('connected', this.botUser);
      return true;
    } catch (error) {
      this.connectionStatus = 'error';
      throw this.createError('auth_invalid', 'Failed to authenticate with Notion', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    this.botUser = null;
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
    this.log('info', 'Disconnected from Notion');
  }

  async authenticate(authCode?: string): Promise<boolean> {
    // Notion uses a different OAuth flow - typically the access token is obtained
    // through the OAuth callback directly
    if (!authCode) {
      throw this.createError('auth_invalid', 'Authorization code required');
    }

    const oauthConfig = this.getOAuthConfig()!;

    try {
      const response = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: authCode,
          redirect_uri: oauthConfig.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'OAuth failed');
      }

      const data = await response.json();

      this.token = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn: data.expires_in,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        scopes: data['workspace_id'] ? ['read', 'write'] : [],
        metadata: {
          workspaceId: data['workspace_id'],
          workspaceName: data['workspace_name'],
          workspaceIcon: data['workspace_icon'],
        },
      };

      return this.connect();
    } catch (error) {
      throw this.createError('auth_invalid', 'Notion OAuth failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refresh(): Promise<boolean> {
    // Notion tokens don't expire, so no refresh needed
    return this.token !== null;
  }

  async sync(params?: Record<string, unknown>): Promise<SyncJob> {
    const startTime = Date.now();
    const jobId = `notion-sync-${Date.now()}`;

    const job: SyncJob = {
      id: jobId,
      connectorId: this.type,
      type: (params?.type as SyncJob['type']) || 'full',
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

      // Search all pages and databases
      const searchResult = await this.searchNotion('', undefined, 100);
      job.itemsTotal = searchResult.results.length;

      for (let i = 0; i < searchResult.results.length; i++) {
        try {
          const item = searchResult.results[i];
          await this.syncItem(item);
          job.itemsSynced++;
          job.itemsAdded++;
        } catch (error) {
          job.errorCount++;
          job.lastError = error instanceof Error ? error.message : String(error);
          this.log('warn', 'Failed to sync Notion item:', error);
        }

        job.progress = Math.round((i + 1) / searchResult.results.length * 100);
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
    const items: ConnectorItem[] = [];

    try {
      const searchQuery = query.query || '';
      const filters = query.filters || {};
      const limit = query.pagination?.limit || 100;

      // Build filter for page/database
      const filter: Record<string, unknown> = {};
      if (filters.itemTypes && filters.itemTypes.length === 1) {
        filter.property = 'object';
        filter.value = filters.itemTypes[0] === 'page' ? 'page' : 'database';
      }

      const result = await this.searchNotion(searchQuery, filter, limit);

      for (const item of result.results) {
        if (item.object === 'page') {
          items.push(this.pageToItem(item));
        } else if (item.object === 'database') {
          items.push(this.databaseToItem(item));
        }
      }

      return {
        items,
        total: items.length,
        hasMore: result.has_more,
        duration: Date.now() - startTime,
        connectorType: 'notion',
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

    const [type, id] = itemId.split('/') as ['page' | 'database' | 'block', string];

    if (!type || !id) {
      throw this.createError('not_found', `Invalid item ID: ${itemId}`);
    }

    try {
      switch (type) {
        case 'page':
          return await this.getPageItem(id);
        case 'database':
          return await this.getDatabaseItem(id);
        case 'block':
          return await this.getBlockItem(id);
        default:
          throw this.createError('not_found', `Unknown item type: ${type}`);
      }
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
      await this.fetchBotUser();
      return 'healthy';
    } catch {
      return 'error';
    }
  }

  metadata(): ConnectorMetadata {
    return NotionConnector.getStaticMetadata();
  }

  // ============== OAUTH ==============

  async getOAuthUrl(state: string): Promise<string> {
    const config = this.getOAuthConfig()!;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri || '',
      response_type: 'code',
      state,
      owner: 'user',
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, _state: string): Promise<OAuthToken> {
    await this.authenticate(code);
    return this.token!;
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_NOTION_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_NOTION_CLIENT_SECRET || '',
      authorizationUrl: 'https://api.notion.com/v1/oauth/authorize',
      tokenUrl: 'https://api.notion.com/v1/oauth/token',
      revokeUrl: '',
      scopes: ['read', 'write'],
      redirectUri: import.meta.env.VITE_NOTION_REDIRECT_URI || `${chrome?.identity?.getRedirectURL?.() || window.location.origin}/oauth/notion`,
      responseType: 'code',
      grantType: 'authorization_code',
    };
  }

  // ============== LIST OVERRIDES ==============

  async list(filter?: ConnectorFilter): Promise<ConnectorItemList> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    if (filter?.parentId) {
      return this.listChildren(filter.parentId, filter);
    }

    // List all pages and databases
    const result = await this.searchNotion('', undefined, filter?.ids?.length || 100);
    const items: ConnectorItem[] = [];

    for (const item of result.results) {
      if (item.object === 'page') {
        items.push(this.pageToItem(item));
      } else if (item.object === 'database') {
        items.push(this.databaseToItem(item));
      }
    }

    return {
      items,
      total: items.length,
      hasMore: result.has_more,
      nextCursor: result.next_cursor || undefined,
    };
  }

  // ============== NOTION API METHODS ==============

  private async fetchBotUser(): Promise<NotionUser> {
    const response = await this.request('GET', '/users/me') as { results: NotionUser[] };
    return response.results?.find(u => u.type === 'bot') || response as unknown as NotionUser;
  }

  private async fetchPage(pageId: string): Promise<NotionPage> {
    return this.request('GET', `/pages/${pageId}`) as Promise<NotionPage>;
  }

  private async fetchDatabase(databaseId: string): Promise<NotionDatabase> {
    return this.request('GET', `/databases/${databaseId}`) as Promise<NotionDatabase>;
  }

  private async fetchBlockChildren(blockId: string, limit = 100): Promise<NotionBlock[]> {
    const response = await this.request('GET', `/blocks/${blockId}/children?page_size=${limit}`) as NotionBlockChildrenResponse;
    return response.results;
  }

  private async searchNotion(
    query: string,
    filter?: Record<string, unknown>,
    pageSize = 100
  ): Promise<NotionSearchResult> {
    const body: Record<string, unknown> = {
      query,
      page_size: pageSize,
    };

    if (filter) {
      body.filter = filter;
    }

    return this.request('POST', '/search', body) as Promise<NotionSearchResult>;
  }

  private async queryDatabase(
    databaseId: string,
    startCursor?: string
  ): Promise<NotionQueryDatabaseResponse> {
    const url = startCursor
      ? `/databases/${databaseId}/query?start_cursor=${startCursor}`
      : `/databases/${databaseId}/query`;

    return this.request('POST', url, {}) as Promise<NotionQueryDatabaseResponse>;
  }

  // ============== ITEM CONVERTERS ==============

  private pageToItem(page: NotionPage): ConnectorItem {
    const title = this.extractPageTitle(page);
    const icon = page.icon?.type === 'emoji' ? page.icon.emoji : page.icon?.external?.url;

    return {
      id: `page/${page.id}`,
      connectorType: 'notion',
      itemType: 'page',
      parentId: page.parent.database_id
        ? `database/${page.parent.database_id}`
        : page.parent.page_id
          ? `page/${page.parent.page_id}`
          : undefined,
      title,
      url: page.url,
      thumbnail: page.cover?.external?.url || undefined,
      icon: icon || 'page',
      metadata: {
        workspace: page.parent.type === 'workspace',
        archived: page.archived,
        hasChildren: false,
      },
      tags: [page.archived ? 'archived' : ''],
      createdAt: new Date(page.created_time).getTime(),
      updatedAt: new Date(page.last_edited_time).getTime(),
    };
  }

  private databaseToItem(database: NotionDatabase): ConnectorItem {
    const title = database.title.map(t => t.plain_text).join('');
    const icon = database.icon?.type === 'emoji' ? database.icon.emoji : database.icon?.external?.url;

    return {
      id: `database/${database.id}`,
      connectorType: 'notion',
      itemType: 'database',
      parentId: database.parent.page_id ? `page/${database.parent.page_id}` : undefined,
      title,
      description: database.description.map(d => d.plain_text).join('') || undefined,
      url: database.url,
      thumbnail: database.cover?.external?.url || undefined,
      icon: icon || 'database',
      metadata: {
        workspace: database.parent.type === 'workspace',
      },
      tags: [],
      createdAt: new Date(database.created_time).getTime(),
      updatedAt: new Date(database.last_edited_time).getTime(),
    };
  }

  private blockToItem(block: NotionBlock, parentId: string): ConnectorItem {
    const content = this.extractBlockContent(block);

    return {
      id: `block/${block.id}`,
      connectorType: 'notion',
      itemType: 'block',
      parentId,
      title: content.substring(0, 100) || block.type,
      description: content || undefined,
      icon: 'block',
      metadata: {
        type: block.type,
        hasChildren: block.has_children,
      },
      tags: [],
      createdAt: new Date(block.created_time).getTime(),
      updatedAt: new Date(block.last_edited_time).getTime(),
    };
  }

  // ============== EXTRACTORS ==============

  private extractPageTitle(page: NotionPage): string {
    if (!page.properties) return 'Untitled';

    // Try common title property names
    const titleProp = page.properties['Name'] ||
      page.properties['Title'] ||
      page.properties['title'] ||
      page.properties['name'];

    if (titleProp && typeof titleProp === 'object') {
      const prop = titleProp as { title?: Array<{ plain_text: string }> };
      if (prop.title && Array.isArray(prop.title)) {
        return prop.title.map(t => t.plain_text).join('');
      }
    }

    return 'Untitled';
  }

  private extractBlockContent(block: NotionBlock): string {
    const blockType = block.type;
    const content = (block as Record<string, unknown>)[blockType] as Record<string, unknown> | undefined;

    if (!content) return '';

    if (content.rich_text && Array.isArray(content.rich_text)) {
      return content.rich_text.map((t: { plain_text?: string }) => t.plain_text || '').join('');
    }

    if (content.text && Array.isArray(content.text)) {
      return content.text.map((t: { plain_text?: string }) => t.plain_text || '').join('');
    }

    return '';
  }

  // ============== SYNC HELPERS ==============

  private async syncItem(item: NotionPage | NotionDatabase): Promise<void> {
    if (item.object === 'page') {
      this.emit('item-synced', this.pageToItem(item));
    } else {
      this.emit('item-synced', this.databaseToItem(item));
    }
  }

  // ============== ITEM FETCHERS ==============

  private async getPageItem(pageId: string): Promise<ConnectorItem> {
    const page = await this.fetchPage(pageId);
    const item = this.pageToItem(page);

    // Fetch block children for preview
    const blocks = await this.fetchBlockChildren(pageId);
    if (blocks.length > 0) {
      item.content = blocks.map(b => this.extractBlockContent(b)).join('\n');
      item.preview = item.content?.substring(0, 500);
    }

    return item;
  }

  private async getDatabaseItem(databaseId: string): Promise<ConnectorItem> {
    const database = await this.fetchDatabase(databaseId);
    return this.databaseToItem(database);
  }

  private async getBlockItem(blockId: string): Promise<ConnectorItem> {
    const block = await this.request('GET', `/blocks/${blockId}`) as NotionBlock;
    return this.blockToItem(block, '');
  }

  // ============== LIST HELPERS ==============

  private async listChildren(parentId: string, _filter?: ConnectorFilter): Promise<ConnectorItemList> {
    const [type, id] = parentId.split('/') as ['page' | 'database', string];

    const items: ConnectorItem[] = [];

    switch (type) {
      case 'page': {
        // List block children
        const blocks = await this.fetchBlockChildren(id);
        for (const block of blocks) {
          items.push(this.blockToItem(block, parentId));
        }
        break;
      }
      case 'database': {
        // Query database entries
        const result = await this.queryDatabase(id);
        for (const page of result.results) {
          items.push(this.pageToItem(page));
        }
        break;
      }
    }

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }

  // ============== API REQUEST ==============

  private async request(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBase}${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Notion-Version': this.notionVersion,
    };

    if (this.token?.accessToken) {
      headers['Authorization'] = `Bearer ${this.token.accessToken}`;
    }

    // Notion requires a Notion-Integration header but it's the auth token
    if (this.token?.accessToken) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string; error?: string };

      if (response.status === 401) {
        this.connectionStatus = 'expired';
        throw this.createError('auth_expired', 'Notion token expired');
      }

      if (response.status === 403) {
        throw this.createError('permission_denied', error.message || 'Permission denied');
      }

      if (response.status === 404) {
        const notFoundError = new Error('Not found') as Error & { status: number };
        notFoundError.status = 404;
        throw notFoundError;
      }

      if (response.status === 429) {
        throw this.createError('rate_limit_exceeded', 'Notion rate limit exceeded');
      }

      throw this.createError('server_error', error.message || error.error || 'Notion API error', {
        status: response.status,
        error,
      });
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
      canDownload: false,
      canUpload: false,
      canDelete: true,
      canShare: true,
      supportsOAuth: true,
      supportsApiKey: true,
      supportsPAT: false,
      supportsWebhooks: false,
      supportsRealTime: false,
      supportsPagination: true,
      supportsRateLimit: true,
    };

    return {
      id: 'notion',
      type: 'notion',
      category: 'productivity',
      name: 'notion',
      displayName: 'Notion',
      description: 'All-in-one workspace for notes, docs, wikis, and project management. Connect to pages, databases, and blocks.',
      icon: 'notion',
      color: '#ffffff',
      website: 'https://notion.so',
      documentation: 'https://developers.notion.com',
      version: '1.0.0',
      capabilities,
      defaultScopes: ['read', 'write'],
      requiredScopes: ['read'],
      optionalScopes: ['write'],
      rateLimit: {
        requests: 3,
        period: 1,
        unit: 'second',
      },
      supportsMultipleAccounts: false,
    };
  }
}

export default NotionConnector;
