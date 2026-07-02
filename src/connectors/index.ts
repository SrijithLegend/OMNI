/**
 * Connectors Index — Export all connectors.
 */

// Export types first
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
  ConnectorConstructor,
  ConnectorRegistry,
} from './types';

// Export base and connectors
export { BaseConnector } from './base';
export * from './github';
export * from './notion';
export * from './google';
export * from './stubs';

// Connector registry for easy instantiation
import type { ConnectorType, ConnectorConstructor, ConnectorRegistry } from './types';
import { GitHubConnector } from './github';
import { NotionConnector } from './notion';
import { GoogleDriveConnector, GoogleDocsConnector, GoogleSheetsConnector, GmailConnector, GoogleCalendarConnector } from './google';
import { createStubConnector } from './stubs';

export const connectorRegistry: ConnectorRegistry = new Map<ConnectorType, ConnectorConstructor>([
  ['github', GitHubConnector as unknown as ConnectorConstructor],
  ['notion', NotionConnector as unknown as ConnectorConstructor],
  ['google_drive', GoogleDriveConnector as unknown as ConnectorConstructor],
  ['google_docs', GoogleDocsConnector as unknown as ConnectorConstructor],
  ['google_sheets', GoogleSheetsConnector as unknown as ConnectorConstructor],
  ['gmail', GmailConnector as unknown as ConnectorConstructor],
  ['google_calendar', GoogleCalendarConnector as unknown as ConnectorConstructor],
  // Stubs for remaining connectors
  ['slack', createStubConnector('slack')],
  ['discord', createStubConnector('discord')],
  ['linear', createStubConnector('linear')],
  ['jira', createStubConnector('jira')],
  ['figma', createStubConnector('figma')],
  ['trello', createStubConnector('trello')],
  ['dropbox', createStubConnector('dropbox')],
  ['onedrive', createStubConnector('onedrive')],
  ['confluence', createStubConnector('confluence')],
]);

export function getConnectorClass(type: ConnectorType): ConnectorConstructor | undefined {
  return connectorRegistry.get(type);
}

export function registerConnector(type: ConnectorType, connector: ConnectorConstructor): void {
  connectorRegistry.set(type, connector);
}

export function getAvailableConnectors(): ConnectorType[] {
  return Array.from(connectorRegistry.keys());
}
