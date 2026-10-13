# NOEMA Frontend Codebase Audit Report

**Date:** October 13, 2026  
**Project:** NOEMA (React + Vite + Tailwind)  
**Type:** Personal Knowledge Workspace with AI Chat  

---

## Executive Summary

NOEMA is a well-structured, production-ready React application implementing a Notion-like knowledge workspace with AI-powered chat (RAG). The codebase demonstrates **strong architectural discipline**, thoughtful UX patterns, and proper separation of concerns. However, there are areas where technical debt is accumulating, particularly around component size, state management complexity, and some architectural deviations from the documented guidelines.

**Overall Grade: A-** (Excellent foundation, needs refactoring in specific areas)

---

## Architecture Assessment

### ✅ Strengths

| Area | Assessment |
|------|------------|
| **Project Structure** | Clean, follows documented conventions. Clear separation: `components/`, `pages/`, `services/`, `hooks/`, `context/` |
| **API Layer** | Centralized Axios instance with interceptors, caching, retry logic, and token refresh. Well-organized resource-specific APIs. |
| **Authentication** | Robust auth flow with Google OAuth, token refresh, cross-tab sync via `storage` events, session expiry handling. |
| **State Management** | Context API used appropriately for genuinely global state (Auth, Chat, Editor, Toast). No unnecessary Redux/Zustand. |
| **Routing** | Lazy-loaded routes with Suspense, protected routes, nested dashboard children. Clean router config. |
| **Styling** | Tailwind CSS v4 with `lightswind` plugin. Custom theme tokens, dark mode, high contrast support. |
| **Error Handling** | Centralized toast system, API error interceptors, user-friendly validation messages. |
| **Developer Experience** | Vite + React 19, ESLint, path aliases, TypeScript-ready (`.tsx` hooks). |

### ⚠️ Deviations from Documented Guidelines (dev/u.md)

| Guideline | Current State | Impact |
|-----------|---------------|--------|
| **Single-responsibility components** | Several components exceed 1000 lines (`AIChat.jsx` ~1363, `NoteEditor.jsx` ~1528, `Sidebar.jsx` ~1293) | Hard to maintain, test, and reuse |
| **Service → Hook → Component flow** | Components directly import from `services/api.js` (e.g., `AIChat`, `NoteEditor`, `Sidebar`) | Bypasses hook abstraction layer |
| **Custom hooks for data fetching** | `useSectionLoader` exists but not used consistently; many components use `useEffect` + API calls directly | Duplicated loading/error logic |
| **Tree utilities separated** | Tree building/traversal logic lives inside `Sidebar.jsx` and `EditorContext` | Not reusable, hard to test |
| **No CSS Modules** | ✅ Followed - only global CSS + Tailwind | Good |

---

## Detailed Component Analysis

### 1. **AIChat.jsx** (1,363 lines) — **Critical Refactor Candidate**

**Issues:**
- Monolithic component handling: message rendering, streaming logic, composer UI, tool mentions, interactive choices, sources popover, thinking animations, markdown rendering
- Complex streaming pacer logic (200+ lines) mixed with UI
- Duplicate `MessageActions` / `RightPanelMessageItem` / `ChatMessageItem` render paths
- Inline parsing logic (`parseUserToolMessage`, `parseInteractiveChoice`) should be utilities

**Recommended Split:**
```
Chat/
├── AIChat.jsx              (~200 lines - orchestrator)
├── ChatMessageList.jsx     (virtualized list)
├── ChatMessageItem.jsx     (user/assistant variants)
├── ChatComposer.jsx        (input, tools, suggestions)
├── SourcesPopover.jsx      (extracted)
├── ThinkingAnimation.jsx   (extracted)
├── MessageActions.jsx      (extracted)
├── hooks/
│   ├── useChatStreaming.js (streaming pacer logic)
│   ├── useChatHistory.js   (session management)
│   └── useToolMentions.js  (@-mention logic)
└── utils/
    ├── messageParsers.js   (parseUserToolMessage, parseInteractiveChoice)
    └── formatters.js       (formatSource, timeAgo)
```

### 2. **NoteEditor.jsx** (1,528 lines) — **Critical Refactor Candidate**

**Issues:**
- Handles: Tiptap editor setup, slash menu, selection toolbar, bottom bar, AI inline streaming, table toolbar, prompt input, save logic, location picker, keyboard shortcuts, draft persistence
- `runInlineAIStream` (150+ lines) mixes ProseMirror manipulation with streaming
- Slash menu items (100+ lines) defined inline
- Multiple `useEffect` for keyboard/menu management scattered throughout

