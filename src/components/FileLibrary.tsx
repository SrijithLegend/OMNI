/**
 * FileLibrary — File management UI components for the workspace.
 */

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { File, Folder, Upload, Download, Trash2, Star, Pin, MoveVertical as MoreVertical, Search, Grid2x2 as Grid, List, FileText, Image, Code, FileSpreadsheet, FileJson, FileArchive, RefreshCw, X, CircleCheck as CheckCircle, CircleAlert as AlertCircle, Loader as Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { WorkspaceFile, Folder as FolderType, FilePreview } from "@/models/workspace";
import { formatFileSize, isImageFile, isCodeFile, isDocumentFile } from "@/models/workspace";

// ============== FILE ICON COMPONENT ==============

interface FileIconProps {
  extension: string;
  className?: string;
  size?: number;
}

export function FileIcon({ extension, className, size = 24 }: FileIconProps) {
  const ext = extension.replace(".", "").toLowerCase();

  if (isImageFile(ext)) {
    return <Image className={cn("text-purple-500", className)} size={size} />;
  }

  if (isCodeFile(ext)) {
    return <Code className={cn("text-green-500", className)} size={size} />;
  }

  if (["csv", "xlsx", "xls"].includes(ext)) {
    return <FileSpreadsheet className={cn("text-emerald-500", className)} size={size} />;
  }

  if (["json", "yaml", "yml", "xml", "toml"].includes(ext)) {
    return <FileJson className={cn("text-yellow-500", className)} size={size} />;
  }

  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) {
    return <FileArchive className={cn("text-orange-500", className)} size={size} />;
  }

  if (isDocumentFile(ext)) {
    return <FileText className={cn("text-blue-500", className)} size={size} />;
  }

  return <File className={cn("text-gray-500", className)} size={size} />;
}

// ============== FILE CARD COMPONENT ==============

interface FileCardProps {
  file: WorkspaceFile;
  onClick?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onTogglePinned?: () => void;
  selected?: boolean;
  mode?: "grid" | "list";
}

export function FileCard({
  file,
  onClick,
  onPreview,
  onDownload,
  onDelete,
  onToggleFavorite,
  onTogglePinned,
  selected = false,
  mode = "grid",
}: FileCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (mode === "list") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
          "hover:bg-muted/50",
          selected && "bg-primary/10 border-primary"
        )}
        onClick={onClick}
      >
        <FileIcon extension={file.extension} size={20} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{file.name}</span>
            {file.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            {file.isPinned && <Pin className="w-3 h-3 text-blue-500" />}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{formatFileSize(file.size)}</span>
            <span>{formatDate(file.updatedAt)}</span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded hover:bg-muted"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-8 z-10 w-40 bg-background border rounded-lg shadow-lg overflow-hidden"
              >
                {onPreview && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onPreview();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> Preview
                  </button>
                )}
                {onDownload && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDownload();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onToggleFavorite();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Star className="w-4 h-4" /> {file.isFavorite ? "Unfavorite" : "Favorite"}
                  </button>
                )}
                {onTogglePinned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onTogglePinned();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Pin className="w-4 h-4" /> {file.isPinned ? "Unpin" : "Pin"}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "relative group p-4 rounded-lg border transition-all cursor-pointer",
        "hover:shadow-md hover:border-primary/20",
        selected && "bg-primary/10 border-primary"
      )}
      onClick={onClick}
    >
      {/* Thumbnail area */}
      <div className="aspect-square rounded-lg bg-muted/30 flex items-center justify-center mb-3 overflow-hidden">
        {file.thumbnailUrl ? (
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <FileIcon extension={file.extension} size={48} className="text-muted-foreground/50" />
        )}
      </div>

      {/* File info */}
      <div className="min-w-0">
        <div className="flex items-center gap-1 mb-1">
          {file.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
          {file.isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
          <span className="font-medium truncate text-sm">{file.name}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg bg-background/90 shadow hover:bg-muted"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-8 z-10 w-40 bg-background border rounded-lg shadow-lg overflow-hidden"
              >
                {onPreview && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onPreview();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> Preview
                  </button>
                )}
                {onDownload && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDownload();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onToggleFavorite();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Star className="w-4 h-4" /> {file.isFavorite ? "Unfavorite" : "Favorite"}
                  </button>
                )}
                {onTogglePinned && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onTogglePinned();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Pin className="w-4 h-4" /> {file.isPinned ? "Unpin" : "Pin"}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ============== FILE UPLOAD DROPZONE ==============

interface FileDropzoneProps {
  onUpload: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function FileDropzone({
  onUpload,
  accept,
  maxFiles = 10,
  disabled = false,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const filtered = accept
      ? files.filter(f => accept.some(a => f.name.endsWith(a.replace(".", ""))))
      : files;

    if (filtered.length > 0) {
      onUpload(filtered.slice(0, maxFiles));
    }
  }, [disabled, accept, maxFiles, onUpload]);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onUpload(files.slice(0, maxFiles));
    }
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
        isDragging && "border-primary bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed",
        !isDragging && !disabled && "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept?.join(",")}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      <Upload className={cn("w-10 h-10 mx-auto mb-3", isDragging ? "text-primary" : "text-muted-foreground/50")} />
      <p className="text-sm text-muted-foreground">
        {isDragging ? "Drop files here" : "Drag and drop files, or click to browse"}
      </p>
      {maxFiles && (
        <p className="text-xs text-muted-foreground/70 mt-1">
          Up to {maxFiles} files
        </p>
      )}
    </div>
  );
}

// ============== FILE PREVIEW MODAL ==============

interface FilePreviewModalProps {
  preview: FilePreview | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
  className?: string;
}

