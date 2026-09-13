# MNEME Frontend Rules & Context

## 1. Application

MNEME is a personal knowledge workspace.

Core experience:

Create notes
    ↓
Organize into workspaces/folders
    ↓
Read & edit pages
    ↓
Search knowledge
    ↓
Ask AI about notes

MNEME is NOT a generic Notion clone.
The main differentiator is AI-powered retrieval over the user's own knowledge.

---

## 2. Current Backend

Backend is already implemented with:

- Node.js
- Express.js
- MongoDB + Mongoose

### Authentication
- Local authentication
- Google OAuth
- Register
- Login
- Logout
- Authenticated user handling

### Workspace
- Workspace CRUD
- Workspace belongs to a User

### Folder
- Folder CRUD
- Folder belongs to a Workspace
- Nested folders supported through `parentFolderId`

### Page
- Page CRUD
- Page belongs to a Workspace
- Page can optionally belong to a Folder
- Page contains content
- Page stores creator

### AI / RAG
Already implemented and tested:

Page Content
    ↓
Chunking
    ↓
Embedding Generation
    ↓
Vector Retrieval
    ↓
Relevant Chunks
    ↓
LLM
    ↓
Answer

Embedding generation and retrieval are working.

Frontend must treat AI/RAG as backend APIs.

Do NOT implement:
- embeddings
- chunking
- vector search
- LLM logic
- database logic

inside React.

---

## 3. Data Relationships

All models are separate MongoDB collections.

User
│
└── Workspace
      │
      ├── Folder
      │    ├── Page
      │    └── Folder
      │         └── Page
      │
      └── Page

Relations use MongoDB ObjectId references.

Frontend should NOT assume the backend stores one giant nested document.

Frontend receives data and builds the tree required by the UI.

Example:

Workspace
│
├── JavaScript
│   ├── Basics
│   │   ├── Variables
│   │   └── Functions
│   │
│   └── Advanced
│       ├── Promises
│       └── Event Loop
│
└── React
    ├── Hooks
    └── Components

---

## 4. Frontend Stack

Use:

- React.js
- Vite
- React Router DOM
- Tailwind CSS
- Axios
- React Context API
- Lucide React
- Tiptap for the page editor

Do NOT introduce Redux, Zustand, MobX, or another state-management library unless there is a real requirement.

Do NOT add libraries unnecessarily.

---

## 5. Folder Structure

src/
│
├── assets/
│
├── components/
│   ├── common/
│   ├── layout/
│   ├── workspace/
│   ├── folder/
│   ├── page/
│   └── ai/
│
├── pages/
│   ├── Login/
│   ├── Register/
│   ├── Home/
│   ├── Workspace/
│   ├── PageEditor/
│   └── AIChat/
│
├── services/
│   ├── api.js
│   ├── auth.service.js
│   ├── workspace.service.js
│   ├── folder.service.js
│   ├── page.service.js
│   └── ai.service.js
│
├── hooks/
│   ├── useAuth.js
│   ├── useWorkspace.js
│   ├── useFolders.js
│   ├── usePages.js
│   └── useAI.js
│
├── context/
│   └── AuthContext.jsx
│
├── routes/
│   └── AppRoutes.jsx
│
├── utils/
│
├── constants/
│
├── styles/
│   └── globals.css
│
├── App.jsx
└── main.jsx

Keep the structure simple.
Do not create folders until they are actually needed.

---

## 6. API / UI Separation

STRICT RULE:

UI components must NOT directly call Axios or fetch.

Never:

Component
    ↓
axios.get(...)

Instead:

Component
    ↓
Custom Hook
    ↓
Service
    ↓
Axios
    ↓
Backend API

Example:

PageEditor.jsx
    ↓
usePages()
    ↓
page.service.js
    ↓
api.js
    ↓
Backend

---

## 7. API Layer

Create ONE central Axios instance.

`services/api.js` handles:

- Base URL
- credentials/auth configuration
- common headers
- common API errors
- authentication errors

Resource-specific API logic belongs in:

auth.service.js
workspace.service.js
folder.service.js
page.service.js
ai.service.js

Example responsibilities:

page.service.js:
- getPages()
- getPage()
- createPage()
- updatePage()
- deletePage()

The service should contain API communication only.

Do not put UI logic inside services.

---

## 8. Custom Hooks

Hooks connect UI with API/data logic.

Example:

usePages()

handles:

- loading
- error
- page data
- API actions
- refresh/update state

Components should mainly consume:

data
loading
error
actions

Do not put large business workflows directly inside JSX.

---

## 9. Authentication

Auth state is global.

`AuthContext` handles:

- current user
- login
- logout
- Google authentication
- authentication status
- auth loading state

Protected routes:

- Home
- Workspace
- Page Editor
- AI Chat

Frontend authentication is only for UI/access control.

Backend remains responsible for actual authentication and authorization.

---

## 10. Workspace Tree

The UI must support:

Workspace
│
├── Folder
│   ├── Page
│   ├── Page
│   │
│   └── Folder
│       ├── Page
│       └── Page
│
├── Folder
│   └── Page
│
└── Page

Keep tree-building logic separate from visual components.

Example:

utils/
└── treeUtils.js

Tree UI should be reusable:

FolderTree
├── FolderNode
└── PageNode

Folders must support:

- expand
- collapse
- nested folders
- page navigation

---

## 11. Component Architecture

Components should have ONE clear responsibility.

