# Omni — Project Workspace Architecture

## Overview

The Project Workspace is the central hub of the Omni Chrome Extension. Every future feature (Conversations, Files, Notes, Tasks, Timeline, Connectors) will belong to a Project.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHROME EXTENSION                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     UI Layer (React + Tailwind)                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │  │
│  │  │  Popup      │  │  SidePanel  │  │  Modals (Create/Edit)   │  │  │
│  │  │  (Compact)  │  │  (Full)     │  │  (Shared)               │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │  │
│  │                         │                                              │
│  │  ┌──────────────────────────────────────────────────────────────┐  │
│  │  │  ProjectDashboard · ProjectCard · ProjectDetails · UI Kit     │  │
│  │  │  (Button, Modal, Input, Badge, Textarea, IconPicker, ColorPicker)│  │
│  │  └──────────────────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     State Layer (Zustand)                         │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  useProjectStore                                          │  │  │
│  │  │  · projects, filteredProjects, selectedProjectId          │  │  │
│  │  │  · searchQuery (text, filter, sort, includeArchived)       │  │  │
│  │  │  · computed: stats, recent, pinned, favorite, archived    │  │  │
│  │  │  · actions: create, update, delete, restore, toggle, open  │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Engine Layer (Business Logic)                 │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  ProjectEngine                                              │  │  │
│  │  │  · create()   → validate, dedupe, generate UUID, stamp    │  │  │
│  │  │  · update()   → validate, merge, stamp updatedAt            │  │  │
│  │  │  · softDelete() → mark deleted, clear pins/favs             │  │  │
│  │  │  · restore()  → clear deleted flag                          │  │  │
│  │  │  · permanentDelete() → remove from storage                  │  │  │
│  │  │  · toggleFavorite/Pin/Archive → flip flags, cascade         │  │  │
│  │  │  · open()     → update lastOpenedAt                         │  │  │
│  │  │  · search()   → filter by text, filter, sort                │  │  │
│  │  │  · getStats() → aggregate counts across all projects        │  │  │
│  │  │  · getTemplates() → 6 built-in templates (SW, Research, ...)  │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Storage Layer (Chrome Storage)                │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  StorageEngine                                                │  │  │
│  │  │  · chrome.storage.local under key "omni_projects"            │  │  │
│  │  │  · versioned schema (v1) with migration path                │  │  │
│  │  │  · CRUD + replaceAll + export/import JSON                   │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                            │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     Types Layer (Source of Truth)                 │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  Project, ProjectId, ProjectStats, ProjectMetadata,         │  │  │
│  │  │  ProjectFuture, ProjectTemplate, ProjectFilter,             │  │  │
│  │  │  ProjectSort, ProjectSearchQuery, ProjectCreateInput,         │  │  │
│  │  │  ProjectUpdateInput, ProjectAction, PROJECT_COLORS,         │  │  │
│  │  │  PROJECT_ICONS                                              │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Updated Folder Tree

```
project/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── manifest.json
│   ├── types/
│   │   └── index.ts          # All Project types, constants, enums
│   ├── storage/
│   │   └── index.ts          # Chrome Storage Engine wrapper
│   ├── engines/
│   │   └── index.ts          # ProjectEngine (business logic)
│   ├── state/
│   │   └── index.ts          # Zustand store (useProjectStore)
│   ├── utils/
│   │   └── index.ts          # cn(), formatDate(), formatFullDate()
│   ├── ui/
│   │   ├── Button.tsx        # Reusable button component
│   │   ├── Input.tsx         # Form input with label + error
│   │   ├── Textarea.tsx      # Form textarea with label + error
│   │   ├── Modal.tsx         # Accessible modal (focus trap, ESC, ARIA)
│   │   ├── Badge.tsx         # Status badge component
│   │   ├── IconPicker.tsx    # Icon grid picker (Lucide)
│   │   └── ColorPicker.tsx   # Color swatch picker
│   ├── components/
│   │   ├── ProjectDashboard.tsx   # Main dashboard (stats, filters, grid/list)
│   │   ├── ProjectCard.tsx        # Individual project card with hover actions
│   │   ├── ProjectDetails.tsx     # Slide-over details panel (overview, placeholders)
│   │   ├── CreateProjectModal.tsx # Create project flow with templates
│   │   ├── EditProjectModal.tsx   # Edit project flow (name, desc, icon, color, flags)
│   │   ├── DeleteProjectModal.tsx # Soft/permanent delete confirmation
│   │   ├── SidePanel.tsx          # Side panel entry point
│   │   └── Popup.tsx              # Popup entry point
│   ├── styles/
│   │   └── index.css           # Tailwind + custom styles + Inter font
│   └── entries/
│       ├── sidepanel.html      # SidePanel HTML entry
│       ├── sidepanel.tsx       # SidePanel React mount
│       ├── popup.html          # Popup HTML entry
│       ├── popup.tsx           # Popup React mount
│       └── background.ts       # Service worker (context menus, open sidepanel)
└── dist/
    ├── manifest.json
    ├── background.js
    ├── assets/
    │   ├── index.css
    │   ├── index.js
    │   ├── popup.js
    │   └── sidepanel.js
    └── src/
        └── entries/
            ├── popup.html
            └── sidepanel.html
```

