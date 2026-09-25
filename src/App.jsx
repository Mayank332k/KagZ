import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { EditorProvider } from './context/EditorContext';
import { ToastProvider } from './context/ToastContext';

import { ProtectedRoute } from './components/ProtectedRoute';
import MobileOverlay from './components/UI/MobileOverlay';

import { ThemeProvider } from 'next-themes';

const Login = lazy(() => import('./pages/Login/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Home = lazy(() => import('./pages/Home/Home'));
const Workspace = lazy(() => import('./pages/Workspace/Workspace'));
const Tasks = lazy(() => import('./pages/Tasks/Tasks'));
const NoteEditor = lazy(() => import('./components/Editor/NoteEditor'));
const AIChat = lazy(() => import('./components/Chat/AIChat'));

const RouteLoader = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[40vh]">
    <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-800 dark:border-t-white rounded-full animate-spin" />
  </div>
);

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <Suspense fallback={<RouteLoader />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Suspense fallback={<RouteLoader />}>
          <Dashboard />
        </Suspense>
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<RouteLoader />}>
            <Home />
          </Suspense>
        ),
      },
      {
        path: "chat",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <AIChat />
          </Suspense>
        ),
      },
      {
        path: "page/:pageId",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <NoteEditor />
          </Suspense>
        ),
      },
      {
        path: "editor/:pageId",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <NoteEditor />
          </Suspense>
        ),
      },
      {
        path: "workspace/:workspaceId",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <Workspace />
          </Suspense>
        ),
      },
      {
        path: "tasks",
        element: (
          <Suspense fallback={<RouteLoader />}>
            <Tasks />
          </Suspense>
        ),
      },
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
