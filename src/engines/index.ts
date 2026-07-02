/**
 * Omni Engines — All core engines exported from one place.
 */

export * from "./base";
export * from "./project";
export * from "./capture";
export * from "./summary";
export * from "./model-registry";
export * from "./ai-switch";
export * from "./context-transfer";

// Workspace engines
export * from "./file-library";
export * from "./notes";
export * from "./tasks";
export * from "./snippets";
export * from "./clipboard";
export * from "./activity";

// Phase 6: Productivity engines
// Note: SearchEngine has its own types that don't conflict with connector types
export {
  SearchEngine,
  getSearchEngine,
  highlightMatch,
  type SearchableType,
  type SearchEntry,
  type SearchQuery,
  type SearchResult,
  type ConnectorSearchResult as EngineConnectorSearchResult,
  type UnifiedSearchResult,
  type SearchFilter,
  type IndexProgress,
  type SavedSearch,
} from "./search";

export * from "./analytics";
export * from "./export";
export * from "./import";

// Phase 7: Connector ecosystem
// Explicitly export to avoid conflicts with HealthStatus from base
export {
  ConnectorEngine,
  getConnectorEngine,
  type InstalledConnector,
  type ConnectorType,
  type ConnectorMetadata,
  type ConnectorItem,
  type ConnectorSearchQuery,
  type ConnectorSearchResult,
  type ConnectorConfig,
  type OAuthToken,
  type ConnectorAccount,
  type SyncJob,
  type SyncQueueItem,
  type ConnectionStatus,
  type ConnectorError,
} from "./connector";