## Project Data Model

```typescript
interface Project {
  id: string;              // UUID v4
  name: string;            // 1-100 chars, unique
  description: string;     // Optional
  icon: string;            // Lucide icon name
  color: string;           // Hex color
  tags: string[];          // Auto-populated from template
  template: string | null; // software, research, startup, college, personal, blank

  // Status flags
  isFavorite: boolean;
  isArchived: boolean;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt: number | null;

  // Timestamps
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms
  lastOpenedAt: number | null;

  // Statistics
  stats: {
    conversationCount: number;
    fileCount: number;
    noteCount: number;
    taskCount: number;
    totalTokens: number;
    totalTime: number;
    activityScore: number;
  };

  // Metadata
  metadata: {
    url: string | null;
    language: string | null;
    framework: string | null;
    version: string | null;
    custom: Record<string, string>;
  };

  // Future integration points
  future: {
    aiMemory: string[];
    connectorIds: string[];
    conversationIds: string[];
    noteIds: string[];
    taskIds: string[];
    timelineIds: string[];
    fileIds: string[];
  };
}
```

## State Flow

```
User Action
    │
    ▼
┌─────────────┐
│   UI Event  │  (click, keydown, input change)
└─────────────┘
    │
    ▼
┌─────────────┐
│ useProjectStore action │  (createProject, updateProject, etc.)
└─────────────┘
    │
    ▼
┌─────────────┐
│ ProjectEngine │  (validate, generate UUID, set timestamps)
└─────────────┘
    │
    ▼
┌─────────────┐
│ StorageEngine │  (chrome.storage.local read/write)
└─────────────┘
    │
    ▼
┌─────────────┐
│   Store reloads │  (loadProjects() → recompute derived state)
└─────────────┘
    │
    ▼
┌─────────────┐
│  UI re-renders │  (filteredProjects, stats, recent, etc.)
└─────────────┘
```

## Storage Flow

```
Chrome Storage (local)
    │
    ├── key: "omni_projects"
    │
    └── value: {
          version: 1,
          projects: Project[],
          lastSync: number
        }

Read Flow:
  chrome.storage.local.get("omni_projects") → deserialize → return Project[]

Write Flow:
  Project → serialize → chrome.storage.local.set({ key: value }) → persist

Migration:
  If version mismatch, reset to empty (v1) with graceful fallback
```

## Component Tree

```
SidePanel / Popup
    └── ProjectDashboard
        ├── Stats Bar (4 cards)
        ├── Search Bar + Filters + Sort
        ├── Error Banner (AnimatePresence)
        ├── Empty State (if no projects)
        ├── Pinned Section (if pinned exist)
        ├── Favorites Section (if favorites exist)
        ├── Recent Section (if recent exist)
        ├── All Projects Grid/List
        └── Modals (create, edit, delete)
        └── ProjectDetails (slide-over)
            ├── Header (name, color, badges, actions)
            ├── Overview (description, tags, timestamps)
            ├── Quick Stats (conversations, files, notes, tasks)
            ├── Conversations (placeholder)
            ├── Files (placeholder)
            ├── Notes (placeholder)
            ├── Tasks (placeholder)
            ├── Timeline (placeholder)
            └── Connectors (placeholder)
```

