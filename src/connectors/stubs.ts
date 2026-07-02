/**
 * Connector Stubs — Basic implementations for remaining connectors.
 *
 * These are placeholder implementations that can be expanded with full API integration later.
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
  ConnectionStatus,
  HealthStatus,
  SyncJob,
  ConnectorType,
} from './types';
import type { ConnectorConstructor } from './base';

// ============== STUB CONNECTOR BASE ==============

abstract class StubConnector extends BaseConnector {
  protected accessToken: string | null = null;

  async connect(credentials?: Record<string, unknown>): Promise<boolean> {
    const token = credentials?.accessToken as string | undefined;
    if (!token) {
      throw this.createError('auth_required', `${this.name} access token required`);
    }

    this.accessToken = token;
    this.token = {
      accessToken: token,
      tokenType: 'bearer',
      scopes: [],
    };
    this.connectionStatus = 'connected';
    this.emit('connected');
    this.log('info', 'Connected (stub mode)');
    return true;
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
  }

  async authenticate(authCode?: string): Promise<boolean> {
    if (!authCode) {
      throw this.createError('auth_invalid', 'Authorization code required');
    }
    // In stub mode, we just connect with the code as token
    return this.connect({ accessToken: authCode });
  }

  async refresh(): Promise<boolean> {
    return this.accessToken !== null;
  }

  async sync(): Promise<SyncJob> {
    return {
      id: `${this.type}-sync-${Date.now()}`,
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

  async search(_query: ConnectorSearchQuery): Promise<ConnectorSearchResult> {
    return {
      items: [],
      total: 0,
      hasMore: false,
      duration: 0,
      connectorType: this.type,
    };
  }

  async read(itemId: string): Promise<ConnectorItem | null> {
    this.log('debug', `Stub read: ${itemId}`);
    return null;
  }

  async status(): Promise<ConnectionStatus> {
    return this.connectionStatus;
  }

  async permissions(): Promise<string[]> {
    return [];
  }

  async health(): Promise<HealthStatus> {
    return this.connectionStatus === 'connected' ? 'healthy' : 'unknown';
  }

  abstract metadata(): ConnectorMetadata;
}

// ============== SLACK CONNECTOR ==============

class SlackConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'slack' as const,
      category: 'communication' as const,
      name: 'Slack Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'slack',
      type: 'slack',
      category: 'communication',
      name: 'slack',
      displayName: 'Slack',
      description: 'Business communication platform. Connect to channels, messages, and files.',
      icon: 'message',
      color: '#4A154B',
      website: 'https://slack.com',
      documentation: 'https://api.slack.com',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: false, canPreview: true,
        canDownload: true, canUpload: true, canDelete: false, canShare: true,
        supportsOAuth: true, supportsApiKey: false, supportsPAT: true, supportsWebhooks: true,
        supportsRealTime: true, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['channels:read', 'chat:read'],
      requiredScopes: ['channels:read'],
      optionalScopes: ['chat:write', 'files:read', 'files:write'],
      rateLimit: { requests: 1, period: 1, unit: 'minute' },
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_SLACK_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_SLACK_CLIENT_SECRET || '',
      authorizationUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['channels:read', 'chat:read'],
      redirectUri: import.meta.env.VITE_SLACK_REDIRECT_URI || '',
    };
  }

  async list(): Promise<ConnectorItemList> {
    return { items: [], total: 0, hasMore: false };
  }
}

// ============== DISCORD CONNECTOR ==============

class DiscordConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'discord' as const,
      category: 'communication' as const,
      name: 'Discord Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'discord',
      type: 'discord',
      category: 'communication',
      name: 'discord',
      displayName: 'Discord',
      description: 'Voice, video, and text chat platform. Connect to servers, channels, and messages.',
      icon: 'message',
      color: '#5865F2',
      website: 'https://discord.com',
      documentation: 'https://discord.com/developers/docs',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: false, canPreview: false,
        canDownload: true, canUpload: false, canDelete: false, canShare: false,
        supportsOAuth: true, supportsApiKey: false, supportsPAT: false, supportsWebhooks: true,
        supportsRealTime: true, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['identify', 'guilds'],
      requiredScopes: ['identify'],
      optionalScopes: ['guilds', 'messages.read'],
      rateLimit: { requests: 50, period: 1, unit: 'second' },
      supportsMultipleAccounts: false,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_DISCORD_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_DISCORD_CLIENT_SECRET || '',
      authorizationUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      scopes: ['identify', 'guilds'],
      redirectUri: import.meta.env.VITE_DISCORD_REDIRECT_URI || '',
    };
  }
}

// ============== LINEAR CONNECTOR ==============

class LinearConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'linear' as const,
      category: 'productivity' as const,
      name: 'Linear Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'linear',
      type: 'linear',
      category: 'productivity',
      name: 'linear',
      displayName: 'Linear',
      description: 'Project management and issue tracking. Connect to issues, projects, and teams.',
      icon: 'task',
      color: '#5E6AD2',
      website: 'https://linear.app',
      documentation: 'https://developers.linear.app',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: true, canPreview: false,
        canDownload: false, canUpload: false, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: true, supportsPAT: true, supportsWebhooks: true,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['read', 'write'],
      requiredScopes: ['read'],
      optionalScopes: ['write', 'issues:create', 'issues:delete'],
      rateLimit: { requests: 1500, period: 1, unit: 'hour' },
      supportsMultipleAccounts: false,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_LINEAR_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_LINEAR_CLIENT_SECRET || '',
      authorizationUrl: 'https://linear.app/oauth/authorize',
      tokenUrl: 'https://api.linear.app/oauth/token',
      scopes: ['read', 'write'],
      redirectUri: import.meta.env.VITE_LINEAR_REDIRECT_URI || '',
    };
  }
}

// ============== JIRA CONNECTOR ==============

class JiraConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'jira' as const,
      category: 'productivity' as const,
      name: 'Jira Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'jira',
      type: 'jira',
      category: 'productivity',
      name: 'jira',
      displayName: 'Jira',
      description: 'Issue and project tracking software. Connect to issues, boards, and projects.',
      icon: 'task',
      color: '#0052CC',
      website: 'https://www.atlassian.com/software/jira',
      documentation: 'https://developer.atlassian.com/cloud/jira/platform',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: true, canPreview: false,
        canDownload: true, canUpload: true, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: true, supportsPAT: true, supportsWebhooks: true,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['read:jira-work', 'write:jira-work'],
      requiredScopes: ['read:jira-work'],
      optionalScopes: ['write:jira-work', 'manage:jira-project'],
      rateLimit: { requests: 100, period: 1, unit: 'minute' },
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_JIRA_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_JIRA_CLIENT_SECRET || '',
      authorizationUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      scopes: ['read:jira-work', 'write:jira-work'],
      redirectUri: import.meta.env.VITE_JIRA_REDIRECT_URI || '',
    };
  }
}

// ============== FIGMA CONNECTOR ==============

class FigmaConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'figma' as const,
      category: 'design' as const,
      name: 'Figma Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'figma',
      type: 'figma',
      category: 'design',
      name: 'figma',
      displayName: 'Figma',
      description: 'Collaborative design platform. Connect to designs, frames, and components.',
      icon: 'design',
      color: '#F24E1E',
      website: 'https://figma.com',
      documentation: 'https://www.figma.com/developers/api',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: false, canSearch: true, canSync: false, canPreview: true,
        canDownload: true, canUpload: false, canDelete: false, canShare: true,
        supportsOAuth: true, supportsApiKey: false, supportsPAT: true, supportsWebhooks: false,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['file_read'],
      requiredScopes: ['file_read'],
      optionalScopes: ['file_write', 'project_read'],
      rateLimit: { requests: 100, period: 1, unit: 'minute' },
      supportsMultipleAccounts: false,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_FIGMA_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_FIGMA_CLIENT_SECRET || '',
      authorizationUrl: 'https://www.figma.com/oauth',
      tokenUrl: 'https://www.figma.com/api/oauth/token',
      scopes: ['file_read'],
      redirectUri: import.meta.env.VITE_FIGMA_REDIRECT_URI || '',
    };
  }
}

// ============== TRELLO CONNECTOR ==============

class TrelloConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'trello' as const,
      category: 'productivity' as const,
      name: 'Trello Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'trello',
      type: 'trello',
      category: 'productivity',
      name: 'trello',
      displayName: 'Trello',
      description: 'Visual project management with boards and cards. Connect to boards, lists, and cards.',
      icon: 'board',
      color: '#0079BF',
      website: 'https://trello.com',
      documentation: 'https://developer.atlassian.com/cloud/trello',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: false, canPreview: false,
        canDownload: false, canUpload: true, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: true, supportsPAT: false, supportsWebhooks: true,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['read', 'write'],
      requiredScopes: ['read'],
      optionalScopes: ['write', 'account'],
      rateLimit: { requests: 300, period: 10, unit: 'second' },
      supportsMultipleAccounts: false,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_TRELLO_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_TRELLO_CLIENT_SECRET || '',
      authorizationUrl: 'https://trello.com/1/authorize',
      tokenUrl: 'https://trello.com/1/OAuthGetAccessToken',
      scopes: ['read', 'write'],
      redirectUri: import.meta.env.VITE_TRELLO_REDIRECT_URI || '',
    };
  }
}

// ============== DROPBOX CONNECTOR ==============

class DropboxConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'dropbox' as const,
      category: 'storage' as const,
      name: 'Dropbox Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'dropbox',
      type: 'dropbox',
      category: 'storage',
      name: 'dropbox',
      displayName: 'Dropbox',
      description: 'Cloud storage and file synchronization. Connect to files, folders, and shared drives.',
      icon: 'folder',
      color: '#0061FF',
      website: 'https://dropbox.com',
      documentation: 'https://www.dropbox.com/developers',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: true, canPreview: true,
        canDownload: true, canUpload: true, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: false, supportsPAT: false, supportsWebhooks: false,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['files.metadata.read', 'files.content.read'],
      requiredScopes: ['files.metadata.read'],
      optionalScopes: ['files.content.write', 'sharing.read', 'sharing.write'],
      rateLimit: { requests: 500, period: 1, unit: 'minute' },
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_DROPBOX_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_DROPBOX_CLIENT_SECRET || '',
      authorizationUrl: 'https://www.dropbox.com/oauth2/authorize',
      tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
      scopes: ['files.metadata.read', 'files.content.read'],
      redirectUri: import.meta.env.VITE_DROPBOX_REDIRECT_URI || '',
    };
  }
}

// ============== ONEDRIVE CONNECTOR ==============

class OneDriveConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'onedrive' as const,
      category: 'storage' as const,
      name: 'OneDrive Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'onedrive',
      type: 'onedrive',
      category: 'storage',
      name: 'onedrive',
      displayName: 'OneDrive',
      description: 'Microsoft cloud storage. Connect to files, folders, and shared libraries.',
      icon: 'folder',
      color: '#0078D4',
      website: 'https://onedrive.com',
      documentation: 'https://learn.microsoft.com/onedrive/developer',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: true, canPreview: true,
        canDownload: true, canUpload: true, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: false, supportsPAT: false, supportsWebhooks: true,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['Files.Read', 'Files.Read.All'],
      requiredScopes: ['Files.Read'],
      optionalScopes: ['Files.ReadWrite', 'Files.ReadWrite.All'],
      rateLimit: { requests: 1000, period: 5, unit: 'minute' },
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_MS_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_MS_CLIENT_SECRET || '',
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['Files.Read', 'Files.Read.All'],
      redirectUri: import.meta.env.VITE_MS_REDIRECT_URI || '',
    };
  }
}

// ============== CONFLUENCE CONNECTOR ==============

class ConfluenceConnector extends StubConnector {
  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super({
      type: 'confluence' as const,
      category: 'knowledge' as const,
      name: 'Confluence Connector',
      version: '1.0.0',
    }, config);
  }

  metadata(): ConnectorMetadata {
    return {
      id: 'confluence',
      type: 'confluence',
      category: 'knowledge',
      name: 'confluence',
      displayName: 'Confluence',
      description: 'Enterprise wiki and knowledge base. Connect to pages, spaces, and content.',
      icon: 'page',
      color: '#172B4D',
      website: 'https://www.atlassian.com/software/confluence',
      documentation: 'https://developer.atlassian.com/cloud/confluence',
      version: '1.0.0',
      capabilities: {
        canRead: true, canWrite: true, canSearch: true, canSync: true, canPreview: true,
        canDownload: true, canUpload: true, canDelete: true, canShare: true,
        supportsOAuth: true, supportsApiKey: true, supportsPAT: true, supportsWebhooks: true,
        supportsRealTime: false, supportsPagination: true, supportsRateLimit: true,
      },
      defaultScopes: ['read:confluence-content.all', 'read:confluence-space.summary'],
      requiredScopes: ['read:confluence-content.all'],
      optionalScopes: ['write:confluence-content', 'manage:confluence-configuration'],
      rateLimit: { requests: 100, period: 1, unit: 'minute' },
      supportsMultipleAccounts: true,
    };
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_JIRA_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_JIRA_CLIENT_SECRET || '',
      authorizationUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      scopes: ['read:confluence-content.all', 'read:confluence-space.summary'],
      redirectUri: import.meta.env.VITE_CONFLUENCE_REDIRECT_URI || '',
    };
  }
}

// ============== FACTORY FUNCTION ==============

export function createStubConnector(type: ConnectorType): ConnectorConstructor {
  const connectorMap: Record<string, ConnectorConstructor> = {
    slack: SlackConnector as unknown as ConnectorConstructor,
    discord: DiscordConnector as unknown as ConnectorConstructor,
    linear: LinearConnector as unknown as ConnectorConstructor,
    jira: JiraConnector as unknown as ConnectorConstructor,
    figma: FigmaConnector as unknown as ConnectorConstructor,
    trello: TrelloConnector as unknown as ConnectorConstructor,
    dropbox: DropboxConnector as unknown as ConnectorConstructor,
    onedrive: OneDriveConnector as unknown as ConnectorConstructor,
    confluence: ConfluenceConnector as unknown as ConnectorConstructor,
  };

  return connectorMap[type] || class GenericStub extends StubConnector {
    constructor(config?: Partial<import('./types').ConnectorConfig>) {
      super({
        type: type as ConnectorType,
        category: 'productivity' as const,
        name: `${type} Connector`,
        version: '1.0.0',
      }, config);
    }

    metadata(): ConnectorMetadata {
      return {
        id: type,
        type: type as ConnectorType,
        category: 'productivity',
        name: type,
        displayName: type.charAt(0).toUpperCase() + type.slice(1),
        description: `${type} connector (stub implementation)`,
        icon: 'item',
        color: '#6366F1',
        website: '#',
        documentation: '#',
        version: '1.0.0',
        capabilities: {
          canRead: true, canWrite: false, canSearch: false, canSync: false, canPreview: false,
          canDownload: false, canUpload: false, canDelete: false, canShare: false,
          supportsOAuth: false, supportsApiKey: false, supportsPAT: false, supportsWebhooks: false,
          supportsRealTime: false, supportsPagination: false, supportsRateLimit: false,
        },
        defaultScopes: [],
        requiredScopes: [],
        optionalScopes: [],
        supportsMultipleAccounts: false,
      };
    }
  } as unknown as ConnectorConstructor;
}

// ============== EXPORTS ==============

export {
  SlackConnector,
  DiscordConnector,
  LinearConnector,
  JiraConnector,
  FigmaConnector,
  TrelloConnector,
  DropboxConnector,
  OneDriveConnector,
  ConfluenceConnector,
};
