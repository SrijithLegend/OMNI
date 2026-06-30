/**
 * Connector Slice — Reactive state for connector integrations.
 */

export interface ConnectorSlice {
  connectors: Connector[];
  isLoading: boolean;
  activeConnectorId: string | null;
  errors: ConnectorError[];
}

export interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  enabled: boolean;
  status: string;
  config: Record<string, unknown>;
  lastSyncAt?: number;
  errorCount: number;
  lastError?: string;
}

export interface ConnectorError {
  connectorId: string;
  message: string;
  timestamp: number;
}

export const initialConnectorSlice: ConnectorSlice = {
  connectors: [],
  isLoading: false,
  activeConnectorId: null,
  errors: [],
};