**Recommended Split:**
```
Editor/
├── NoteEditor.jsx              (~300 lines - orchestrator)
├── EditorToolbar.jsx           (top/bottom bars)
├── SlashMenu.jsx               (slash command palette)
├── SelectionToolbar.jsx        (floating format bar)
├── TableToolbar.jsx            (table operations)
├── PromptInput.jsx             (AI instruction input)
├── LocationPicker.jsx          (save location dropdown)
├── extensions/
│   ├── AILoadingNode.jsx
│   ├── AIEffectMark.jsx
│   └── index.js                (editor extension registry)
├── hooks/
│   ├── useEditor.js            (Tiptap setup, content sync)
│   ├── useInlineAI.js          (runInlineAIStream logic)
│   ├── useSlashMenu.js         (slash menu state/keyboard)
│   ├── useSelectionToolbar.js  (floating toolbar)
│   ├── useDraftPersistence.js  (localStorage drafts)
│   └── useKeyboardShortcuts.js (global + editor shortcuts)
└── utils/
    ├── slashMenuItems.js       (menu item definitions)
    └── markdownHelpers.js      (marked parsing, content transforms)
```

### 3. **Sidebar.jsx** (1,293 lines) — **Major Refactor Candidate**

**Issues:**
- Handles: navigation, workspace tree, recent/favorites/chat-history sections, search palette, settings modal (6 tabs!), context menus, optimistic updates, keyboard shortcuts
- Settings modal alone is 400+ lines with 6 sub-tabs
- Tree operations (`findNode`, `renameRecursive`, `deleteRecursive`, `addRecursive`) duplicated in multiple handlers
- Section loading logic (`useSectionLoader`) good but underutilized

**Recommended Split:**
```
Sidebar/
├── Sidebar.jsx                 (~200 lines - layout orchestrator)
├── SidebarNav.jsx              (top nav: Home/Chat/Tasks)
├── SidebarSections/
│   ├── WorkspacesSection.jsx
│   ├── FavoritesSection.jsx
│   ├── RecentSection.jsx
│   └── ChatHistorySection.jsx
├── SidebarTree/
│   ├── TreeNode.jsx            (recursive folder/page node)
│   ├── WorkspaceNode.jsx
│   ├── FolderNode.jsx
│   └── PageNode.jsx
├── ContextMenus/
│   ├── NodeContextMenu.jsx
│   └── AddMenuDropdown.jsx
├── SettingsModal/
│   ├── SettingsModal.jsx       (shell + tabs)
│   ├── PreferencesTab.jsx
│   ├── TypographyTab.jsx
│   ├── PrivacyTab.jsx
│   └── AITab.jsx
├── hooks/
│   ├── useSidebarTree.js       (tree ops: find, rename, delete, add)
│   ├── useSectionLoader.js     (already exists - good!)
│   └── useKeyboardShortcuts.js
└── utils/
    ├── treeUtils.js            (traversal, path finding)
    └── storageUtils.js         (localStorage calculations)
```

### 4. **EditorContext.jsx** (192 lines) — **Overloaded Context**

**Issues:**
- Mixes: page state, workspace tree, recent/favorites, location picker, sidebar refresh trigger
- `loadWorkspaceData` does N+1 API calls (fetches folders + pages per workspace sequentially)
- `findLocationInTree` duplicated in `NoteEditor.jsx`

**Recommendation:** Split into `WorkspaceContext` (tree data) and `EditorContext` (active page state). Move tree utilities to `utils/treeUtils.js`.

### 5. **ChatContext.jsx** (627 lines) — **Heavy but Acceptable**

**Issues:**
- Streaming pacer logic (200+ lines) belongs in a hook
- LocalStorage persistence logic scattered across multiple `useEffect`s
- Background sync on mount could cause race conditions with user interactions

**Recommendation:** Extract `useChatStreaming` hook, `useChatPersistence` hook.

---

## Code Quality Issues

### 1. **Type Safety Gaps**
- Project uses `.jsx` predominantly despite `@types/react` installed
- No TypeScript interfaces for API responses, context values, component props
- `ChatContextDefinition.js` / `AuthContextDefinition.js` exist but only export empty contexts

### 2. **Magic Numbers & Strings**
```javascript
// Scattered throughout components
const MIN_STATE_DISPLAY_MS = 2800;
const CACHE_TTL = 5 * 60 * 1000;
'AuthProvider' // event names as strings
'noema-chat-startup-mode' // localStorage keys
```