## Future Integration Points

| Phase | Feature | Integration Point |
|-------|---------|------------------|
| 3 | Conversations | `project.future.conversationIds` + `project.stats.conversationCount` |
| 3 | Context Engine | `project.metadata` (url, language, framework) |
| 3 | Model Switching | `project.metadata.custom.model` |
| 4 | Connectors | `project.future.connectorIds` |
| 4 | Search Engine | Index across `project.name`, `description`, `tags`, `conversations` |
| 4 | Timeline | `project.future.timelineIds` |
| 5 | Notes | `project.future.noteIds` + `project.stats.noteCount` |
| 5 | Tasks | `project.future.taskIds` + `project.stats.taskCount` |
| 5 | File Library | `project.future.fileIds` + `project.stats.fileCount` |
| 6 | AI Memory | `project.future.aiMemory` |
| 6 | AI Comparison | `project.stats.totalTokens`, `project.stats.activityScore` |

## Files Added

1. `src/types/index.ts` — Project model, constants, enums
2. `src/storage/index.ts` — Chrome Storage Engine
3. `src/engines/index.ts` — Project Engine (business logic)
4. `src/state/index.ts` — Zustand store
5. `src/utils/index.ts` — Utility functions (cn, date formatting)
6. `src/ui/Button.tsx` — Button component
7. `src/ui/Input.tsx` — Input component
8. `src/ui/Textarea.tsx` — Textarea component
9. `src/ui/Modal.tsx` — Modal component
10. `src/ui/Badge.tsx` — Badge component
11. `src/ui/IconPicker.tsx` — Icon picker
12. `src/ui/ColorPicker.tsx` — Color picker
13. `src/components/ProjectDashboard.tsx` — Dashboard
14. `src/components/ProjectCard.tsx` — Card
15. `src/components/ProjectDetails.tsx` — Details panel
16. `src/components/CreateProjectModal.tsx` — Create modal
17. `src/components/EditProjectModal.tsx` — Edit modal
18. `src/components/DeleteProjectModal.tsx` — Delete modal
19. `src/components/SidePanel.tsx` — Side panel entry
20. `src/components/Popup.tsx` — Popup entry
21. `src/styles/index.css` — Global styles
22. `src/entries/sidepanel.html` — HTML entry
23. `src/entries/sidepanel.tsx` — React mount
24. `src/entries/popup.html` — HTML entry
25. `src/entries/popup.tsx` — React mount
26. `src/entries/background.ts` — Service worker

## Files Modified

- `package.json` — Added dependencies (react, zustand, framer-motion, lucide-react, uuid, clsx, tailwind-merge)
- `tsconfig.json` — Added paths, baseUrl, types
- `vite.config.ts` — Multi-entry build (popup, sidepanel, background)
- `tailwind.config.js` — Custom theme (colors, fonts, animations)
- `postcss.config.js` — Tailwind + Autoprefixer
- `src/manifest.json` — Chrome extension manifest

## Known Limitations

1. **Chrome Storage only** — No sync across devices via Supabase (user didn't request cloud sync)
2. **No drag-and-drop** — Project reordering not implemented
3. **No bulk actions** — Can't multi-select and delete/archive
4. **No trash view** — Soft-deleted projects are hidden but not shown in a dedicated trash
5. **No project duplicatation** — Clone/copy project not implemented
6. **No custom tags input** — Tags are from template only; free-form tag creation not wired
7. **No project color preview in details** — The color swatch is used for the icon background
8. **No real-time sync** — If the user has multiple Chrome windows open, state won't sync across them
9. **No project icons from custom images** — Only Lucide icons are supported
10. **No project history/audit log** — Changes are not tracked historically

## Preparation Checklist for Phase 3

- [ ] Design conversation data model and link to `project.future.conversationIds`
- [ ] Add `conversation` storage engine
- [ ] Implement `ContextEngine` for capturing page context
- [ ] Implement `ModelSwitcher` for switching between AI providers
- [ ] Build conversation UI inside Project Details
- [ ] Add keyboard shortcuts for quick capture
- [ ] Add real-time indicator for active capture
- [ ] Implement auto-save for conversation drafts
- [ ] Add project-level settings (default model, auto-capture rules)
- [ ] Add project import/export from JSON
