/**
 * Universal File Picker — Attach files from local, Google Drive, GitHub, Notion, Dropbox, OneDrive.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Folder, File, Image, FileText, RefreshCw, Check, ExternalLink, HardDrive, Cloud, GitBranch, ChevronRight, Upload, Grid2x2 as Grid, List, Clock } from 'lucide-react';
import { getEngine } from '@/engines/base';
import type { InstalledConnector, ConnectorType, ConnectorEngine } from '@/engines/connector';
import type { ConnectorItem, ConnectorItemList } from '@/connectors/types';

// ============== TYPES ==============

export interface FilePickerItem {
  id: string;
  name: string;
  type: 'local' | 'connector';
  source: string; // 'local' or a ConnectorType
  mimeType?: string;
  size?: number;
  url?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  connectorItem?: ConnectorItem;
  localFile?: File;
}

interface UniversalFilePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (files: FilePickerItem[]) => void;
  multiple?: boolean;
  accept?: string[];
  maxFileSize?: number; // in bytes
  sources?: ('local' | 'google_drive' | 'github' | 'notion' | 'dropbox' | 'onedrive')[];
}

// ============== SOURCE CONFIG ==============

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  local: { label: 'Local', icon: <HardDrive className="w-4 h-4" />, color: '#6366F1' },
  google_drive: { label: 'Google Drive', icon: <Cloud className="w-4 h-4" />, color: '#4285F4' },
  github: { label: 'GitHub', icon: <GitBranch className="w-4 h-4" />, color: '#24292E' },
  notion: { label: 'Notion', icon: <FileText className="w-4 h-4" />, color: '#000000' },
  dropbox: { label: 'Dropbox', icon: <Cloud className="w-4 h-4" />, color: '#0061FF' },
  onedrive: { label: 'OneDrive', icon: <Cloud className="w-4 h-4" />, color: '#0078D4' },
};

// ============== MAIN COMPONENT ==============

export const UniversalFilePicker: React.FC<UniversalFilePickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  multiple = true,
  accept,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  sources = ['local', 'google_drive', 'github', 'notion', 'dropbox', 'onedrive'],
}) => {
  const [activeSource, setActiveSource] = useState<string>('local');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [items, setItems] = useState<FilePickerItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [connectedConnectors, setConnectedConnectors] = useState<InstalledConnector[]>([]);

  const engine = getEngine<any>('ConnectorEngine') as ConnectorEngine | undefined;

  // Load connected connectors
  useEffect(() => {
    if (isOpen && engine) {
      const installed = engine.getInstalledConnectors();
      setConnectedConnectors(installed);

      // Set first available connector as active if not local
      if (activeSource !== 'local' && !installed.some((c: InstalledConnector) => c.type === activeSource)) {
        const availableSources = sources.filter(s =>
          s === 'local' || installed.some((c: InstalledConnector) => c.type === s)
        );
        if (availableSources.length > 0) {
          setActiveSource(availableSources[0]);
        }
      }
    }
  }, [isOpen, engine, activeSource, sources]);

  // Load items when source or path changes
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setItems([]);

    try {
      if (activeSource === 'local') {
        // Local files are handled by file input
        setItems([]);
      } else {
        // Load from connector
        const items = await loadConnectorItems(
          activeSource as ConnectorType,
          currentPath.join('/'),
          searchQuery
        );
        setItems(items);
      }
    } catch (error) {
      console.error(`Failed to load items from ${activeSource}:`, error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeSource, currentPath, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  // Handle source change
  const handleSourceChange = (source: string) => {
    setActiveSource(source);
    setCurrentPath([]);
    setSearchQuery('');
    setSelectedItems(new Set());
  };

  // Handle item selection
  const toggleItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);

    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      if (!multiple) {
        newSelected.clear();
      }
      newSelected.add(itemId);
    }

    setSelectedItems(newSelected);
  };

  // Navigate into folder
  const navigateTo = (item: FilePickerItem) => {
    if (item.connectorItem?.itemType === 'folder') {
      setCurrentPath([...currentPath, item.id]);
    }
  };

  // Handle local file selection
  const handleLocalFiles = (files: FileList) => {
    const validFiles: FilePickerItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size
      if (file.size > maxFileSize) {
        console.warn(`File ${file.name} exceeds max size limit`);
        continue;
      }

      // Check accepted types
      if (accept && accept.length > 0) {
        const isAccepted = accept.some(type => {
          if (type.startsWith('.')) {
            return file.name.endsWith(type);
          }
          if (type.includes('*')) {
            const [base] = type.split('/');
            return file.type.startsWith(base);
          }
          return file.type === type;
        });

        if (!isAccepted) {
          console.warn(`File ${file.name} type not accepted`);
          continue;
        }
      }

      validFiles.push({
        id: `local-${Date.now()}-${i}`,
        name: file.name,
        type: 'local',
        source: 'local',
        mimeType: file.type,
        size: file.size,
        localFile: file,
      });
    }

    if (validFiles.length > 0) {
      onSelect(validFiles);
      onClose();
    }
  };

  // Confirm selection
  const handleConfirm = () => {
    const selected = items.filter(item => selectedItems.has(item.id));
    if (selected.length > 0) {
      onSelect(selected);
      onClose();
    }
  };

  const availableSources = useMemo(() => {
    return sources.filter(s =>
      s === 'local' || connectedConnectors.some(c => c.type === s)
    );
  }, [sources, connectedConnectors]);

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
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Select Files
              </h2>

              <div className="flex items-center gap-2">
                {/* View mode toggle */}
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Source tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {availableSources.map((source) => {
                const config = SOURCE_CONFIG[source];
                const isActive = activeSource === source;

                return (
                  <button
                    key={source}
                    onClick={() => handleSourceChange(source)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span style={{ color: isActive ? 'white' : config.color }}>
                      {config.icon}
                    </span>
                    {config.label}
                  </button>
                );
              })}
            </div>

            {/* Search & navigation */}
            {activeSource !== 'local' && (
              <div className="flex items-center gap-3 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {currentPath.length > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <button
                      onClick={() => setCurrentPath([])}
                      className="text-blue-500 hover:underline"
                    >
                      Root
                    </button>
                    {currentPath.map((segment, i) => (
                      <React.Fragment key={i}>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <button
                          onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                          className="text-blue-500 hover:underline"
                        >
                          {segment.slice(0, 20)}
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeSource === 'local' ? (
              /* Local file upload */
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Drag and drop files here, or click to browse
                </p>
                <label className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors">
                  Browse Files
                  <input
                    type="file"
                    accept={accept?.join(',') || undefined}
                    multiple={multiple}
                    onChange={(e) => e.target.files && handleLocalFiles(e.target.files)}
                    className="hidden"
                  />
                </label>

                {accept && (
                  <p className="text-xs text-gray-400 mt-4">
                    Accepted formats: {accept.join(', ')}
                  </p>
                )}

                <p className="text-xs text-gray-400">
                  Max file size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB
                </p>
              </div>
            ) : isLoading ? (
              /* Loading state */
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-12">
                <Folder className="w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No files found matching your search' : 'No files in this folder'}
                </p>

                {!connectedConnectors.some(c => c.type === activeSource) && (
                  <p className="text-sm text-orange-500 mt-2">
                    Connect {SOURCE_CONFIG[activeSource]?.label || activeSource} to browse files
                  </p>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              /* Grid view */
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {items.map((item) => (
                  <FilePickerItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    isFolder={item.connectorItem?.itemType === 'folder'}
                    onToggle={() => toggleItem(item.id)}
                    onNavigate={() => navigateTo(item)}
                    viewMode="grid"
                  />
                ))}
              </div>
            ) : (
              /* List view */
              <div className="space-y-2">
                {items.map((item) => (
                  <FilePickerItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    isFolder={item.connectorItem?.itemType === 'folder'}
                    onToggle={() => toggleItem(item.id)}
                    onNavigate={() => navigateTo(item)}
                    viewMode="list"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {activeSource !== 'local' && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedItems.size} file{selectedItems.size !== 1 ? 's' : ''} selected
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirm}
                  disabled={selectedItems.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Attach {selectedItems.size > 0 && `(${selectedItems.size})`}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============== FILE ITEM CARD ==============

const FilePickerItemCard: React.FC<{
  item: FilePickerItem;
  isSelected: boolean;
  isFolder: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  viewMode: 'grid' | 'list';
}> = ({ item, isSelected, isFolder, onToggle, onNavigate, viewMode }) => {
  const handleClick = () => {
    if (isFolder) {
      onNavigate();
    } else {
      onToggle();
    }
  };

  const icon = isFolder ? (
    <Folder className="w-6 h-6 text-blue-500" />
  ) : item.mimeType?.startsWith('image/') ? (
    <Image className="w-6 h-6 text-green-500" />
  ) : item.mimeType?.includes('pdf') ? (
    <FileText className="w-6 h-6 text-red-500" />
  ) : (
    <File className="w-6 h-6 text-gray-400" />
  );

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        onClick={handleClick}
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500'
            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            icon
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {item.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.size ? formatFileSize(item.size) : isFolder ? 'Folder' : item.mimeType}
          </p>
        </div>

        {!isFolder && (
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isSelected
              ? 'bg-blue-500 border-blue-500 text-white'
              : 'border-gray-300 dark:border-gray-600'
          }`}>
            {isSelected && <Check className="w-4 h-4" />}
          </div>
        )}

        {isFolder && (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      onClick={handleClick}
      className={`relative rounded-lg overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
          : 'hover:shadow-lg'
      }`}
    >
      <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            {React.cloneElement(icon, { className: 'w-8 h-8' })}
          </div>
        )}
      </div>

      <div className="p-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {item.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isFolder ? 'Folder' : (item.size ? formatFileSize(item.size) : '')}
        </p>
      </div>

      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow">
          <Check className="w-4 h-4" />
        </div>
      )}
    </motion.div>
  );
};

// ============== HELPER FUNCTIONS ==============

async function loadConnectorItems(
  source: ConnectorType,
  path: string,
  searchQuery: string
): Promise<FilePickerItem[]> {
  const engine = getEngine<any>('ConnectorEngine');
  if (!engine) return [];

  try {
    const connector = engine.getInstalledConnectors().find((c: InstalledConnector) => c.type === source);
    if (!connector) return [];

    let result: ConnectorItemList;

    if (searchQuery) {
      const searchResult = await engine.searchConnector(connector.id, {
        query: searchQuery,
        pagination: { limit: 50 },
      });
      result = { items: searchResult.items, total: searchResult.total, hasMore: searchResult.hasMore };
    } else {
      result = await engine.listItems(connector.id, path || undefined);
    }

    return result.items.map((item: ConnectorItem) => ({
      id: item.id,
      name: item.title,
      type: 'connector',
      source,
      mimeType: (item.metadata?.mimeType as string) || undefined,
      size: (item.metadata?.size as number) || undefined,
      url: item.url,
      thumbnail: item.thumbnail,
      thumbnailUrl: item.thumbnail,
      connectorItem: item,
    }));
  } catch (error) {
    console.error(`Failed to load items from ${source}:`, error);
    return [];
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default UniversalFilePicker;
