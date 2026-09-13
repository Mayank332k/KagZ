# NOEMA Backend API Documentation (LLM-Ready)

This document is designed for AI assistants and frontend developers to understand the complete NOEMA backend contract. The API follows RESTful conventions and uses JSON.

## Global Rules & Authentication
- **Base URL:** `http://localhost:5001/api`
- **Authentication:** The backend uses `httpOnly` cookies to store JWTs. Therefore, the frontend Axios client MUST be configured with `withCredentials: true`. No `Authorization` headers are needed manually.
- **Response Format:** All endpoints return a JSON object with a `success` boolean.
  - Success: `{ "success": true, ...data }`
  - Error: `{ "success": false, "message": "Error details" }`

---

## 1. Authentication (`/api/auth`)

### 1.1 Google Login
- **Endpoint:** `POST /auth/google`
- **Request Body:** `{ "token": "eyJ..." }` *(Must be a valid Google JWT ID Token, NOT an access token)*
- **Response (200/201):**
  ```json
  {
    "success": true,
    "token": "jwt_token_string",
    "user": { "_id": "...", "username": "...", "email": "...", "avatar": "...", "authProvider": "google" }
  }
  ```
  *(Note: A cookie named `token` is automatically set by the server).*

### 1.2 Get Current User
- **Endpoint:** `GET /auth/me`
- **Response (200):** `{ "success": true, "user": { ... } }`

### 1.3 Logout
- **Endpoint:** `POST /auth/logout`
- **Response (200):** `{ "success": true, "message": "Logged out successfully" }`

---

## 2. Workspaces (`/api/workspaces`)

### 2.1 Get All User Workspaces
- **Endpoint:** `GET /workspaces`
- **Response (200):** `{ "success": true, "workspaces": [ { "_id": "...", "name": "...", "isFavorite": false, "owner": { "_id": "...", "username": "..." } } ] }`

### 2.2 Create Workspace
- **Endpoint:** `POST /workspaces`
- **Request Body:** `{ "name": "My Workspace" }`
- **Response (201):** `{ "success": true, "workspace": { ... } }`

### 2.3 Update Workspace
- **Endpoint:** `PUT /workspaces/:id`
- **Request Body (Partial updates allowed):** 
  ```json
  { 
    "name": "Updated Name",
    "isFavorite": true 
  }
  ```
- **Response (200):** `{ "success": true, "workspace": { ... } }`

### 2.4 Delete Workspace
- **Endpoint:** `DELETE /workspaces/:id`
- **Response (200):** `{ "success": true, "message": "Workspace removed" }`
*(Cascades deletion to all folders, pages, and vectors).*

---

## 3. Folders (`/api/folders`)

### 3.1 Get Folders in Workspace
- **Endpoint:** `GET /folders/workspace/:workspaceId?parentId=null`
- **Query Params:** 
  - `parentId` (Optional). If omitted or `"null"`, returns root folders. If provided, returns sub-folders inside that parent.
- **Response (200):** `{ "success": true, "folders": [ ... ] }`

### 3.2 Create Folder
- **Endpoint:** `POST /folders`
- **Request Body:**
  ```json
  { 
    "name": "Project X", 
    "workspaceId": "...", 
    "parentId": null 
  }
  ```
- **Response (201):** `{ "success": true, "folder": { ... } }`

### 3.3 Update Folder
- **Endpoint:** `PUT /folders/:id`
- **Request Body (Partial allowed):** `{ "name": "New Name", "isFavorite": true }`
- **Response (200):** `{ "success": true, "folder": { ... } }`

### 3.4 Delete Folder
- **Endpoint:** `DELETE /folders/:id`
- **Response (200):** `{ "success": true, "message": "Folder removed" }`

---

## 4. Pages (Notes) (`/api/pages`)

### 4.1 Search Pages (Regex Match)
- **Endpoint:** `GET /pages/search?q=keyword&workspaceId=...`
- **Query Params:**
  - `q` (Required): The search keyword.
  - `workspaceId` (Required): Scopes the search to this workspace.
- **Response (200):** `{ "success": true, "pages": [ { "_id": "...", "title": "...", "content": "..." } ] }`

