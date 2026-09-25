import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { EditorProvider } from './context/EditorContext';
import { ToastProvider } from './context/ToastContext';

import { DashboardRoute } from './pages/Dashboard/Dashboard';
import Home from './pages/Home/Home';
import Workspace from './pages/Workspace/Workspace';
import Tasks from './pages/Tasks/Tasks';
import NoteEditor from './components/Editor/NoteEditor';
import AIChat from './components/Chat/AIChat';
import { ProtectedRoute } from './components/ProtectedRoute';
import MobileOverlay from './components/UI/MobileOverlay';

import { ThemeProvider } from 'next-themes';

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardRoute />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: "chat", element: <AIChat /> },
      { path: "page/:pageId", element: <NoteEditor /> },
      { path: "editor/:pageId", element: <NoteEditor /> },
      { path: "workspace/:workspaceId", element: <Workspace /> },
      { path: "tasks", element: <Tasks /> },
    ],
  },
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "*", element: <Navigate to="/dashboard" replace /> },
]);

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <GoogleOAuthProvider clientId={import.meta.env.Config_GOOGLE_CLIENT_ID}>
        <ToastProvider>
          <AuthProvider>
            <ChatProvider>
              <EditorProvider>
                <MobileOverlay />
                <RouterProvider router={router} />
              </EditorProvider>
            </ChatProvider>
          </AuthProvider>
        </ToastProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  )
}

export default App;