export function FilePreviewModal({
  preview,
  isOpen,
  onClose,
  onDownload,
  className,
}: FilePreviewModalProps) {
  if (!isOpen || !preview) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl bg-background shadow-2xl",
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Preview</h3>
            <div className="flex items-center gap-2">
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
            {preview.error && (
              <div className="flex items-center gap-2 text-red-500 mb-4">
                <AlertCircle className="w-5 h-5" />
                <span>{preview.error}</span>
              </div>
            )}

            {preview.type === "image" && preview.content && (
              <div className="flex items-center justify-center">
                <img
                  src={preview.content}
                  alt="Preview"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}

            {preview.type === "code" && preview.content && (
              <pre className="p-4 rounded-lg bg-muted overflow-auto text-sm font-mono">
                <code className={`language-${preview.language}`}>
                  {preview.content}
                </code>
              </pre>
            )}

            {(preview.type === "text" || preview.type === "markdown" || preview.type === "json") && preview.content && (
              <pre className="p-4 rounded-lg bg-muted overflow-auto text-sm whitespace-pre-wrap">
                {preview.content}
              </pre>
            )}

            {preview.type === "pdf" && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-16 h-16 mb-4" />
                <p>PDF preview requires PDF.js</p>
              </div>
            )}

            {preview.type === "unsupported" && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <File className="w-16 h-16 mb-4" />
                <p>Preview not available for this file type</p>
              </div>
            )}

            {preview.isLarge && !preview.error && (
              <div className="mt-4 text-xs text-muted-foreground text-center">
                File is large. Showing first {preview.content?.length.toLocaleString()} characters.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============== FILE LIST COMPONENT ==============

interface FileListProps {
  files: WorkspaceFile[];
  viewMode?: "grid" | "list";
  onFileClick?: (file: WorkspaceFile) => void;
  onFilePreview?: (file: WorkspaceFile) => void;
  onFileDownload?: (file: WorkspaceFile) => void;
  onFileDelete?: (file: WorkspaceFile) => void;
  onFileFavorite?: (file: WorkspaceFile) => void;
  onFilePin?: (file: WorkspaceFile) => void;
  selectedIds?: UUID[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function FileList({
  files,
  viewMode = "grid",
  onFileClick,
  onFilePreview,
  onFileDownload,
  onFileDelete,
  onFileFavorite,
  onFilePin,
  selectedIds = [],
  loading = false,
  emptyMessage = "No files yet",
  className,
}: FileListProps) {
  if (loading) {
    return (
      <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4", className)}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square rounded-lg bg-muted/30" />
            <div className="mt-2 h-4 bg-muted/30 rounded w-3/4" />
            <div className="mt-1 h-3 bg-muted/30 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <File className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className={cn("space-y-2", className)}>
        <AnimatePresence mode="popLayout">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              mode="list"
              onClick={() => onFileClick?.(file)}
              onPreview={() => onFilePreview?.(file)}
              onDownload={() => onFileDownload?.(file)}
              onDelete={() => onFileDelete?.(file)}
              onToggleFavorite={() => onFileFavorite?.(file)}
              onTogglePinned={() => onFilePin?.(file)}
              selected={selectedIds.includes(file.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4", className)}>
      <AnimatePresence mode="popLayout">
        {files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            onClick={() => onFileClick?.(file)}
            onPreview={() => onFilePreview?.(file)}
            onDownload={() => onFileDownload?.(file)}
            onDelete={() => onFileDelete?.(file)}
            onToggleFavorite={() => onFileFavorite?.(file)}
            onTogglePinned={() => onFilePin?.(file)}
            selected={selectedIds.includes(file.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============== FILE LIBRARY TAB ==============

interface FileLibraryTabProps {
  projectId: UUID;
  files: WorkspaceFile[];
  onUpload: (files: File[]) => void;
  onFilePreview: (file: WorkspaceFile) => void;
  onFileDownload: (file: WorkspaceFile) => void;
  onFileDelete: (file: WorkspaceFile) => void;
  onFileFavorite: (file: WorkspaceFile) => void;
  onFilePin: (file: WorkspaceFile) => void;
  loading?: boolean;
  className?: string;
}

export function FileLibraryTab({
  files,
  onUpload,
  onFilePreview,
  onFileDownload,
  onFileDelete,
  onFileFavorite,
  onFilePin,
  loading = false,
  className,
}: FileLibraryTabProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState<UUID | null>(null);
  const [previewFile, setPreviewFile] = useState<WorkspaceFile | null>(null);
  const [previewData, setPreviewData] = useState<FilePreview | null>(null);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;

    const query = searchQuery.toLowerCase();
    return files.filter(f =>
      f.name.toLowerCase().includes(query) ||
      f.tags.some(t => t.toLowerCase().includes(query))
    );
  }, [files, searchQuery]);

  const handleUpload = useCallback(async (uploadFiles: File[]) => {
    onUpload(uploadFiles);
  }, [onUpload]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 rounded-lg transition-colors",
              viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Upload area */}
      <FileDropzone onUpload={handleUpload} />

      {/* File list */}
      <FileList
        files={filteredFiles}
        viewMode={viewMode}
        onFilePreview={onFilePreview}
        onFileDownload={onFileDownload}
        onFileDelete={onFileDelete}
        onFileFavorite={onFileFavorite}
        onFilePin={onFilePin}
        loading={loading}
      />

      {/* Preview modal */}
      <FilePreviewModal
        preview={previewData}
        isOpen={previewFile !== null}
        onClose={() => {
          setPreviewFile(null);
          setPreviewData(null);
        }}
        onDownload={previewFile ? () => onFileDownload(previewFile) : undefined}
      />
    </div>
  );
}