Avoid giant components such as:

Workspace.jsx
- API calls
- authentication
- tree building
- modal logic
- page editing
- sidebar rendering

Prefer:

WorkspacePage
├── WorkspaceSidebar
├── WorkspaceHeader
├── FolderTree
├── FolderNode
├── PageNode
└── RecentPages

Reuse components when reuse is actually needed.

Do NOT create components for every tiny element.

---

## 12. State Management

Use the simplest solution.

Use:

- useState
- useReducer
- Context API

Use local state for local UI.

Use Context only for genuinely global state such as authentication.

Do not put every piece of application data into global state.

Do not duplicate server data unnecessarily.

---

## 13. Routing

Use React Router.

Main routes:

/login
/register
/
/workspace/:workspaceId
/page/:pageId
/ai

Protected routes should require authentication.

Keep routing logic inside:

routes/AppRoutes.jsx

---

## 14. Tailwind Rules

Tailwind CSS is the primary styling system.

Use:

- Tailwind utility classes
- global CSS only for truly global/base styles

Do NOT use CSS Modules unless there is a specific reason.

Do NOT create separate CSS files for every component.

Do NOT use inline styles unless dynamically required.

---

## 15. Design System

MNEME should feel:

- Apple-inspired
- Notion-inspired
- Minimal
- Premium
- Calm
- Spacious

Visual direction:

- Light mode first
- White / soft-gray backgrounds
- Purple primary accent
- Soft borders
- Rounded cards
- Pill-shaped controls
- Subtle shadows
- Clean typography
- Generous spacing
- Restrained animations

Avoid:

- Excessive gradients
- Neon colors
- Excessive glassmorphism
- Heavy shadows
- Overly colorful dashboards
- Excessive animations
- Dense enterprise UI

The UI should feel like a focused knowledge/productivity application.

---

## 16. Responsive Design

Every screen must work on:

- Desktop
- Tablet
- Mobile

Sidebar should collapse on smaller screens.

Do not design desktop-only layouts.

---

## 17. Loading / Error / Empty States

Every API-driven screen must handle:

Loading
Error
Empty
Success

Examples:

Loading → Skeleton
Error → Clear message + retry
Empty → Useful empty state
Success → Actual content

Never leave a blank screen while waiting for an API.

---

## 18. Naming Conventions

Components:

PascalCase

Example:
WorkspaceSidebar.jsx

Hooks:

camelCase with `use`

Example:
useWorkspace.js

Services:

resource.service.js

Example:
workspace.service.js

Utilities:

camelCase

Example:
treeUtils.js

Constants:

UPPER_SNAKE_CASE

---

## 19. Coding Rules

- Keep functions small.
- Keep logic readable.
- Avoid deeply nested logic.
- Avoid unnecessary abstractions.
- Do not duplicate API logic.
- Do not duplicate UI logic.
- Keep business logic out of JSX.
- Keep API logic out of components.
- Reuse existing code before creating new code.
- Do not silently swallow errors.
- Do not add dependencies without a clear reason.
- Do not rewrite working architecture for a small feature.

Prefer simple, boring code that is easy to debug.

---

## 20. AI Coding Rules

Before changing code:

1. Inspect the existing architecture.
2. Understand existing services/hooks/components.
3. Reuse existing functionality.
4. Preserve existing API contracts.
5. Make the smallest reasonable change.
6. Do not introduce unnecessary libraries.
7. Do not create duplicate components.
8. Do not move API logic into UI.
9. Do not move business logic into presentation components.
10. Keep changes modular.

Never invent backend endpoints.

Use the existing backend API contract.

---

## 21. Feature Implementation Pattern

For most features:

API Service
    ↓
Custom Hook
    ↓
Page / Container
    ↓
Reusable Components
    ↓
UI

Example:

Create Page:

page.service.js
    ↓
usePages.js
    ↓
PageEditor.jsx
    ↓
Editor / Toolbar / Sidebar

---

## 22. Current Frontend Screens

Initial frontend:

1. Login
2. Register
3. Home
4. Workspace
5. Page Editor
6. AI Chat

Do NOT add UI for backend functionality that does not exist.

Do not invent:

- Collaboration
- Real-time editing
- Version history
- Knowledge graph
- Flashcards
- Quizzes
- Web search
- Advanced permissions

until the backend supports them.

---

## 23. Main User Flows

### Authentication

Login / Google Login
    ↓
Backend Authentication
    ↓
Authenticated User
    ↓
Home

### Workspace

Home
    ↓
Select Workspace
    ↓
Workspace Tree
    ↓
Folder
    ↓
Page

### Page

Page
    ↓
Editor
    ↓
Save / Update
    ↓
Backend API
    ↓
MongoDB

### AI

User Question
    ↓
AI Chat
    ↓
Backend AI API
    ↓
RAG / Retrieval
    ↓
LLM
    ↓
Response
    ↓
React UI

---

## 24. Product Principle

MNEME is a knowledge workspace FIRST and an AI application SECOND.

The notes should remain useful without AI.

AI should enhance the user's knowledge rather than dominate the interface.

Core experience:

Create
    ↓
Organize
    ↓
Read
    ↓
Search
    ↓
Ask AI

Keep the product simple, focused and fast.

---

## 25. Final Rule

Do not over-engineer MNEME.

Architecture should make future features easier, not make current features harder.

Before adding abstraction, ask:

"Do we actually need this?"

If not, keep the code simple.