### 4.2 Get Pages in Workspace
- **Endpoint:** `GET /pages/workspace/:workspaceId?folderId=null`
- **Query Params:** 
  - `folderId` (Optional). If omitted or `"null"`, returns root pages.
- **Response (200):** `{ "success": true, "pages": [ ... ] }`

### 4.2 Get Single Page
- **Endpoint:** `GET /pages/:id`
- **Response (200):** `{ "success": true, "page": { "_id": "...", "title": "...", "content": "...", "type": "document", "isFavorite": false, "workspaceId": "..." } }`

### 4.3 Create Page
- **Endpoint:** `POST /pages`
- **Request Body:**
  ```json
  {
    "title": "Meeting Notes",
    "content": "Raw markdown or text...",
    "type": "document",
    "workspaceId": "...",
    "folderId": null 
  }
  ```
  *(Note: `type` can be `document` or `code`. Defaults to `document`).*
- **Response (201):** `{ "success": true, "page": { ... } }`

### 4.4 Update Page
- **Endpoint:** `PUT /pages/:id`
- **Request Body (Partial allowed):** 
  ```json
  { 
    "title": "Updated Title", 
    "content": "Updated content", 
    "type": "code",
    "folderId": "...", 
    "isFavorite": true 
  }
  ```
- **Response (200):** `{ "success": true, "page": { ... } }`
*(Note: Updating content triggers background embedding sync).*

### 4.5 Delete Page
- **Endpoint:** `DELETE /pages/:id`
- **Response (200):** `{ "success": true, "message": "Page removed" }`

---

## 5. Tasks (`/api/tasks`)

### 5.1 Get Workspace Tasks
- **Endpoint:** `GET /tasks/workspace/:workspaceId`
- **Response (200):** `{ "success": true, "tasks": [ ... ] }`

### 5.2 Create Task
- **Endpoint:** `POST /tasks`
- **Request Body:**
  ```json
  {
    "title": "Buy groceries",
    "description": "Optional details",
    "status": "todo",
    "workspaceId": "..."
  }
  ```
  *(Status options: `todo`, `in_progress`, `completed`. Defaults to `todo`).*
- **Response (201):** `{ "success": true, "task": { ... } }`

### 5.3 Update Task
- **Endpoint:** `PUT /tasks/:id`
- **Request Body (Partial allowed):** `{ "title": "...", "description": "...", "status": "completed" }`
- **Response (200):** `{ "success": true, "task": { ... } }`

### 5.4 Delete Task
- **Endpoint:** `DELETE /tasks/:id`
- **Response (200):** `{ "success": true, "message": "Task removed" }`

---

## 6. AI Chat (RAG) (`/api/chat`)

### 6.1 Ask Question (SSE Stream)
> **CRITICAL FRONTEND RULE:** This is a Server-Sent Events (SSE) endpoint. You **CANNOT** use standard `axios.post` to read the response. You must use the native `fetch` API to read the stream chunks (`response.body.getReader()`).

- **Endpoint:** `POST /chat/ask`
- **Headers:** `Content-Type: application/json`
- **Request Body:** `{ "query": "What are my notes on React?", "sessionId": "frontend-generated-uuid" }`
- **Stream Format:**
  1. `data: {"type":"sources","data":[{"pageId":"...","title":"React Notes","workspaceId":"..."}]}\n\n` *(Sent immediately)*
  2. `data: {"type":"content","data":"React "}\n\n` *(Sent word by word)*
  3. `data: {"type":"done"}\n\n` *(Sent at the end)*

### 6.2 Get Chat History
- **Endpoint:** `GET /chat/history/:sessionId`
- **Response (200):** 
  ```json
  {
    "success": true,
    "messages": [
      { "role": "user", "content": "What is React?", "createdAt": "..." },
      { "role": "assistant", "content": "React is a...", "sources": [{ "title": "...", "pageId": "..." }], "createdAt": "..." }
    ]
  }
  ```

### 6.3 Clear Chat History
- **Endpoint:** `DELETE /chat/history/:sessionId`
- **Response (200):** `{ "success": true, "message": "Chat history cleared" }`
