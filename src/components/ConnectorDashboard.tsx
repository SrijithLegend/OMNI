/**
 * Connector Dashboard — Manage all connected platforms.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Link2, Unlink2, Settings, Search, Check, CircleAlert as AlertCircle, Clock, HardDrive, Activity, Shield, Trash2, ExternalLink, ChevronRight, Filter } from 'lucide-react';
import { getEngine } from '@/engines/base';
import type { ConnectorEngine, InstalledConnector, ConnectorMetadata, ConnectorType } from '@/engines/connector';
import type { ConnectorCategory, ConnectionStatus } from '@/connectors/types';

// Re-export InstalledConnector for external use
export type { InstalledConnector, ConnectorType } from '@/engines/connector';

// ============== TYPES ==============

interface ConnectorDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConnectorCardProps {
  metadata: ConnectorMetadata;
  isInstalled: boolean;
  connector?: InstalledConnector;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  onRemove: () => void;
}

// ============== CATEGORY DATA ==============

const CATEGORIES: { id: ConnectorCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'development', label: 'Development', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'productivity', label: 'Productivity', icon: <Activity className="w-4 h-4" /> },
  { id: 'storage', label: 'Storage', icon: <HardDrive className="w-4 h-4" /> },
  { id: 'communication', label: 'Communication', icon: <Activity className="w-4 h-4" /> },
  { id: 'design', label: 'Design', icon: <Activity className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar', icon: <Clock className="w-4 h-4" /> },
  { id: 'knowledge', label: 'Knowledge', icon: <Activity className="w-4 h-4" /> },
];

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connected: 'text-green-500',
  disconnected: 'text-gray-400',
  connecting: 'text-blue-500',
  error: 'text-red-500',
  expired: 'text-orange-500',
  revoked: 'text-red-500',
};

const STATUS_BG_COLORS: Record<ConnectionStatus, string> = {
  connected: 'bg-green-500/10',
  disconnected: 'bg-gray-500/10',
  connecting: 'bg-blue-500/10',
  error: 'bg-red-500/10',
  expired: 'bg-orange-500/10',
  revoked: 'bg-red-500/10',
};

// ============== MAIN COMPONENT ==============

export const ConnectorDashboard: React.FC<ConnectorDashboardProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ConnectorCategory | null>(null);
  const [installedConnectors, setInstalledConnectors] = useState<InstalledConnector[]>([]);
  const [availableConnectors, setAvailableConnectors] = useState<ConnectorMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const engine = getEngine<any>('ConnectorEngine') as ConnectorEngine | undefined;

  const loadData = useCallback(async () => {
    if (!engine) return;

    setIsLoading(true);
    try {
      const installed = engine.getInstalledConnectors();
      const available = engine.getAvailableConnectorsMetadata();

      setInstalledConnectors(installed);
      setAvailableConnectors(available);
    } catch (error) {
      console.error('Failed to load connectors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [engine]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleConnect = async (type: string) => {
    if (!engine) return;

    try {
      await engine.installConnector(type as ConnectorType);
      await loadData();
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = async (connectorId: string) => {
    if (!engine) return;

    try {
      await engine.disconnectConnector(connectorId as ConnectorType);
      await loadData();
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSync = async (connectorId: string) => {
    if (!engine) return;

    try {
      await engine.queueSync(connectorId as ConnectorType, 'manual');
      await loadData();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleRemove = async (connectorId: string) => {
    if (!engine) return;

    try {
      await engine.uninstallConnector(connectorId as ConnectorType);
      await loadData();
    } catch (error) {
      console.error('Failed to remove:', error);
    }
  };

  const filteredAvailable = availableConnectors.filter(conn => {
    const matchesSearch = !searchQuery ||
      conn.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || conn.category === selectedCategory;

    const isNotInstalled = !installedConnectors.some(
      ic => ic.type === conn.type
    );

    return matchesSearch && matchesCategory && isNotInstalled;
  });

  const filteredInstalled = installedConnectors.filter(conn => {
    const matchesSearch = !searchQuery ||
      conn.metadata.displayName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = !selectedCategory || conn.metadata.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Connectors
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Connect to external platforms and services
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Filters */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search connectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  !selectedCategory
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>

              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    selectedCategory === cat.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('installed')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'installed'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Connected ({installedConnectors.length})
              </button>
              <button
                onClick={() => setActiveTab('available')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === 'available'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Available ({filteredAvailable.length})
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : activeTab === 'installed' ? (
              filteredInstalled.length === 0 ? (
                <div className="text-center py-12">
                  <Link2 className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No connectors installed
                  </p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Browse Connectors
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredInstalled.map((connector) => (
                    <InstalledConnectorCard
                      key={connector.id}
                      connector={connector}
                      onSync={() => handleSync(connector.id)}
                      onDisconnect={() => handleDisconnect(connector.id)}
                      onRemove={() => handleRemove(connector.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAvailable.map((metadata) => (
                  <AvailableConnectorCard
                    key={metadata.type}
                    metadata={metadata}
                    onConnect={() => handleConnect(metadata.type)}
                  />
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============== INSTALLED CONNECTOR CARD ==============

const InstalledConnectorCard: React.FC<{
  connector: InstalledConnector;
  onSync: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}> = ({ connector, onSync, onDisconnect, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = connector.connector['connectionStatus'] as ConnectionStatus || 'disconnected';

  const lastSyncText = connector.lastSyncAt
    ? new Date(connector.lastSyncAt).toLocaleString()
    : 'Never';

  return (
    <motion.div
      layout
      className="bg-gray-50 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: connector.metadata.color }}
            >
              {connector.metadata.displayName.charAt(0)}
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {connector.metadata.displayName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {connector.metadata.description.slice(0, 50)}...
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${STATUS_BG_COLORS[status]}`}>
            <span className={`w-2 h-2 rounded-full ${
              status === 'connected' ? 'bg-green-500' :
              status === 'error' ? 'bg-red-500' :
              status === 'expired' ? 'bg-orange-500' :
              'bg-gray-400'
            }`} />
            <span className={`text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
              {status}
            </span>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <span>Details</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Last Sync</p>
                  <p className="font-medium text-gray-900 dark:text-white">{lastSyncText}</p>
                </div>

                <div>
                  <p className="text-gray-500 dark:text-gray-400">Version</p>
                  <p className="font-medium text-gray-900 dark:text-white">{connector.metadata.version}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {connector.metadata.capabilities.canRead && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded text-xs">
                    Read
                  </span>
                )}
                {connector.metadata.capabilities.canWrite && (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs">
                    Write
                  </span>
                )}
                {connector.metadata.capabilities.canSync && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs">
                    Sync
                  </span>
                )}
              </div>

              {connector.account && (
                <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  {connector.account.accountAvatar ? (
                    <img src={connector.account.accountAvatar} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {connector.account.accountName?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {connector.account.accountName || connector.account.accountEmail}
                    </p>
                    {connector.account.workspaceName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {connector.account.workspaceName}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={onSync}
                  disabled={status !== 'connected'}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Sync
                </button>

                <button
                  onClick={onDisconnect}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  <Unlink2 className="w-4 h-4" />
                  Disconnect
                </button>

                <button
                  onClick={onRemove}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============== AVAILABLE CONNECTOR CARD ==============

const AvailableConnectorCard: React.FC<{
  metadata: ConnectorMetadata;
  onConnect: () => void;
}> = ({ metadata, onConnect }) => {
  return (
    <motion.div
      layout
      className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: metadata.color }}
        >
          {metadata.displayName.charAt(0)}
        </div>

        <div>
          <h3 className="font-medium text-gray-900 dark:text-white">
            {metadata.displayName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
            {metadata.category}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
        {metadata.description}
      </p>

      <div className="flex items-center gap-2 flex-wrap mb-4">
        {metadata.capabilities.canRead && (
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
            Read
          </span>
        )}
        {metadata.capabilities.canWrite && (
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
            Write
          </span>
        )}
        {metadata.capabilities.supportsOAuth && (
          <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
            OAuth
          </span>
        )}
      </div>

      <button
        onClick={onConnect}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
      >
        <Link2 className="w-4 h-4" />
        Connect
      </button>
    </motion.div>
  );
};

export default ConnectorDashboard;
