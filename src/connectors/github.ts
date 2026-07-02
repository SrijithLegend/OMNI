/**
 * GitHub Connector — Full GitHub API integration.
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
  ConnectorItemType,
} from './types';

// ============== GITHUB API TYPES ==============

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
  };
  private: boolean;
  fork: boolean;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  language: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
  author?: {
    login: string;
    avatar_url: string;
  };
}

interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
    avatar_url: string;
  };
  head: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
    };
  };
  base: {
    ref: string;
    sha: string;
    repo: {
      full_name: string;
    };
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  draft: boolean;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  repository_url?: string;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: {
    url: string;
  };
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  html_url: string;
  author: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
  html_url: string;
  content?: string;
  encoding?: string;
}

interface GitHubSearchResult {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[] | GitHubIssue[] | GitHubCodeResult[];
}

interface GitHubCodeResult {
  name: string;
  path: string;
  sha: string;
  html_url: string;
  repository: GitHubRepository;
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

// ============== GITHUB CONNECTOR ==============

export class GitHubConnector extends BaseConnector {
  private apiBase = 'https://api.github.com';
  private user: GitHubUser | null = null;
  private rateLimitRemaining = 5000;
  private rateLimitReset = 0;

  constructor(config?: Partial<import('./types').ConnectorConfig>) {
    super(
      {
        type: 'github' as const,
        category: 'development' as const,
        name: 'GitHub Connector',
        version: '1.0.0',
      },
      config
    );
  }

  // ============== REQUIRED ABSTRACT METHODS ==============

  async connect(credentials?: Record<string, unknown>): Promise<boolean> {
    const token = credentials?.accessToken as string | undefined;

    if (!token && !this.token) {
      throw this.createError('auth_required', 'GitHub access token required');
    }

    if (token) {
      this.token = {
        accessToken: token,
        tokenType: 'bearer',
        scopes: credentials?.scopes as string[] || ['repo', 'user'],
      };
    }

    try {
      this.user = await this.fetchUser();
      this.connectionStatus = 'connected';
      this.log('info', `Connected as ${this.user.login}`);
      this.emit('connected', this.user);
      return true;
    } catch (error) {
      this.connectionStatus = 'error';
      throw this.createError('auth_invalid', 'Failed to authenticate with GitHub', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async disconnect(): Promise<void> {
    this.user = null;
    this.token = null;
    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
    this.log('info', 'Disconnected from GitHub');
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
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          code: authCode,
          redirect_uri: oauthConfig.redirectUri,
        }),
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
        scopes: typeof data.scope === 'string' ? data.scope.split(',') : [],
      };

      return this.connect();
    } catch (error) {
      throw this.createError('auth_invalid', 'GitHub OAuth failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async refresh(): Promise<boolean> {
    if (!this.token?.refreshToken) {
      return false;
    }

    const oauthConfig = this.getOAuthConfig()!;

    if (!oauthConfig.refreshTokenUrl) {
      return false;
    }

    try {
      const response = await fetch(oauthConfig.refreshTokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          refresh_token: this.token.refreshToken,
          grant_type: 'refresh_token',
        }),
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
        scopes: typeof data.scope === 'string' ? data.scope.split(',') : this.token.scopes,
      };

      return true;
    } catch (error) {
      throw this.createError('token_refresh_failed', 'Failed to refresh GitHub token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sync(params?: Record<string, unknown>): Promise<SyncJob> {
    const startTime = Date.now();
    const jobId = `github-sync-${Date.now()}`;

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

      const repos = await this.fetchRepositories();
      job.itemsTotal = repos.length;

      for (let i = 0; i < repos.length; i++) {
        try {
          await this.syncRepository(repos[i]);
          job.itemsSynced++;
          job.itemsAdded++;
        } catch (error) {
          job.errorCount++;
          job.lastError = error instanceof Error ? error.message : String(error);
          this.log('warn', `Failed to sync repository ${repos[i].full_name}:`, error);
        }

        job.progress = Math.round((i + 1) / repos.length * 100);
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

      // If searching for a specific item type
      if (filters.itemTypes && filters.itemTypes.length > 0) {
        for (const itemType of filters.itemTypes) {
          const typeItems = await this.searchByType(itemType, searchQuery, filters, query.pagination);
          items.push(...typeItems);
        }
      } else {
        // General search across repositories
        const repos = await this.searchRepositories(searchQuery, query.pagination);
        items.push(...repos);

        // Also search issues if query is meaningful
        if (searchQuery.length >= 3) {
          const issues = await this.searchIssues(searchQuery, query.pagination);
          items.push(...issues);
        }
      }

      return {
        items,
        total: items.length,
        hasMore: false,
        duration: Date.now() - startTime,
        connectorType: 'github',
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

    const [owner, repo, type, ...parts] = itemId.split('/');

    if (!owner || !repo || !type) {
      throw this.createError('not_found', `Invalid item ID: ${itemId}`);
    }

    try {
      switch (type) {
        case 'repo':
          return await this.getRepositoryItem(owner, repo);
        case 'branch':
          return await this.getBranchItem(owner, repo, parts[0]);
        case 'commit':
          return await this.getCommitItem(owner, repo, parts[0]);
        case 'pr':
          return await this.getPullRequestItem(owner, repo, parseInt(parts[0]));
        case 'issue':
          return await this.getIssueItem(owner, repo, parseInt(parts[0]));
        case 'release':
          return await this.getReleaseItem(owner, repo, parts[0]);
        case 'file':
          return await this.getFileItem(owner, repo, parts.join('/'));
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
      const response = await this.request('GET', '/rate_limit');
      const data = response as { resources?: { core?: { remaining: number; reset: number } } };

      this.rateLimitRemaining = data.resources?.core?.remaining ?? 0;
      this.rateLimitReset = data.resources?.core?.reset ?? 0;

      if (this.rateLimitRemaining < 100) {
        return 'degraded';
      }

      return 'healthy';
    } catch {
      return 'error';
    }
  }

  metadata(): ConnectorMetadata {
    return GitHubConnector.getStaticMetadata();
  }

  // ============== OAUTH ==============

  async getOAuthUrl(state: string): Promise<string> {
    const config = this.getOAuthConfig()!;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri || '',
      scope: config.scopes.join(' '),
      state,
      response_type: 'code',
    });

    return `${config.authorizationUrl}?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, _state: string): Promise<OAuthToken> {
    await this.authenticate(code);
    return this.token!;
  }

  getOAuthConfig(): OAuthConfig | undefined {
    return {
      clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_GITHUB_CLIENT_SECRET || '',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      refreshTokenUrl: 'https://github.com/login/oauth/access_token',
      revokeUrl: `https://api.github.com/applications/${import.meta.env.VITE_GITHUB_CLIENT_ID}/grant`,
      scopes: ['repo', 'user', 'read:org'],
      redirectUri: import.meta.env.VITE_GITHUB_REDIRECT_URI || `${chrome?.identity?.getRedirectURL?.() || window.location.origin}/oauth/github`,
      responseType: 'code',
      grantType: 'authorization_code',
    };
  }

  // ============== LIST OVERRIDES ==============

  async list(filter?: ConnectorFilter): Promise<ConnectorItemList> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    const items: ConnectorItem[] = [];

    if (filter?.parentId) {
      // List children of a specific item
      return this.listChildren(filter.parentId, filter);
    }

    if (filter?.itemTypes && filter.itemTypes.length > 0) {
      for (const itemType of filter.itemTypes) {
        const typeItems = await this.listByType(itemType, filter.parentId);
        items.push(...typeItems.items);
      }

      return {
        items,
        total: items.length,
        hasMore: false,
      };
    }

    // Default: list repositories
    const repos = await this.fetchRepositories();

    for (const repo of repos) {
      items.push(this.repositoryToItem(repo));
    }

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }

  async listByType(itemType: ConnectorItemType, parentId?: string): Promise<ConnectorItemList> {
    if (this.connectionStatus !== 'connected') {
      await this.connect();
    }

    const items: ConnectorItem[] = [];

    switch (itemType) {
      case 'repository': {
        if (parentId) {
          const [owner, repo] = parentId.split('/');
          const repos = await this.fetchRepositories(owner);
          items.push(...repos.filter(r => r.name === repo).map(r => this.repositoryToItem(r)));
        } else {
          const repos = await this.fetchRepositories();
          items.push(...repos.map(r => this.repositoryToItem(r)));
        }
        break;
      }
      case 'branch': {
        if (parentId) {
          const [owner, repo] = parentId.split('/');
          const branches = await this.fetchBranches(owner, repo);
          items.push(...branches.map(b => this.branchToItem(b, parentId)));
        }
        break;
      }
      case 'commit': {
        if (parentId) {
          const [owner, repo, ref] = parentId.split('/');
          const commits = await this.fetchCommits(owner, repo, ref);
          items.push(...commits.map(c => this.commitToItem(c, parentId)));
        }
        break;
      }
      case 'pull_request': {
        if (parentId) {
          const [owner, repo] = parentId.split('/');
          const prs = await this.fetchPullRequests(owner, repo);
          items.push(...prs.map(pr => this.pullRequestToItem(pr, parentId)));
        }
        break;
      }
      case 'issue': {
        if (parentId) {
          const [owner, repo] = parentId.split('/');
          const issues = await this.fetchIssues(owner, repo);
          items.push(...issues.map(i => this.issueToItem(i, parentId)));
        }
        break;
      }
      case 'release': {
        if (parentId) {
          const [owner, repo] = parentId.split('/');
          const releases = await this.fetchReleases(owner, repo);
          items.push(...releases.map(r => this.releaseToItem(r, parentId)));
        }
        break;
      }
      case 'file':
      case 'folder': {
        if (parentId) {
          const [owner, repo, branch, ...pathParts] = parentId.split('/');
          const path = pathParts.join('/');
          const contents = await this.fetchContents(owner, repo, path, branch);
          items.push(...contents.map(c => this.fileToItem(c, parentId)));
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

  // ============== GITHUB API METHODS ==============

  private async fetchUser(): Promise<GitHubUser> {
    return this.request('GET', '/user') as Promise<GitHubUser>;
  }

  private async fetchRepositories(owner?: string): Promise<GitHubRepository[]> {
    const endpoint = owner
      ? `/users/${owner}/repos?per_page=100`
      : '/user/repos?per_page=100&affiliation=owner,collaborator,organization_member';

    return this.request('GET', endpoint) as Promise<GitHubRepository[]>;
  }

  private async fetchRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request('GET', `/repos/${owner}/${repo}`) as Promise<GitHubRepository>;
  }

  private async fetchBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.request('GET', `/repos/${owner}/${repo}/branches?per_page=100`) as Promise<GitHubBranch[]>;
  }

  private async fetchCommits(owner: string, repo: string, ref?: string): Promise<GitHubCommit[]> {
    const endpoint = ref
      ? `/repos/${owner}/${repo}/commits?sha=${ref}&per_page=100`
      : `/repos/${owner}/${repo}/commits?per_page=100`;

    return this.request('GET', endpoint) as Promise<GitHubCommit[]>;
  }

  private async fetchPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]> {
    return this.request('GET', `/repos/${owner}/${repo}/pulls?state=all&per_page=100`) as Promise<GitHubPullRequest[]>;
  }

  private async fetchIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
    return this.request('GET', `/repos/${owner}/${repo}/issues?state=all&per_page=100`) as Promise<GitHubIssue[]>;
  }

  private async fetchReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
    return this.request('GET', `/repos/${owner}/${repo}/releases?per_page=100`) as Promise<GitHubRelease[]>;
  }

  private async fetchContents(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFile[]> {
    const endpoint = ref
      ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
      : `/repos/${owner}/${repo}/contents/${path}`;

    return this.request('GET', endpoint) as Promise<GitHubFile[]>;
  }

  private async fetchFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFile> {
    const endpoint = ref
      ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
      : `/repos/${owner}/${repo}/contents/${path}`;

    return this.request('GET', endpoint) as Promise<GitHubFile>;
  }

  private async searchRepositories(query: string, pagination?: { limit?: number }): Promise<ConnectorItem[]> {
    if (!query) {
      const repos = await this.fetchRepositories();
      return repos.slice(0, pagination?.limit || 50).map(r => this.repositoryToItem(r));
    }

    const response = await this.request('GET', `/search/repositories?q=${encodeURIComponent(query)}&per_page=${pagination?.limit || 50}`) as GitHubSearchResult;

    return (response.items as GitHubRepository[]).map(r => this.repositoryToItem(r));
  }

  private async searchIssues(query: string, pagination?: { limit?: number }): Promise<ConnectorItem[]> {
    if (!query) return [];

    const response = await this.request('GET', `/search/issues?q=${encodeURIComponent(query)}&per_page=${pagination?.limit || 50}`) as { items: GitHubIssue[] };

    return response.items
      .filter(item => !item.pull_request)
      .map(i => this.issueToItem(i, i.repository_url ? i.repository_url.split('/').slice(-2).join('/') : ''));
  }

  private async searchCode(
    query: string,
    repo?: string,
    pagination?: { limit?: number }
  ): Promise<ConnectorItem[]> {
    let q = query;
    if (repo) {
      q += ` repo:${repo}`;
    }

    const response = await this.request('GET', `/search/code?q=${encodeURIComponent(q)}&per_page=${pagination?.limit || 50}`) as { items: GitHubCodeResult[] };

    return response.items.map(c => this.codeResultToItem(c));
  }

  // ============== SYNC HELPERS ==============

  private async syncRepository(repo: GitHubRepository): Promise<void> {
    // Emit event for each synced repository
    this.emit('item-synced', this.repositoryToItem(repo));
  }

  // ============== ITEM CONVERTERS ==============

  private repositoryToItem(repo: GitHubRepository): ConnectorItem {
    return {
      id: `${repo.full_name}/repo`,
      connectorType: 'github',
      itemType: 'repository',
      title: repo.name,
      description: repo.description || undefined,
      url: repo.html_url,
      thumbnail: repo.owner.avatar_url,
      icon: 'repository',
      metadata: {
        fullName: repo.full_name,
        owner: repo.owner.login,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        issues: repo.open_issues_count,
        language: repo.language,
        isPrivate: repo.private,
        isFork: repo.fork,
        defaultBranch: repo.default_branch,
        permissions: repo.permissions,
      },
      tags: [repo.language, repo.private ? 'private' : 'public'].filter(Boolean) as string[],
      createdAt: new Date(repo.created_at).getTime(),
      updatedAt: new Date(repo.updated_at).getTime(),
      author: {
        id: String(repo.owner.id),
        name: repo.owner.login,
        avatar: repo.owner.avatar_url,
      },
      permissions: {
        canRead: true,
        canWrite: repo.permissions?.push ?? false,
        canDelete: repo.permissions?.admin ?? false,
        canShare: true,
      },
    };
  }

  private branchToItem(branch: GitHubBranch, parentId: string): ConnectorItem {
    const [owner, repo] = parentId.split('/');
    return {
      id: `${parentId}/branch/${branch.name}`,
      connectorType: 'github',
      itemType: 'branch',
      parentId,
      title: branch.name,
      url: `https://github.com/${owner}/${repo}/tree/${branch.name}`,
      icon: 'branch',
      metadata: {
        sha: branch.commit.sha,
        isProtected: branch.protected,
      },
      tags: [branch.protected ? 'protected' : ''],
      author: this.user ? {
        id: String(this.user.id),
        name: this.user.login,
        avatar: this.user.avatar_url,
      } : undefined,
    };
  }

  private commitToItem(commit: GitHubCommit, parentId: string): ConnectorItem {
    const [owner, repo] = parentId.split('/');
    return {
      id: `${parentId}/commit/${commit.sha}`,
      connectorType: 'github',
      itemType: 'commit',
      parentId,
      title: commit.commit.message.split('\n')[0],
      description: commit.commit.message,
      url: commit.html_url,
      icon: 'commit',
      metadata: {
        sha: commit.sha,
        author: commit.commit.author.name,
        authorEmail: commit.commit.author.email,
      },
      tags: [],
      createdAt: new Date(commit.commit.author.date).getTime(),
      author: commit.author ? {
        id: commit.author.login,
        name: commit.author.login,
        avatar: commit.author.avatar_url,
      } : {
        id: commit.commit.author.email,
        name: commit.commit.author.name,
      },
    };
  }

  private pullRequestToItem(pr: GitHubPullRequest, parentId: string): ConnectorItem {
    return {
      id: `${parentId}/pr/${pr.number}`,
      connectorType: 'github',
      itemType: 'pull_request',
      parentId,
      title: pr.title,
      description: pr.body || undefined,
      url: pr.html_url,
      icon: 'pull-request',
      metadata: {
        number: pr.number,
        state: pr.state,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        isDraft: pr.draft,
        mergedAt: pr.merged_at ? new Date(pr.merged_at).getTime() : undefined,
      },
      tags: [pr.state, pr.draft ? 'draft' : ''],
      createdAt: new Date(pr.created_at).getTime(),
      updatedAt: new Date(pr.updated_at).getTime(),
      author: {
        id: pr.user.login,
        name: pr.user.login,
        avatar: pr.user.avatar_url,
      },
    };
  }

  private issueToItem(issue: GitHubIssue, parentId: string): ConnectorItem {
    return {
      id: `${parentId}/issue/${issue.number}`,
      connectorType: 'github',
      itemType: 'issue',
      parentId,
      title: issue.title,
      description: issue.body || undefined,
      url: issue.html_url,
      icon: 'issue',
      metadata: {
        number: issue.number,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
      },
      tags: [issue.state, ...issue.labels.map(l => l.name)],
      createdAt: new Date(issue.created_at).getTime(),
      updatedAt: new Date(issue.updated_at).getTime(),
      author: {
        id: issue.user.login,
        name: issue.user.login,
        avatar: issue.user.avatar_url,
      },
    };
  }

  private releaseToItem(release: GitHubRelease, parentId: string): ConnectorItem {
    return {
      id: `${parentId}/release/${release.tag_name}`,
      connectorType: 'github',
      itemType: 'release',
      parentId,
      title: release.name || release.tag_name,
      description: release.body || undefined,
      url: release.html_url,
      icon: 'release',
      metadata: {
        tagName: release.tag_name,
        isDraft: release.draft,
        isPrerelease: release.prerelease,
        assets: release.assets.map(a => ({
          name: a.name,
          url: a.browser_download_url,
          size: a.size,
        })),
      },
      tags: [
        release.draft ? 'draft' : '',
        release.prerelease ? 'prerelease' : '',
      ].filter(Boolean) as string[],
      createdAt: new Date(release.created_at).getTime(),
      author: {
        id: release.author.login,
        name: release.author.login,
        avatar: release.author.avatar_url,
      },
    };
  }

  private fileToItem(file: GitHubFile, parentId: string): ConnectorItem {
    return {
      id: `${parentId}/${file.type === 'dir' ? 'folder' : 'file'}/${file.path}`,
      connectorType: 'github',
      itemType: file.type === 'dir' ? 'folder' : 'file',
      parentId,
      title: file.name,
      url: file.html_url,
      icon: file.type === 'dir' ? 'folder' : 'file',
      metadata: {
        path: file.path,
        sha: file.sha,
        size: file.size,
        downloadUrl: file.download_url,
      },
      tags: [],
      author: this.user ? {
        id: String(this.user.id),
        name: this.user.login,
        avatar: this.user.avatar_url,
      } : undefined,
    };
  }

  private codeResultToItem(result: GitHubCodeResult): ConnectorItem {
    return {
      id: `${result.repository.full_name}/file/${result.path}`,
      connectorType: 'github',
      itemType: 'file',
      parentId: result.repository.full_name,
      title: result.name,
      description: result.path,
      url: result.html_url,
      icon: 'file',
      metadata: {
        path: result.path,
        sha: result.sha,
        repository: result.repository.full_name,
      },
      tags: [],
    };
  }

  // ============== ITEM FETCHERS ==============

  private async getRepositoryItem(owner: string, repo: string): Promise<ConnectorItem> {
    const repository = await this.fetchRepository(owner, repo);
    return this.repositoryToItem(repository);
  }

  private async getBranchItem(owner: string, repo: string, branch: string): Promise<ConnectorItem> {
    const branches = await this.fetchBranches(owner, repo);
    const b = branches.find(br => br.name === branch);
    if (!b) throw this.createError('not_found', `Branch not found: ${branch}`);
    return this.branchToItem(b, `${owner}/${repo}`);
  }

  private async getCommitItem(owner: string, repo: string, sha: string): Promise<ConnectorItem> {
    const commit = await this.request('GET', `/repos/${owner}/${repo}/commits/${sha}`) as GitHubCommit;
    return this.commitToItem(commit, `${owner}/${repo}`);
  }

  private async getPullRequestItem(owner: string, repo: string, number: number): Promise<ConnectorItem> {
    const pr = await this.request('GET', `/repos/${owner}/${repo}/pulls/${number}`) as GitHubPullRequest;
    return this.pullRequestToItem(pr, `${owner}/${repo}`);
  }

  private async getIssueItem(owner: string, repo: string, number: number): Promise<ConnectorItem> {
    const issue = await this.request('GET', `/repos/${owner}/${repo}/issues/${number}`) as GitHubIssue;
    return this.issueToItem(issue, `${owner}/${repo}`);
  }

  private async getReleaseItem(owner: string, repo: string, tag: string): Promise<ConnectorItem> {
    const release = await this.request('GET', `/repos/${owner}/${repo}/releases/tags/${tag}`) as GitHubRelease;
    return this.releaseToItem(release, `${owner}/${repo}`);
  }

  private async getFileItem(owner: string, repo: string, path: string): Promise<ConnectorItem> {
    const file = await this.fetchFileContent(owner, repo, path);
    const item = this.fileToItem(file, `${owner}/${repo}/main`);

    if (file.content && file.encoding === 'base64') {
      item.content = atob(file.content.replace(/\n/g, ''));
      item.preview = item.content?.substring(0, 500);
    }

    return item;
  }

  // ============== LIST HELPERS ==============

  private async listChildren(parentId: string, _filter?: ConnectorFilter): Promise<ConnectorItemList> {
    const parts = parentId.split('/');
    const [owner, repo, type] = parts;

    if (!owner || !repo) {
      return { items: [], total: 0, hasMore: false };
    }

    const items: ConnectorItem[] = [];

    switch (type) {
      case 'repo': {
        // List repository children (branches, issues, PRs, releases)
        const [branches, issues, prs, releases] = await Promise.all([
          this.fetchBranches(owner, repo),
          this.fetchIssues(owner, repo),
          this.fetchPullRequests(owner, repo),
          this.fetchReleases(owner, repo),
        ]);

        items.push(...branches.slice(0, 10).map(b => this.branchToItem(b, parentId)));
        items.push(...prs.slice(0, 10).map(pr => this.pullRequestToItem(pr, parentId)));
        items.push(...issues.slice(0, 10).map(i => this.issueToItem(i, parentId)));
        items.push(...releases.slice(0, 5).map(r => this.releaseToItem(r, parentId)));
        break;
      }
      case 'branch': {
        const branchName = parts[3];
        const commits = await this.fetchCommits(owner, repo, branchName);
        items.push(...commits.slice(0, 50).map(c => this.commitToItem(c, parentId)));
        break;
      }
      case 'folder': {
        const pathParts = parts.slice(4);
        const path = pathParts.join('/');
        const contents = await this.fetchContents(owner, repo, path);
        items.push(...contents.map(c => this.fileToItem(c, parentId)));
        break;
      }
    }

    return { items, total: items.length, hasMore: false };
  }

  // ============== SEARCH HELPERS ==============

  private async searchByType(
    itemType: ConnectorItemType,
    query: string,
    filters: ConnectorFilter,
    pagination?: { limit?: number }
  ): Promise<ConnectorItem[]> {
    switch (itemType) {
      case 'repository':
        return this.searchRepositories(query, pagination);
      case 'issue':
        return this.searchIssues(query, pagination);
      case 'file':
        if (filters.parentId) {
          const [owner, repo] = filters.parentId.split('/');
          return this.searchCode(query, `${owner}/${repo}`, pagination);
        }
        return this.searchCode(query, undefined, pagination);
      default:
        return [];
    }
  }

  // ============== API REQUEST ==============

  private async request(method: string, endpoint: string, body?: unknown): Promise<unknown> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBase}${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (this.token?.accessToken) {
      headers['Authorization'] = `Bearer ${this.token.accessToken}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
      };
    }

    const response = await fetch(url, options);

    // Update rate limit info
    const remaining = response.headers.get('X-RateLimit-Remaining');
    const reset = response.headers.get('X-RateLimit-Reset');
    if (remaining) this.rateLimitRemaining = parseInt(remaining);
    if (reset) this.rateLimitReset = parseInt(reset);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));

      if (response.status === 401) {
        this.connectionStatus = 'expired';
        throw this.createError('auth_expired', 'GitHub token expired');
      }

      if (response.status === 403) {
        if (this.rateLimitRemaining === 0) {
          throw this.createError('rate_limit_exceeded', 'GitHub rate limit exceeded', {
            resetAt: new Date(this.rateLimitReset * 1000).toISOString(),
          });
        }
        throw this.createError('permission_denied', error.message || 'Permission denied');
      }

      if (response.status === 404) {
        const notFoundError = new Error('Not found') as Error & { status: number };
        notFoundError.status = 404;
        throw notFoundError;
      }

      throw this.createError('server_error', error.message || 'GitHub API error', {
        status: response.status,
        error,
      });
    }

    if (response.status === 204) {
      return null;
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
      canUpload: false,
      canDelete: false,
      canShare: true,
      supportsOAuth: true,
      supportsApiKey: true,
      supportsPAT: true,
      supportsWebhooks: true,
      supportsRealTime: false,
      supportsPagination: true,
      supportsRateLimit: true,
    };

    return {
      id: 'github',
      type: 'github',
      category: 'development',
      name: 'github',
      displayName: 'GitHub',
      description: 'The complete platform for software development. Connect to repositories, issues, pull requests, and more.',
      icon: 'github',
      color: '#24292e',
      website: 'https://github.com',
      documentation: 'https://docs.github.com',
      version: '1.0.0',
      capabilities,
      defaultScopes: ['repo', 'user'],
      requiredScopes: ['repo'],
      optionalScopes: ['read:org', 'workflow', 'admin:org'],
      rateLimit: {
        requests: 5000,
        period: 3600,
        unit: 'hour',
      },
      supportsMultipleAccounts: false,
    };
  }
}

export default GitHubConnector;