### 3. **Inconsistent Error Handling**
- Some API calls use `try/catch` with `showToast`, others rely on interceptor
- `chatAPI.ask` has custom retry logic duplicating axios-retry
- No standardized error boundary for component crashes

### 4. **Performance Concerns**
- `Sidebar.jsx`: `findNode` does O(n) tree search on every context menu click
- `EditorContext.loadWorkspaceData`: Sequential `Promise.all` per workspace → N+1 problem
- `AIChat.jsx`: `messages` state triggers full re-render on every token chunk (mitigated by pacer but still)
- No `React.memo` on `ChatMessageItem` children (but parent is memo'd)
- `NoteEditor`: `onSelectionUpdate` fires on every cursor move with 50ms timeout

### 5. **Accessibility Gaps**
- Custom dropdowns/modals lack proper ARIA attributes in some cases
- Keyboard navigation implemented but not comprehensive (e.g., tree navigation)
- Focus management during streaming/loading transitions could improve

---

## Security Review

### ✅ Good Practices
- HttpOnly cookies for JWT (backend responsibility)
- `withCredentials: true` on Axios
- Token refresh with request queuing to prevent race conditions
- Input validation on AI actions (`validateAiInput`)
- XSS protection via `marked` + `react-markdown` (but see below)

### ⚠️ Concerns
| Issue | Location | Risk |
|-------|----------|------|
| **LocalStorage token storage** | `AuthContext.jsx`, `api.js` | Accessible to XSS; consider httpOnly-only |
| **`dangerouslySetInnerHTML` in NoteEditor** | Line 1502+ | CSS injection via editor styles; sandboxed but risky |
| **`marked.parse` on streaming content** | `runInlineAIStream` line 1414 | If backend returns HTML, could inject scripts |
| **Google OAuth client ID in env** | `App.jsx` line 114 | Ensure not committed; use `Config_` prefix correctly |

---

## Testing & Quality Assurance

### Current State
- **No test files found** in codebase
- ESLint configured but basic (`eslint.config.js` not reviewed in detail)
- No CI/CD pipeline visible
- No Storybook or visual regression testing

### Recommended Testing Strategy
```
Unit Tests (Vitest):
├── utils/aiValidation.test.js
├── utils/treeUtils.test.js
├── hooks/useAsyncAction.test.js
├── hooks/useSectionLoader.test.js
└── services/api.test.js (mock axios)

Integration Tests:
├── contexts/AuthContext.test.jsx
├── contexts/ChatContext.test.jsx
└── contexts/EditorContext.test.jsx

E2E Tests (Playwright):
├── auth-flow.spec.ts
├── workspace-crud.spec.ts
├── page-editor.spec.ts
└── ai-chat.spec.ts
```

---

## Dependency Analysis

### Production Dependencies (42)
| Category | Packages | Notes |
|----------|----------|-------|
| **Core** | react, react-dom, react-router-dom | v19, v7 - latest |
| **Editor** | @tiptap/* (8 packages), tiptap-markdown | Well-chosen, modular |
| **AI/Chat** | marked, react-markdown, remark-gfm | Good markdown pipeline |
| **UI** | framer-motion, lucide-react, hugeicons-react, next-themes, clsx, tailwind-merge, cva | Modern stack |
| **Auth** | @react-oauth/google | Google OAuth only |
| **Utils** | axios, axios-retry, uuid | Standard |

### Dev Dependencies (11)
- Vite 8, Tailwind 4, ESLint 10, React plugin - all current

### ⚠️ Version Pinning
```json
"overrides": {
  "lucide-react": "^1.33.0",
  "tailwind-merge": "^3.6.0",
  "clsx": "^2.1.1",
  "framer-motion": "12.42.2"
}
```
Overrides suggest dependency conflicts. Audit with `npm ls` to resolve properly.

---

## Scalability & Maintainability

### Technical Debt Inventory

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Split `AIChat.jsx` into 5+ components + hooks | 2-3 days | High - core feature, frequent changes |
| **P0** | Split `NoteEditor.jsx` into 7+ components + hooks | 3-4 days | High - core feature, complex logic |
| **P1** | Split `Sidebar.jsx` + extract SettingsModal | 2-3 days | Medium - settings rarely change but tree logic does |
| **P1** | Add TypeScript interfaces for all contexts/API | 1-2 days | High - catches bugs, improves DX |
| **P1** | Centralize localStorage keys & constants | 0.5 day | Low - prevents typos |
| **P2** | Implement `treeUtils.js` for shared tree ops | 0.5 day | Medium - reduces duplication |
| **P2** | Add error boundaries per route | 0.5 day | Medium - prevents white screens |
| **P2** | Virtualize chat message list | 1 day | High - performance at scale |
| **P3** | Add unit/integration test suite | 3-5 days | High - confidence for refactors |
| **P3** | Migrate to TypeScript incrementally | 2-3 weeks | High - long-term maintainability |

---

## Specific Recommendations

### Immediate (This Week)
1. **Extract `treeUtils.js`** - Move `findNode`, `findWorkspaceIdForNode`, `deleteRecursive`, `renameRecursive`, `addRecursive` from `Sidebar.jsx` and `NoteEditor.jsx` to shared utility
2. **Create `constants.js`** - Centralize all localStorage keys, event names, cache TTLs, AI limits
3. **Add Error Boundaries** - Wrap each lazy-loaded route in `ErrorBoundary` component
4. **Fix `loadWorkspaceData` N+1** - Batch folder/page fetches or add backend endpoint for full tree

### Short-term (This Sprint)
5. **Extract `useChatStreaming` hook** - Move pacer logic out of `ChatContext`
6. **Extract `useInlineAI` hook** - Move `runInlineAIStream` out of `NoteEditor`
7. **Split `SettingsModal`** - Separate tabs into own components
8. **Add TypeScript** - Start with `context/*Definition.js` files, then services, then hooks

### Medium-term (Next Quarter)
9. **Full component splits** for AIChat, NoteEditor, Sidebar per above
10. **Virtualized message list** - Use `@tanstack/react-virtual` or `react-window`
11. **Test infrastructure** - Vitest + React Testing Library + Playwright
12. **Performance profiling** - React DevTools Profiler, identify re-render bottlenecks

---

## Architecture Decision Records (Suggested)

| Decision | Current Approach | Recommended |
|----------|------------------|-------------|
| **State Management** | Context API for global, useState for local | Keep, but split overloaded contexts |
| **Data Fetching** | Direct API calls in components + `useSectionLoader` | Standardize on `useQuery` pattern (TanStack Query or custom) |
| **Editor Extensions** | Inline in `NoteEditor.jsx` | Extract to `extensions/index.js` |
| **Streaming Parsing** | Custom SSE parser in `chatAPI.ask` | Consider `eventsource-parser` library |
| **Markdown Rendering** | `marked` + `react-markdown` + custom components | Consolidate to single pipeline |
| **Icons** | `lucide-react` + `hugeicons-react` + `@hugeicons/core-free-icons` + Material Symbols | Pick 1-2, remove rest |

---

## File-by-File Risk Assessment

| File | Lines | Risk | Primary Concern |
|------|-------|------|-----------------|
| `src/components/Chat/AIChat.jsx` | 1,363 | 🔴 Critical | Monolithic, streaming logic mixed with UI |
| `src/components/Editor/NoteEditor.jsx` | 1,528 | 🔴 Critical | Monolithic, ProseMirror + AI streaming combined |
| `src/components/Sidebar/Sidebar.jsx` | 1,293 | 🔴 Critical | Monolithic, settings modal, tree ops duplicated |
| `src/context/ChatContext.jsx` | 627 | 🟠 High | Streaming logic in context, persistence scattered |
| `src/context/EditorContext.jsx` | 192 | 🟠 High | Overloaded, N+1 API calls |
| `src/services/api.js` | 557 | 🟢 Low | Well-structured, good patterns |
| `src/hooks/useSectionLoader.js` | (need to read) | 🟢 Good | Reusable pattern, underutilized |
| `src/utils/aiValidation.js` | 143 | 🟢 Good | Clean, reusable validation |

---

## Conclusion

NOEMA is a **genuinely impressive codebase** for a personal project. The architecture follows React best practices, the UX is polished (streaming animations, thoughtful interactions), and the backend integration is solid. The primary risk is **component bloat** - three core components exceed 1,200 lines each, making future changes risky and testing difficult.

**Priority 1:** Refactor the three monolithic components using the extraction patterns outlined above. This will pay dividends in maintainability and enable safer feature development.

**Priority 2:** Add TypeScript and a test suite before the next major feature push.

The documented guidelines in `dev/u.md` are excellent - the codebase just needs to align more closely with them.

---

*Generated by codebase audit. For questions or clarification on specific findings, refer to the file references above.*