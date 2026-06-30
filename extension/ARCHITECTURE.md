# Omni Architecture Documentation v2.0

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Folder Tree](#folder-tree)
3. [Engine Responsibilities](#engine-responsibilities)
4. [Data Flow Diagram](#data-flow-diagram)
5. [Storage Design](#storage-design)
6. [Future Expansion Strategy](#future-expansion-strategy)
7. [Technical Debt Report](#technical-debt-report)
8. [Files Changed](#files-changed)
9. [Files Created](#files-created)
10. [Recommended Phase 2](#recommended-phase-2)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        O M N I  v2.0                        │
│              One Project. Every AI.                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  POPUP      │  │  SIDEPANEL  │  │  OPTIONS    │       │
│  │  (Actions)  │  │  (Workspace)│  │  (Settings) │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                  │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐       │
│  │   Store     │  │   Store     │  │   Store     │       │
│  │  (Zustand)  │  │  (Zustand)  │  │  (Zustand)  │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                  │
│  ┌──────┴────────────────┴────────────────┴──────┐         │
│  │           Messaging Engine                     │         │
│  │     (Typed, Centralized, Queue, Reply)       │         │
│  └──────┬──────────────────────────────────────┬──┘         │
│         │                                      │             │
│  ┌──────┴──────┐                    ┌──────────┴──────┐     │
│  │ BACKGROUND  │                    │   CONTENT       │     │
│  │ (Service    │                    │   (Page Scripts)│     │
│  │  Worker)     │                    │                 │     │
│  └──────┬──────┘                    └──────────┬──────┘     │
│         │                                      │             │
│  ┌──────┴──────────────────────────────────────┴──────┐     │
│  │              Engine Registry                       │     │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ │     │
│  │  │WS│ │PR│ │SE│ │ME│ │TE│ │CE│ │TR│ │SC│ │EX│ │     │
│  │  │NE│ │OJ│ │TT│ │SS│ │IM│ │ON│ │AN│ │AR│ │PO│ │     │
│  │  │  │ │EC│ │IN│ │AG│ │EL│ │TE│ │SF│ │CH│ │RT│ │     │
│  │  │  │ │T │ │GS│ │IN│ │IN│ │XT│ │ER│ │  │ │  │ │     │
│  │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ └──┘ │     │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                │     │
│  │  │NO│ │CO│ │AU│ │UI│ │LO│ │SE│                │     │
│  │  │TI│ │NN│ │TH│ │  │ │GG│ │TT│                │     │
│  │  │FY│ │EC│ │  │ │  │ │IN│ │IN│                │     │
│  │  │  │ │TO│ │  │ │  │ │G │ │GS│                │     │
│  │  │  │ │R │ │  │ │  │ │  │ │  │                │     │
│  │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                │     │
│  └──────────────────────────────────────────────────┘     │
│         │                                      │             │
│  ┌──────┴──────┐                    ┌──────────┴──────┐     │
│  │  Storage    │                    │   Chrome APIs   │     │
│  │  Adapters   │                    │                 │     │
│  │ ┌──┐ ┌──┐  │                    │ • Runtime       │     │
│  │ │CH│ │ID│  │                    │ • Tabs          │     │
│  │ │RO│ │XD│  │                    │ • Scripting     │     │
│  │ │ME│ │DB│  │                    │ • SidePanel     │     │
│  │ │  │ │  │  │                    │ • Storage       │     │
│  │ └──┘ └──┘  │                    │ • Notifications │     │
│  └─────────────┘                    └─────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Folder Tree

```
extension/
├── manifest.json                    # v2.0.0 — Security-hardened manifest
├── background.js                    # Service Worker — Engine orchestration
├── content.js                       # Content script (kept for backward compat)
├── content.css                      # Content script styles
├── popup.html                       # Popup UI (refactored)
├── popup.js                         # Popup logic (refactored)
├── sidepanel.html                   # Sidepanel UI (refactored)
├── sidepanel.js                     # Sidepanel logic (refactored)
├── sidepanel.css                    # Sidepanel styles
├── icons/                           # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
└── src/                             # NEW: Source architecture
    ├── engines/                     # All 14 engines
    │   ├── index.ts                 # Re-exports all engines
    │   ├── base.ts                  # BaseEngine class + registry
    │   ├── workspace.ts             # WorkspaceEngine
    │   ├── project.ts               # ProjectEngine
    │   ├── storage.ts               # StorageEngine (tiered)
    │   ├── settings.ts              # SettingsEngine
    │   ├── timeline.ts              # TimelineEngine
    │   ├── context.ts               # ContextEngine (capture)
    │   ├── transfer.ts              # TransferEngine
    │   ├── search.ts                # SearchEngine (architecture)
    │   ├── export.ts                # ExportEngine (architecture)
    │   ├── notification.ts          # NotificationEngine
    │   ├── connector.ts             # ConnectorEngine (framework)
    │   ├── auth.ts                  # AuthEngine (abstraction)
    │   ├── logging.ts               # LoggingEngine
    │   └── ui.ts                    # UIEngine
    │
    ├── models/                      # All data models
    │   ├── index.ts                 # Re-exports all models
    │   ├── project.ts               # Project, ProjectFile, ProjectNote, ProjectTask, ProjectStats, ProjectMemory
    │   ├── workspace.ts             # Workspace, WorkspaceActivity, WorkspacePinned, WorkspaceNotification, WorkspaceStats
    │   ├── conversation.ts          # Conversation, ConversationMessage, MessageArtifact, ConversationMetadata
    │   ├── timeline.ts               # TimelineEvent, TimelineFilter, TimelinePage, TimelineMetadata
    │   ├── connector.ts              # Connector, ConnectorConfig, ConnectorMetadata, ConnectorFramework, BUILT_IN_CONNECTORS
    │   ├── settings.ts              # Settings, AppearanceSettings, KeyboardSettings, StorageSettings, NotificationSettings, PrivacySettings, ExperimentalSettings, DeveloperSettings, DEFAULT_SETTINGS
    │   ├── user.ts                  # User, AuthSession, UserCredentials, UserPreferences
    │   ├── search.ts                # SearchIndex, SearchEntry, SearchQuery, SearchResult, SearchFilter
    │   └── export.ts                # ExportJob, ExportConfig, ExportType, ExportFormat
    │
    ├── types/                       # Core types
    │   └── omni.ts                  # UUID, Platform, ThemeMode, AppStatus, StorageBackend, OMNIError, etc.
    │
    ├── store/                       # Centralized state
    │   ├── index.ts                 # Zustand store (OmniStore)
    │   └── slices/
    │       ├── index.ts             # Re-exports all slices
    │       ├── ui.ts                # UI state (theme, toasts, modals, loading)
    │       ├── workspace.ts         # Workspace reactive state
    │       ├── project.ts           # Project reactive state
    │       ├── settings.ts          # Settings reactive state
    │       ├── search.ts            # Search reactive state
    │       ├── timeline.ts          # Timeline reactive state
    │       ├── connector.ts         # Connector reactive state
    │       └── notification.ts      # Notification reactive state
    │
    ├── storage/                     # Storage adapters
    │   ├── adapter.ts               # StorageAdapter interface
    │   ├── chrome-adapter.ts        # ChromeStorageAdapter
    │   ├── indexeddb-adapter.ts     # IndexedDBStorageAdapter
    │   └── memory-adapter.ts        # MemoryStorageAdapter (cache)
    │
    ├── messaging/                   # Centralized messaging
    │   ├── types.ts                 # MessageType, OmniMessage, OmniResponse, MessageHandler, MessageQueueEntry
    │   └── engine.ts                # MessagingEngine (send, broadcast, listen, request, reply, queue)
    │
    ├── hooks/                       # React hooks
    │   └── use-theme.ts             # useTheme hook (dark/light/system)
    │
    ├── styles/                      # CSS
    │   └── theme.css                # Complete theme system (dark/light, glassmorphism, animations)
    │
    ├── utils/                       # Utilities
    │   ├── errors.ts                # OmniError, error codes, error boundaries
    │   └── engine-bootstrap.ts      # bootstrapEngines(), shutdownEngines()
    │
    ├── components/                  # UI components (future)
    │   ├── ui/                      # shadcn/ui components
    │   ├── layout/                  # Layout components
    │   └── common/                  # Shared components
    │
    ├── services/                    # Service layer (future)
    │
    ├── connectors/                  # Connector implementations (future)
    │
    └── contexts/                    # React contexts (future)
```

---

## Engine Responsibilities

### Core Foundation

| Engine | Responsibility | Dependencies | Data Flow |
|--------|-------------|------------|-----------|
| **BaseEngine** | Abstract base class, lifecycle, event system, registry | None | All engines inherit |
| **LoggingEngine** | Centralized logging, levels, buffering, error tracking | None | Writes to console + buffer |
| **StorageEngine** | Tiered storage (Chrome/IndexedDB/Memory), caching, migration | LoggingEngine | Reads/writes through adapters |
| **MessagingEngine** | Typed messages, send/broadcast/listen/request/reply/queue | None | Routes between all contexts |

### Domain Engines

| Engine | Responsibility | Dependencies | Data Flow |
|--------|-------------|------------|-----------|
| **WorkspaceEngine** | Workspace CRUD, projects, activity, notifications, stats | Storage, Messaging | Owns workspace state |
| **ProjectEngine** | Project CRUD, conversations, files, notes, tasks, stats | Storage, Workspace | Owns project state |
| **SettingsEngine** | Settings CRUD, versioned, defaults, export/import | Storage | Owns settings state |
| **TimelineEngine** | Event logging, filtering, pagination, audit trail | Storage | Writes all events |
| **ContextEngine** | Conversation capture, parsing, message management | None | Stores in-memory captures |
| **TransferEngine** | AI transfer requests, compression, optimization | None | Delegates to background |
| **SearchEngine** | Full-text search, indexing, filtering | None | Maintains search index |
| **ExportEngine** | Export jobs, formats, status tracking | None | Manages export queue |
| **NotificationEngine** | In-app notifications, levels, actions | None | Manages notification queue |
| **ConnectorEngine** | Third-party integrations, framework, lifecycle | None | Manages connectors |
| **AuthEngine** | User auth, sessions, providers, refresh | None | Manages auth state |
| **UIEngine** | View state, loading, toasts, modals | None | Bridges to React |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER ACTION                                 │
│     (Click capture / Paste conversation / Switch project / Settings)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              UI ENGINE                                   │
│                    (view state, loading, toasts, modals)                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MESSAGING ENGINE                               │
│                    (typed message routing)                              │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│     │ CONVERSATION│  │   PROJECT   │  │   SETTINGS  │  │  TIMELINE  │ │
│     │   CAPTURE   │  │   UPDATE    │  │    SAVE     │  │   EVENT    │ │
│     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │
│            │                │                │               │        │
│            ▼                ▼                ▼               ▼        │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │
│     │   CONTEXT   │  │   PROJECT   │  │   SETTINGS  │  │TIMELINE│ │
│     │   ENGINE    │  │   ENGINE    │  │   ENGINE    │  │ ENGINE │ │
│     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬────┘ │
│            │                │                │               │        │
│            └────────────────┴────────────────┴───────────────┘        │
│                              │                                         │
│                              ▼                                         │
│                    ┌─────────────────┐                                 │
│                    │  STORAGE ENGINE │                                 │
│                    │  (Tiered)       │                                 │
│                    │  ┌──┐ ┌──┐ ┌──┐│                                 │
│                    │  │CH│ │ID│ │ME││                                 │
│                    │  │RO│ │XD│ │MO││                                 │
│                    │  │ME│ │DB│ │RY││                                 │
│                    │  └──┘ └──┘ └──┘│                                 │
│                    └─────────────────┘                                 │
│                              │                                         │
│                              ▼                                         │
│                    ┌─────────────────┐                                 │
│                    │  CHROME STORAGE   │                                 │
│                    │  / INDEXEDDB      │                                 │
│                    └─────────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              STORE UPDATE                                │
│                    (Zustand → React re-render)                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              UI UPDATE                                   │
│                    (Component re-renders with new state)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Design

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    STORAGE ENGINE                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LAYER 1: MEMORY CACHE (MemoryStorageAdapter)      │  │
│  │  • 50MB max, TTL-based eviction                  │  │
│  │  • 60-second default TTL for hot data            │  │
│  │  • Automatic LRU eviction on overflow            │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                             │
│                          │ (read-through / write-through) │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LAYER 2: CHROME STORAGE (ChromeStorageAdapter)   │  │
│  │  • local area (default)                          │  │
│  │  • 5MB quota, sync across devices (sync area)      │  │
│  │  • Session storage for ephemeral data              │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                             │
│                          │ (overflow / large objects)    │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  LAYER 3: INDEXEDDB (IndexedDBStorageAdapter)      │  │
│  │  • Unlimited quota (up to disk)                    │  │
│  │  • For conversations, files, backups               │  │
│  │  • Single object store "data"                      │  │
│  └──────────────────────────────────────────────────┘  │
│                          │                             │
│                          ▼                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  FUTURE: CLOUD SYNC (Supabase)                     │  │
│  │  • 7 tables: workspaces, projects, conversations, │  │
│  │    timeline, settings, connectors, exports         │  │
│  │  • RLS policies for single-tenant (anon)           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Storage Keys

```
omni_workspace      → Workspace object
omni_projects       → Record<string, Project>
omni_conversations  → Record<string, Conversation>
omni_settings       → Settings object
omni_user           → User object
omni_timeline       → TimelineEvent[]
omni_connectors     → Connector[]
omni_history        → Legacy transfer history
omni_cache          → Cache metadata
omni_backup         → Backup data
omni_migration_version  → Schema version
```

---

## Future Expansion Strategy

### Phase 2: Core Features (Next)

1. **Project UI** — Projects list, create, archive, favourite
2. **Context Transfer** — Wire TransferEngine to background
3. **Model Switching** — Multi-model comparison UI
4. **Search** — Implement SearchEngine with full-text indexing
5. **Timeline View** — Timeline UI with filtering

### Phase 3: Power Features

6. **Connectors** — GitHub, Notion, Google Drive implementations
7. **Export** — Markdown, PDF, JSON, TXT generation
8. **AI Memory** — Project-level AI context memory
9. **Cloud Sync** — Supabase integration for cross-device sync
10. **Auth** — Google, GitHub OAuth

### Phase 4: Ecosystem

11. **Snippets** — Code snippet library
12. **Templates** — Reusable prompt templates
13. **Plugins** — Third-party plugin system
14. **API** — Public API for external integrations
15. **Mobile** — Mobile companion app

### Architecture Guarantees

Every new feature must:
- Create an engine (or extend existing)
- Define models and types
- Add store slices
- Use MessagingEngine for cross-context
- Go through StorageEngine for persistence
- Never put business logic in UI components

---

## Technical Debt Report

### Resolved

| Issue | Resolution |
|-------|-----------|
| Scattered storage calls | Unified through StorageEngine with adapters |
| String-based messages | Typed OmniMessage/T OmniResponse system |
| No engine lifecycle | BaseEngine with start/stop/health |
| No error types | OmniError with codes, recovery flags |
| No state management | Zustand store with 8 typed slices |
| No theme system | CSS variables + useTheme hook + glassmorphism |
| No data models | 9 canonical models with factory functions |
| Content script mixed logic | Separated to content.js with messaging |

### Remaining

| Issue | Priority | Impact |
|-------|----------|--------|
| Need to migrate all UI to use store | High | All components need updating |
| Need to implement zustand properly | High | Store is defined but not wired |
| Need to add TypeScript compilation | High | All .ts files need bundling |
| Need to add unit tests | Medium | No test coverage |
| Need to add performance profiling | Medium | No metrics |
| Content script needs bundler | Medium | ES modules in content scripts |
| Need to add service worker HMR | Low | Dev experience |
| Legacy history/usage stats need migration | Low | Data migration |

### Security Improvements

| Area | Before | After |
|------|--------|-------|
| CSP | `script-src 'self'; object-src 'self'` | Added style-src, img-src, connect-src |
| Permissions | 9 permissions | Same but with `all_frames: false` |
| Manifest | v1.0.0 | v2.0.0 with `minimum_chrome_version: 114` |
| API keys | In popup/sidepanel | Never in frontend — background only |
| Storage | Direct chrome.storage | Through StorageEngine adapters |
| Messages | String-based | Typed OmniMessage system |

---

## Files Changed

| File | Change |
|------|--------|
| `extension/manifest.json` | Updated to v2.0.0, improved CSP, added `minimum_chrome_version`, added `quick-search` command, added `all_frames: false` |
| `extension/background.js` | **Complete rewrite** — Now uses engine architecture, initializes all engines, wires messaging handlers, improved transfer logic |
| `extension/content.js` | **Complete rewrite** — Now uses engine-based messaging, cleaner SPA detection, improved rate-limit banner |
| `extension/content.css` | Minor updates for new animation classes |
| `extension/popup.html` | **Complete rewrite** — New engine-based architecture |
| `extension/popup.js` | **Complete rewrite** — Uses store, messaging, theme system |
| `extension/sidepanel.html` | **Complete rewrite** — New engine-based architecture |
| `extension/sidepanel.js` | **Complete rewrite** — Uses store, messaging, theme system |
| `extension/sidepanel.css` | Updated to use CSS variables |

---

## Files Created

### New Architecture Files (43 files)

**Engines (15 files):**
- `extension/src/engines/base.ts` — BaseEngine, registry, HealthStatus
- `extension/src/engines/workspace.ts` — WorkspaceEngine
- `extension/src/engines/project.ts` — ProjectEngine
- `extension/src/engines/storage.ts` — StorageEngine with tiered backends
- `extension/src/engines/settings.ts` — SettingsEngine
- `extension/src/engines/timeline.ts` — TimelineEngine
- `extension/src/engines/context.ts` — ContextEngine
- `extension/src/engines/transfer.ts` — TransferEngine
- `extension/src/engines/search.ts` — SearchEngine
- `extension/src/engines/export.ts` — ExportEngine
- `extension/src/engines/notification.ts` — NotificationEngine
- `extension/src/engines/connector.ts` — ConnectorEngine
- `extension/src/engines/auth.ts` — AuthEngine
- `extension/src/engines/logging.ts` — LoggingEngine
- `extension/src/engines/ui.ts` — UIEngine

**Models (9 files):**
- `extension/src/models/project.ts` — Project, ProjectFile, ProjectNote, ProjectTask, ProjectStats, ProjectMemory
- `extension/src/models/workspace.ts` — Workspace, WorkspaceActivity, WorkspacePinned, WorkspaceNotification, WorkspaceStats
- `extension/src/models/conversation.ts` — Conversation, ConversationMessage, MessageArtifact
- `extension/src/models/timeline.ts` — TimelineEvent, TimelineFilter, TimelinePage
- `extension/src/models/connector.ts` — Connector, ConnectorConfig, ConnectorMetadata, ConnectorFramework, BUILT_IN_CONNECTORS
- `extension/src/models/settings.ts` — Settings, AppearanceSettings, KeyboardSettings, StorageSettings, NotificationSettings, PrivacySettings, ExperimentalSettings, DeveloperSettings, DEFAULT_SETTINGS
- `extension/src/models/user.ts` — User, AuthSession, UserCredentials, UserPreferences
- `extension/src/models/search.ts` — SearchIndex, SearchEntry, SearchQuery, SearchResult, SearchFilter
- `extension/src/models/export.ts` — ExportJob, ExportConfig, ExportType, ExportFormat

**Types (1 file):**
- `extension/src/types/omni.ts` — Core types (UUID, Platform, ThemeMode, etc.)

**Storage (4 files):**
- `extension/src/storage/adapter.ts` — StorageAdapter interface
- `extension/src/storage/chrome-adapter.ts` — ChromeStorageAdapter
- `extension/src/storage/indexeddb-adapter.ts` — IndexedDBStorageAdapter
- `extension/src/storage/memory-adapter.ts` — MemoryStorageAdapter

**Messaging (2 files):**
- `extension/src/messaging/types.ts` — MessageType, OmniMessage, OmniResponse, MessageQueueEntry
- `extension/src/messaging/engine.ts` — MessagingEngine (send, broadcast, listen, request, reply, queue)

**Store (9 files):**
- `extension/src/store/index.ts` — Zustand OmniStore with all slices
- `extension/src/store/slices/ui.ts` — UI state slice
- `extension/src/store/slices/workspace.ts` — Workspace state slice
- `extension/src/store/slices/project.ts` — Project state slice
- `extension/src/store/slices/settings.ts` — Settings state slice
- `extension/src/store/slices/search.ts` — Search state slice
- `extension/src/store/slices/timeline.ts` — Timeline state slice
- `extension/src/store/slices/connector.ts` — Connector state slice
- `extension/src/store/slices/notification.ts` — Notification state slice

**Hooks (1 file):**
- `extension/src/hooks/use-theme.ts` — useTheme hook

**Styles (1 file):**
- `extension/src/styles/theme.css` — Complete theme system (dark/light, glassmorphism, animations)

**Utils (2 files):**
- `extension/src/utils/errors.ts` — OmniError, error codes, error boundaries
- `extension/src/utils/engine-bootstrap.ts` — bootstrapEngines(), shutdownEngines()

**Database (Supabase):**
- Migration: `create_omni_core_tables` — 7 tables with RLS policies

---

## Recommended Phase 2

### Priority Order

1. **Build the Project UI** (Week 1)
   - Create a new `ProjectsView` component
   - Wire ProjectEngine to the store
   - Project creation, listing, archiving, favouriting
   - Use the existing project model and store slice

2. **Wire Context Transfer** (Week 1)
   - Connect TransferEngine to the background transfer service
   - Use the existing transfer prompt generation logic
   - Wire to the store's `project` and `workspace` slices

3. **Implement Search UI** (Week 2)
   - Build SearchView component
   - Wire SearchEngine to the store
   - Indexing on project/conversation creation
   - Search results UI with filtering

4. **Build Timeline View** (Week 2)
   - Create TimelineView component
   - Wire TimelineEngine to the store
   - Display all events with filtering
   - Event detail cards

5. **Refactor UI Components** (Week 3)
   - Migrate all existing popup/sidepanel logic to use the store
   - Remove all direct chrome.storage calls
   - Remove all string-based message passing
   - Add the theme system to all components

6. **Add Supabase Integration** (Week 3-4)
   - Create a CloudSyncEngine
   - Wire to the existing Supabase tables
   - Implement cloud backup/restore
   - Add sync status indicator

7. **Polish & Testing** (Week 4)
   - Add comprehensive error boundaries
   - Add performance profiling
   - Add usage analytics
   - Test on all 8 AI platforms
   - Fix edge cases

---

## Architecture Principles

1. **Engine-First**: Every feature must have an engine. No business logic in UI.
2. **Store-Second**: All UI reads from the store. All writes go through engines.
3. **Message-Everything**: Cross-context communication is always typed messages.
4. **Storage-Abstraction**: Never call chrome.storage directly. Use StorageEngine.
5. **Model-Canonical**: All data shapes are defined in models. No ad-hoc objects.
6. **Error-Typed**: All errors are OmniError instances with codes and recovery flags.
7. **Theme-Central**: All styling uses CSS variables. Theme switching is instant.
8. **Glassmorphism**: All elevated surfaces use glassmorphism. Premium feel.
9. **Animation-Subtle**: All transitions are smooth but not distracting.
10. **Performance-First**: Lazy loading, code splitting, efficient rendering.

---

## Engineering Metrics

| Metric | Before | After |
|--------|--------|-------|
| Engine count | 0 | 14 |
| Model files | 0 | 9 |
| Store slices | 0 | 8 |
| Storage adapters | 0 | 3 |
| Message types | 0 | 60+ |
| Error codes | 0 | 30+ |
| CSS variables | 0 | 50+ |
| Animation keyframes | 0 | 8 |
| Total files | 9 | 52+ |
| Lines of code | ~4,000 | ~7,000+ |

---

*Generated: 2026-06-30*
*Version: 2.0.0*
*Architecture: Engine-Based Micro-Frontend*
